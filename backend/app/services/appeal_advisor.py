"""
CareAudit AI - Appeal Advisor
Rule-based analyst that tells the nurse whether an appeal should be
OVERTURNED (reverse the denial, grant inpatient care) or UPHELD (denial stands),
with a confidence score and a full, evidence-linked rationale.

Mirrors the prior-auth `ai_deep_analysis` produced in nurse_workspace.get_workspace_data,
but framed for the appeal decision (Overturn vs Uphold) instead of Approve vs Deny.

Evidence is pulled, in priority order, from:
  1. the linked prior-auth case's structured_case (vitals / labs / clinical summary)
  2. regex parsing of the appeal's key_evidence_cited + clinical_rationale_provided text
"""
from __future__ import annotations
import json
import re
from typing import Optional


def _to_float(v) -> Optional[float]:
    try:
        if v is None or v == "":
            return None
        return float(str(v).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _parse_evidence_text(text: str) -> dict:
    """Best-effort extraction of vitals/labs from free text (key_evidence_cited / rationale)."""
    out: dict = {}
    if not text:
        return out
    t = text

    def grab(pattern: str, key: str) -> None:
        m = re.search(pattern, t, re.IGNORECASE)
        if m:
            try:
                out[key] = float(m.group(1).replace(",", ""))
            except (ValueError, TypeError):
                pass

    grab(r"(?:BP|blood\s*pressure)[:\s]*(\d{2,3})\s*(?:/|over)\s*\d{2,3}", "sbp")
    grab(r"(?:temp(?:erature)?)[:\s]*(\d{2,3}\.?\d*)", "temp")
    grab(r"(?:HR|heart\s*rate|pulse)[:\s]*(\d{2,3})", "hr")
    grab(r"(?:RR|resp(?:iratory)?\s*rate)[:\s]*(\d{1,2})", "rr")
    grab(r"(?:O2\s*sat|SpO2|oxygen\s*sat(?:uration)?)[:\s]*(\d{2,3})", "o2_sat")
    grab(r"(?:lactate)[:\s]*(\d+\.?\d*)", "lactate")
    grab(r"(?:WBC|white\s*blood\s*cell)[:\s]*(\d+\.?\d*)", "wbc")
    grab(r"(?:creatinine|Cr)[:\s]*(\d+\.?\d*)", "creatinine")
    grab(r"(?:BNP)[:\s]*([\d,]+\.?\d*)", "bnp")
    grab(r"(?:troponin)[:\s]*(\d+\.?\d*)", "troponin")
    grab(r"(?:procalcitonin|PCT)[:\s]*(\d+\.?\d*)", "procalcitonin")
    grab(r"(?:EF|ejection\s*fraction)[:\s]*(\d{1,2})", "ef")
    grab(r"(?:pH)[:\s]*(\d\.\d{1,2})", "ph")
    grab(r"(?:pCO2|PaCO2)[:\s]*(\d{2,3}\.?\d*)", "pco2")
    return out


def _collect_evidence(appeal: dict, case: Optional[dict]) -> tuple[dict, str, list[str]]:
    """Return (values, source_label, notes) merging the linked case + appeal text."""
    values: dict = {}
    notes: list[str] = []
    source = "appeal narrative"

    case = case or {}
    structured = None
    sc = case.get("structured_case")
    if isinstance(sc, str):
        try:
            sc = json.loads(sc)
        except Exception:
            sc = None
    structured = sc if isinstance(sc, dict) else None

    if structured:
        source = f"linked case {case.get('case_number') or case.get('id', '')}".strip()
        v = structured.get("vitals", {}) or {}
        l = structured.get("labs", {}) or {}
        bp = v.get("bp") or v.get("blood_pressure")
        if isinstance(bp, str) and "/" in bp:
            values["sbp"] = _to_float(bp.split("/")[0])
        for k_src, k_dst in [("temp", "temp"), ("hr", "hr"), ("rr", "rr"), ("o2_sat", "o2_sat")]:
            if v.get(k_src) is not None:
                values[k_dst] = _to_float(v.get(k_src))
        for k in ("wbc", "lactate", "creatinine", "bnp", "troponin", "procalcitonin", "ef", "ph", "pco2"):
            if l.get(k) is not None:
                values[k] = _to_float(l.get(k))

    # Fill any gaps from the appeal free text
    text_vals = _parse_evidence_text(
        f"{appeal.get('key_evidence_cited', '')}\n{appeal.get('clinical_rationale_provided', '')}"
    )
    for k, val in text_vals.items():
        if values.get(k) is None and val is not None:
            values[k] = val
            if structured:
                notes.append(f"{k} taken from appeal text (not in linked case)")

    # Drop keys that ended up None
    values = {k: v for k, v in values.items() if v is not None}
    return values, source, notes


def _diagnosis_bucket(appeal: dict, case: Optional[dict]) -> str:
    cat = (appeal.get("diagnosis_category") or "").lower()
    dx = (appeal.get("primary_diagnosis_display") or (case or {}).get("primary_diagnosis_display") or "").lower()
    pol = (appeal.get("policy_referenced") or "").upper()
    blob = f"{cat} {dx} {pol}"
    if any(s in blob for s in ("infect", "sepsis", "sep-", "sepsis-001")):
        return "SEPSIS"
    if any(s in blob for s in ("cardio", "heart failure", "chf", "chf-", "card-")):
        return "CHF"
    if any(s in blob for s in ("respir", "copd", "copd-")):
        return "COPD"
    return "GENERAL"


def _evaluate_criteria(bucket: str, ev: dict) -> list[dict]:
    """Return list of {criterion, status(MET/NOT_MET/UNKNOWN), evidence, threshold}."""
    C: list[dict] = []

    def crit(name, threshold, present, met, got):
        if not present:
            C.append({"criterion": name, "status": "UNKNOWN", "threshold": threshold,
                      "evidence": "Not documented in the appeal or linked case."})
        else:
            C.append({"criterion": name, "status": "MET" if met else "NOT_MET",
                      "threshold": threshold, "evidence": got})

    if bucket == "SEPSIS":
        la = ev.get("lactate"); crit("Elevated lactate (tissue hypoperfusion)", "Lactate >= 2.0 mmol/L",
                                     la is not None, la is not None and la >= 2.0, f"Lactate {la} mmol/L")
        sbp = ev.get("sbp"); crit("Persistent hypotension", "Systolic BP < 90 mmHg",
                                  sbp is not None, sbp is not None and sbp < 90, f"Systolic BP {sbp} mmHg")
        wbc = ev.get("wbc"); crit("Leukocytosis / leukopenia (SIRS)", "WBC > 12 or < 4 K/uL",
                                  wbc is not None, wbc is not None and (wbc > 12 or wbc < 4), f"WBC {wbc} K/uL")
        tmp = ev.get("temp"); crit("Fever (systemic inflammatory response)", "Temp > 100.4 F",
                                   tmp is not None, tmp is not None and tmp > 100.4, f"Temp {tmp} F")
        pct = ev.get("procalcitonin"); crit("Elevated procalcitonin (bacterial infection marker)", "PCT > 0.15 ng/mL",
                                            pct is not None, pct is not None and pct > 0.15, f"Procalcitonin {pct} ng/mL")
    elif bucket == "CHF":
        o2 = ev.get("o2_sat"); crit("Hypoxemia", "O2 sat < 90% on room air",
                                    o2 is not None, o2 is not None and o2 < 90, f"O2 sat {o2}%")
        bnp = ev.get("bnp"); crit("Elevated BNP (myocardial wall stress)", "BNP > 500 pg/mL",
                                  bnp is not None, bnp is not None and bnp > 500, f"BNP {bnp} pg/mL")
        ef = ev.get("ef"); crit("Reduced ejection fraction", "EF < 40%",
                                ef is not None, ef is not None and ef < 40, f"EF {ef}%")
        tn = ev.get("troponin"); crit("Myocardial injury", "Troponin > 0.04 ng/mL",
                                      tn is not None, tn is not None and tn > 0.04, f"Troponin {tn} ng/mL")
    elif bucket == "COPD":
        o2 = ev.get("o2_sat"); crit("Severe hypoxemia", "O2 sat < 88% on room air",
                                    o2 is not None, o2 is not None and o2 < 88, f"O2 sat {o2}%")
        ph = ev.get("ph"); crit("Respiratory acidosis", "ABG pH < 7.35",
                                ph is not None, ph is not None and ph < 7.35, f"pH {ph}")
        pco2 = ev.get("pco2"); crit("Hypercapnia / failed outpatient therapy", "pCO2 > 50 mmHg",
                                    pco2 is not None, pco2 is not None and pco2 > 50, f"pCO2 {pco2} mmHg")
    else:  # GENERAL
        o2 = ev.get("o2_sat"); crit("Active monitoring required", "O2 sat < 93%",
                                    o2 is not None, o2 is not None and o2 < 93, f"O2 sat {o2}%")
        sbp = ev.get("sbp"); crit("Hemodynamic instability", "Systolic BP < 90 mmHg",
                                  sbp is not None, sbp is not None and sbp < 90, f"Systolic BP {sbp} mmHg")
        cr = ev.get("creatinine"); crit("Acute organ dysfunction (renal)", "Creatinine > 1.5 mg/dL",
                                        cr is not None, cr is not None and cr > 1.5, f"Creatinine {cr} mg/dL")
    return C


_POLICY_NAME = {
    "SEPSIS": "Sepsis & Severe Infection Inpatient Admission Guidelines",
    "CHF": "Acute Congestive Heart Failure Inpatient Admission Guidelines",
    "COPD": "Acute COPD Exacerbation Inpatient Admission Guidelines",
    "GENERAL": "Observation vs Inpatient Admission Determination Guidelines",
}


def analyze_appeal(appeal: dict, case: Optional[dict] = None,
                   original_decision: Optional[dict] = None,
                   appeal_risk: Optional[dict] = None) -> dict:
    """Produce the AI appeal recommendation payload."""
    ev, source, notes = _collect_evidence(appeal, case)
    bucket = _diagnosis_bucket(appeal, case)
    criteria = _evaluate_criteria(bucket, ev)

    met = [c for c in criteria if c["status"] == "MET"]
    not_met = [c for c in criteria if c["status"] == "NOT_MET"]
    unknown = [c for c in criteria if c["status"] == "UNKNOWN"]
    n_known = len(met) + len(not_met)
    met_ratio = (len(met) / n_known) if n_known else 0.0
    # "3 of the core criteria" is the inpatient bar used by the policy engine;
    # for appeals we require a majority of the *known* criteria to be met.
    required = 2 if len(criteria) <= 3 else 3

    patient = appeal.get("patient_name") or (case or {}).get("patient_name") or "the patient"
    dx = appeal.get("primary_diagnosis_display") or appeal.get("diagnosis_category") or "the presenting condition"
    policy_ref = appeal.get("policy_referenced") or "the applicable UM policy"
    policy_name = _POLICY_NAME.get(bucket, "Utilization Management Guidelines")
    disputed = appeal.get("financial_amount_disputed") or 0.0

    # -- Recommendation -------------------------------------------------------
    # Three outcomes: OVERTURN (evidence clears the bar), UPHOLD (evidence
    # falls short), REVIEW (too few criteria could be verified to decide).
    overturn = len(met) >= required and met_ratio >= 0.5
    insufficient = (not overturn) and n_known < required and len(not_met) == 0

    # Confidence: criteria margin + evidence completeness + risk-model agreement
    conf = 0.55
    conf += min(len(met), 4) * 0.08 if overturn else min(len(not_met), 4) * 0.06
    completeness = n_known / max(len(criteria), 1)
    conf += 0.12 * completeness
    if unknown:
        conf -= 0.05 * min(len(unknown), 3)
    risk_prob = None
    if appeal_risk and appeal_risk.get("overturn_probability") is not None:
        risk_prob = float(appeal_risk["overturn_probability"])
        # agreement between this rule engine and the stored appeal-risk model
        if overturn and risk_prob >= 0.5:
            conf += 0.06
        elif not overturn and risk_prob < 0.5:
            conf += 0.06
        else:
            conf -= 0.06
    if insufficient:
        confidence = round(max(0.30, min(conf - 0.15, 0.55)), 2)
        rec = "REVIEW"
    else:
        confidence = round(max(0.5, min(conf, 0.95)), 2)
        rec = "OVERTURN" if overturn else "UPHOLD"

    # -- Narrative -----------------------------------------------------------
    met_phrases = "; ".join(f"{c['criterion']} - {c['evidence']}" for c in met) or "none"
    notmet_phrases = "; ".join(f"{c['criterion']} ({c['threshold']}) - {c['evidence']}" for c in not_met) or "none"
    unknown_phrases = ", ".join(c["criterion"] for c in unknown) or "none"

    if insufficient:
        recommendation_text = (
            f"MANUAL REVIEW NEEDED. Only {n_known} of {len(criteria)} inpatient criteria under "
            f"{policy_name} ({policy_ref}) could be scored from the structured data available - "
            f"not enough to recommend overturning or upholding. Read the appeal narrative and the "
            f"attached source records, then decide."
        )
        risk_if_overturned = (
            f"Unquantified. The key values ({unknown_phrases}) are not in structured form, so the "
            f"overturn risk cannot be scored. Do not overturn without confirming the clinical "
            f"thresholds from the source documents."
        )
        risk_if_upheld = (
            f"Unquantified. Upholding without scoring the criteria could be reversed on escalation "
            f"if the narrative in fact supports admission. Confirm the values in {unknown_phrases} "
            f"before finalizing."
        )
    elif overturn:
        recommendation_text = (
            f"Recommend OVERTURNING the denial. The clinical evidence on appeal satisfies "
            f"{len(met)} of {n_known} documented inpatient criteria under {policy_name} "
            f"({policy_ref}), which meets the admission bar. The original denial is not "
            f"supported by the documented severity."
        )
        risk_if_overturned = (
            f"Low risk. Overturning aligns with the evidence ({met_phrases}). Ensure the "
            f"determination letter cites each met criterion and the source values."
        )
        risk_if_upheld = (
            f"High risk. Upholding the denial when {len(met)} core criteria are met invites a "
            f"Level 2 / external appeal and probable reversal, with financial exposure on the "
            f"${disputed:,.0f} disputed. The documented instability would likely support the "
            f"provider on escalation."
        )
    else:
        recommendation_text = (
            f"Recommend UPHOLDING the denial. Only {len(met)} of {n_known} documented inpatient "
            f"criteria under {policy_name} ({policy_ref}) are met, below the admission bar. "
            f"The appeal does not add evidence that changes the original determination."
        )
        risk_if_overturned = (
            f"Elevated risk. Overturning without meeting the criteria ({notmet_phrases}) may "
            f"trigger an audit finding for insufficient medical necessity and sets an "
            f"inconsistent precedent for similar {dx} appeals."
        )
        risk_if_upheld = (
            f"Low risk. The denial is consistent with the criteria assessment "
            f"({len(met)}/{n_known} met). State clearly which criteria were not met and what "
            f"additional documentation would change the outcome."
        )

    p1 = (
        f"{patient} is appealing a denial of inpatient admission for {dx}. Evidence for this "
        f"analysis was drawn from {source}"
        + (f" (with {len(notes)} value(s) supplemented from the appeal narrative)." if notes else ".")
    )
    p2 = (
        f"Measured against {policy_name}, {len(met)} criteria are MET ({met_phrases}); "
        f"{len(not_met)} are NOT met ({notmet_phrases}); "
        f"{len(unknown)} could not be evaluated for lack of data ({unknown_phrases})."
    )
    if risk_prob is not None:
        agree = (rec == "OVERTURN" and risk_prob >= 0.5) or (rec == "UPHOLD" and risk_prob < 0.5)
        p3 = (
            f"The stored appeal-risk model estimates a {int(risk_prob * 100)}% overturn probability, "
            f"which {'agrees with' if agree else 'diverges from'} this criteria-based read. "
            f"Overall confidence in the recommendation is {int(confidence * 100)}%."
        )
    else:
        p3 = (
            f"No prior appeal-risk score was on file for this case; the recommendation rests on the "
            f"criteria assessment above. Overall confidence is {int(confidence * 100)}%."
        )
    clinical_analysis = f"{p1}\n\n{p2}\n\n{p3}"

    if insufficient:
        policy_explanation = (
            f"{policy_name} ({policy_ref}) requires the patient to meet the core clinical criteria "
            f"for inpatient-level care. Only {n_known} of {len(criteria)} criteria could be scored "
            f"from the available structured data, so no automated determination is made - a nurse "
            f"must review the source records."
        )
    else:
        policy_explanation = (
            f"{policy_name} ({policy_ref}) requires the patient to meet the core clinical criteria for "
            f"inpatient-level care. On appeal, {len(met)} of {n_known} evaluated criteria are satisfied "
            f"(bar for admission: {required}). "
            + ("This clears the bar, so the denial should be reversed."
               if overturn else
               "This is below the bar, so the denial stands unless further documentation is supplied.")
        )

    nurse_actions: list[str] = []
    if original_decision and original_decision.get("rationale"):
        nurse_actions.append(
            "Compare the appeal evidence against the original denial rationale to confirm whether "
            "new or previously-overlooked data is being presented."
        )
    if unknown:
        nurse_actions.append(
            f"Obtain and confirm the values not in the record: {unknown_phrases}."
        )
    if insufficient:
        nurse_actions.append(
            "Read the full appeal narrative and attached source documents (ED note, labs, imaging, "
            "flow sheets) and score each policy criterion by hand before deciding."
        )
        nurse_actions.append(
            "If the narrative clearly supports admission, overturn and cite the specific values; "
            "otherwise uphold and state the documentation gap."
        )
    elif overturn:
        nurse_actions.append(
            "If overturning, write a rationale that names each met criterion with its measured value "
            f"and cites {policy_ref}."
        )
        nurse_actions.append("Confirm the disputed amount and route for retroactive authorization.")
    else:
        nurse_actions.append(
            "If upholding, state each unmet criterion, the required threshold, and the documentation "
            "gap; offer the provider a peer-to-peer review."
        )
    nurse_actions.append(
        "Verify the cited vitals/labs match the source records (ED note, flow sheet, lab report) "
        "attached to the appeal."
    )

    rec_label = {"OVERTURN": "Overturn Denial", "UPHOLD": "Uphold Denial",
                 "REVIEW": "Manual Review Needed"}[rec]

    return {
        "recommendation": rec,                       # OVERTURN | UPHOLD | REVIEW
        "recommendation_label": rec_label,
        "confidence": confidence,
        "recommendation_text": recommendation_text,
        "clinical_analysis": clinical_analysis,
        "policy_name": policy_name,
        "policy_referenced": policy_ref,
        "criteria": criteria,
        "criteria_met_count": len(met),
        "criteria_evaluated_count": n_known,
        "criteria_required": required,
        "supporting_findings": [f"{c['criterion']}: {c['evidence']}" for c in met],
        "gaps": [f"{c['criterion']} - needs {c['threshold']} (have: {c['evidence']})" for c in not_met]
        + [f"{c['criterion']} - not documented" for c in unknown],
        "risk_if_overturned": risk_if_overturned,
        "risk_if_upheld": risk_if_upheld,
        "policy_explanation": policy_explanation,
        "nurse_actions": nurse_actions,
        "evidence_source": source,
        "evidence_values": ev,
        "appeal_risk_overturn_probability": risk_prob,
    }

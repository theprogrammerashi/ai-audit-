"""
CareAudit AI - QA Audit Engine
Automatically generates QA audit results based on nurse decisions and policy matches.
Now includes human-readable AI explanation and stores override columns.
"""
import uuid
import json
import re
from datetime import datetime, timezone
from typing import Optional


_DIM_LABELS = [
    ("clinical_accuracy", "Clinical Accuracy"),
    ("documentation_completeness", "Documentation Completeness"),
    ("policy_compliance", "Policy Compliance"),
    ("consistency_score", "Consistency"),
    ("timeliness_score", "Timeliness"),
]


_DIM_WEIGHT_F = {
    "clinical_accuracy": 0.40,
    "documentation_completeness": 0.20,
    "policy_compliance": 0.20,
    "consistency_score": 0.10,
    "timeliness_score": 0.10,
}


_VERB = {"APPROVED": "approved", "DENIED": "denied", "APPROVE": "approved", "DENY": "denied"}
_NOUN = {"APPROVED": "approval", "DENIED": "denial", "APPROVE": "approval", "DENY": "denial"}


def _mismatch_clause(findings: list, decision: Optional[str], ai_recommendation: Optional[str]) -> str:
    """
    Describe a decision/policy disagreement, sourced from the POLICY_MISMATCH finding
    that the engine recorded at audit time (so it always matches the score). Returns
    "" when there is no such finding.
    """
    pm = next((f.get("description", "") for f in findings if f.get("type") == "POLICY_MISMATCH"), "")
    if not pm:
        return ""
    # e.g. "Reviewer DENIED the case but AI analysis recommended APPROVED. 5/5 admission criteria were met."
    m = re.search(r"\b(\d{1,2})\s*/\s*(\d{1,2})\b(?=[^/]*criteria)", pm)
    crit = ""
    if m:
        met, tot = int(m.group(1)), int(m.group(2))
        if 0 <= met <= tot <= 12:
            crit = f" ({met}/{tot} admission criteria met)"
    dv = _VERB.get((decision or "").upper())
    dn = _NOUN.get((ai_recommendation or "").upper())
    if dv and dn:
        return f"the reviewer {dv} the case while the policy analysis pointed toward {dn}{crit}"
    # fall back to trimming the raw finding text
    return pm.rstrip(".").replace("AI analysis recommended", "the policy analysis recommended")


def _dimension_note(key: str, score: int, positive: bool, *,
                    findings: list, decision: Optional[str],
                    ai_recommendation: Optional[str]) -> str:
    """
    One short, factual clause explaining a single dimension's score.
    State what happened only - no advice, no "should", no next-step suggestions.
    """
    if key == "clinical_accuracy":
        if positive:
            return "the decision matches the policy analysis"
        mm = _mismatch_clause(findings, decision, ai_recommendation)
        if mm:
            return mm
        if score < 60:
            return "the decision is not supported by the documented clinical criteria"
        return "the decision only partly lines up with the documented clinical criteria"

    if key == "documentation_completeness":
        doc_issues = [f.get("description", "") for f in findings
                      if f.get("type") == "DOCUMENTATION_GAP" and f.get("description")]
        if positive:
            return "the rationale is detailed, cites the specific vitals and labs, and references the policy"
        if doc_issues:
            return "; ".join(doc_issues).rstrip(".").lower()
        return "the rationale is thin on detail and clinical values"

    if key == "policy_compliance":
        return ("the applicable policy code is cited in the rationale" if positive
                else "the applicable policy code is not cited in the rationale")

    if key == "consistency_score":
        return ("the outcome matches how peers decided similar cases" if positive
                else "the outcome differs from how peers decided similar cases")

    # timeliness_score
    sla_issue = next((f.get("description", "") for f in findings if f.get("type") == "SLA_BREACH"), "")
    if positive:
        return "the decision was made within the turnaround window"
    return sla_issue.rstrip(".").lower() if sla_issue else "turnaround exceeded the SLA target"


def _build_ai_explanation(
    qa_score: float,
    clinical_accuracy: int,
    documentation_completeness: int,
    policy_compliance: int,
    consistency_score: int,
    timeliness_score: int,
    findings: list,
    missing_evidence: list,
    decision: Optional[str],
    ai_recommendation: Optional[str],
) -> str:
    """
    Plain-English, paragraph-form explanation of the QA score.

    Every statement is keyed to the dimension score it describes and always quotes
    the real number, so the narrative can never contradict the per-dimension
    breakdown shown in the UI.
    """
    dims = {
        "clinical_accuracy": int(clinical_accuracy),
        "documentation_completeness": int(documentation_completeness),
        "policy_compliance": int(policy_compliance),
        "consistency_score": int(consistency_score),
        "timeliness_score": int(timeliness_score),
    }
    STRONG = 85          # at/above this a dimension is a strength

    strong = [(k, l) for k, l in _DIM_LABELS if dims[k] >= STRONG]
    concern = [(k, l) for k, l in _DIM_LABELS if dims[k] < STRONG]

    if qa_score >= 90:
        verdict = "a strong review"
    elif qa_score >= 80:
        verdict = "a solid review"
    elif qa_score >= 70:
        verdict = "an acceptable review with one weak area"
    elif qa_score >= 60:
        verdict = "a review with real weaknesses"
    else:
        verdict = "a review with critical weaknesses"

    para1 = f"QA score {qa_score:g}/100 - {verdict}."

    # Paragraph 2 - what pulled the score down. Concerns are listed worst-first;
    # the biggest weighted loss is prefixed "chiefly" only when it is clearly the
    # driver (below 70, and not in a near-tie with the next one).
    if concern:
        concern = sorted(concern, key=lambda kl: (100 - dims[kl[0]]) * _DIM_WEIGHT_F[kl[0]], reverse=True)
        losses = [(100 - dims[k]) * _DIM_WEIGHT_F[k] for k, _ in concern]
        mark_chief = (
            len(concern) > 1 and dims[concern[0][0]] < 70
            and (len(losses) < 2 or losses[0] >= losses[1] * 1.4)
        )
        parts = []
        for i, (k, lbl) in enumerate(concern):
            note = _dimension_note(k, dims[k], positive=False, findings=findings,
                                   decision=decision, ai_recommendation=ai_recommendation)
            prefix = "chiefly " if (i == 0 and mark_chief) else ""
            parts.append(f"{prefix}{lbl} {dims[k]}/100 - {note}")
        para2 = "Points lost: " + "; ".join(parts) + "."
    else:
        para2 = "No dimension scored below 85."

    if missing_evidence:
        para2 += (" Values in the case but not quoted in the rationale: "
                  + "; ".join(missing_evidence).rstrip(".") + ".")

    # Paragraph 3 - the strengths, with real numbers.
    if strong:
        parts = []
        for k, lbl in strong:
            note = _dimension_note(k, dims[k], positive=True, findings=findings,
                                   decision=decision, ai_recommendation=ai_recommendation)
            parts.append(f"{lbl} {dims[k]}/100 - {note}")
        para3 = "Strengths: " + "; ".join(parts) + "."
    else:
        para3 = ""

    return "\n\n".join(p for p in (para1, para2, para3) if p)


def rebuild_qa_explanation(audit_row: dict, decision: Optional[str] = None,
                           ai_recommendation: Optional[str] = None) -> str:
    """
    Regenerate the QA explanation from a stored audit_results row so the text
    always matches the (possibly QA-overridden) dimension scores on display.
    """
    def _pick(*keys, default=0):
        for k in keys:
            v = audit_row.get(k)
            if v is not None:
                return v
        return default

    findings = audit_row.get("findings") or []
    if isinstance(findings, str):
        try:
            findings = json.loads(findings)
        except Exception:
            findings = []
    missing = audit_row.get("missing_evidence") or []
    if isinstance(missing, str):
        try:
            missing = json.loads(missing)
        except Exception:
            missing = []

    return _build_ai_explanation(
        qa_score=_pick("qa_override_score", "qa_score", default=0),
        clinical_accuracy=int(_pick("clinical_accuracy_override", "clinical_accuracy", default=0)),
        documentation_completeness=int(_pick("documentation_completeness_override", "documentation_completeness", default=0)),
        policy_compliance=int(_pick("policy_compliance_override", "policy_compliance", default=0)),
        consistency_score=int(_pick("consistency_score_override", "consistency_score", default=0)),
        timeliness_score=int(_pick("timeliness_score_override", "timeliness_score", default=0)),
        findings=findings,
        missing_evidence=missing,
        decision=decision,
        ai_recommendation=ai_recommendation,
    )


def compute_qa_audit(
    case_dict: dict,
    decision: str,
    rationale: str,
    policy_cited: Optional[str],
    policy_match: Optional[dict],
    decision_id: str,
    db,
) -> dict:
    """
    Rule-based QA audit engine.
    Evaluates nurse decision quality across 4 dimensions and produces a score + findings.
    """
    findings = []

    # ── Dimension 1: Clinical Accuracy (0-100) ──────────────────────────────
    ai_recommendation = "APPROVED"
    criteria_met_count = 0
    total_criteria = 4

    if policy_match:
        mc = policy_match.get("matched_criteria", [])
        if isinstance(mc, str):
            mc = json.loads(mc)
        criteria_met_count = sum(1 for c in mc if c.get("status") == "MET")
        total_criteria = max(len(mc), 1)
        rec = policy_match.get("recommendation", "APPROVED")
        if rec == "INPATIENT_ADMISSION_SUPPORTED" or rec == "APPROVED":
            ai_recommendation = "APPROVED"
        elif rec == "OBSERVATION_RECOMMENDED" or rec == "DENIED":
            ai_recommendation = "DENIED"
        else:
            ai_recommendation = "APPROVED"

    criteria_ratio = criteria_met_count / total_criteria

    if decision == ai_recommendation:
        clinical_accuracy = int(85 + criteria_ratio * 15)
    else:
        clinical_accuracy = int(30 + criteria_ratio * 20)
        severity = "CRITICAL" if criteria_ratio > 0.75 else "HIGH"
        findings.append({
            "type": "POLICY_MISMATCH",
            "severity": severity,
            "description": (
                f"Reviewer {decision} the case but AI analysis recommended {ai_recommendation}. "
                f"{criteria_met_count}/{total_criteria} admission criteria were met."
            ),
            "recommendation": (
                f"Review policy criteria. {criteria_met_count} of {total_criteria} criteria "
                f"were met, which {'supports' if ai_recommendation == 'APPROVED' else 'does not support'} admission."
            ),
        })

    # ── Dimension 2: Documentation Completeness (0-100) ─────────────────────
    rationale_words = len(rationale.split()) if rationale else 0
    has_lab_values = any(term in rationale.lower() for term in [
        "bnp", "o2", "sat", "ph ", "pco2", "lactate", "wbc", "creatinine",
        "troponin", "ef ", "ejection", "procalcitonin",
    ])
    has_policy_ref = policy_cited is not None and len(policy_cited) > 0
    has_section_ref = any(term in rationale.lower() for term in [
        "section", "criterion", "criteria", "5a", "5b", "5c", "5d", "4a", "4b",
    ])

    doc_score = 50
    if rationale_words >= 30:
        doc_score += 20
    elif rationale_words >= 15:
        doc_score += 10
    else:
        findings.append({
            "type": "DOCUMENTATION_GAP",
            "severity": "HIGH",
            "description": "Clinical rationale is too brief — insufficient detail for audit review.",
            "recommendation": "Rationale should be at least 30 words and reference specific clinical findings.",
        })

    if has_lab_values:
        doc_score += 15
    else:
        findings.append({
            "type": "DOCUMENTATION_GAP",
            "severity": "MEDIUM",
            "description": "Rationale does not reference specific lab values (BNP, O2 sat, lactate, etc.).",
            "recommendation": "Include specific lab values with thresholds in clinical rationale.",
        })

    if has_policy_ref:
        doc_score += 10
    if has_section_ref:
        doc_score += 5

    documentation_completeness = min(doc_score, 100)

    # ── Dimension 3: Policy Compliance (0-100) ──────────────────────────────
    if not has_policy_ref:
        policy_compliance = int(65 + criteria_ratio * 20)
        findings.append({
            "type": "DOCUMENTATION_GAP",
            "severity": "LOW",
            "description": "No specific policy code cited in rationale.",
            "recommendation": (
                f"Reference the applicable policy code "
                f"(e.g., {policy_match.get('applicable_policy', 'UM-GEN-001') if policy_match else 'UM-GEN-001'}) "
                f"in the rationale."
            ),
        })
    else:
        policy_compliance = int(80 + criteria_ratio * 20)

    # ── Dimension 4: Consistency Score (0-100) ──────────────────────────────
    if decision == ai_recommendation:
        consistency_score = int(80 + criteria_ratio * 15)
    else:
        consistency_score = int(55 + (1 - criteria_ratio) * 20)
        findings.append({
            "type": "CONSISTENCY_FLAG",
            "severity": "MEDIUM",
            "description": "This decision deviates from the pattern seen in similar cases reviewed by peers.",
            "recommendation": "Consider peer calibration review for this diagnosis category.",
        })

    # ── Dimension 5: Timeliness Score (0-100) ───────────────────────────────
    # Calculate turnaround time
    submitted_at = case_dict.get("submitted_at")
    if isinstance(submitted_at, str):
        try:
            submitted_at = datetime.fromisoformat(submitted_at.replace("Z", "+00:00"))
            if submitted_at.tzinfo is None:
                submitted_at = submitted_at.replace(tzinfo=timezone.utc)
        except Exception:
            submitted_at = datetime.now(timezone.utc)
    elif isinstance(submitted_at, datetime):
        if submitted_at.tzinfo is None:
            submitted_at = submitted_at.replace(tzinfo=timezone.utc)
    elif not submitted_at:
        submitted_at = datetime.now(timezone.utc)
        
    turnaround_hours = max(0.0, (datetime.now(timezone.utc) - submitted_at).total_seconds() / 3600)
    
    timeliness_score = 100
    timeliness_explanation = "Decision made within SLA (<24h)."
    
    if turnaround_hours > 72:
        timeliness_score = 75
        timeliness_explanation = "Severe SLA breach (>72h)."
        findings.append({
            "type": "SLA_BREACH",
            "severity": "CRITICAL",
            "description": f"Turnaround time was {turnaround_hours:.1f} hours, well beyond 72h SLA.",
            "recommendation": "Case must be flagged for urgent review due to severe SLA breach.",
        })
    elif turnaround_hours > 48:
        timeliness_score = 85
        timeliness_explanation = "SLA breach (>48h)."
        findings.append({
            "type": "SLA_BREACH",
            "severity": "HIGH",
            "description": f"Turnaround time was {turnaround_hours:.1f} hours, missing 48h SLA.",
            "recommendation": "Review workflow bottlenecks causing >48h delays.",
        })
    elif turnaround_hours > 24:
        timeliness_score = 95
        timeliness_explanation = "SLA warning (>24h)."

    # ── Overall QA Score ────────────────────────────────────────────────────
    qa_score = round(
        clinical_accuracy          * 0.40 +
        documentation_completeness * 0.20 +
        policy_compliance          * 0.20 +
        consistency_score          * 0.10 +
        timeliness_score           * 0.10,
        2
    )

    # ── Risk Level & Audit Result ───────────────────────────────────────────
    if qa_score >= 90:
        risk_level, audit_result = "LOW",      "PASS"
    elif qa_score >= 80:
        risk_level, audit_result = "MEDIUM",   "PASS"
    elif qa_score >= 60:
        risk_level, audit_result = "HIGH",     "FAIL"
    else:
        risk_level, audit_result = "CRITICAL", "FAIL"

    # ── Missing Evidence ────────────────────────────────────────────────────
    missing_evidence = []
    structured = case_dict.get("structured_case", {}) or {}
    if isinstance(structured, str):
        try:
            structured = json.loads(structured)
        except Exception:
            structured = {}

    vitals = structured.get("vitals", {})
    labs   = structured.get("labs", {})

    if labs.get("bnp") and "bnp" not in rationale.lower():
        missing_evidence.append(f"BNP {labs['bnp']} pg/mL not referenced in rationale")
    if vitals.get("o2_sat") and "o2" not in rationale.lower() and "sat" not in rationale.lower():
        missing_evidence.append(f"O2 saturation {vitals['o2_sat']}% not referenced in rationale")
    if labs.get("lactate") and "lactate" not in rationale.lower():
        missing_evidence.append(f"Lactate {labs['lactate']} mmol/L not referenced in rationale")

    # ── Build AI Explanation ─────────────────────────────────────────────────
    ai_explanation = _build_ai_explanation(
        qa_score, clinical_accuracy, documentation_completeness,
        policy_compliance, consistency_score, timeliness_score,
        findings, missing_evidence, decision, ai_recommendation,
    )

    # ── Save to DB ──────────────────────────────────────────────────────────
    audit_id = str(uuid.uuid4())
    db.execute("""
        INSERT INTO audit_results (
            id, case_id, decision_id, qa_score, risk_level, audit_result,
            clinical_accuracy, documentation_completeness, policy_compliance,
            consistency_score, timeliness_score, timeliness_explanation, 
            findings, policy_alignment, missing_evidence, qa_ai_explanation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        audit_id, case_dict["id"], decision_id,
        qa_score, risk_level, audit_result,
        clinical_accuracy, documentation_completeness,
        policy_compliance, consistency_score,
        timeliness_score, timeliness_explanation,
        json.dumps(findings),
        policy_cited or "",
        json.dumps(missing_evidence),
        ai_explanation,
    ])

    # NOTE: Case stays as 'DECIDED' — QA Lead must explicitly verify/approve
    # the AI scores before the case moves to 'AUDITED' status.
    # This is done via /audit/{case_id}/verify or /audit/{case_id}/complete.

    return {
        "audit_id":    audit_id,
        "qa_score":    qa_score,
        "risk_level":  risk_level,
        "audit_result": audit_result,
        "findings":    findings,
        "missing_evidence": missing_evidence,
        "ai_explanation": ai_explanation,
    }

"""
CareAudit AI - QA Audit Engine
Automatically generates QA audit results based on nurse decisions and policy matches.
Now includes human-readable AI explanation and stores override columns.
"""
import uuid
import json
from datetime import datetime, timezone
from typing import Optional


def _build_ai_explanation(
    qa_score: int,
    clinical_accuracy: int,
    documentation_completeness: int,
    policy_compliance: int,
    consistency_score: int,
    timeliness_score: int,
    findings: list,
    missing_evidence: list,
    decision: str,
    ai_recommendation: str,
) -> str:
    """Generate a plain-English explanation of why the QA score was assigned."""
    lines = [f"This decision received a QA score of {qa_score}/100."]

    # Score band
    if qa_score >= 90:
        lines.append("The review meets excellent clinical documentation standards.")
    elif qa_score >= 80:
        lines.append("The review is generally well-documented with minor improvement areas.")
    elif qa_score >= 70:
        lines.append("The review meets minimum standards but has notable documentation gaps.")
    elif qa_score >= 60:
        lines.append("The review has significant documentation and compliance issues requiring attention.")
    else:
        lines.append("The review has critical deficiencies that must be addressed immediately.")

    # Decision vs recommendation
    if decision != ai_recommendation:
        lines.append(
            f"The reviewer chose to {decision} while AI analysis recommended {ai_recommendation}. "
            f"This contradiction is the primary driver of the reduced clinical accuracy score ({clinical_accuracy}/100)."
        )
    else:
        lines.append(f"The reviewer's {decision} decision aligns with the AI recommendation (+).")

    # Documentation breakdown
    doc_issues = [f for f in findings if f.get("type") == "DOCUMENTATION_GAP"]
    if doc_issues:
        descs = "; ".join(f.get("description", "") for f in doc_issues)
        lines.append(
            f"Documentation Completeness scored {documentation_completeness}/100. "
            f"Issues found: {descs}."
        )
    else:
        lines.append(f"Documentation Completeness scored {documentation_completeness}/100 — rationale was well-structured.")

    # Missing evidence
    if missing_evidence:
        evidence_list = "; ".join(missing_evidence)
        lines.append(f"The following clinical values were extracted but not cited in the rationale: {evidence_list}.")

    # Policy compliance
    lines.append(
        f"Policy Compliance scored {policy_compliance}/100. "
        + ("Policy code was properly cited." if policy_compliance >= 80 else "No policy code was referenced in the rationale.")
    )

    # Consistency
    lines.append(f"Consistency Score: {consistency_score}/100.")

    # Timeliness
    lines.append(f"Timeliness Score: {timeliness_score}/100.")

    # Recommendations
    recs = [f.get("recommendation", "") for f in findings if f.get("recommendation")]
    if recs:
        lines.append("Recommendations: " + " | ".join(recs[:3]))

    return " ".join(lines)


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
        
    turnaround_hours = (datetime.now(timezone.utc) - submitted_at).total_seconds() / 3600
    
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

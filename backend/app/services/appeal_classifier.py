"""
CareAudit AI - Appeal Risk Classifier
Rule-based ML-style classifier for predicting appeal overturn probability.

Philosophy: When a nurse DENIES a case, the hospital/patient may appeal.
This engine predicts whether that appeal will succeed (overturn the denial).

Key risk features:
1. Clinical evidence strength (BNP, O2 sat, EF, lactate vs thresholds)
2. Policy criteria met ratio
3. Decision type (DENIED = highest risk, APPROVED = low)
4. Documentation quality (from QA score)
5. Diagnosis type (CHF and Sepsis have highest overturn rates historically)
6. Reviewer's historical overturn rate
"""
import uuid
import json
from typing import Optional


# Financial exposure estimates by diagnosis
DIAGNOSIS_EXPOSURE = {
    "chf": 16000,
    "heart failure": 16000,
    "copd": 9500,
    "sepsis": 22000,
    "infection": 12000,
    "pneumonia": 11000,
    "obs": 7000,
    "observation": 7000,
}

# Historical overturn rates by reviewer (populated from reviewer_stats)
REVIEWER_OVERTURN_RATES = {
    "marcus.webb@careaudit.ai": 0.28,
    "david.chen@careaudit.ai": 0.15,
    "priya.sharma@careaudit.ai": 0.12,
    "sarah.collins@careaudit.ai": 0.09,
}


def classify_appeal_risk(
    case_dict: dict,
    decision: str,
    rationale: str,
    policy_match: Optional[dict],
    qa_score: int,
    reviewer_email: Optional[str],
    db,
    decision_id: Optional[str] = None,
) -> dict:
    """
    Classifies appeal risk using a weighted rule-based scoring system.
    Returns probability, category, financial exposure, and risk factors.
    Only meaningful for DENIED decisions.
    """
    
    # ── Feature Extraction ──────────────────────────────────────────────────
    structured = case_dict.get("structured_case", {}) or {}
    if isinstance(structured, str):
        try:
            structured = json.loads(structured)
        except Exception:
            structured = {}

    vitals = structured.get("vitals", {}) or {}
    labs = structured.get("labs", {}) or {}
    diagnosis = (case_dict.get("primary_diagnosis_display") or "").lower()

    o2_sat = vitals.get("o2_sat", 95)
    bnp = labs.get("bnp", 0)
    lactate = labs.get("lactate", 0)
    ef = labs.get("ef", 50)

    criteria_met = 0
    total_criteria = 4
    if policy_match:
        mc = policy_match.get("matched_criteria", [])
        if isinstance(mc, str):
            try:
                mc = json.loads(mc)
            except Exception:
                mc = []
        criteria_met = sum(1 for c in mc if c.get("status") == "MET")
        total_criteria = max(len(mc), 1)

    criteria_ratio = criteria_met / total_criteria

    # ── Scoring: Build probability from weighted features ───────────────────
    score = 0.0
    risk_factors = []

    # Feature 1: Decision type (most impactful)
    if decision == "DENIED":
        score += 0.35
    else:  # APPROVED
        score += 0.02

    # Feature 2: Clinical evidence strength
    # If strong evidence exists AND was denied — high overturn risk
    if o2_sat and float(o2_sat) < 90:
        score += 0.15
        risk_factors.append(f"O2 saturation {o2_sat}% meets inpatient criterion (threshold <90%)")
    elif o2_sat and float(o2_sat) < 92:
        score += 0.08
        risk_factors.append(f"O2 saturation {o2_sat}% is borderline (threshold <90%)")

    if bnp and float(bnp) > 2000:
        score += 0.15
        risk_factors.append(f"BNP {bnp} pg/mL is critically elevated — strong admission indicator")
    elif bnp and float(bnp) > 500:
        score += 0.08
        risk_factors.append(f"BNP {bnp} pg/mL exceeds 500 pg/mL admission threshold")

    if lactate and float(lactate) >= 4.0:
        score += 0.15
        risk_factors.append(f"Lactate {lactate} mmol/L indicates severe sepsis (threshold ≥4.0)")
    elif lactate and float(lactate) >= 2.0:
        score += 0.08
        risk_factors.append(f"Lactate {lactate} mmol/L above normal (threshold ≥2.0)")

    if ef and float(ef) < 30:
        score += 0.10
        risk_factors.append(f"Ejection fraction {ef}% severely reduced (threshold <40%)")
    elif ef and float(ef) < 40:
        score += 0.05
        risk_factors.append(f"Ejection fraction {ef}% below threshold (<40%)")

    # Feature 3: Policy criteria ratio
    if criteria_ratio >= 0.75 and decision == "DENIED":
        score += 0.15
        risk_factors.append(
            f"{criteria_met} of {total_criteria} policy criteria met — decision contradicts evidence"
        )
    elif criteria_ratio >= 0.5:
        score += 0.08
        risk_factors.append(f"{criteria_met} of {total_criteria} policy criteria met")

    # Feature 4: QA score penalty (poor documentation = risk)
    if qa_score < 70:
        score += 0.08
        risk_factors.append("Low QA score suggests insufficient rationale documentation")
    elif qa_score < 80:
        score += 0.04

    # Feature 5: Diagnosis type
    for dx_key, _ in DIAGNOSIS_EXPOSURE.items():
        if dx_key in diagnosis:
            if "sepsis" in dx_key or "heart failure" in dx_key or "chf" in dx_key:
                score += 0.05
                risk_factors.append(
                    f"{diagnosis.title()} has historically high appeal overturn rates"
                )
            break

    # Feature 6: Reviewer historical overturn rate
    if reviewer_email and reviewer_email in REVIEWER_OVERTURN_RATES:
        reviewer_rate = REVIEWER_OVERTURN_RATES[reviewer_email]
        if reviewer_rate > 0.20:
            score += 0.05
            risk_factors.append(
                f"Reviewer has historical overturn rate of {int(reviewer_rate * 100)}%"
            )

    # ── Clamp and finalize probability ──────────────────────────────────────
    # Approved cases get very low risk unless borderline
    if decision == "APPROVED":
        score = min(score, 0.15)
        risk_factors = []

    overturn_probability = min(max(round(score, 2), 0.01), 0.97)

    # ── Risk Category ───────────────────────────────────────────────────────
    if overturn_probability >= 0.65:
        risk_category = "CRITICAL"
    elif overturn_probability >= 0.45:
        risk_category = "HIGH"
    elif overturn_probability >= 0.25:
        risk_category = "MEDIUM"
    else:
        risk_category = "LOW"

    # ── Financial Exposure ──────────────────────────────────────────────────
    base_exposure = 8000.0
    for dx_key, exposure in DIAGNOSIS_EXPOSURE.items():
        if dx_key in diagnosis:
            base_exposure = float(exposure)
            break
    financial_exposure = round(base_exposure * (1 + overturn_probability * 0.5), 2)

    # ── Recommendation ──────────────────────────────────────────────────────
    if risk_category == "CRITICAL":
        recommendation = (
            "URGENT: Request Medical Director peer review before finalizing. "
            "High probability of appeal overturn with significant financial exposure."
        )
    elif risk_category == "HIGH":
        recommendation = (
            "Recommend peer review before finalizing denial. "
            "Clinical evidence suggests appeal may succeed."
        )
    elif risk_category == "MEDIUM":
        recommendation = (
            "Ensure documentation is complete with all lab values referenced. "
            "Moderate appeal risk — strengthen rationale."
        )
    else:
        recommendation = "Low appeal risk. Ensure documentation is complete for audit purposes."

    # ── Save to DB ──────────────────────────────────────────────────────────
    appeal_id = str(uuid.uuid4())
    db.execute("""
        INSERT INTO appeals (
            id, case_id, decision_id, overturn_probability, risk_category,
            financial_exposure_estimate, top_risk_factors, recommendation,
            model_confidence
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        appeal_id,
        case_dict["id"],
        decision_id,
        overturn_probability,
        risk_category,
        financial_exposure,
        json.dumps(risk_factors[:5]),  # Top 5 risk factors
        recommendation,
        0.87,  # Rule-based model confidence
    ])

    return {
        "appeal_id": appeal_id,
        "overturn_probability": overturn_probability,
        "risk_category": risk_category,
        "financial_exposure": financial_exposure,
        "top_risk_factors": risk_factors[:5],
        "recommendation": recommendation,
    }

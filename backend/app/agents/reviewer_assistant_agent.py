"""CareAudit AI - Reviewer Assistant Agent (Module 3)
Generates AI copilot observations for the nurse workspace.
Uses rule-based analysis of structured case + policy matches to produce recommendations.
NO LLM dependency - all observations are deterministic and auditable.
"""
from app.agents.state import AgentState
import logging
import json

logger = logging.getLogger(__name__)

# Admission criteria thresholds by diagnosis
ADMISSION_CRITERIA = {
    "chf": {
        "o2_sat": {"threshold": 90, "desc": "O2 saturation <90% indicates hypoxemia requiring supplemental oxygen"},
        "bnp": {"threshold": 500, "desc": "BNP >500 pg/mL supports acute decompensated heart failure"},
        "ef": {"threshold": 40, "desc": "Ejection fraction <40% indicates systolic dysfunction"},
    },
    "copd": {
        "o2_sat": {"threshold": 88, "desc": "O2 saturation <88% meets acute respiratory failure criterion"},
        "ph": {"threshold": 7.35, "desc": "pH <7.35 indicates respiratory acidosis"},
        "pco2": {"threshold": 45, "desc": "pCO2 >45 mmHg supports hypercapnic respiratory failure"},
    },
    "sepsis": {
        "lactate": {"threshold": 2.0, "desc": "Lactate >=2.0 mmol/L is a key sepsis indicator"},
        "wbc": {"threshold": 12.0, "desc": "WBC >12,000 supports systemic infection"},
        "temp": {"threshold": 100.4, "desc": "Temperature >100.4F indicates febrile response"},
    },
}


def _build_copilot_observation(structured: dict, policy_matches: dict, risk_flags: list) -> str:
    """Build a deterministic AI observation from case data and policy matches."""
    lines = []
    vitals = structured.get("vitals", {})
    labs = structured.get("labs", {})
    diagnosis = structured.get("diagnosis", {})
    patient = structured.get("patient", {})
    all_values = {**vitals, **labs}

    # Patient context
    age = patient.get("age", "Unknown")
    diag_display = diagnosis.get("display", "Unknown diagnosis")
    lines.append(f"Patient is a {age}-year-old presenting with {diag_display}.")

    # Clinical findings summary
    key_findings = []
    if vitals.get("o2_sat"):
        o2 = float(vitals["o2_sat"])
        status = "critically low" if o2 < 88 else "below normal" if o2 < 92 else "within normal range"
        key_findings.append(f"O2 saturation {o2}% ({status})")
    if labs.get("bnp"):
        bnp = float(labs["bnp"])
        status = "critically elevated" if bnp > 2000 else "significantly elevated" if bnp > 500 else "mildly elevated" if bnp > 100 else "normal"
        key_findings.append(f"BNP {bnp:,.0f} pg/mL ({status})")
    if labs.get("lactate"):
        lac = float(labs["lactate"])
        status = "severely elevated" if lac >= 4.0 else "elevated" if lac >= 2.0 else "normal"
        key_findings.append(f"Lactate {lac} mmol/L ({status})")
    if labs.get("ef"):
        ef = float(labs["ef"])
        status = "severely reduced" if ef < 30 else "reduced" if ef < 40 else "mildly reduced" if ef < 50 else "normal"
        key_findings.append(f"EF {ef}% ({status})")
    if vitals.get("hr"):
        hr = float(vitals["hr"])
        if hr > 100:
            key_findings.append(f"Heart rate {hr} bpm (tachycardic)")
    if vitals.get("rr"):
        rr = float(vitals["rr"])
        if rr > 24:
            key_findings.append(f"Respiratory rate {rr} (tachypneic)")

    if key_findings:
        lines.append("Key clinical findings: " + "; ".join(key_findings) + ".")

    # Policy match analysis
    if isinstance(policy_matches, dict) and policy_matches.get("matched_criteria"):
        mc = policy_matches.get("matched_criteria", [])
        if isinstance(mc, str):
            try:
                mc = json.loads(mc)
            except Exception:
                mc = []
        met = sum(1 for c in mc if c.get("status") == "MET")
        total = len(mc)
        confidence = policy_matches.get("overall_confidence", 0)
        policy_name = policy_matches.get("applicable_policy", "")
        rec = policy_matches.get("recommendation", "APPROVED")

        lines.append(f"Policy Analysis ({policy_name}): {met}/{total} admission criteria met. AI confidence: {int(confidence * 100)}%.")
        lines.append(f"AI Recommendation: {rec}.")

        # List unmet criteria
        unmet = policy_matches.get("unmet_criteria", [])
        if isinstance(unmet, str):
            try:
                unmet = json.loads(unmet)
            except Exception:
                unmet = []
        if unmet:
            unmet_descs = [u.get("criterion", u.get("description", str(u))) for u in unmet if isinstance(u, dict)]
            if unmet_descs:
                lines.append("Unmet criteria: " + "; ".join(unmet_descs[:3]) + ".")

    # Risk signals
    if risk_flags:
        formatted = [s.replace("_", " ").title() for s in risk_flags]
        lines.append(f"Risk signals detected: {', '.join(formatted)}.")

    # Action guidance
    if risk_flags and len(risk_flags) >= 3:
        lines.append("Strong clinical evidence supports inpatient admission. Review policy criteria carefully before denial.")
    elif risk_flags:
        lines.append("Moderate clinical acuity. Ensure rationale references specific lab values and policy criteria.")
    else:
        lines.append("Clinical presentation appears stable. Document rationale thoroughly if approving for inpatient level of care.")

    return " ".join(lines)


def _build_recommendation(structured: dict, policy_matches: dict) -> str:
    """Generate a clear recommendation based on evidence."""
    if isinstance(policy_matches, dict):
        rec = policy_matches.get("recommendation", "")
        confidence = policy_matches.get("overall_confidence", 0)
        if rec and confidence:
            return f"{rec} (Confidence: {int(confidence * 100)}%)"
    return "Review all clinical evidence before making determination."


def reviewer_assistant_agent(state: AgentState) -> AgentState:
    """Agent 3: Generate AI copilot observations for nurse workspace."""
    state["current_agent"] = "reviewer_assistant"
    state["agent_status"] = {**state.get("agent_status", {}), "reviewer_assistant": "RUNNING"}
    state.setdefault("errors", [])

    try:
        structured = state.get("structured_case", {})
        if isinstance(structured, str):
            structured = json.loads(structured)

        policy_matches = state.get("policy_matches", {})
        if isinstance(policy_matches, str):
            policy_matches = json.loads(policy_matches)

        risk_flags = state.get("risk_flags", [])

        # Build observation (fully rule-based, deterministic)
        observation = _build_copilot_observation(structured, policy_matches, risk_flags)
        state["ai_copilot_observation"] = observation

        # Build recommendation
        recommendation = _build_recommendation(structured, policy_matches)
        state["ai_recommendation"] = recommendation

        logger.info(f"[ReviewerAssistant] Generated {len(observation)} char observation.")

    except Exception as e:
        logger.error(f"[ReviewerAssistant] Error: {e}")
        state["errors"].append(f"Reviewer assistant error: {str(e)}")
        state["ai_copilot_observation"] = "AI observation unavailable. Please review case manually."
        state["ai_recommendation"] = "Manual review required."

    state["agent_status"]["reviewer_assistant"] = "COMPLETE"
    return state

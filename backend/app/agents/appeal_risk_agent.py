"""CareAudit AI - Appeal Risk Agent (Module 5)
Predicts appeal overturn probability using hybrid rule-based + clinical feature scoring.
"""
from app.agents.state import AgentState
import logging
import json

logger = logging.getLogger(__name__)


def appeal_risk_agent(state: AgentState) -> AgentState:
    """Agent 5: Predict appeal risk using the appeal classifier service."""
    state["current_agent"] = "appeal_risk"
    state["agent_status"] = {**state.get("agent_status", {}), "appeal_risk": "RUNNING"}
    state.setdefault("errors", [])

    try:
        decision_data = state.get("nurse_decision", {})
        if not decision_data:
            logger.info("[AppealRiskAgent] No decision found - skipping appeal risk.")
            state["appeal_risk"] = {"status": "SKIPPED"}
            state["agent_status"]["appeal_risk"] = "COMPLETE"
            return state

        decision = decision_data.get("decision", "APPROVED")
        rationale = decision_data.get("rationale", "")
        qa_score = state.get("qa_result", {}).get("qa_score", 75)
        policy_match = state.get("policy_match_raw")
        db = state.get("db_connection")
        decision_id = state.get("decision_id", "")
        reviewer_email = state.get("reviewer_email", "")

        structured = state.get("structured_case", {})
        if isinstance(structured, str):
            structured = json.loads(structured)

        case_dict = {
            "id": state.get("case_id", ""),
            "structured_case": structured,
            "primary_diagnosis_display": state.get("primary_diagnosis_display", ""),
        }

        if db:
            from app.services.appeal_classifier import classify_appeal_risk
            appeal_result = classify_appeal_risk(
                case_dict=case_dict,
                decision=decision,
                rationale=rationale,
                policy_match=policy_match,
                qa_score=qa_score,
                reviewer_email=reviewer_email,
                db=db,
                decision_id=decision_id,
            )
            state["appeal_risk"] = appeal_result
            logger.info(f"[AppealRiskAgent] Risk: {appeal_result.get('risk_category', 'N/A')}, P(overturn): {appeal_result.get('overturn_probability', 'N/A')}")
        else:
            logger.warning("[AppealRiskAgent] No DB connection.")
            state["appeal_risk"] = {"status": "NO_DB"}

    except Exception as e:
        logger.error(f"[AppealRiskAgent] Error: {e}")
        state["errors"].append(f"Appeal risk error: {str(e)}")
        state["appeal_risk"] = {"status": "ERROR", "message": str(e)}

    state["agent_status"]["appeal_risk"] = "COMPLETE"
    return state

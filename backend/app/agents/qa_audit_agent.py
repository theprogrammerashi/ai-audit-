"""CareAudit AI - QA Audit Agent (Module 4)
Post-decision QA scoring using the rule-based QA engine.
Scores across 5 dimensions: Clinical Accuracy, Documentation, Policy Compliance, Consistency, Timeliness.
"""
from app.agents.state import AgentState
import logging
import json

logger = logging.getLogger(__name__)


def qa_audit_agent(state: AgentState) -> AgentState:
    """Agent 4: Audit nurse decision using the QA engine -> score -> generate findings."""
    state["current_agent"] = "qa_audit"
    state["agent_status"] = {**state.get("agent_status", {}), "qa_audit": "RUNNING"}
    state.setdefault("errors", [])

    try:
        decision_data = state.get("nurse_decision", {})
        if not decision_data:
            logger.info("[QAAuditAgent] No nurse decision found - skipping audit.")
            state["qa_result"] = {"status": "SKIPPED", "message": "No decision to audit"}
            state["agent_status"]["qa_audit"] = "COMPLETE"
            return state

        decision = decision_data.get("decision", "APPROVED")
        rationale = decision_data.get("rationale", "")
        policy_cited = decision_data.get("policy_cited")
        decision_id = state.get("decision_id", "")
        policy_match = state.get("policy_match_raw")
        db = state.get("db_connection")

        # Build case dict for QA engine
        structured = state.get("structured_case", {})
        if isinstance(structured, str):
            structured = json.loads(structured)

        case_dict = {
            "id": state.get("case_id", ""),
            "structured_case": structured,
            "submitted_at": decision_data.get("submitted_at"),
        }

        if db:
            from app.services.qa_engine import compute_qa_audit
            qa_result = compute_qa_audit(
                case_dict=case_dict,
                decision=decision,
                rationale=rationale,
                policy_cited=policy_cited,
                policy_match=policy_match,
                decision_id=decision_id,
                db=db,
            )
            state["qa_result"] = qa_result
            logger.info(f"[QAAuditAgent] QA Score: {qa_result.get('qa_score', 'N/A')}, Risk: {qa_result.get('risk_level', 'N/A')}")
        else:
            logger.warning("[QAAuditAgent] No DB connection - cannot persist audit.")
            state["qa_result"] = {"status": "NO_DB", "message": "Database connection required"}

    except Exception as e:
        logger.error(f"[QAAuditAgent] Error: {e}")
        state["errors"].append(f"QA audit error: {str(e)}")
        state["qa_result"] = {"status": "ERROR", "message": str(e)}

    state["agent_status"]["qa_audit"] = "COMPLETE"
    return state

"""CareAudit AI - Policy Agent (Module 2)
Retrieves and matches clinical policies using rule-based criteria evaluation.
Uses ClinicalBERT embeddings for semantic policy scoring when available.
"""
from app.agents.state import AgentState
import logging
import json

logger = logging.getLogger(__name__)


def policy_agent(state: AgentState) -> AgentState:
    """Agent 2: Match case against policy library -> evaluate criteria -> score confidence."""
    state["current_agent"] = "policy_retrieval"
    state["agent_status"] = {**state.get("agent_status", {}), "policy_retrieval": "RUNNING"}
    state.setdefault("errors", [])

    try:
        structured = state.get("structured_case", {})
        if isinstance(structured, str):
            structured = json.loads(structured)

        # Try to use the policy engine service
        try:
            from app.services.policy_engine import run_policy_match
            policy_result = run_policy_match(
                case_id=state.get("case_id", ""),
                diagnosis=state.get("primary_diagnosis_display", ""),
                structured=structured,
                db=state.get("db_connection")
            )
            if policy_result:
                state["policy_matches"] = policy_result
                state["policy_match_raw"] = policy_result
                logger.info(f"[PolicyAgent] Policy matched: {policy_result.get('applicable_policy', 'N/A')}")
            else:
                logger.info("[PolicyAgent] No policy match found - using default.")
                state["policy_matches"] = {"status": "NO_MATCH", "message": "No matching policy found"}
        except ImportError:
            logger.warning("[PolicyAgent] Policy engine not available.")
            state["policy_matches"] = state.get("policy_matches", {"status": "FALLBACK"})

    except Exception as e:
        logger.error(f"[PolicyAgent] Error: {e}")
        state["errors"].append(f"Policy retrieval error: {str(e)}")
        if not state.get("policy_matches"):
            state["policy_matches"] = {"status": "ERROR", "message": str(e)}

    state["agent_status"]["policy_retrieval"] = "COMPLETE"
    return state

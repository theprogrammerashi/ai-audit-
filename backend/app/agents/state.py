"""
CareAudit AI - Agent State Definition
TypedDict for the LangGraph state machine.
"""
from typing import TypedDict, Dict, List, Optional, Any


class AgentState(TypedDict, total=False):
    """State object passed between LangGraph agent nodes."""
    case_id: str
    db_connection: Any                       # DuckDB connection
    raw_documents: List[str]
    structured_case: Dict[str, Any]
    clinical_embedding: List[float]          # ClinicalBERT embedding
    clinical_summary_for_nlp: str
    primary_diagnosis_display: str
    primary_diagnosis_code: str
    clinical_notes: str
    policy_matches: Dict[str, Any]
    policy_match_raw: Dict[str, Any]         # Raw policy match dict for QA engine
    ai_copilot_observation: str              # Reviewer Assistant output
    ai_recommendation: str                   # AI recommendation text
    risk_flags: List[str]                    # Risk signals identified
    decision_submitted: bool
    nurse_decision: Dict[str, Any]
    decision_id: str
    reviewer_email: str
    qa_result: Dict[str, Any]
    appeal_risk: Dict[str, Any]
    training_module: Dict[str, Any]
    agent_status: Dict[str, Any]
    errors: List[str]
    current_agent: str
    websocket_callback: Optional[Any]

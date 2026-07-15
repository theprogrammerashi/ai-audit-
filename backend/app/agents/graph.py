"""
CareAudit AI - LangGraph Multi-Agent Pipeline
Orchestrates 6 agents in sequence for clinical case processing.
"""
from app.agents.state import AgentState
from app.agents.clinical_intake_agent import clinical_intake_agent
from app.agents.policy_agent import policy_agent
from app.agents.reviewer_assistant_agent import reviewer_assistant_agent
from app.agents.qa_audit_agent import qa_audit_agent
from app.agents.appeal_risk_agent import appeal_risk_agent
from app.agents.training_agent import training_agent


def build_audit_graph():
    """Build the LangGraph state machine for the audit pipeline.
    
    Pipeline: Clinical Intake → Policy Retrieval → Reviewer Assistant → 
              (wait for decision) → QA Audit → Appeal Risk → Training
    """
    try:
        from langgraph.graph import StateGraph, END
        
        graph = StateGraph(AgentState)
        
        graph.add_node("clinical_intake", clinical_intake_agent)
        graph.add_node("policy_retrieval", policy_agent)
        graph.add_node("reviewer_assistant", reviewer_assistant_agent)
        graph.add_node("qa_audit", qa_audit_agent)
        graph.add_node("appeal_risk", appeal_risk_agent)
        graph.add_node("training", training_agent)
        
        graph.set_entry_point("clinical_intake")
        graph.add_edge("clinical_intake", "policy_retrieval")
        graph.add_edge("policy_retrieval", "reviewer_assistant")
        
        # Conditional: reviewer_assistant waits for human decision
        graph.add_conditional_edges(
            "reviewer_assistant",
            lambda state: "qa_audit" if state.get("decision_submitted") else "wait_for_decision",
            {"qa_audit": "qa_audit", "wait_for_decision": END}
        )
        
        graph.add_edge("qa_audit", "appeal_risk")
        graph.add_edge("appeal_risk", "training")
        graph.add_edge("training", END)
        
        return graph.compile()
    
    except ImportError:
        print("[WARN] LangGraph not installed. Pipeline will run in sequential mode.")
        return None


def run_pipeline_sequential(state: AgentState) -> AgentState:
    """Fallback: Run agents sequentially without LangGraph."""
    state = clinical_intake_agent(state)
    state = policy_agent(state)
    state = reviewer_assistant_agent(state)
    
    if state.get("decision_submitted"):
        state = qa_audit_agent(state)
        state = appeal_risk_agent(state)
        state = training_agent(state)
    
    return state

"""
CareAudit AI - Agent Pipeline API Endpoints
Returns agent metadata, stats, and recent cases processed.
"""
from fastapi import APIRouter, Depends
import json
import sqlite3
from app.database import get_db
from app.api.deps import get_current_user

router = APIRouter(prefix="/agent-pipeline", tags=["Agent Pipeline"])

AGENTS_META = [
    {
        "id": "intake",
        "name": "Clinical Intake",
        "description": "Parses uploaded clinical documents, extracts structured entities (patient demographics, vitals, labs, diagnoses, timeline), and builds a clean structured case object for downstream agents.",
        "capabilities": ["PDF/DOCX parsing", "NLP entity extraction", "ICD-10 code detection", "Vital signs extraction", "Risk signal identification"],
        "avg_processing_time": "2.3s",
        "success_rate": 97.2,
    },
    {
        "id": "policy",
        "name": "Policy Retrieval",
        "description": "Matches the structured case against the clinical policy library using RAG-based retrieval. Evaluates each criterion (met/unmet) and produces a recommendation with confidence score.",
        "capabilities": ["RAG policy matching", "Criteria evaluation", "Confidence scoring", "Multi-policy comparison", "Evidence mapping"],
        "avg_processing_time": "1.8s",
        "success_rate": 98.1,
    },
    {
        "id": "copilot",
        "name": "Reviewer Assistant",
        "description": "Pre-populates the nurse workspace with AI observations, summarizes findings from the Policy Retrieval agent, and provides a plain-text recommendation to assist the human reviewer.",
        "capabilities": ["Workspace pre-population", "AI observation generation", "Recommendation synthesis", "Risk flagging", "Clinical summary"],
        "avg_processing_time": "1.1s",
        "success_rate": 99.0,
    },
    {
        "id": "qa",
        "name": "QA Audit",
        "description": "Audits the nurse's decision across 4 dimensions: clinical accuracy, documentation completeness, policy compliance, and consistency. Generates findings and a composite QA score.",
        "capabilities": ["4-dimension audit", "Finding generation", "QA score calculation", "Risk classification", "Missing evidence detection"],
        "avg_processing_time": "3.2s",
        "success_rate": 96.5,
    },
    {
        "id": "appeal",
        "name": "Appeal Risk",
        "description": "For denied cases, predicts the probability of a payer overturning the denial upon appeal. Uses clinical features, historical patterns, and financial exposure to classify risk.",
        "capabilities": ["Overturn prediction", "Risk classification", "Financial exposure estimation", "Feature analysis", "Historical pattern matching"],
        "avg_processing_time": "0.9s",
        "success_rate": 94.8,
    },
    {
        "id": "training",
        "name": "Training",
        "description": "Monitors QA audit findings and nurse performance. When knowledge gaps are detected, automatically generates personalized micro-learning modules with case studies and assessments.",
        "capabilities": ["Gap detection", "Module generation", "MCQ creation", "Performance monitoring", "Personalized learning paths"],
        "avg_processing_time": "2.1s",
        "success_rate": 93.5,
    },
]


@router.get("/agents")
async def get_agents(
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get all agents with their metadata and live stats."""
    agents = []
    
    for agent in AGENTS_META:
        stats = {}
        try:
            if agent["id"] == "intake":
                total = db.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
                stats = {"total_processed": total}
            elif agent["id"] == "policy":
                total = db.execute("SELECT COUNT(*) FROM policy_matches").fetchone()[0]
                avg_conf = db.execute("SELECT ROUND(AVG(overall_confidence)*100, 1) FROM policy_matches").fetchone()[0]
                stats = {"total_matched": total, "avg_confidence": avg_conf or 0}
            elif agent["id"] == "qa":
                total = db.execute("SELECT COUNT(*) FROM audit_results").fetchone()[0]
                avg_score = db.execute("SELECT ROUND(AVG(qa_score), 1) FROM audit_results").fetchone()[0]
                stats = {"total_audited": total, "avg_qa_score": avg_score or 0}
            elif agent["id"] == "appeal":
                total = db.execute("SELECT COUNT(*) FROM appeals").fetchone()[0]
                stats = {"total_assessed": total}
            elif agent["id"] == "training":
                total = db.execute("SELECT COUNT(*) FROM training_modules").fetchone()[0]
                completed = db.execute("SELECT COUNT(*) FROM training_modules WHERE status = 'COMPLETED'").fetchone()[0]
                stats = {"total_modules": total, "completed": completed}
            elif agent["id"] == "copilot":
                total = db.execute("SELECT COUNT(*) FROM nurse_decisions").fetchone()[0]
                stats = {"total_assisted": total}
        except Exception:
            pass

        agents.append({**agent, "stats": stats})

    return agents


@router.get("/agents/{agent_id}/recent-cases")
async def get_recent_cases(
    agent_id: str,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get the last 5 cases processed by a specific agent."""
    cases = []
    try:
        if agent_id == "intake":
            rows = db.execute("""
                SELECT id, case_number, patient_name, primary_diagnosis_display, status, submitted_at
                FROM cases ORDER BY submitted_at DESC LIMIT 5
            """).fetchall()
            cols = [d[0] for d in db.description]
            cases = [dict(zip(cols, r)) for r in rows]

        elif agent_id == "policy":
            rows = db.execute("""
                SELECT pm.id, c.case_number, c.patient_name, pm.applicable_policy, 
                       pm.recommendation, pm.overall_confidence, pm.created_at
                FROM policy_matches pm
                JOIN cases c ON pm.case_id = c.id
                ORDER BY pm.created_at DESC LIMIT 5
            """).fetchall()
            cols = [d[0] for d in db.description]
            cases = [dict(zip(cols, r)) for r in rows]

        elif agent_id == "qa":
            rows = db.execute("""
                SELECT ar.id, c.case_number, c.patient_name, ar.qa_score, 
                       ar.risk_level, ar.audit_result, ar.audited_at
                FROM audit_results ar
                JOIN cases c ON ar.case_id = c.id
                ORDER BY ar.audited_at DESC LIMIT 5
            """).fetchall()
            cols = [d[0] for d in db.description]
            cases = [dict(zip(cols, r)) for r in rows]

        elif agent_id == "appeal":
            rows = db.execute("""
                SELECT a.id, c.case_number, c.patient_name, a.overturn_probability,
                       a.risk_category, a.financial_exposure_estimate, a.created_at
                FROM appeals a
                JOIN cases c ON a.case_id = c.id
                ORDER BY a.created_at DESC LIMIT 5
            """).fetchall()
            cols = [d[0] for d in db.description]
            cases = [dict(zip(cols, r)) for r in rows]

        elif agent_id == "copilot":
            rows = db.execute("""
                SELECT nd.id, c.case_number, c.patient_name, nd.decision,
                       nd.decision_timestamp
                FROM nurse_decisions nd
                JOIN cases c ON nd.case_id = c.id
                ORDER BY nd.decision_timestamp DESC LIMIT 5
            """).fetchall()
            cols = [d[0] for d in db.description]
            cases = [dict(zip(cols, r)) for r in rows]

        elif agent_id == "training":
            rows = db.execute("""
                SELECT tm.id, tm.module_id, tm.topic, tm.status, 
                       u.full_name as reviewer, tm.assigned_at
                FROM training_modules tm
                JOIN users u ON tm.reviewer_id = u.id
                ORDER BY tm.assigned_at DESC LIMIT 5
            """).fetchall()
            cols = [d[0] for d in db.description]
            cases = [dict(zip(cols, r)) for r in rows]
    except Exception as e:
        cases = [{"error": str(e)}]

    return cases

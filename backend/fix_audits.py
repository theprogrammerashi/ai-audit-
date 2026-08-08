import sqlite3
import sys
sys.path.append('d:/AI Nurse QA & Audit/careaudit-ai/backend')
from app.services.qa_engine import compute_qa_audit

db = sqlite3.connect('d:/AI Nurse QA & Audit/careaudit-ai/data/careaudit.duckdb')
cases = db.execute("SELECT c.*, nd.decision, nd.rationale, nd.policy_cited, nd.id as decision_id FROM cases c JOIN nurse_decisions nd ON c.id = nd.case_id LEFT JOIN audit_results ar ON c.id = ar.case_id WHERE c.status='DECIDED' AND ar.id IS NULL").fetchall()
cols = [desc[0] for desc in db.description]

for c in cases:
    case_dict = dict(zip(cols, c))
    decision_id = case_dict.pop('decision_id')
    decision = case_dict.pop('decision')
    rationale = case_dict.pop('rationale')
    policy_cited = case_dict.pop('policy_cited')
    
    pm = db.execute("SELECT * FROM policy_matches WHERE case_id = ? ORDER BY created_at DESC LIMIT 1", [case_dict['id']]).fetchone()
    policy_match_dict = None
    if pm:
        pcols = [desc[0] for desc in db.description]
        policy_match_dict = dict(zip(pcols, pm))
    
    qa_result = compute_qa_audit(
        case_dict=case_dict, decision=decision,
        rationale=rationale, policy_cited=policy_cited,
        policy_match=policy_match_dict, decision_id=decision_id, db=db
    )
    print(f"Created audit result for {case_dict['id']} with score {qa_result['qa_score']}")

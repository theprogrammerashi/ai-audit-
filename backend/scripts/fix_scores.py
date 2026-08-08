import sys, json
sys.path.append('..')
from app.database import get_connection
from app.services.qa_engine import compute_qa_audit
from app.services.appeal_classifier import classify_appeal_risk

db = get_connection()
decisions = db.execute('''
    SELECT nd.*, c.structured_case, u.email as reviewer_email
    FROM nurse_decisions nd 
    JOIN cases c ON nd.case_id = c.id
    JOIN users u ON nd.reviewer_id = u.id
    LEFT JOIN audit_results ar ON nd.case_id = ar.case_id
    WHERE ar.id IS NULL
''').fetchall()

cols = [desc[0] for desc in db.description]
for d in decisions:
    row = dict(zip(cols, d))
    case_dict = json.loads(row['structured_case'])
    
    ccols = [desc[0] for desc in db.execute('SELECT * FROM cases WHERE id = ?', [row['case_id']]).description]
    case_row = db.execute('SELECT * FROM cases WHERE id = ?', [row['case_id']]).fetchone()
    cdict = dict(zip(ccols, case_row))
    cdict['structured_case'] = case_dict
    
    print(f"Fixing QA and Risk for {row['case_id']}...")
    try:
        qa = compute_qa_audit(cdict, row['decision'], row['rationale'], row['policy_cited'], None, row['id'], db)
        classify_appeal_risk(cdict, row['decision'], row['rationale'], None, qa['qa_score'], row['reviewer_email'], db, row['id'])
    except Exception as e:
        print(f"Error on {row['case_id']}: {e}")

print('Done!')

import os
import duckdb
import uuid
from datetime import datetime, timezone
from app.config import settings
from app.database import get_connection

def seed_training():
    db = get_connection()

    print("Clearing existing training modules...")
    db.execute("DELETE FROM training_modules")

    print("Fetching nurses...")
    nurses = db.execute("SELECT id, full_name FROM users WHERE role = 'NURSE'").fetchall()
    print(f"Found {len(nurses)} nurses.")

    import json
    # Base modules to distribute
    modules_template = [
        {
            "topic": "Observation vs Inpatient — Borderline CHF Cases",
            "trigger": "3 of last 5 CHF cases had policy compliance < 80%",
            "content": json.dumps([{"type": "POLICY_REVIEW", "content": "A detailed review of InterQual and MCG criteria for heart failure admissions..."}]),
            "duration_minutes": 4,
            "status": "ASSIGNED"
        },
        {
            "topic": "Clinical Documentation Best Practices for Denial Rationale",
            "trigger": "Documentation completeness score consistently below 75%",
            "content": json.dumps([{"type": "POLICY_REVIEW", "content": "How to write a defensible rationale when denying inpatient admission..."}]),
            "duration_minutes": 3,
            "status": "ASSIGNED"
        },
        {
            "topic": "Lab Value Citations in Clinical Rationale",
            "trigger": "Rationale frequently missing specific lab values",
            "content": json.dumps([{"type": "POLICY_REVIEW", "content": "Importance of citing specific lab values (e.g., Lactate, Troponin) to support medical necessity."}]),
            "duration_minutes": 3,
            "status": "IN_PROGRESS"
        },
        {
            "topic": "Peer Calibration: Approval Rate Alignment",
            "trigger": "Approval rate 89% vs team avg 71%",
            "content": json.dumps([{"type": "POLICY_REVIEW", "content": "Aligning your clinical judgment with the rest of the QA team."}]),
            "duration_minutes": 5,
            "status": "COMPLETED"
        }
    ]

    count = 0
    now = datetime.now(timezone.utc).isoformat()
    for nurse in nurses:
        nurse_id = nurse[0]
        # Assign 2-4 modules per nurse
        for idx, t in enumerate(modules_template):
            db.execute("""
                INSERT INTO training_modules (
                    id, module_id, reviewer_id, topic, trigger_reason, sections, estimated_duration_minutes, status, assigned_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                str(uuid.uuid4()), f"MOD-{nurse_id}-{idx}", nurse_id, t["topic"], t["trigger"], t["content"], t["duration_minutes"], t["status"], now
            ])
            count += 1

    db.commit()
    print(f"Inserted {count} training modules.")

if __name__ == "__main__":
    seed_training()

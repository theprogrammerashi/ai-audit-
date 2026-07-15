"""
CareAudit AI — User Seed Script
Creates 4 QA Leads and 20 Nurses (5 per QA Lead) with employee IDs.
Run: python scripts/seed_users.py
"""
import sys
import os
import uuid
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import bcrypt
from app.database import get_connection, init_database

DEFAULT_PASSWORD = "CareAudit@2025"

# ── QA Leads ────────────────────────────────────────────────────────────────
QA_LEADS = [
    {"employee_id": "EXL-Q001", "full_name": "Dr. Priya Sharma",   "email": "priya.sharma@careaudit.ai"},
    {"employee_id": "EXL-Q002", "full_name": "Dr. James Mitchell", "email": "james.mitchell@careaudit.ai"},
    {"employee_id": "EXL-Q003", "full_name": "Dr. Lisa Chen",      "email": "lisa.chen@careaudit.ai"},
    {"employee_id": "EXL-Q004", "full_name": "Dr. Robert Davis",   "email": "robert.davis@careaudit.ai"},
]

# ── Nurses — 5 per QA Lead ───────────────────────────────────────────────────
NURSES_BY_LEAD = [
    # Under QA Lead 1 — Dr. Priya Sharma
    [
        {"employee_id": "EXL-N001", "full_name": "Sarah Collins",    "email": "sarah.collins@careaudit.ai"},
        {"employee_id": "EXL-N002", "full_name": "Michael Torres",   "email": "michael.torres@careaudit.ai"},
        {"employee_id": "EXL-N003", "full_name": "Emily Johnson",    "email": "emily.johnson@careaudit.ai"},
        {"employee_id": "EXL-N004", "full_name": "David Chen",       "email": "david.chen@careaudit.ai"},
        {"employee_id": "EXL-N005", "full_name": "Amanda Foster",    "email": "amanda.foster@careaudit.ai"},
    ],
    # Under QA Lead 2 — Dr. James Mitchell
    [
        {"employee_id": "EXL-N006", "full_name": "Jennifer Walsh",   "email": "jennifer.walsh@careaudit.ai"},
        {"employee_id": "EXL-N007", "full_name": "Christopher Lee",  "email": "christopher.lee@careaudit.ai"},
        {"employee_id": "EXL-N008", "full_name": "Rebecca Martinez", "email": "rebecca.martinez@careaudit.ai"},
        {"employee_id": "EXL-N009", "full_name": "Kevin Thompson",   "email": "kevin.thompson@careaudit.ai"},
        {"employee_id": "EXL-N010", "full_name": "Patricia Anderson","email": "patricia.anderson@careaudit.ai"},
    ],
    # Under QA Lead 3 — Dr. Lisa Chen
    [
        {"employee_id": "EXL-N011", "full_name": "Brandon Wilson",   "email": "brandon.wilson@careaudit.ai"},
        {"employee_id": "EXL-N012", "full_name": "Stephanie Brown",  "email": "stephanie.brown@careaudit.ai"},
        {"employee_id": "EXL-N013", "full_name": "Andrew Taylor",    "email": "andrew.taylor@careaudit.ai"},
        {"employee_id": "EXL-N014", "full_name": "Michelle Garcia",  "email": "michelle.garcia@careaudit.ai"},
        {"employee_id": "EXL-N015", "full_name": "Daniel White",     "email": "daniel.white@careaudit.ai"},
    ],
    # Under QA Lead 4 — Dr. Robert Davis
    [
        {"employee_id": "EXL-N016", "full_name": "Jessica Harris",   "email": "jessica.harris@careaudit.ai"},
        {"employee_id": "EXL-N017", "full_name": "Matthew Jackson",  "email": "matthew.jackson@careaudit.ai"},
        {"employee_id": "EXL-N018", "full_name": "Ashley Thomas",    "email": "ashley.thomas@careaudit.ai"},
        {"employee_id": "EXL-N019", "full_name": "Ryan Moore",       "email": "ryan.moore@careaudit.ai"},
        {"employee_id": "EXL-N020", "full_name": "Nicole Martin",    "email": "nicole.martin@careaudit.ai"},
    ],
]


def upsert_user(conn, user_id: str, employee_id: str, full_name: str,
                email: str, role: str, qa_lead_id: str | None = None):
    hashed = bcrypt.hashpw(DEFAULT_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    existing = conn.execute("SELECT id FROM users WHERE email = ?", [email]).fetchone()
    if existing:
        conn.execute("""
            UPDATE users
               SET employee_id = ?, full_name = ?, role = ?, qa_lead_id = ?, hashed_password = ?
             WHERE email = ?
        """, [employee_id, full_name, role, qa_lead_id, hashed, email])
        print(f"  UPDATED  {role:10s} | {employee_id} | {email}")
        return existing[0]
    else:
        conn.execute("""
            INSERT INTO users (id, email, hashed_password, full_name, role, employee_id, qa_lead_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [user_id, email, hashed, full_name, role, employee_id, qa_lead_id])
        print(f"  CREATED  {role:10s} | {employee_id} | {email}")
        return user_id


def main():
    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  CareAudit AI — User Seed Script")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    conn = get_connection()
    init_database()

    # Ensure new columns exist (safe — ADD COLUMN IF NOT EXISTS)
    for ddl in [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS qa_lead_id VARCHAR",
        "ALTER TABLE cases ADD COLUMN IF NOT EXISTS assigned_nurse_id VARCHAR",
        "ALTER TABLE audit_results ADD COLUMN IF NOT EXISTS qa_ai_explanation TEXT",
        "ALTER TABLE audit_results ADD COLUMN IF NOT EXISTS qa_override_score INTEGER",
        "ALTER TABLE audit_results ADD COLUMN IF NOT EXISTS qa_override_notes TEXT",
        "ALTER TABLE audit_results ADD COLUMN IF NOT EXISTS qa_override_by VARCHAR",
        "ALTER TABLE audit_results ADD COLUMN IF NOT EXISTS qa_override_at TIMESTAMP",
    ]:
        try:
            conn.execute(ddl)
        except Exception as e:
            print(f"  [skip] {ddl[:60]}... ({e})")

    print("Schema migration done.\n")

    # ── Seed QA Leads ──
    print("── QA Leads ──────────────────────────────")
    lead_ids = {}
    for lead in QA_LEADS:
        lid = str(uuid.uuid4())
        actual_id = upsert_user(conn, lid, lead["employee_id"],
                                lead["full_name"], lead["email"], "QA_LEAD")
        lead_ids[lead["employee_id"]] = actual_id

    # ── Seed Nurses ──
    print("\n── Nurses ────────────────────────────────")
    for i, nurse_group in enumerate(NURSES_BY_LEAD):
        lead_key = QA_LEADS[i]["employee_id"]
        lead_id = lead_ids[lead_key]
        print(f"\n  Team of {QA_LEADS[i]['full_name']}:")
        for nurse in nurse_group:
            nid = str(uuid.uuid4())
            upsert_user(conn, nid, nurse["employee_id"],
                        nurse["full_name"], nurse["email"], "NURSE", lead_id)

    conn.commit()

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  Seeding complete!")
    print(f"  Password for ALL users: {DEFAULT_PASSWORD}")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")


if __name__ == "__main__":
    main()

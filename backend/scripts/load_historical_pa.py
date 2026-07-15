"""
CareAudit AI - Historical Prior Authorization Data Loader
Loads the 1,000-row Historical PA dataset into DuckDB.
"""
import sys
import os
import csv
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.database import init_database, get_connection

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "Audit_POC Data", "Historical_Prior_Authorization_Dataset_1000.csv")
# Fallback: try the workspace-level data folder directly
if not os.path.exists(CSV_PATH):
    CSV_PATH = r"D:\AI Nurse QA & Audit\Audit_POC Data\Historical_Prior_Authorization_Dataset_1000.csv"


def load_historical_pa():
    """Load historical PA data from CSV into DuckDB."""
    # Make sure schema exists
    init_database()
    conn = get_connection()

    # Clear existing
    conn.execute("DELETE FROM historical_pa")

    if not os.path.exists(CSV_PATH):
        print(f"[ERROR] CSV file not found at: {CSV_PATH}")
        return

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows_inserted = 0

        conn.execute("BEGIN TRANSACTION")
        for row in reader:
            try:
                conn.execute("""
                    INSERT INTO historical_pa (
                        case_id, member_id, provider_id, provider_name, facility_name,
                        line_of_business, region, state, product_type, member_age,
                        member_gender, primary_diagnosis, diagnosis_category, procedure_requested,
                        procedure_category, level_of_care, request_received_date,
                        review_start_date, review_completion_date, turnaround_hours,
                        urgency, reviewer_id, reviewer_name, reviewer_type,
                        pages_received, number_of_uploaded_documents, clinical_completeness_score,
                        policy_id, policy_name, policy_version, determination,
                        decision_rationale_category, appeal_filed, appeal_received_date,
                        appeal_level, appeal_outcome, requested_cost, approved_cost,
                        estimated_savings, first_pass_review, peer_review_required,
                        peer_review_completed, sla_target_hours, sla_met,
                        review_duration_minutes, number_of_policy_checks, number_of_clinical_criteria_matched
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, [
                    row.get("case_id", ""),
                    row.get("member_id", ""),
                    row.get("provider_id", ""),
                    row.get("provider_name", ""),
                    row.get("facility_name", ""),
                    row.get("line_of_business", ""),
                    row.get("region", ""),
                    row.get("state", ""),
                    row.get("product_type", ""),
                    int(row.get("member_age", 0) or 0),
                    row.get("member_gender", ""),
                    row.get("primary_diagnosis", ""),
                    row.get("diagnosis_category", ""),
                    row.get("procedure_requested", ""),
                    row.get("procedure_category", ""),
                    row.get("level_of_care", ""),
                    row.get("request_received_date", None) or None,
                    row.get("review_start_date", None) or None,
                    row.get("review_completion_date", None) or None,
                    float(row.get("turnaround_hours", 0) or 0),
                    row.get("urgency", ""),
                    row.get("reviewer_id", ""),
                    row.get("reviewer_name", ""),
                    row.get("reviewer_type", ""),
                    int(row.get("pages_received", 0) or 0),
                    int(row.get("number_of_uploaded_documents", 0) or 0),
                    int(row.get("clinical_completeness_score", 0) or 0),
                    row.get("policy_id", ""),
                    row.get("policy_name", ""),
                    row.get("policy_version", ""),
                    row.get("determination", ""),
                    row.get("decision_rationale_category", ""),
                    row.get("appeal_filed", ""),
                    row.get("appeal_received_date", "") or None,
                    row.get("appeal_level", "") or None,
                    row.get("appeal_outcome", "") or None,
                    float(row.get("requested_cost", 0) or 0),
                    float(row.get("approved_cost", 0) or 0),
                    float(row.get("estimated_savings", 0) or 0),
                    row.get("first_pass_review", ""),
                    row.get("peer_review_required", ""),
                    row.get("peer_review_completed", ""),
                    int(row.get("sla_target_hours", 72) or 72),
                    row.get("sla_met", ""),
                    int(row.get("review_duration_minutes", 0) or 0),
                    int(row.get("number_of_policy_checks", 0) or 0),
                    int(row.get("number_of_clinical_criteria_matched", 0) or 0),
                ])
                rows_inserted += 1
            except Exception as e:
                print(f"Error loading row: {e}")
        
        conn.execute("COMMIT")
        print(f"[OK] Inserted {rows_inserted} historical PA records.")


if __name__ == "__main__":
    load_historical_pa()

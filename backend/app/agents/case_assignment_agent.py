"""
CareAudit AI — Case Assignment Agent
Distributes unassigned cases equally across nurses using workload balancing.
Supports both standard case assignment and appeal reassignment (to a different nurse).
"""
import uuid
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


def assign_cases_to_nurses(db) -> dict:
    """
    Scans all PENDING_REVIEW cases with no assigned nurse and distributes
    them round-robin to the nurse with the lowest current pending count.
    Uses assigned_nurse_id column (falls back to submitted_by for legacy compat).
    Returns a summary dict with assignment counts.
    """
    # Get all active nurses
    nurse_rows = db.execute(
        "SELECT id, full_name, npi as employee_id FROM users WHERE role = 'NURSE' ORDER BY npi"
    ).fetchall()

    if not nurse_rows:
        return {"assigned": 0, "message": "No nurses found in the system."}

    nurses = [{"id": r[0], "name": r[1], "employee_id": r[2]} for r in nurse_rows]

    # Build current pending workload per nurse
    # Check both assigned_nurse_id and submitted_by for backward compat
    for nurse in nurses:
        count_row = db.execute(
            """
            SELECT COUNT(*) FROM cases
            WHERE (assigned_nurse_id = ? OR (assigned_nurse_id IS NULL AND submitted_by = ?))
              AND status IN ('PENDING_REVIEW', 'IN_REVIEW')
            """,
            [nurse["id"], nurse["id"]],
        ).fetchone()
        nurse["pending"] = count_row[0] if count_row else 0

    # Get all unassigned pending cases
    unassigned = db.execute(
        """
        SELECT id FROM cases
        WHERE status = 'PENDING_REVIEW'
          AND assigned_nurse_id IS NULL
          AND (submitted_by IS NULL OR submitted_by = '')
        ORDER BY submitted_at ASC
        """
    ).fetchall()

    assigned_count = 0
    assignment_log = []

    for (case_id,) in unassigned:
        # Pick the nurse with the fewest pending cases
        nurses.sort(key=lambda n: n["pending"])
        target = nurses[0]

        # Update both columns for compatibility
        db.execute(
            "UPDATE cases SET assigned_nurse_id = ?, submitted_by = ? WHERE id = ?",
            [target["id"], target["id"], case_id],
        )

        target["pending"] += 1
        assigned_count += 1
        assignment_log.append({
            "case_id": case_id,
            "assigned_to": target["name"],
            "employee_id": target["employee_id"],
        })

    logger.info(f"[CaseAssignment] Assigned {assigned_count} cases across {len(nurses)} nurses.")

    return {
        "assigned": assigned_count,
        "assignments": assignment_log,
        "nurse_workloads": [
            {"nurse": n["name"], "employee_id": n["employee_id"], "pending": n["pending"]}
            for n in sorted(nurses, key=lambda x: x["employee_id"])
        ],
    }


def assign_single_case(case_id: str, db) -> str | None:
    """
    Assigns a single new case to the nurse with the lowest current workload.
    Returns the assigned nurse_id, or None if no nurses exist.
    """
    nurse_rows = db.execute(
        "SELECT id FROM users WHERE role = 'NURSE' ORDER BY npi"
    ).fetchall()
    if not nurse_rows:
        return None

    best_nurse_id = None
    best_count = float("inf")

    for (nid,) in nurse_rows:
        row = db.execute(
            """
            SELECT COUNT(*) FROM cases
            WHERE (assigned_nurse_id = ? OR (assigned_nurse_id IS NULL AND submitted_by = ?))
              AND status IN ('PENDING_REVIEW', 'IN_REVIEW')
            """,
            [nid, nid],
        ).fetchone()
        count = row[0] if row else 0
        if count < best_count:
            best_count = count
            best_nurse_id = nid

    if best_nurse_id:
        db.execute(
            "UPDATE cases SET assigned_nurse_id = ?, submitted_by = ? WHERE id = ?",
            [best_nurse_id, best_nurse_id, case_id],
        )
        logger.info(f"[CaseAssignment] Case {case_id} assigned to nurse {best_nurse_id} (workload: {best_count})")

    return best_nurse_id


def assign_appeal_case(appeal_case_id: str, original_nurse_id: str, db) -> str | None:
    """
    Assigns an appeal case to a DIFFERENT nurse than the one who made the original decision.
    This is a critical business rule — the same nurse must NEVER review their own appeal.
    
    Uses workload balancing among eligible nurses (excludes original nurse).
    Returns the assigned nurse_id, or None if no eligible nurses exist.
    """
    nurse_rows = db.execute(
        "SELECT id, full_name FROM users WHERE role = 'NURSE' AND id != ? ORDER BY npi",
        [original_nurse_id],
    ).fetchall()

    if not nurse_rows:
        # Edge case: only one nurse in the system — log warning
        logger.warning(f"[AppealAssignment] No alternative nurse available for appeal {appeal_case_id}")
        return None

    best_nurse_id = None
    best_count = float("inf")
    best_name = ""

    for nid, name in nurse_rows:
        # Count pending appeal cases assigned to this nurse
        row = db.execute(
            """
            SELECT COUNT(*) FROM appeal_intake_cases
            WHERE reviewer_assigned = ?
              AND (appeal_outcome IS NULL OR appeal_outcome = '')
            """,
            [nid],
        ).fetchone()
        # Also count standard pending cases
        row2 = db.execute(
            """
            SELECT COUNT(*) FROM cases
            WHERE (assigned_nurse_id = ? OR (assigned_nurse_id IS NULL AND submitted_by = ?))
              AND status IN ('PENDING_REVIEW', 'IN_REVIEW')
            """,
            [nid, nid],
        ).fetchone()
        total = (row[0] if row else 0) + (row2[0] if row2 else 0)
        if total < best_count:
            best_count = total
            best_nurse_id = nid
            best_name = name

    if best_nurse_id:
        # Update the appeal_intake_cases record with the new reviewer
        db.execute(
            "UPDATE appeal_intake_cases SET reviewer_assigned = ? WHERE id = ?",
            [best_nurse_id, appeal_case_id],
        )
        # Also store the original nurse for audit trail
        try:
            db.execute(
                "UPDATE appeal_intake_cases SET original_nurse_id = ? WHERE id = ? AND original_nurse_id IS NULL",
                [original_nurse_id, appeal_case_id],
            )
        except Exception:
            pass  # Column might not exist yet

        logger.info(
            f"[AppealAssignment] Appeal {appeal_case_id} assigned to {best_name} "
            f"(excluded original nurse {original_nurse_id}, workload: {best_count})"
        )

    return best_nurse_id

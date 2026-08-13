"""
CareAudit AI - Audit API Endpoints
Scoped by role: NURSE sees own audits, QA_LEAD sees their team's audits.
QA Lead can override QA score with notes.
"""
from fastapi import APIRouter, Depends, HTTPException
import json
import uuid
import sqlite3
from datetime import datetime, timezone
from app.database import get_db
from app.api.deps import get_current_user, get_scoped_nurse_ids, require_qa_lead_or_admin
from app.schemas.audit import AuditResultResponse, AuditFinding, AuditQueueItem

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/queue", response_model=list[AuditQueueItem])
async def get_audit_queue(
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Get the QA audit queue — scoped by role.
    NURSE → only their own decisions.
    QA_LEAD → all decisions by their 5 nurses.
    ADMIN/EXECUTIVE → all decisions.
    """
    nurse_ids = get_scoped_nurse_ids(user, db)
    if not nurse_ids:
        return []

    placeholders = ",".join(["?" for _ in nurse_ids])
    results = db.execute(f"""
        SELECT ar.id, ar.case_id, c.case_number, c.patient_name,
               c.primary_diagnosis_display AS diagnosis,
               u.full_name AS reviewer_name, nd.decision,
               ar.qa_score, ar.risk_level,
               COALESCE(ar.qa_verified, FALSE) AS qa_verified,
               CASE WHEN aic.id IS NOT NULL THEN 'appeal' ELSE 'prior_auth' END AS case_type,
               ar.audited_at
        FROM audit_results ar
        JOIN cases c ON ar.case_id = c.id
        LEFT JOIN nurse_decisions nd ON ar.decision_id = nd.id
        LEFT JOIN users u ON nd.reviewer_id = u.id
        LEFT JOIN appeal_intake_cases aic ON c.id = aic.case_id
        WHERE nd.reviewer_id IN ({placeholders}) AND c.status IN ('DECIDED', 'AUDITED')
        ORDER BY ar.audited_at DESC
    """, nurse_ids).fetchall()
    columns = [desc[0] for desc in db.description]
    return [AuditQueueItem(**dict(zip(columns, row))) for row in results]


@router.get("/{case_id}", response_model=AuditResultResponse)
async def get_audit_result(
    case_id: str,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Get audit result for a specific case.
    NURSE: can only see their own case audits.
    QA_LEAD: can see audits for their team's cases.
    Returns the effective score (override if set, else AI score) plus explanation.
    """
    result = db.execute("""
        SELECT ar.*, c.status as case_status, c.submitted_by, c.case_number, c.patient_name
        FROM audit_results ar
        JOIN cases c ON ar.case_id = c.id
        WHERE ar.case_id = ? 
        ORDER BY ar.audited_at DESC LIMIT 1
    """, [case_id]).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail=f"No audit result for case {case_id}")

    columns = [desc[0] for desc in db.description]
    audit_dict = dict(zip(columns, result))

    # Access control — check this case belongs to a nurse in scope
    nurse_ids = get_scoped_nurse_ids(user, db)
    nd = db.execute(
        "SELECT reviewer_id FROM nurse_decisions WHERE id = ?",
        [audit_dict.get("decision_id", "")]
    ).fetchone()
    
    has_access = False
    if audit_dict.get("submitted_by") in nurse_ids:
        has_access = True
    elif nd and nd[0] in nurse_ids:
        has_access = True
    
    if not has_access:
        # Check if user has an assigned peer review for this case
        try:
            pr = db.execute("SELECT id FROM peer_reviews WHERE case_id = ? AND assigned_to = ?", [case_id, user["id"]]).fetchone()
            if pr:
                has_access = True
        except Exception:
            pass
            
    if not has_access:
        raise HTTPException(status_code=403, detail="You do not have access to this audit result.")

    # Parse JSON fields
    for field in ("findings", "missing_evidence"):
        val = audit_dict.get(field)
        if isinstance(val, str):
            audit_dict[field] = json.loads(val)
        elif val is None:
            audit_dict[field] = []

    # Expose effective_score — override takes precedence
    audit_dict["effective_score"] = (
        audit_dict.get("qa_override_score") or audit_dict.get("qa_score")
    )

    return AuditResultResponse(**audit_dict)

def get_reviewer_id_for_case(db: sqlite3.Connection, case_id: str) -> str | None:
    row = db.execute("""
        SELECT nd.reviewer_id
        FROM audit_results ar
        JOIN nurse_decisions nd ON ar.decision_id = nd.id
        WHERE ar.case_id = ?
        LIMIT 1
    """, [case_id]).fetchone()
    return row[0] if row else None

def recalculate_reviewer_stats(db: sqlite3.Connection, reviewer_id: str):
    """
    Dynamically recalculate a reviewer's stats based on all verified or audited
    cases in the past 30 days, and update the reviewer_stats table.
    """
    if not reviewer_id:
        return

    # Compute averages from audit_results
    stats = db.execute("""
        SELECT 
            AVG(COALESCE(ar.qa_override_score, ar.qa_score)) as qa_score_avg,
            AVG(ar.documentation_completeness) as documentation_score,
            AVG(ar.policy_compliance) as policy_compliance,
            AVG(ar.consistency_score) as consistency_score,
            COUNT(ar.id) as case_volume
        FROM audit_results ar
        JOIN nurse_decisions nd ON ar.decision_id = nd.id
        WHERE nd.reviewer_id = ?
          AND (ar.qa_verified = TRUE OR ar.qa_override_score IS NOT NULL OR ar.audit_result IS NOT NULL)
          AND ar.audited_at >= date('now', '-30 days')
    """, [reviewer_id]).fetchone()

    if not stats or stats[0] is None:
        return

    qa_score_avg, doc_score, pol_comp, cons_score, volume = stats

    # Get actual decision distribution for approval/denial rates
    decisions = db.execute("""
        SELECT 
            COUNT(id) as total_decisions,
            SUM(CASE WHEN decision = 'APPROVED' THEN 1 ELSE 0 END) as approved_count,
            SUM(CASE WHEN decision = 'DENIED' THEN 1 ELSE 0 END) as denied_count
        FROM nurse_decisions
        WHERE reviewer_id = ? AND decision_timestamp >= date('now', '-30 days')
    """, [reviewer_id]).fetchone()

    if decisions and decisions[0] > 0:
        approval_rate = decisions[1] / decisions[0]
        denial_rate = decisions[2] / decisions[0]
    else:
        approval_rate = 0.8
        denial_rate = 0.2

    # Update the stats table
    db.execute("""
        UPDATE reviewer_stats 
        SET qa_score_avg = ?,
            documentation_score = ?,
            policy_compliance = ?,
            consistency_score = ?,
            case_volume = ?,
            approval_rate = ?,
            denial_rate = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE reviewer_id = ? AND period = '30d'
    """, [
        round(qa_score_avg, 1) if qa_score_avg is not None else None,
        round(doc_score, 1) if doc_score is not None else None,
        round(pol_comp, 1) if pol_comp is not None else None,
        round(cons_score, 1) if cons_score is not None else None,
        volume,
        round(approval_rate, 2),
        round(denial_rate, 2),
        reviewer_id
    ])

# ── QA LEAD: Override Score ─────────────────────────────────────────────────

@router.post("/{case_id}/score-override")
async def override_qa_score(
    case_id: str,
    body: dict,
    user: dict = Depends(require_qa_lead_or_admin()),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    QA Lead overrides the AI-generated QA score for a case.
    Body: { "score": 88, "notes": "Nurse cited policy verbally; documentation adjusted." }
    The AI score is preserved in original_ai_score; qa_score is updated to the override score.
    Nurses see the effective score and the QA Lead's note.
    """
    score = body.get("score")
    notes = body.get("notes", "")

    if score is None or not (0 <= int(score) <= 100):
        raise HTTPException(status_code=400, detail="score must be an integer 0–100")
    if not notes or len(notes.strip()) < 10:
        raise HTTPException(status_code=400, detail="notes must explain the override (min 10 chars)")

    # Verify audit result exists for this case
    audit = db.execute(
        "SELECT id, qa_score, original_ai_score FROM audit_results WHERE case_id = ? ORDER BY audited_at DESC LIMIT 1",
        [case_id],
    ).fetchone()
    if not audit:
        raise HTTPException(status_code=404, detail="No audit result found for this case.")

    audit_id = audit[0]
    current_qa_score = audit[1]
    original_ai_score = audit[2] if audit[2] is not None else current_qa_score

    # Determine standard risk level and result
    if int(score) >= 90:
        risk, result = "LOW", "PASS"
    elif int(score) >= 80:
        risk, result = "MEDIUM", "PASS"
    elif int(score) >= 60:
        risk, result = "HIGH", "FAIL"
    else:
        risk, result = "CRITICAL", "FAIL"

    db.execute("""
        UPDATE audit_results
           SET qa_score          = ?,
               risk_level        = ?,
               audit_result      = ?,
               original_ai_score = ?,
               qa_override_score = ?,
               qa_override_notes = ?,
               qa_override_by    = ?,
               qa_override_at    = ?
         WHERE id = ?
    """, [int(score), risk, result, original_ai_score, int(score), notes.strip(), user["id"], datetime.now(timezone.utc), audit_id])

    reviewer_id = get_reviewer_id_for_case(db, case_id)
    if reviewer_id:
        recalculate_reviewer_stats(db, reviewer_id)

    return {
        "success": True,
        "audit_id": audit_id,
        "case_id": case_id,
        "original_score": original_ai_score,
        "override_score": int(score),
        "override_by": user["full_name"],
        "notes": notes,
    }


@router.post("/{case_id}/complete")
async def complete_qa_audit_review(
    case_id: str,
    user: dict = Depends(require_qa_lead_or_admin()),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    QA Lead marks the QA review as complete.
    Changes case status from 'DECIDED' to 'AUDITED'.
    """
    case = db.execute("SELECT status FROM cases WHERE id = ?", [case_id]).fetchone()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    db.execute("UPDATE cases SET status = 'AUDITED' WHERE id = ?", [case_id])
    
    reviewer_id = get_reviewer_id_for_case(db, case_id)
    if reviewer_id:
        recalculate_reviewer_stats(db, reviewer_id)
        
    return {"success": True, "message": "Case marked as AUDITED"}


# ── QA LEAD: Element-Level Score Override ───────────────────────────────────

@router.post("/{case_id}/element-score-override")
async def element_score_override(
    case_id: str,
    body: dict,
    user: dict = Depends(require_qa_lead_or_admin()),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    QA Lead overrides individual dimension scores.
    Auto-calculates weighted total: CA*0.30 + DC*0.25 + PC*0.25 + CS*0.10 + TS*0.10
    """
    audit = db.execute(
        "SELECT id, qa_score, original_ai_score, clinical_accuracy, documentation_completeness, policy_compliance, consistency_score, timeliness_score FROM audit_results WHERE case_id = ? ORDER BY audited_at DESC LIMIT 1",
        [case_id],
    ).fetchone()
    if not audit:
        raise HTTPException(status_code=404, detail="No audit result found for this case.")

    audit_id = audit[0]
    original_ai_score = audit[2] if audit[2] is not None else audit[1]

    # Get new dimension scores (use existing if not provided)
    ca = body.get("clinical_accuracy", audit[3] or 80)
    dc = body.get("documentation_completeness", audit[4] or 80)
    pc = body.get("policy_compliance", audit[5] or 80)
    cs = body.get("consistency_score", audit[6] or 80)
    ts = body.get("timeliness_score", audit[7] or 80)
    notes = body.get("notes", "")

    # Validate
    for name, val in [("clinical_accuracy", ca), ("documentation_completeness", dc),
                       ("policy_compliance", pc), ("consistency_score", cs), ("timeliness_score", ts)]:
        if not (0 <= int(val) <= 100):
            raise HTTPException(status_code=400, detail=f"{name} must be 0-100")

    # Auto-calculate weighted total
    total = round(int(ca) * 0.40 + int(dc) * 0.20 + int(pc) * 0.20 + int(cs) * 0.10 + int(ts) * 0.10)

    # Determine risk level and result
    if total >= 90:
        risk, result = "LOW", "PASS"
    elif total >= 80:
        risk, result = "MEDIUM", "PASS"
    elif total >= 60:
        risk, result = "HIGH", "FAIL"
    else:
        risk, result = "CRITICAL", "FAIL"

    now = datetime.now(timezone.utc)
    db.execute("""
        UPDATE audit_results
           SET clinical_accuracy = ?, documentation_completeness = ?,
               policy_compliance = ?, consistency_score = ?, timeliness_score = ?,
               qa_score = ?, risk_level = ?, audit_result = ?,
               original_ai_score = ?,
               qa_override_score = ?, qa_override_notes = ?,
               qa_override_by = ?, qa_override_at = ?
         WHERE id = ?
    """, [int(ca), int(dc), int(pc), int(cs), int(ts),
          total, risk, result, original_ai_score,
          total, notes.strip() if notes else "Element-level score adjustment",
          user["id"], now, audit_id])

    reviewer_id = get_reviewer_id_for_case(db, case_id)
    if reviewer_id:
        recalculate_reviewer_stats(db, reviewer_id)

    return {
        "success": True,
        "audit_id": audit_id,
        "case_id": case_id,
        "clinical_accuracy": int(ca),
        "documentation_completeness": int(dc),
        "policy_compliance": int(pc),
        "consistency_score": int(cs),
        "timeliness_score": int(ts),
        "total_score": total,
        "risk_level": risk,
        "audit_result": result,
        "verified_by": user["full_name"],
    }


@router.post("/{case_id}/verify")
async def verify_qa_audit(
    case_id: str,
    body: dict = None,
    user: dict = Depends(require_qa_lead_or_admin()),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    QA Lead verifies the AI-generated QA score without changing it.
    Makes the score visible on the nurse's dashboard.
    """
    audit = db.execute(
        "SELECT id FROM audit_results WHERE case_id = ? ORDER BY audited_at DESC LIMIT 1",
        [case_id],
    ).fetchone()
    if not audit:
        raise HTTPException(status_code=404, detail="No audit result found for this case.")

    notes = body.get("notes", "") if body else ""
    now = datetime.now(timezone.utc)
    db.execute("""
        UPDATE audit_results
           SET qa_verified = TRUE, qa_verified_by = ?, qa_verified_at = ?, qa_verification_notes = ?
         WHERE id = ?
    """, [user["id"], now, notes.strip() if notes else None, audit[0]])

    db.execute("UPDATE cases SET status = 'AUDITED' WHERE id = ?", [case_id])

    reviewer_id = get_reviewer_id_for_case(db, case_id)
    if reviewer_id:
        recalculate_reviewer_stats(db, reviewer_id)

    return {"success": True, "message": "QA audit verified", "case_id": case_id}


# ── Nurses List (for peer review UI) ───────────────────────────────────────

@router.get("/nurses/list")
async def list_nurses(
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """List reviewers for peer review. QA Lead sees other QA Leads. Nurses see their scoped nurses."""
    if user.get("role") == "QA_LEAD":
        # Return all QA Leads except themselves
        rows = db.execute(
            "SELECT id, full_name, email, npi as employee_id FROM users WHERE role = 'QA_LEAD' AND id != ? ORDER BY full_name",
            [user["id"]]
        ).fetchall()
    else:
        nurse_ids = get_scoped_nurse_ids(user, db)
        if not nurse_ids:
            return []
        placeholders = ",".join(["?" for _ in nurse_ids])
        rows = db.execute(
            f"SELECT id, full_name, email, npi as employee_id FROM users WHERE id IN ({placeholders}) AND id != ? ORDER BY full_name",
            nurse_ids + [user["id"]],
        ).fetchall()
    
    cols = [d[0] for d in db.description]
    return [dict(zip(cols, r)) for r in rows]


# ── Peer Review Endpoints ───────────────────────────────────────────────────

@router.post("/{case_id}/peer-review")
async def request_peer_review(
    case_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    assigned_to = body.get("assigned_to")
    message = body.get("message", "")
    if not assigned_to:
        raise HTTPException(status_code=400, detail="assigned_to is required")
    nurse = db.execute("SELECT id FROM users WHERE id = ?", [assigned_to]).fetchone()
    if not nurse:
        raise HTTPException(status_code=404, detail="Target reviewer not found")
    pr_id = str(uuid.uuid4())
    db.execute("""
        INSERT INTO peer_reviews (id, case_id, requested_by, assigned_to, message, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
    """, [pr_id, case_id, user["id"], assigned_to, message, datetime.now(timezone.utc)])
    return {"status": "success", "id": pr_id}


@router.get("/peer-reviews/assigned")
async def get_assigned_peer_reviews(
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute("""
        SELECT pr.id, pr.case_id, c.case_number, c.patient_name,
               c.primary_diagnosis_display, pr.message, pr.status,
               u.full_name as requested_by_name, pr.created_at
        FROM peer_reviews pr
        JOIN cases c ON pr.case_id = c.id
        LEFT JOIN users u ON pr.requested_by = u.id
        WHERE pr.assigned_to = ?
        ORDER BY pr.created_at DESC
    """, [user["id"]]).fetchall()
    cols = [d[0] for d in db.description]
    return [dict(zip(cols, r)) for r in rows]


@router.post("/peer-reviews/{review_id}/complete")
async def complete_peer_review(
    review_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    findings = body.get("findings", "")
    db.execute("""
        UPDATE peer_reviews SET status='COMPLETED', findings=?, completed_at=? WHERE id=?
    """, [findings, datetime.now(timezone.utc), review_id])
    return {"status": "success"}


@router.post("/{case_id}/override")
async def override_finding(
    case_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    finding_index = body.get("finding_index", 0)
    rationale = body.get("rationale", "")
    original_finding = body.get("original_finding", "")
    if not rationale:
        raise HTTPException(status_code=400, detail="Override rationale is required")
    override_id = str(uuid.uuid4())
    db.execute("""
        INSERT INTO audit_overrides (id, case_id, overridden_by, finding_index,
               original_finding, override_rationale, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
    """, [override_id, case_id, user["id"], finding_index,
          original_finding, rationale, datetime.now(timezone.utc)])
    return {"status": "success", "id": override_id}

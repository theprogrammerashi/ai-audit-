import sqlite3
"""
CareAudit AI - Analytics API
Scoped: QA_LEAD sees only their 5 nurses. NURSE gets 403. ADMIN sees all.
"""
from fastapi import APIRouter, Depends, HTTPException
import json, duckdb
from app.database import get_db
from app.api.deps import get_current_user, get_scoped_nurse_ids
from app.schemas.analytics import ReviewerStats, TeamAnalytics, OrgAnalytics, ReviewerDetailResponse

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _parse_reviewer_row(row, columns) -> dict:
    rd = dict(zip(columns, row))
    if isinstance(rd.get("top_gaps"), str):
        rd["top_gaps"] = json.loads(rd["top_gaps"])
    elif rd.get("top_gaps") is None:
        rd["top_gaps"] = []
    rd["qa_score_30d"]    = round(rd.get("qa_score_avg") or 0, 2)
    rd["case_volume_30d"] = rd.get("case_volume") or 0
    return rd


@router.get("/reviewer/{reviewer_id}", response_model=ReviewerStats)
async def get_reviewer_stats(
    reviewer_id: str,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Individual reviewer performance. NURSE can only see their own stats."""
    role = user.get("role", "NURSE")

    if role == "NURSE" and reviewer_id != user["id"]:
        raise HTTPException(status_code=403, detail="Nurses can only view their own stats.")

    if role == "QA_LEAD":
        scoped = get_scoped_nurse_ids(user, db)
        if reviewer_id not in scoped:
            raise HTTPException(status_code=403, detail="This reviewer is not in your team.")

    result = db.execute("""
        SELECT rs.*, u.full_name AS name
        FROM reviewer_stats rs
        JOIN users u ON rs.reviewer_id = u.id
        WHERE rs.reviewer_id = ? AND rs.period = '30d'
        ORDER BY rs.updated_at DESC LIMIT 1
    """, [reviewer_id]).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail=f"No stats for reviewer {reviewer_id}")

    columns = [desc[0] for desc in db.description]
    return ReviewerStats(**_parse_reviewer_row(result, columns))


@router.get("/team", response_model=TeamAnalytics)
async def get_team_analytics(
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Team analytics — scoped.
    NURSE: 403 (no access to team view).
    QA_LEAD: sees their 5 nurses only.
    ADMIN/EXECUTIVE: sees all nurses.
    """
    role = user.get("role", "NURSE")

    if role == "NURSE":
        raise HTTPException(status_code=403, detail="Nurses do not have access to team analytics.")

    nurse_ids = get_scoped_nurse_ids(user, db)
    if not nurse_ids:
        return TeamAnalytics(reviewers=[], team_avg_qa_score=0, team_avg_approval_rate=0, total_cases=0)

    placeholders = ",".join(["?" for _ in nurse_ids])
    results = db.execute(f"""
        SELECT rs.*, u.full_name AS name
        FROM reviewer_stats rs
        JOIN users u ON rs.reviewer_id = u.id
        WHERE rs.reviewer_id IN ({placeholders}) AND rs.period = '30d'
        ORDER BY rs.qa_score_avg DESC
    """, nurse_ids).fetchall()
    columns = [desc[0] for desc in db.description]

    reviewers = [ReviewerStats(**_parse_reviewer_row(row, columns)) for row in results]
    avg_qa       = sum(r.qa_score_30d or 0 for r in reviewers) / len(reviewers) if reviewers else 0
    avg_approval = sum(r.approval_rate or 0 for r in reviewers) / len(reviewers) if reviewers else 0
    total_cases  = sum(r.case_volume_30d or 0 for r in reviewers)

    return TeamAnalytics(
        reviewers=reviewers,
        team_avg_qa_score=round(avg_qa, 1),
        team_avg_approval_rate=round(avg_approval, 2),
        total_cases=total_cases,
    )


@router.get("/reviewer/{reviewer_id}/detail", response_model=ReviewerDetailResponse)
async def get_reviewer_detail(
    reviewer_id: str,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Detailed breakdown for a reviewer. Scoped — same rules as /reviewer/{id}."""
    role = user.get("role", "NURSE")
    if role == "NURSE" and reviewer_id != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")
    if role == "QA_LEAD":
        scoped = get_scoped_nurse_ids(user, db)
        if reviewer_id not in scoped:
            raise HTTPException(status_code=403, detail="Reviewer not in your team.")

    reviewer = db.execute(
        "SELECT id, full_name, email, npi as employee_id FROM users WHERE id = ?", [reviewer_id]
    ).fetchone()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found.")

    rcols = [d[0] for d in db.description]
    reviewer_dict = dict(zip(rcols, reviewer))

    recent_cases = db.execute("""
        SELECT c.case_number, c.patient_name, c.primary_diagnosis_display,
               nd.decision, nd.decision_timestamp,
               ar.qa_score, ar.risk_level, ar.audit_result,
               ar.qa_override_score, ar.qa_ai_explanation
        FROM nurse_decisions nd
        JOIN cases c ON nd.case_id = c.id
        LEFT JOIN audit_results ar ON ar.decision_id = nd.id
        WHERE nd.reviewer_id = ?
        ORDER BY nd.decision_timestamp DESC LIMIT 10
    """, [reviewer_id]).fetchall()
    ccols = [d[0] for d in db.description]

    cases_list = []
    for row in recent_cases:
        d = dict(zip(ccols, row))
        if d.get("decision_timestamp") and not isinstance(d["decision_timestamp"], str):
            d["decision_timestamp"] = d["decision_timestamp"].isoformat()
        d["effective_score"] = d.get("qa_override_score") or d.get("qa_score")
        cases_list.append(d)

    stats = db.execute("""
        SELECT qa_score_avg, approval_rate, case_volume, top_gaps, trend,
               documentation_score, policy_compliance, consistency_score
        FROM reviewer_stats WHERE reviewer_id = ? AND period = '30d'
        ORDER BY updated_at DESC LIMIT 1
    """, [reviewer_id]).fetchone()
    stats_dict = {}
    if stats:
        scols = [d[0] for d in db.description]
        stats_dict = dict(zip(scols, stats))
        if isinstance(stats_dict.get("top_gaps"), str):
            stats_dict["top_gaps"] = json.loads(stats_dict["top_gaps"])

    # Compute dimension averages from audit_results if missing in reviewer_stats
    if not stats_dict.get("documentation_score") or not stats_dict.get("policy_compliance") or not stats_dict.get("consistency_score"):
        dim_avgs = db.execute("""
            SELECT AVG(ar.clinical_accuracy) as avg_ca,
                   AVG(ar.documentation_completeness) as avg_dc,
                   AVG(ar.policy_compliance) as avg_pc,
                   AVG(ar.consistency_score) as avg_cs,
                   AVG(ar.timeliness_score) as avg_ts
            FROM audit_results ar
            JOIN nurse_decisions nd ON ar.decision_id = nd.id
            WHERE nd.reviewer_id = ?
        """, [reviewer_id]).fetchone()
        if dim_avgs:
            stats_dict.setdefault("documentation_score", round(dim_avgs[1] or 0, 1))
            stats_dict.setdefault("policy_compliance", round(dim_avgs[2] or 0, 1))
            stats_dict.setdefault("consistency_score", round(dim_avgs[3] or 0, 1))
            # Store computed clinical accuracy too
            if dim_avgs[0]:
                stats_dict["clinical_accuracy_avg"] = round(dim_avgs[0], 1)
            if dim_avgs[4]:
                stats_dict["timeliness_avg"] = round(dim_avgs[4], 1)

    # Ensure top_gaps is never null
    if not stats_dict.get("top_gaps"):
        gaps = []
        doc_s = stats_dict.get("documentation_score", 0) or 0
        pol_s = stats_dict.get("policy_compliance", 0) or 0
        con_s = stats_dict.get("consistency_score", 0) or 0
        if doc_s < 85:
            gaps.append({"area": "Documentation", "score": doc_s, "recommendation": "Focus on citing specific lab values and policy codes in rationale"})
        if pol_s < 85:
            gaps.append({"area": "Policy Compliance", "score": pol_s, "recommendation": "Ensure every decision references applicable policy section"})
        if con_s < 85:
            gaps.append({"area": "Consistency", "score": con_s, "recommendation": "Align decisions with peer benchmarks for similar case types"})
        stats_dict["top_gaps"] = gaps[:3] if gaps else [{"area": "None", "score": 100, "recommendation": "Performance meets all benchmarks"}]

    return ReviewerDetailResponse(
        reviewer=reviewer_dict,
        recent_cases=cases_list,
        stats=stats_dict,
        ai_summary=(
            f"{reviewer_dict['full_name']} has completed {stats_dict.get('case_volume', 0)} cases "
            f"with an average QA score of {round(stats_dict.get('qa_score_avg') or 0, 1)}%. "
            f"Trend: {stats_dict.get('trend', 'N/A')}."
        ),
    )


@router.get("/org", response_model=OrgAnalytics)
async def get_org_analytics(
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Org-wide analytics — ADMIN/EXECUTIVE only."""
    if user.get("role") not in ("ADMIN", "EXECUTIVE"):
        raise HTTPException(status_code=403, detail="Access restricted to Admin/Executive roles.")

    rows = db.execute("""
        SELECT rs.*, u.full_name AS name
        FROM reviewer_stats rs JOIN users u ON rs.reviewer_id = u.id
        WHERE rs.period = '30d' ORDER BY rs.qa_score_avg DESC
    """).fetchall()
    columns = [desc[0] for desc in db.description]
    reviewers = [ReviewerStats(**_parse_reviewer_row(row, columns)) for row in rows]
    avg_qa = sum(r.qa_score_30d or 0 for r in reviewers) / len(reviewers) if reviewers else 0

    return OrgAnalytics(
        total_reviewers=len(reviewers),
        avg_qa_score=round(avg_qa, 1),
        reviewers=reviewers,
    )

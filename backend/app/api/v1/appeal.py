"""
CareAudit AI - Appeal API Endpoints
Appeal risk predictions and dashboard, scoped by role.
"""
from fastapi import APIRouter, Depends, HTTPException
import json
import duckdb
from app.database import get_db
from app.api.deps import get_current_user, get_scoped_nurse_ids, require_qa_lead_or_admin
from typing import Optional, List
from pydantic import BaseModel
from app.schemas.appeal import AppealRiskResponse, AppealDashboardItem, AppealDashboardResponse, AppealIntakeItem, AppealAnalyticsResponse

router = APIRouter(prefix="/appeal", tags=["Appeal Risk"])


@router.get("/risk/{case_id}", response_model=AppealRiskResponse)
async def get_appeal_risk(
    case_id: str,
    user: dict = Depends(get_current_user),
    db: duckdb.DuckDBPyConnection = Depends(get_db)
):
    """Get appeal risk prediction for a specific case."""
    result = db.execute("SELECT * FROM appeals WHERE case_id = ? ORDER BY created_at DESC LIMIT 1", [case_id]).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail=f"No appeal risk data for case {case_id}")

    columns = [desc[0] for desc in db.description]
    appeal_dict = dict(zip(columns, result))

    # RBAC Guard
    role = user.get("role", "NURSE")
    if role in ("NURSE", "QA_LEAD"):
        nurse_ids = get_scoped_nurse_ids(user, db)
        nd = db.execute("SELECT reviewer_id FROM nurse_decisions WHERE id = ?", [appeal_dict.get("decision_id")]).fetchone()
        if nd and nd[0] not in nurse_ids:
            raise HTTPException(status_code=403, detail="Access denied")

    if isinstance(appeal_dict.get("top_risk_factors"), str):
        appeal_dict["top_risk_factors"] = json.loads(appeal_dict["top_risk_factors"])
    elif appeal_dict.get("top_risk_factors") is None:
        appeal_dict["top_risk_factors"] = []

    return AppealRiskResponse(
        case_id=case_id,
        appeal_overturn_probability=appeal_dict.get("overturn_probability", 0.0),
        risk_category=appeal_dict.get("risk_category", "LOW"),
        financial_exposure_estimate=appeal_dict.get("financial_exposure_estimate", 0.0),
        top_risk_factors=appeal_dict.get("top_risk_factors", []),
        recommendation=appeal_dict.get("recommendation", ""),
        model_confidence=appeal_dict.get("model_confidence", 0.0)
    )


@router.get("/dashboard", response_model=AppealDashboardResponse)
async def get_appeal_dashboard(
    user: dict = Depends(get_current_user),
    db: duckdb.DuckDBPyConnection = Depends(get_db)
):
    """Get appeal risk dashboard — nurses see own cases, QA Leads see team."""
    role = user.get("role", "NURSE")
    uid = user["id"]

    if role == "NURSE":
        # Nurses see only their own denied cases with appeal risk
        results = db.execute("""
            SELECT a.case_id, c.case_number, c.patient_name,
                   c.primary_diagnosis_display as diagnosis,
                   nd.decision, a.overturn_probability, a.risk_category,
                   a.financial_exposure_estimate as financial_exposure,
                   u.full_name as reviewer_name, nd.decision_timestamp as decision_date,
                   a.top_risk_factors, a.recommendation as appeal_recommendation, a.model_confidence
            FROM appeals a
            JOIN cases c ON a.case_id = c.id
            LEFT JOIN nurse_decisions nd ON a.decision_id = nd.id
            LEFT JOIN users u ON nd.reviewer_id = u.id
            WHERE nd.reviewer_id = ?
            ORDER BY a.overturn_probability DESC
        """, [uid]).fetchall()
    else:
        # QA Lead / Admin / Executive — scoped to team
        nurse_ids = get_scoped_nurse_ids(user, db)
        if not nurse_ids:
            return AppealDashboardResponse(high_risk_cases=[], total_exposure=0, avg_overturn_probability=0, total_cases=0)
        placeholders = ",".join(["?" for _ in nurse_ids])
        results = db.execute(f"""
            SELECT a.case_id, c.case_number, c.patient_name,
                   c.primary_diagnosis_display as diagnosis,
                   nd.decision, a.overturn_probability, a.risk_category,
                   a.financial_exposure_estimate as financial_exposure,
                   u.full_name as reviewer_name, nd.decision_timestamp as decision_date,
                   a.top_risk_factors, a.recommendation as appeal_recommendation, a.model_confidence
            FROM appeals a
            JOIN cases c ON a.case_id = c.id
            LEFT JOIN nurse_decisions nd ON a.decision_id = nd.id
            LEFT JOIN users u ON nd.reviewer_id = u.id
            WHERE nd.reviewer_id IN ({placeholders})
            ORDER BY a.overturn_probability DESC
        """, nurse_ids).fetchall()

    columns = [desc[0] for desc in db.description]
    items = []
    for row in results:
        d = dict(zip(columns, row))
        if isinstance(d.get('top_risk_factors'), str):
            try: d['top_risk_factors'] = json.loads(d['top_risk_factors'])
            except: d['top_risk_factors'] = []
        elif d.get('top_risk_factors') is None:
            d['top_risk_factors'] = []
        items.append(AppealDashboardItem(**d))
    total_exposure = sum(i.financial_exposure for i in items)
    avg_prob = sum(i.overturn_probability for i in items) / len(items) if items else 0.0

    return AppealDashboardResponse(
        high_risk_cases=items,
        total_exposure=total_exposure,
        avg_overturn_probability=avg_prob,
        total_cases=len(items)
    )


@router.get("/intake-cases", response_model=List[AppealIntakeItem])
async def get_appeal_intake_cases(user: dict = Depends(get_current_user), db=Depends(get_db)):
    try:
        role = user.get("role", "NURSE")
        if role == "NURSE":
            results = db.execute(
                "SELECT * FROM appeal_intake_cases WHERE reviewer_assigned = ? ORDER BY appeal_received_date DESC",
                [user["id"]]
            ).fetchall()
        elif role == "QA_LEAD":
            nurse_ids = get_scoped_nurse_ids(user, db)
            if not nurse_ids:
                return []
            placeholders = ",".join(["?" for _ in nurse_ids])
            results = db.execute(
                f"SELECT * FROM appeal_intake_cases WHERE reviewer_assigned IN ({placeholders}) ORDER BY appeal_received_date DESC",
                nurse_ids
            ).fetchall()
        else:
            # ADMIN / EXECUTIVE — see all
            results = db.execute("SELECT * FROM appeal_intake_cases ORDER BY appeal_received_date DESC").fetchall()
        columns = [desc[0] for desc in db.description]
        return [AppealIntakeItem(**dict(zip(columns, row))) for row in results]
    except:
        return []

class AppealDecisionSubmit(BaseModel):
    decision: str
    rationale: str

@router.post("/intake-cases/{id}/decision")
async def submit_appeal_decision(id: str, decision_data: AppealDecisionSubmit, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Submit appeal decision — updates appeal outcome and tracks lifecycle."""
    try:
        import uuid
        from datetime import datetime, timezone

        # Fetch the appeal case
        appeal_row = db.execute("SELECT * FROM appeal_intake_cases WHERE id = ?", [id]).fetchone()
        if not appeal_row:
            raise HTTPException(status_code=404, detail="Appeal case not found")
        
        acols = [desc[0] for desc in db.description]
        appeal_dict = dict(zip(acols, appeal_row))

        # NURSE access guard — must be the assigned reviewer
        if user.get("role") == "NURSE":
            if appeal_dict.get("reviewer_assigned") != user["id"]:
                raise HTTPException(status_code=403, detail="This appeal is not assigned to you.")
            # Also ensure it's not the original nurse
            if appeal_dict.get("original_nurse_id") == user["id"]:
                raise HTTPException(status_code=403, detail="You cannot review your own appeal.")

        # Update the appeal record
        resolution_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Calculate turnaround
        turnaround = None
        if appeal_dict.get("appeal_received_date"):
            try:
                received = appeal_dict["appeal_received_date"]
                if isinstance(received, str):
                    from datetime import date
                    received = date.fromisoformat(received)
                turnaround = (datetime.now(timezone.utc).date() - received).days
            except Exception:
                turnaround = 0

        db.execute("""
            UPDATE appeal_intake_cases
            SET appeal_outcome = ?,
                clinical_rationale_provided = ?,
                resolution_date = ?,
                turnaround_days = ?
            WHERE id = ?
        """, [decision_data.decision, decision_data.rationale, resolution_date, turnaround, id])

        # Record in audit_log for HIPAA compliance
        db.execute("""
            INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, timestamp)
            VALUES (?, ?, ?, 'appeal_intake', ?, CURRENT_TIMESTAMP)
        """, [str(uuid.uuid4()), user["id"], f"APPEAL_{decision_data.decision.upper()}", id])

        return {
            "status": "success", 
            "message": f"Appeal {decision_data.decision.lower()} recorded",
            "appeal_id": id,
            "resolution_date": resolution_date,
            "turnaround_days": turnaround,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record decision: {str(e)}")
@router.post("/intake-cases/{id}/reassign")
async def reassign_appeal_case(id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Auto-assigns the appeal to a DIFFERENT nurse."""
    try:
        from app.agents.case_assignment_agent import assign_appeal_case
        # Get original nurse
        row = db.execute("SELECT original_nurse_id FROM appeal_intake_cases WHERE id = ?", [id]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Appeal case not found")
        
        orig_nurse = row[0]
        if not orig_nurse:
            # Fallback if somehow not set
            orig_nurse = "SYSTEM"
            
        new_nurse = assign_appeal_case(id, orig_nurse, db)
        if not new_nurse:
            raise HTTPException(status_code=400, detail="No eligible nurse found for reassignment (must not be the original reviewer)")
            
        return {"status": "success", "message": "Appeal reassigned to new nurse", "assigned_nurse_id": new_nurse}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/intake-cases/{id}", response_model=AppealIntakeItem)
async def get_appeal_intake_case(id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    try:
        result = db.execute("SELECT * FROM appeal_intake_cases WHERE id = ?", [id]).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Appeal case not found")
        columns = [desc[0] for desc in db.description]
        item_dict = dict(zip(columns, result))

        # RBAC access check
        role = user.get("role", "NURSE")
        if role == "NURSE":
            if item_dict.get("reviewer_assigned") != user["id"]:
                raise HTTPException(status_code=403, detail="Access denied")
        elif role == "QA_LEAD":
            nurse_ids = get_scoped_nurse_ids(user, db)
            if item_dict.get("reviewer_assigned") not in nurse_ids:
                raise HTTPException(status_code=403, detail="Access denied")

        return AppealIntakeItem(**item_dict)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/analytics", response_model=AppealAnalyticsResponse)
async def get_appeal_analytics(user: dict = Depends(get_current_user), db=Depends(get_db)):
    try:
        # Build role-scoped WHERE clause
        role = user.get("role", "NURSE")
        scope_clause = ""
        scope_params: list = []
        if role == "NURSE":
            scope_clause = "WHERE reviewer_assigned = ?"
            scope_params = [user["id"]]
        elif role == "QA_LEAD":
            nurse_ids = get_scoped_nurse_ids(user, db)
            if nurse_ids:
                placeholders = ",".join(["?" for _ in nurse_ids])
                scope_clause = f"WHERE reviewer_assigned IN ({placeholders})"
                scope_params = nurse_ids
            else:
                return AppealAnalyticsResponse(overturn_rate_by_denial_reason={}, overturn_rate_by_diagnosis={}, avg_turnaround_time_by_level={}, financial_summary={"total_disputed": 0.0, "total_recovered": 0.0}, top_reasons_for_overturn=[], outcome_distribution={})
        # ADMIN/EXECUTIVE: no scope_clause, sees all

        denial_reason_res = db.execute(f"""
            SELECT denial_reason_category, COUNT(*) as total, SUM(CASE WHEN appeal_outcome LIKE '%Overturned%' THEN 1 ELSE 0 END) as overturned
            FROM appeal_intake_cases {scope_clause} GROUP BY denial_reason_category
        """, scope_params).fetchall()
        overturn_by_reason = {row[0]: (row[2]/row[1]) if row[1] > 0 else 0 for row in denial_reason_res}

        dx_res = db.execute(f"""
            SELECT diagnosis_category, COUNT(*) as total, SUM(CASE WHEN appeal_outcome LIKE '%Overturned%' THEN 1 ELSE 0 END) as overturned
            FROM appeal_intake_cases {scope_clause} GROUP BY diagnosis_category
        """, scope_params).fetchall()
        overturn_by_dx = {row[0]: (row[2]/row[1]) if row[1] > 0 else 0 for row in dx_res}

        tat_res = db.execute(f"SELECT appeal_level, AVG(turnaround_days) FROM appeal_intake_cases {scope_clause} GROUP BY appeal_level", scope_params).fetchall()
        tat_by_level = {row[0]: row[1] for row in tat_res}

        fin_res = db.execute(f"""
            SELECT SUM(financial_amount_disputed) as total_disputed,
                   SUM(CASE WHEN appeal_outcome LIKE '%Overturned%' THEN financial_amount_disputed ELSE 0 END) as total_recovered
            FROM appeal_intake_cases {scope_clause}
        """, scope_params).fetchone()
        financial_summary = {"total_disputed": fin_res[0] or 0.0, "total_recovered": fin_res[1] or 0.0}

        # Dynamic top reasons for overturn
        scope_and = scope_clause.replace("WHERE", "AND") if scope_clause else ""
        top_reasons_res = db.execute(f"""
            SELECT clinical_rationale_provided
            FROM appeal_intake_cases
            WHERE appeal_outcome LIKE '%Overturned%'
              AND clinical_rationale_provided IS NOT NULL
              AND clinical_rationale_provided != ''
              {scope_and}
            LIMIT 5
        """, scope_params).fetchall()
        top_reasons = [row[0] for row in top_reasons_res]

        # Outcome distribution
        outcome_res = db.execute(f"""
            SELECT
              SUM(CASE WHEN appeal_outcome LIKE '%Overturned%' THEN 1 ELSE 0 END) as overturned,
              SUM(CASE WHEN appeal_outcome = 'Upheld' THEN 1 ELSE 0 END) as upheld,
              SUM(CASE WHEN appeal_outcome IS NULL THEN 1 ELSE 0 END) as pending
            FROM appeal_intake_cases {scope_clause}
        """, scope_params).fetchone()
        outcome_distribution = {
            "overturned": outcome_res[0] or 0,
            "upheld": outcome_res[1] or 0,
            "pending": outcome_res[2] or 0
        }

        return AppealAnalyticsResponse(
            overturn_rate_by_denial_reason=overturn_by_reason,
            overturn_rate_by_diagnosis=overturn_by_dx,
            avg_turnaround_time_by_level=tat_by_level,
            financial_summary=financial_summary,
            top_reasons_for_overturn=top_reasons,
            outcome_distribution=outcome_distribution
        )
    except:
        return AppealAnalyticsResponse(overturn_rate_by_denial_reason={}, overturn_rate_by_diagnosis={}, avg_turnaround_time_by_level={}, financial_summary={"total_disputed": 0.0, "total_recovered": 0.0}, top_reasons_for_overturn=[], outcome_distribution={})

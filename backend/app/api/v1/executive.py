"""
CareAudit AI - Executive Dashboard API Endpoints
Powered by real historical PA data (1,000 records).
Scoped strictly to ADMIN/EXECUTIVE roles.
"""
from fastapi import APIRouter, Depends, HTTPException
import duckdb
from app.database import get_db
from app.api.deps import require_qa_lead_or_admin

router = APIRouter(prefix="/executive", tags=["Executive"])


@router.get("/dashboard")
async def get_executive_dashboard(
    user: dict = Depends(require_qa_lead_or_admin()),
    db: duckdb.DuckDBPyConnection = Depends(get_db)
):
    """Get executive dashboard with real aggregated data. Restricted to Admin/Executive."""
    data = {}

    try:
        total = db.execute("SELECT COUNT(*) FROM historical_pa").fetchone()[0]
    except Exception:
        total = 0

    if total == 0:
        return {
            "kpis": {"total_cases": 0, "approval_rate": 0, "denial_rate": 0, "avg_turnaround": 0, "sla_compliance": 0, "total_savings": 0},
            "determination_breakdown": [], "dx_breakdown": [], "financial_summary": [],
            "turnaround_distribution": [], "regional_performance": [], "reviewer_performance": [],
            "monthly_trends": [],
        }

    kpis_row = db.execute("""
        SELECT 
            COUNT(*) as total_cases,
            ROUND(SUM(CASE WHEN determination = 'Approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as approval_rate,
            ROUND(SUM(CASE WHEN determination = 'Denied' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as denial_rate,
            ROUND(AVG(turnaround_hours), 1) as avg_turnaround,
            ROUND(SUM(CASE WHEN sla_met = 'Yes' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as sla_compliance,
            ROUND(SUM(estimated_savings), 2) as total_savings,
            ROUND(AVG(clinical_completeness_score), 1) as avg_completeness,
            ROUND(SUM(requested_cost), 2) as total_requested,
            ROUND(SUM(approved_cost), 2) as total_approved,
            ROUND(AVG(review_duration_minutes), 1) as avg_review_minutes,
            ROUND(SUM(CASE WHEN appeal_filed = 'Yes' THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN determination = 'Denied' THEN 1 ELSE 0 END), 0), 1) as appeal_rate,
            SUM(CASE WHEN determination = 'Partial Approval' THEN 1 ELSE 0 END) as partial_count,
            SUM(CASE WHEN determination = 'Modified Approval' THEN 1 ELSE 0 END) as modified_count
        FROM historical_pa
    """).fetchone()

    data["kpis"] = {
        "total_cases": kpis_row[0], "approval_rate": kpis_row[1], "denial_rate": kpis_row[2],
        "avg_turnaround": kpis_row[3], "sla_compliance": kpis_row[4], "total_savings": kpis_row[5],
        "avg_completeness": kpis_row[6], "total_requested": kpis_row[7], "total_approved": kpis_row[8],
        "avg_review_minutes": kpis_row[9], "appeal_rate": kpis_row[10] or 0,
        "partial_count": kpis_row[11] or 0, "modified_count": kpis_row[12] or 0
    }

    det_rows = db.execute("SELECT determination, COUNT(*) as count FROM historical_pa GROUP BY determination ORDER BY count DESC").fetchall()
    data["determination_breakdown"] = [{"label": r[0], "value": r[1]} for r in det_rows]

    dx_rows = db.execute("""
        SELECT diagnosis_category, COUNT(*) as total,
               SUM(CASE WHEN determination = 'Approved' THEN 1 ELSE 0 END) as approved,
               SUM(CASE WHEN determination = 'Denied' THEN 1 ELSE 0 END) as denied,
               SUM(CASE WHEN determination = 'Partial Approval' THEN 1 ELSE 0 END) as partial,
               SUM(CASE WHEN determination = 'Modified Approval' THEN 1 ELSE 0 END) as modified,
               ROUND(AVG(requested_cost), 0) as avg_cost, ROUND(SUM(estimated_savings), 0) as savings
        FROM historical_pa GROUP BY diagnosis_category ORDER BY total DESC
    """).fetchall()
    data["dx_breakdown"] = [{"dx": r[0], "total": r[1], "approved": r[2], "denied": r[3], "partial": r[4], "modified": r[5], "avg_cost": r[6], "savings": r[7]} for r in dx_rows]

    fin_rows = db.execute("""
        SELECT diagnosis_category, ROUND(SUM(requested_cost), 0) as requested,
               ROUND(SUM(approved_cost), 0) as approved, ROUND(SUM(estimated_savings), 0) as savings
        FROM historical_pa GROUP BY diagnosis_category ORDER BY requested DESC
    """).fetchall()
    data["financial_summary"] = [{"dx": r[0], "requested": r[1], "approved": r[2], "savings": r[3]} for r in fin_rows]

    ta_rows = db.execute("""
        SELECT CASE WHEN turnaround_hours <= 2 THEN '0-2h' 
                    WHEN turnaround_hours <= 4 THEN '2-4h'
                    WHEN turnaround_hours <= 8 THEN '4-8h' 
                    WHEN turnaround_hours <= 12 THEN '8-12h' 
                    WHEN turnaround_hours <= 24 THEN '12-24h' 
                    WHEN turnaround_hours <= 48 THEN '24-48h' 
                    ELSE '48h+' END as bucket, COUNT(*) as count
        FROM historical_pa GROUP BY bucket ORDER BY MIN(turnaround_hours)
    """).fetchall()
    data["turnaround_distribution"] = [{"bucket": r[0], "count": r[1]} for r in ta_rows]

    reg_rows = db.execute("""
        SELECT region, COUNT(*) as total, ROUND(SUM(CASE WHEN determination = 'Approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as approval_rate,
               ROUND(AVG(turnaround_hours), 1) as avg_turnaround, ROUND(SUM(CASE WHEN sla_met = 'Yes' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as sla_rate
        FROM historical_pa GROUP BY region ORDER BY total DESC
    """).fetchall()
    data["regional_performance"] = [{"region": r[0], "total": r[1], "approval_rate": r[2], "avg_turnaround": r[3], "sla_rate": r[4]} for r in reg_rows]

    rev_rows = db.execute("""
        SELECT reviewer_name, reviewer_type, COUNT(*) as total_cases,
               ROUND(SUM(CASE WHEN determination = 'Approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as approval_rate,
               ROUND(AVG(review_duration_minutes), 1) as avg_review_time, ROUND(AVG(clinical_completeness_score), 1) as avg_completeness
        FROM historical_pa GROUP BY reviewer_name, reviewer_type ORDER BY total_cases DESC LIMIT 15
    """).fetchall()
    data["reviewer_performance"] = [{"name": r[0], "type": r[1], "total": r[2], "approval_rate": r[3], "avg_review_time": r[4], "avg_completeness": r[5]} for r in rev_rows]

    try:
        trend_rows = db.execute("""
            SELECT EXTRACT(YEAR FROM CAST(request_received_date AS DATE)) as yr,
                   EXTRACT(MONTH FROM CAST(request_received_date AS DATE)) as mo,
                   COUNT(*) as total, SUM(CASE WHEN determination = 'Approved' THEN 1 ELSE 0 END) as approved,
                   SUM(CASE WHEN determination = 'Denied' THEN 1 ELSE 0 END) as denied, ROUND(SUM(estimated_savings), 0) as savings
            FROM historical_pa WHERE request_received_date IS NOT NULL GROUP BY yr, mo ORDER BY yr, mo
        """).fetchall()
        months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        data["monthly_trends"] = [{"month": months[int(r[1])-1] + " " + str(int(r[0])), "total": r[2], "approved": r[3], "denied": r[4], "savings": r[5]} for r in trend_rows]
    except Exception:
        data["monthly_trends"] = []

    return data

"""
CareAudit AI — Public Stats Endpoint
Returns aggregated metrics derived from the 1,000-case historical dataset.
No authentication required (public landing-page data).
"""
from fastapi import APIRouter, Depends
import duckdb
from app.database import get_db

router = APIRouter(prefix="/stats", tags=["Public Stats"])

# ── Hard-coded from Historical_Prior_Authorization_Dataset_1000.csv ────────────
# Computed offline; served as static JSON for landing-page speed.
HISTORICAL_STATS = {
    "total_cases": 1000,
    "approved": 685,
    "denied": 113,
    "appealed": 21,
    "sla_met": 928,
    "sla_pct": 92.8,
    "total_savings_m": 13.2,
    "approval_rate": 68.5,
    "avg_tat_h": 34.4,
    "first_pass_pct": 49.5,
    "peer_review_pct": 47.6,
    # Monthly sparkline data (Jan–Dec 2025)
    "months": [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ],
    "monthly_cases":    [48, 33, 33, 40, 43, 51, 40, 43, 38, 42, 47, 52],
    "monthly_savings_k":[452, 297, 372, 223, 192, 897, 282, 777, 423, 461, 797, 687],
    "monthly_approval": [77, 67, 70, 85, 74, 71, 70, 51, 82, 64, 66, 71],
    "monthly_tat":      [34, 28, 34, 30, 34, 35, 31, 34, 34, 30, 37, 42],
}


@router.get("/public")
async def get_public_stats():
    """
    Public endpoint — no auth required.
    Returns aggregated metrics for the landing page.
    Data sourced from 1,000 historical prior authorization records (2025).
    """
    return HISTORICAL_STATS


@router.get("/live")
async def get_live_stats(db: duckdb.DuckDBPyConnection = Depends(get_db)):
    """
    Live stats from the active DuckDB database.
    Returns real-time case counts, QA averages, etc.
    No auth required (aggregate only — no PII exposed).
    """
    try:
        total = db.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
        audited = db.execute("SELECT COUNT(*) FROM audit_results").fetchone()[0]
        avg_qa = db.execute("SELECT AVG(qa_score) FROM audit_results").fetchone()[0] or 0
        decisions = db.execute("SELECT COUNT(*) FROM nurse_decisions").fetchone()[0]
        approved = db.execute(
            "SELECT COUNT(*) FROM nurse_decisions WHERE decision='APPROVED'"
        ).fetchone()[0]

        return {
            "live_cases": total,
            "live_decisions": decisions,
            "live_approved": approved,
            "live_approval_rate": round(approved / decisions * 100, 1) if decisions else 0,
            "live_audited": audited,
            "live_avg_qa": round(avg_qa, 1),
            # Fall back to historical for sparklines
            **{k: v for k, v in HISTORICAL_STATS.items()
               if k.startswith("monthly") or k == "months"},
        }
    except Exception:
        # If DB has no data yet, return historical
        return HISTORICAL_STATS

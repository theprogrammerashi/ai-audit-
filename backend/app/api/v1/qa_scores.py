"""
CareAudit AI - QA Scores API Endpoints
"""
from fastapi import APIRouter, Depends
import duckdb
from app.database import get_db
from app.api.deps import get_current_user

router = APIRouter(prefix="/qa-scores", tags=["QA Scores"])


@router.get("/summary")
async def get_qa_summary(
    user: dict = Depends(get_current_user),
    db: duckdb.DuckDBPyConnection = Depends(get_db)
):
    """Get QA score summary statistics."""
    result = db.execute("""
        SELECT 
            COUNT(*) as total_audits,
            AVG(qa_score) as avg_score,
            MIN(qa_score) as min_score,
            MAX(qa_score) as max_score,
            SUM(CASE WHEN qa_score >= 90 THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN qa_score < 75 THEN 1 ELSE 0 END) as high_risk
        FROM audit_results
    """).fetchone()
    
    return {
        "total_audits": result[0],
        "average_score": round(result[1], 1) if result[1] else 0,
        "min_score": result[2] or 0,
        "max_score": result[3] or 0,
        "pass_count": result[4] or 0,
        "high_risk_count": result[5] or 0,
        "pass_rate": round((result[4] / result[0]) * 100, 1) if result[0] > 0 else 0
    }

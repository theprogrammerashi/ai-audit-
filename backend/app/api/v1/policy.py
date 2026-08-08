"""
CareAudit AI - Policy API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
import sqlite3
from app.database import get_db
from app.api.deps import get_current_user

router = APIRouter(prefix="/policy", tags=["Policy"])


@router.get("/")
async def list_policies(
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    """List all available policies."""
    results = db.execute("SELECT * FROM policies ORDER BY policy_code").fetchall()
    columns = [desc[0] for desc in db.description]
    return [dict(zip(columns, row)) for row in results]


@router.get("/{policy_code}")
async def get_policy(
    policy_code: str,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get policy details by code."""
    result = db.execute("SELECT * FROM policies WHERE policy_code = ?", [policy_code]).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail=f"Policy {policy_code} not found")
    columns = [desc[0] for desc in db.description]
    return dict(zip(columns, result))

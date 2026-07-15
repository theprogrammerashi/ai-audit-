"""
CareAudit AI - API Dependencies
Dependency injection for auth, database connections, and role-based access.
Now includes scoped team helpers for QA Lead / Nurse data isolation.
"""
from fastapi import Depends, Header
from typing import Optional
import duckdb
from app.database import get_db, get_connection
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedError, ForbiddenError


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: duckdb.DuckDBPyConnection = Depends(get_db)
):
    """Extract and validate the current user from the JWT token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError()

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise UnauthorizedError("Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Invalid token payload")

    result = db.execute("SELECT * FROM users WHERE id = ?", [user_id]).fetchone()
    if not result:
        raise UnauthorizedError("User not found")

    columns = [desc[0] for desc in db.description]
    user = dict(zip(columns, result))
    return user


async def get_optional_user(
    authorization: Optional[str] = Header(None),
    db: duckdb.DuckDBPyConnection = Depends(get_db)
):
    """Get current user if authenticated, None otherwise."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return await get_current_user(authorization, db)
    except Exception:
        return None


def require_role(*roles: str):
    """Dependency factory — requires user to have one of the specified roles."""
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise ForbiddenError(
                f"Role '{user['role']}' not authorized. Required: {', '.join(roles)}"
            )
        return user
    return role_checker


def require_nurse():
    return require_role("NURSE")


def require_qa_lead():
    return require_role("QA_LEAD")


def require_qa_lead_or_admin():
    return require_role("QA_LEAD", "ADMIN", "EXECUTIVE")


def require_admin():
    return require_role("ADMIN", "EXECUTIVE")


def get_scoped_nurse_ids(user: dict, db: duckdb.DuckDBPyConnection) -> list[str]:
    """
    Returns the list of nurse user-IDs that the current user may see.
    - NURSE      → only their own ID
    - QA_LEAD    → IDs of the 5 nurses who report to them
    - ADMIN/EXEC → all nurse IDs
    """
    role = user.get("role", "NURSE")
    uid  = user["id"]

    if role == "NURSE":
        return [uid]

    if role == "QA_LEAD":
        rows = db.execute(
            "SELECT id FROM users WHERE role = 'NURSE' AND qa_lead_id = ?", [uid]
        ).fetchall()
        return [uid] + [r[0] for r in rows]

    # ADMIN / EXECUTIVE — all nurses
    rows = db.execute("SELECT id FROM users WHERE role = 'NURSE'").fetchall()
    return [r[0] for r in rows]

"""
CareAudit AI - Auth API Endpoints
Login, token refresh, logout.
"""
from fastapi import APIRouter, Depends, HTTPException, status
import duckdb
from app.database import get_db
from app.core.security import verify_password, create_access_token
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: duckdb.DuckDBPyConnection = Depends(get_db)):
    """Authenticate user and return JWT token."""
    result = db.execute("SELECT * FROM users WHERE email = ?", [request.email]).fetchone()
    if not result:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    
    columns = [desc[0] for desc in db.description]
    user = dict(zip(columns, result))
    
    if not verify_password(request.password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            npi=user.get("npi"),
            created_at=user.get("created_at")
        )
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(user: dict = Depends(lambda: None)):
    """Refresh JWT token (simplified — re-login required for now)."""
    raise HTTPException(status_code=501, detail="Token refresh not implemented — re-login required")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current logged in user details."""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user["full_name"],
        role=current_user["role"],
        npi=current_user.get("npi"),
        created_at=current_user.get("created_at")
    )

@router.delete("/logout")
async def logout():
    """Logout (client-side token deletion)."""
    return {"message": "Logged out successfully"}

"""
CareAudit AI - Auth Schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    npi: Optional[str] = None
    created_at: Optional[datetime] = None


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: str
    npi: Optional[str] = None

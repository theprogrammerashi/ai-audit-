"""
CareAudit AI - Training Schemas
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class ModuleSection(BaseModel):
    type: str  # POLICY_REVIEW, CASE_STUDY, QUIZ
    content: Optional[str] = None
    case_id: Optional[str] = None
    lesson: Optional[str] = None
    questions: List[Dict[str, Any]] = []


class TrainingModuleResponse(BaseModel):
    id: str
    module_id: str
    reviewer_id: str
    topic: str
    trigger_reason: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    sections: List[ModuleSection] = []
    status: str
    assigned_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TrainingModuleListResponse(BaseModel):
    modules: List[TrainingModuleResponse]
    total: int
    completed: int

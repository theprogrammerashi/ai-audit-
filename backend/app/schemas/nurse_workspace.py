"""
CareAudit AI - Nurse Workspace Schemas
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class PolicyCriterion(BaseModel):
    criterion: str
    section: str
    status: str  # MET, NOT_MET, INSUFFICIENT_EVIDENCE
    evidence: str
    confidence: float
    explanation: Optional[str] = None


class PolicyMatchResponse(BaseModel):
    applicable_policy: str
    policy_name: str
    matched_criteria: List[PolicyCriterion]
    unmet_criteria: List[PolicyCriterion] = []
    recommendation: str
    overall_confidence: float


class WorkspaceData(BaseModel):
    case: Dict[str, Any]
    policy_match: Optional[PolicyMatchResponse] = None
    ai_copilot_observation: Optional[str] = None
    ai_deep_analysis: Optional[Dict[str, Any]] = None


class DecisionSubmit(BaseModel):
    decision: str  # APPROVED, DENIED
    rationale: str
    policy_cited: Optional[str] = None
    criteria_acknowledged: List[str] = []


class DecisionResponse(BaseModel):
    id: str
    case_id: str
    reviewer_id: str
    reviewer_name: Optional[str] = None
    decision: str
    rationale: str
    policy_cited: Optional[str] = None
    criteria_acknowledged: Optional[str] = None
    decision_timestamp: Optional[datetime] = None


class WorkspaceQueueItem(BaseModel):
    id: str
    case_number: str
    patient_name: Optional[str] = None
    patient_mrn: str
    primary_diagnosis_display: str
    status: str
    submitted_at: Optional[datetime] = None
    urgency: Optional[str] = "STANDARD"
    assigned_nurse_id: Optional[str] = None
    assigned_to: Optional[str] = None
    is_appeal: bool = False

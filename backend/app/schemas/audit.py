"""
CareAudit AI - Audit Schemas
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class AuditFinding(BaseModel):
    type: str  # DOCUMENTATION_GAP, POLICY_MISMATCH, CLINICAL_MISS, CONSISTENCY_FLAG
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    description: str
    recommendation: str


class AuditResultResponse(BaseModel):
    id: str
    case_id: str
    case_number: Optional[str] = None
    patient_name: Optional[str] = None
    case_status: Optional[str] = None
    decision_id: Optional[str] = None
    qa_score: int
    risk_level: str
    audit_result: str
    clinical_accuracy: Optional[int] = None
    documentation_completeness: Optional[int] = None
    policy_compliance: Optional[int] = None
    consistency_score: Optional[int] = None
    timeliness_score: Optional[int] = None
    timeliness_explanation: Optional[str] = None
    qa_ai_explanation: Optional[str] = None
    effective_score: Optional[int] = None
    original_ai_score: Optional[int] = None
    qa_override_score: Optional[int] = None
    qa_override_notes: Optional[str] = None
    qa_override_by: Optional[str] = None
    qa_override_at: Optional[datetime] = None
    qa_verification_notes: Optional[str] = None
    qa_verified: Optional[bool] = False
    qa_verified_by: Optional[str] = None
    qa_verified_at: Optional[datetime] = None
    findings: List[AuditFinding] = []
    policy_alignment: Optional[str] = None
    missing_evidence: List[str] = []
    audited_at: Optional[datetime] = None


class AuditQueueItem(BaseModel):
    id: str
    case_id: str
    case_number: str
    patient_name: Optional[str] = None
    diagnosis: str
    reviewer_name: Optional[str] = None
    decision: str
    qa_score: Optional[int] = None
    risk_level: Optional[str] = None
    qa_verified: Optional[bool] = False
    case_type: Optional[str] = "prior_auth"
    audited_at: Optional[datetime] = None

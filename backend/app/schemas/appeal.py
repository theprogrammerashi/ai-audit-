"""
CareAudit AI - Appeal Schemas
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AppealRiskResponse(BaseModel):
    case_id: str
    appeal_overturn_probability: float
    risk_category: str
    financial_exposure_estimate: float
    top_risk_factors: List[str] = []
    recommendation: str
    model_confidence: float


class AppealDashboardItem(BaseModel):
    case_id: str
    case_number: str
    patient_name: Optional[str] = None
    diagnosis: str
    decision: str
    overturn_probability: float
    risk_category: str
    financial_exposure: float
    reviewer_name: Optional[str] = None
    decision_date: Optional[datetime] = None
    top_risk_factors: List[str] = []
    appeal_recommendation: Optional[str] = None
    model_confidence: Optional[float] = None
    actual_outcome: Optional[str] = None


class AppealDashboardResponse(BaseModel):
    high_risk_cases: List[AppealDashboardItem]
    total_exposure: float
    avg_overturn_probability: float
    total_cases: int

class AppealIntakeItem(BaseModel):
    id: str
    case_id: str
    member_id: Optional[str] = None
    appellant_type: Optional[str] = None
    original_denial_date: Optional[datetime] = None
    appeal_received_date: Optional[datetime] = None
    appeal_level: Optional[str] = None
    denial_reason_category: Optional[str] = None
    clinical_rationale_provided: Optional[str] = None
    requested_service: Optional[str] = None
    diagnosis_category: Optional[str] = None
    financial_amount_disputed: Optional[float] = None
    reviewer_assigned: Optional[str] = None
    appeal_outcome: Optional[str] = None
    resolution_date: Optional[datetime] = None
    turnaround_days: Optional[int] = None
    key_evidence_cited: Optional[str] = None
    policy_referenced: Optional[str] = None

class AppealAnalyticsResponse(BaseModel):
    overturn_rate_by_denial_reason: dict
    overturn_rate_by_diagnosis: dict
    avg_turnaround_time_by_level: dict
    financial_summary: dict
    top_reasons_for_overturn: List[str]
    outcome_distribution: dict = {}

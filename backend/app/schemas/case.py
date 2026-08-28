"""
CareAudit AI - Case Schemas
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class VitalsData(BaseModel):
    temp: Optional[float] = None
    bp: Optional[str] = None
    hr: Optional[int] = None
    rr: Optional[int] = None
    o2_sat: Optional[float] = None


class LabsData(BaseModel):
    wbc: Optional[float] = None
    lactate: Optional[float] = None
    procalcitonin: Optional[float] = None
    creatinine: Optional[float] = None
    bnp: Optional[float] = None
    ph: Optional[float] = None
    pco2: Optional[float] = None
    potassium: Optional[float] = None
    troponin: Optional[float] = None


class DiagnosisData(BaseModel):
    primary: str
    display: str
    secondary: List[str] = []


class PatientData(BaseModel):
    mrn: str
    dob: Optional[str] = None
    age: Optional[int] = None
    name: Optional[str] = None


class TimelineEvent(BaseModel):
    day: str
    event: str
    details: Optional[str] = None


class StructuredCase(BaseModel):
    case_id: str
    patient: PatientData
    diagnosis: DiagnosisData
    vitals: Optional[VitalsData] = None
    labs: Optional[LabsData] = None
    clinical_summary: Optional[str] = None
    timeline: List[TimelineEvent] = []
    risk_signals: List[str] = []
    documents: List[str] = []
    processing_confidence: Optional[float] = None


class CaseCreate(BaseModel):
    patient_mrn: str
    patient_name: Optional[str] = None
    patient_dob: Optional[str] = None
    patient_age: Optional[int] = None
    primary_diagnosis_code: str
    primary_diagnosis_display: str
    secondary_diagnoses: Optional[str] = None
    structured_case: Optional[Dict[str, Any]] = None
    document_type: Optional[str] = None
    clinical_notes: Optional[str] = None


class CaseResponse(BaseModel):
    id: str
    case_number: str
    patient_mrn: str
    patient_name: Optional[str] = None
    patient_dob: Optional[str] = None
    patient_age: Optional[int] = None
    primary_diagnosis_code: str
    primary_diagnosis_display: str
    secondary_diagnoses: Optional[str] = None
    structured_case: Optional[Dict[str, Any]] = None
    document_type: Optional[str] = "PRIOR_AUTH"
    status: str
    submitted_at: Optional[datetime] = None
    submitted_by: Optional[str] = None
    assigned_to: Optional[str] = None


class CaseListResponse(BaseModel):
    cases: List[CaseResponse]
    total: int
    pending: Optional[int] = 0
    completed: Optional[int] = 0


class CaseFullResponse(BaseModel):
    case: CaseResponse
    policy_match: Optional[Dict[str, Any]] = None
    decision: Optional[Dict[str, Any]] = None
    audit_result: Optional[Dict[str, Any]] = None
    appeal_risk: Optional[Dict[str, Any]] = None
    documents: List[Dict[str, Any]] = []

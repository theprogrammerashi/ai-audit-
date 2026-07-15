"""
CareAudit AI - Document Parsing Schemas
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class ExtractedVitals(BaseModel):
    temp: Optional[float] = None
    bp: Optional[str] = None
    hr: Optional[int] = None
    rr: Optional[int] = None
    o2_sat: Optional[int] = None


class ExtractedLabs(BaseModel):
    bnp: Optional[float] = None
    wbc: Optional[float] = None
    lactate: Optional[float] = None
    creatinine: Optional[float] = None
    potassium: Optional[float] = None
    troponin: Optional[float] = None
    procalcitonin: Optional[float] = None
    hemoglobin: Optional[float] = None
    platelet: Optional[float] = None
    sodium: Optional[float] = None
    glucose: Optional[float] = None
    ef: Optional[int] = None


class ExtractedDiagnosis(BaseModel):
    icd10_code: Optional[str] = None
    display_name: Optional[str] = None
    confidence: float = 0.0


class ExtractedTimelineEvent(BaseModel):
    day: str
    event: str
    details: str


class ParsedDocumentResponse(BaseModel):
    """Full parsed result returned to the frontend for auto-fill."""
    # Document metadata
    detected_document_type: str = "PRIOR_AUTH"
    parse_confidence: float = 0.0
    raw_text_preview: str = ""

    # Patient demographics
    patient_name: Optional[str] = None
    patient_name_confidence: float = 0.0
    mrn: Optional[str] = None
    mrn_confidence: float = 0.0
    dob: Optional[str] = None
    dob_confidence: float = 0.0
    age: Optional[int] = None
    age_confidence: float = 0.0
    gender: Optional[str] = None

    # Diagnosis
    primary_diagnosis: Optional[ExtractedDiagnosis] = None
    secondary_diagnoses: List[ExtractedDiagnosis] = []

    # Clinical data
    vitals: Optional[ExtractedVitals] = None
    labs: Optional[ExtractedLabs] = None
    clinical_summary: Optional[str] = None
    clinical_summary_confidence: float = 0.0

    # Timeline
    timeline: List[ExtractedTimelineEvent] = []

    # Risk signals
    risk_signals: List[str] = []

    # AI-powered ICD-10 suggestions from clinical narrative
    icd10_suggestions: List[Dict[str, Any]] = []

    # OCR metadata
    ocr_used: bool = False

    # Uploaded file info
    filename: str = ""
    file_type: str = ""
    page_count: int = 0

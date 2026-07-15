"""
CareAudit AI - Executive Dashboard Schemas
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class KPIMetric(BaseModel):
    label: str
    value: Any
    change: Optional[float] = None
    change_label: Optional[str] = None
    trend: Optional[str] = None  # UP, DOWN, STABLE


class ReadinessScore(BaseModel):
    score: int
    label: str
    breakdown: Dict[str, int] = {}
    recommendations: List[str] = []


class ExecutiveDashboard(BaseModel):
    kpis: List[KPIMetric]
    readiness: ReadinessScore
    qa_trend: List[Dict[str, Any]] = []
    reviewer_heatmap: List[Dict[str, Any]] = []
    financial_exposure_by_dx: List[Dict[str, Any]] = []
    denial_rate_by_dx: List[Dict[str, Any]] = []
    top_performers: List[Dict[str, Any]] = []
    needs_coaching: List[Dict[str, Any]] = []

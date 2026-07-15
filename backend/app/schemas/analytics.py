"""
CareAudit AI - Analytics Schemas
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ReviewerStats(BaseModel):
    reviewer_id: str
    name: str
    qa_score_30d: Optional[float] = None
    approval_rate: Optional[float] = None
    denial_rate: Optional[float] = None
    overturn_rate: Optional[float] = None
    documentation_score: Optional[float] = None
    policy_compliance: Optional[float] = None
    consistency_score: Optional[float] = None
    case_volume_30d: Optional[int] = None
    peer_percentile: Optional[int] = None
    top_gaps: List[str] = []
    trend: Optional[str] = None


class TeamAnalytics(BaseModel):
    reviewers: List[ReviewerStats]
    team_avg_qa_score: float
    team_avg_approval_rate: float
    total_cases: int
    anomalies: List[str] = []


class OrgAnalytics(BaseModel):
    total_cases_ytd: int
    qa_pass_rate: float
    avg_qa_score: float
    total_reviewers: int
    top_performers: List[ReviewerStats]
    needs_coaching: List[ReviewerStats]

class ReviewerDetailResponse(BaseModel):
    reviewer: dict
    recent_cases: List[dict]
    stats: dict
    ai_summary: str

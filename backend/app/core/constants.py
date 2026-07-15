"""
CareAudit AI - Core Constants
Enums and constants used across the application.
"""
from enum import Enum


class UserRole(str, Enum):
    NURSE = "NURSE"
    QA_AUDITOR = "QA_AUDITOR"
    MEDICAL_DIRECTOR = "MEDICAL_DIRECTOR"
    OPERATIONS = "OPERATIONS"
    COMPLIANCE = "COMPLIANCE"
    EXECUTIVE = "EXECUTIVE"
    ADMIN = "ADMIN"


class CaseStatus(str, Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    IN_REVIEW = "IN_REVIEW"
    DECIDED = "DECIDED"
    AUDITED = "AUDITED"
    COMPLETED = "COMPLETED"


class Decision(str, Enum):
    APPROVED = "APPROVED"
    DENIED = "DENIED"



class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AuditResult(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


class CriterionStatus(str, Enum):
    MET = "MET"
    NOT_MET = "NOT_MET"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class AppealOutcome(str, Enum):
    UPHELD = "UPHELD"
    OVERTURNED = "OVERTURNED"
    PARTIAL = "PARTIAL"


class AgentStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    ERROR = "ERROR"


class TrainingStatus(str, Enum):
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


# Policy codes
POLICY_CODES = {
    "CHF": "UM-CHF-001",
    "COPD": "UM-COPD-001",
    "SEPSIS": "UM-SEPSIS-001",
    "OBS_IP": "UM-OBS-IP-001",
    "GENERAL": "UM-GEN-001",
}

# Diagnosis families
DIAGNOSIS_FAMILIES = {
    "I50": "CHF",
    "I11": "CHF",
    "J44": "COPD",
    "J43": "COPD",
    "A41": "SEPSIS",
    "R65": "SEPSIS",
    "A40": "SEPSIS",
}

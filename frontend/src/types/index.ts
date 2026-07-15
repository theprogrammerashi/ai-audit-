export interface Case {
  id: string;
  case_number: string;
  patient_mrn: string;
  patient_name?: string;
  patient_dob?: string;
  patient_age?: number;
  primary_diagnosis_code: string;
  primary_diagnosis_display: string;
  secondary_diagnoses?: string;
  structured_case?: StructuredCase;
  status: string;
  submitted_at?: string;
  submitted_by?: string;
}

export interface StructuredCase {
  case_id: string;
  patient: { mrn: string; dob?: string; age?: number; name?: string };
  diagnosis: { primary: string; display: string; secondary: string[] };
  vitals?: { temp?: number; bp?: string; hr?: number; rr?: number; o2_sat?: number };
  labs?: Record<string, number>;
  clinical_summary?: string;
  timeline?: { day: string; event: string; details?: string }[];
  risk_signals?: string[];
  documents?: string[];
  processing_confidence?: number;
}

export interface PolicyCriterion {
  criterion: string;
  section: string;
  status: "MET" | "NOT_MET" | "INSUFFICIENT_EVIDENCE";
  evidence: string;
  confidence: number;
}

export interface PolicyMatch {
  applicable_policy: string;
  policy_name: string;
  matched_criteria: PolicyCriterion[];
  unmet_criteria: PolicyCriterion[];
  recommendation: string;
  overall_confidence: number;
}

export interface NurseDecision {
  id: string;
  case_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  decision: "APPROVED" | "DENIED";
  rationale: string;
  policy_cited?: string;
  criteria_acknowledged?: string;
  decision_timestamp?: string;
}

export interface AuditFinding {
  type: string;
  severity: string;
  description: string;
  recommendation: string;
}

export interface AuditResult {
  id: string;
  case_id: string;
  qa_score: number;
  risk_level: string;
  audit_result: string;
  clinical_accuracy?: number;
  documentation_completeness?: number;
  policy_compliance?: number;
  consistency_score?: number;
  findings: AuditFinding[];
  policy_alignment?: string;
  missing_evidence?: string[];
  audited_at?: string;
}

export interface AppealRisk {
  case_id: string;
  appeal_overturn_probability: number;
  risk_category: string;
  financial_exposure_estimate: number;
  top_risk_factors: string[];
  recommendation: string;
  model_confidence: number;
}

export interface ReviewerStats {
  reviewer_id: string;
  name: string;
  qa_score_30d?: number;
  approval_rate?: number;
  denial_rate?: number;
  overturn_rate?: number;
  documentation_score?: number;
  policy_compliance?: number;
  consistency_score?: number;
  case_volume_30d?: number;
  peer_percentile?: number;
  top_gaps?: string[];
  trend?: string;
}

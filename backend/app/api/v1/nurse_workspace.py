import sqlite3
"""
CareAudit AI - Nurse Workspace API
Scoped: NURSE sees only their assigned cases. QA_LEAD sees all.
New case submissions auto-trigger the case assignment agent.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import uuid, json, duckdb
from datetime import datetime, timezone
from app.database import get_db
from app.api.deps import get_current_user, get_scoped_nurse_ids
from app.schemas.nurse_workspace import (
    WorkspaceData, DecisionSubmit, DecisionResponse,
    WorkspaceQueueItem, PolicyMatchResponse,
)
from app.services.qa_engine import compute_qa_audit
from app.services.appeal_classifier import classify_appeal_risk

router = APIRouter(prefix="/workspace", tags=["Nurse Workspace"])


@router.get("/queue", response_model=list[WorkspaceQueueItem])
async def get_review_queue(
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Get the review queue — NURSE sees only their assigned cases."""
    role = user.get("role", "NURSE")

    if role == "NURSE":
        # Only cases assigned to this nurse
        results = db.execute("""
            SELECT c.id, c.case_number, c.patient_name, c.patient_mrn,
                   c.primary_diagnosis_display, c.status, c.submitted_at,
                   c.submitted_by AS assigned_nurse_id, u.full_name AS assigned_to,
                   CASE
                     WHEN COALESCE(json_array_length(json_extract(c.structured_case, '$.risk_signals')), 0) >= 3 THEN 'URGENT'
                     WHEN COALESCE(json_array_length(json_extract(c.structured_case, '$.risk_signals')), 0) > 0 THEN 'HIGH'
                     WHEN c.primary_diagnosis_code LIKE 'A41%' OR c.primary_diagnosis_display LIKE '%Sepsis%' THEN 'URGENT'
                     WHEN c.primary_diagnosis_code LIKE 'I50%' OR c.primary_diagnosis_display LIKE '%Heart Failure%' THEN 'HIGH'
                     ELSE 'STANDARD'
                   END AS urgency
            FROM cases c
            LEFT JOIN users u ON c.submitted_by = u.id
            WHERE c.status IN ('PENDING_REVIEW', 'IN_REVIEW')
              AND c.submitted_by = ?
              AND (c.document_type IS NULL OR c.document_type != 'APPEAL_DOCUMENT')
            ORDER BY c.submitted_at ASC
        """, [user["id"]]).fetchall()
        
        # Appeals assigned to nurse
        appeals = db.execute("""
            SELECT a.id, a.id AS case_number, c.patient_name, a.member_id AS patient_mrn,
                   COALESCE(c.primary_diagnosis_display, a.diagnosis_category) AS primary_diagnosis_display, 'PENDING_REVIEW' AS status,
                   COALESCE(a.created_at, a.appeal_received_date) AS submitted_at,
                   a.reviewer_assigned AS assigned_nurse_id, u.full_name AS assigned_to,
                   'HIGH' AS urgency
            FROM appeal_intake_cases a
            LEFT JOIN cases c ON a.case_id = c.id
            LEFT JOIN users u ON a.reviewer_assigned = u.id
            WHERE a.reviewer_assigned = ? AND a.appeal_outcome IS NULL
        """, [user["id"]]).fetchall()
    else:
        # QA Lead / Admin — show all pending
        results = db.execute("""
            SELECT c.id, c.case_number, c.patient_name, c.patient_mrn,
                   c.primary_diagnosis_display, c.status, c.submitted_at,
                   c.submitted_by AS assigned_nurse_id, u.full_name AS assigned_to,
                   CASE
                     WHEN COALESCE(json_array_length(json_extract(c.structured_case, '$.risk_signals')), 0) >= 3 THEN 'URGENT'
                     WHEN COALESCE(json_array_length(json_extract(c.structured_case, '$.risk_signals')), 0) > 0 THEN 'HIGH'
                     WHEN c.primary_diagnosis_code LIKE 'A41%' OR c.primary_diagnosis_display LIKE '%Sepsis%' THEN 'URGENT'
                     WHEN c.primary_diagnosis_code LIKE 'I50%' OR c.primary_diagnosis_display LIKE '%Heart Failure%' THEN 'HIGH'
                     ELSE 'STANDARD'
                   END AS urgency
            FROM cases c
            LEFT JOIN users u ON c.submitted_by = u.id
            WHERE c.status IN ('PENDING_REVIEW', 'IN_REVIEW')
              AND (c.document_type IS NULL OR c.document_type != 'APPEAL_DOCUMENT')
            ORDER BY c.submitted_at ASC
        """).fetchall()
        
        appeals = db.execute("""
            SELECT a.id, a.id AS case_number, c.patient_name, a.member_id AS patient_mrn,
                   COALESCE(c.primary_diagnosis_display, a.diagnosis_category) AS primary_diagnosis_display, 'PENDING_REVIEW' AS status,
                   COALESCE(a.created_at, a.appeal_received_date) AS submitted_at,
                   a.reviewer_assigned AS assigned_nurse_id, u.full_name AS assigned_to,
                   'HIGH' AS urgency
            FROM appeal_intake_cases a
            LEFT JOIN cases c ON a.case_id = c.id
            LEFT JOIN users u ON a.reviewer_assigned = u.id
            WHERE a.appeal_outcome IS NULL
        """).fetchall()

    columns = [desc[0] for desc in db.description]
    standard_cases = [WorkspaceQueueItem(**dict(zip(columns, row)), is_appeal=False) for row in results]
    appeal_cases = [WorkspaceQueueItem(**dict(zip(columns, row)), is_appeal=True) for row in appeals]
    
    all_cases = standard_cases + appeal_cases
    all_cases.sort(key=lambda x: x.submitted_at or datetime.min)
    return all_cases


@router.get("/qa-overview", response_model=dict)
async def get_qa_workspace_overview(
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Get aggregated stats and cases for QA Lead's workspace."""
    if user.get("role") not in ["QA_LEAD", "ADMIN", "EXECUTIVE"]:
        raise HTTPException(status_code=403, detail="QA overview restricted to QA Leads.")
        
    nurse_ids = get_scoped_nurse_ids(user, db)
    if not nurse_ids:
        return {"nurses": [], "cases": []}
        
    placeholders = ",".join(["?" for _ in nurse_ids])
    
    # Get nurse summary stats
    nurses = db.execute(f"""
        SELECT 
            u.id, u.full_name as name, u.npi as employee_id,
            (SELECT COUNT(*) FROM cases WHERE submitted_by = u.id AND status = 'DECIDED') as pending_cases,
            COALESCE(
                (SELECT AVG(((julianday(nd.decision_timestamp) - julianday(c2.submitted_at)) * 86400)) 
                 FROM nurse_decisions nd 
                 JOIN cases c2 ON nd.case_id = c2.id 
                 WHERE nd.reviewer_id = u.id AND nd.decision_timestamp > date('now', '-30 days')),
                0
            ) as avg_turnaround
        FROM users u
        WHERE u.id IN ({placeholders}) AND u.role = 'NURSE'
    """, nurse_ids).fetchall()
    
    nurse_cols = [desc[0] for desc in db.description]
    nurses_list = []
    for r in nurses:
        nd = dict(zip(nurse_cols, r))
        # simplify turnaround seconds/timedelta to hours
        avg_turnaround = nd.get("avg_turnaround", 0) or 0
        if isinstance(avg_turnaround, (int, float)):
            nd["avg_turnaround_hours"] = round(avg_turnaround / 3600, 1)
        elif hasattr(avg_turnaround, "total_seconds"):
            nd["avg_turnaround_hours"] = round(avg_turnaround.total_seconds() / 3600, 1)
        else:
            nd["avg_turnaround_hours"] = 0
            
        if "avg_turnaround" in nd:
            del nd["avg_turnaround"]
        nurses_list.append(nd)

    # Get cases queue for the nurses
    cases = db.execute(f"""
        SELECT c.id, c.case_number, c.patient_name, c.patient_mrn,
               c.primary_diagnosis_display, c.status, c.submitted_at,
               u.full_name as assigned_to, u.id as assigned_nurse_id,
               CASE
                 WHEN COALESCE(json_array_length(json_extract(c.structured_case, '$.risk_signals')), 0) >= 3 THEN 'URGENT'
                 WHEN COALESCE(json_array_length(json_extract(c.structured_case, '$.risk_signals')), 0) > 0 THEN 'HIGH'
                 WHEN c.primary_diagnosis_code LIKE 'A41%' OR c.primary_diagnosis_display LIKE '%Sepsis%' THEN 'URGENT'
                 WHEN c.primary_diagnosis_code LIKE 'I50%' OR c.primary_diagnosis_display LIKE '%Heart Failure%' THEN 'HIGH'
                 ELSE 'STANDARD'
               END AS urgency
        FROM cases c
        JOIN users u ON c.submitted_by = u.id
        WHERE c.status = 'DECIDED'
          AND c.submitted_by IN ({placeholders})
        ORDER BY c.submitted_at ASC
    """, nurse_ids).fetchall()
    
    case_cols = [desc[0] for desc in db.description]
    cases_list = [dict(zip(case_cols, r)) for r in cases]
    for c in cases_list:
        if c.get("submitted_at") and hasattr(c["submitted_at"], "isoformat"):
            c["submitted_at"] = c["submitted_at"].isoformat()

    return {
        "nurses": nurses_list,
        "cases": cases_list
    }


@router.get("/history", response_model=list[dict])
async def get_decision_history(
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Get recently decided cases — NURSE sees only their own decisions."""
    nurse_ids = get_scoped_nurse_ids(user, db)
    if not nurse_ids:
        return []
    placeholders = ",".join(["?" for _ in nurse_ids])
    results = db.execute(f"""
        SELECT c.id, c.case_number, c.patient_name, c.primary_diagnosis_display,
               nd.decision, nd.decision_timestamp,
               CASE WHEN ar.qa_verified = 1 THEN ar.qa_score ELSE NULL END AS qa_score,
               CASE WHEN ar.qa_verified = 1 THEN ar.risk_level ELSE NULL END AS risk_level,
               CASE WHEN ar.qa_verified = 1 THEN ar.audit_result ELSE NULL END AS audit_result,
               COALESCE(ar.qa_verified, 0) as qa_verified,
               u.full_name AS reviewer_name
        FROM cases c
        LEFT JOIN nurse_decisions nd ON nd.case_id = c.id
        LEFT JOIN audit_results ar ON ar.case_id = c.id
        LEFT JOIN users u ON u.id = nd.reviewer_id
        WHERE c.status IN ('DECIDED', 'AUDITED')
          AND nd.reviewer_id IN ({placeholders})
        ORDER BY nd.decision_timestamp DESC
        LIMIT 50
    """, nurse_ids).fetchall()
    columns = [desc[0] for desc in db.description]

    history = []
    for row in results:
        d = dict(zip(columns, row))
        if d.get("decision_timestamp") and not isinstance(d["decision_timestamp"], str):
            d["decision_timestamp"] = d["decision_timestamp"].isoformat()
        history.append(d)
    return history


@router.get("/qa-reports")
async def get_nurse_qa_reports(
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Get QA audit reports for the nurse's cases.
    Nurses see only their own cases.
    QA scores are only shown after QA has verified/approved them.
    """
    nurse_ids = get_scoped_nurse_ids(user, db)
    if not nurse_ids:
        return []
    
    placeholders = ",".join(["?" for _ in nurse_ids])
    
    results = db.execute(f"""
        SELECT 
            c.id as case_id, c.case_number, c.patient_name,
            c.primary_diagnosis_display as diagnosis,
            nd.decision, nd.decision_timestamp,
            ar.qa_score as ai_qa_score,
            ar.qa_override_score,
            ar.risk_level, ar.audit_result,
            ar.findings, ar.missing_evidence,
            COALESCE(ar.qa_verified, FALSE) as qa_verified,
            ar.qa_verified_by, ar.qa_verified_at,
            ar.qa_override_notes,
            ar.qa_verification_notes,
            u.full_name as reviewer_name
        FROM cases c
        LEFT JOIN nurse_decisions nd ON nd.case_id = c.id
        LEFT JOIN audit_results ar ON ar.case_id = c.id
        LEFT JOIN users u ON nd.reviewer_id = u.id
        WHERE nd.reviewer_id IN ({placeholders})
          AND c.status IN ('DECIDED', 'AUDITED')
        ORDER BY nd.decision_timestamp DESC
    """, nurse_ids).fetchall()
    
    columns = [desc[0] for desc in db.description]
    reports = []
    for row in results:
        d = dict(zip(columns, row))
        # Parse JSON fields
        for field in ('findings', 'missing_evidence'):
            if isinstance(d.get(field), str):
                try: d[field] = json.loads(d[field])
                except: d[field] = []
            elif d.get(field) is None:
                d[field] = []
        # Convert timestamps
        for field in ('decision_timestamp', 'qa_verified_at'):
            if d.get(field) and hasattr(d[field], 'isoformat'):
                d[field] = d[field].isoformat()
        
        # CRITICAL: Only expose QA scores if QA has verified
        qa_verified = d.get('qa_verified', False)
        if qa_verified:
            override = d.get('qa_override_score')
            d['effective_score'] = override if override is not None else d.get('ai_qa_score')
            d['score_status'] = 'QA_APPROVED'
        else:
            # Hide actual scores from nurses until QA approves
            d['effective_score'] = None
            d['score_status'] = 'PENDING_QA_REVIEW'
            # Don't expose the AI scores
            d.pop('ai_qa_score', None)
            d.pop('qa_override_score', None)
            d.pop('qa_override_notes', None)
            d.pop('findings', None)
            d.pop('missing_evidence', None)
        
        reports.append(d)
    
    return reports


@router.get("/{case_id}", response_model=WorkspaceData)
async def get_workspace_data(
    case_id: str,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Load full case workspace data. NURSE must be assigned to the case."""
    case_result = db.execute("SELECT * FROM cases WHERE id = ?", [case_id]).fetchone()
    if not case_result:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    columns = [desc[0] for desc in db.description]
    case_dict = dict(zip(columns, case_result))

    # NURSE access guard — must be assigned
    nurse_owner_id = case_dict.get("assigned_nurse_id") or case_dict.get("submitted_by")
    if user.get("role") == "NURSE" and nurse_owner_id != user["id"]:
        raise HTTPException(status_code=403, detail="This case is not assigned to you.")

    if case_dict.get("structured_case") and isinstance(case_dict["structured_case"], str):
        case_dict["structured_case"] = json.loads(case_dict["structured_case"])
    for k, v in case_dict.items():
        if hasattr(v, "isoformat"):
            case_dict[k] = v.isoformat()

    # Policy match
    policy_result = db.execute("""
        SELECT * FROM policy_matches WHERE case_id = ? ORDER BY created_at DESC LIMIT 1
    """, [case_id]).fetchone()

    policy_match = None
    if policy_result:
        pcols = [desc[0] for desc in db.description]
        pdict = dict(zip(pcols, policy_result))
        if isinstance(pdict.get("matched_criteria"), str):
            pdict["matched_criteria"] = json.loads(pdict["matched_criteria"])
        pdict["unmet_criteria"] = json.loads(pdict["unmet_criteria"]) if isinstance(pdict.get("unmet_criteria"), str) else (pdict.get("unmet_criteria") or [])
        policy_match = PolicyMatchResponse(
            applicable_policy=pdict["applicable_policy"],
            policy_name=pdict.get("policy_name", ""),
            matched_criteria=pdict.get("matched_criteria", []),
            unmet_criteria=pdict.get("unmet_criteria", []),
            recommendation=pdict["recommendation"],
            overall_confidence=pdict.get("overall_confidence", 0.0),
        )

    diag_name = case_dict.get("primary_diagnosis_display") or case_dict.get("primary_diagnosis_code") or "Sepsis"

    # --- Build human-readable explanations for each criterion ---
    POLICY_THRESHOLDS = {
        # Sepsis
        "6A": "Documented or suspected clinical infection requiring treatment",
        "6B": "Serum lactate level >= 2.0 mmol/L",
        "6C": "Systolic blood pressure < 90 mmHg",
        "6D": "Acute altered mental status (AMS) from patient baseline (e.g., confusion, lethargy)",
        "6E": "Requirement for broad-spectrum intravenous (IV) antibiotic therapy",
        # Heart Failure
        "5A": "Oxygen saturation (O2 Sat) < 90% on room air",
        "5B": "B-type Natriuretic Peptide (BNP) > 500 pg/mL",
        "5C": "Left ventricular ejection fraction (EF) < 40% on echo",
        "5D": "Initiation of intravenous (IV) loop diuretics (e.g., IV Lasix)",
        # COPD
        "4A": "Severe hypoxemia (Oxygen Saturation < 88% on room air)",
        "4B": "Failure of outpatient oral steroids/bronchodilators (e.g., pCO2 > 50 mmHg)",
        "4C": "Respiratory acidosis (ABG pH < 7.35)",
        "4D": "Requirement for intravenous (IV) corticosteroids",
        # Observation/General
        "7A": "Expected stay duration exceeding 24 hours based on clinical trajectory",
        "7B": "Requirement for intravenous (IV) medications or therapies",
        "7C": "Need for active clinical monitoring (e.g., O2 sat < 93%)",
        "7D": "Failure to improve under standard observation protocol",
    }

    def _explain_criterion(c) -> str:
        """Generate a natural-English explanation for a single policy criterion."""
        status_word = "satisfied" if c.status == "MET" else (
            "not satisfied" if c.status == "NOT_MET" else "lacking sufficient evidence"
        )
        evidence_text = c.evidence if c.evidence else "No clinical evidence was documented"
        # Preserve dynamic evidence (infection source and clinical signs) if present
        if "Infection suspected based on diagnosis" in evidence_text and not ("secondary" in evidence_text or "supported" in evidence_text):
            evidence_text = f"Infection suspected based on diagnosis of {diag_name}"
            c.evidence = evidence_text
        if "AMS likely" in evidence_text:
            evidence_text = "Altered Mental Status (AMS) likely"
            c.evidence = evidence_text

        threshold = POLICY_THRESHOLDS.get(c.section, "Standard clinical necessity threshold")

        if c.status == "MET":
            return (
                f"The patient's clinical data shows: {evidence_text}. "
                f"This meets the threshold defined by policy Section {c.section} "
                f"(Required: {threshold}) for \"{c.criterion}\". This criterion is {status_word}."
            )
        elif c.status == "NOT_MET":
            return (
                f"Regarding \"{c.criterion}\" (policy Section {c.section}): "
                f"the available evidence ({evidence_text}) does not satisfy the required threshold "
                f"(Required: {threshold}). This criterion is {status_word}."
            )
        else:
            return (
                f"For \"{c.criterion}\" (policy Section {c.section}): "
                f"{evidence_text}. There is insufficient documentation to determine "
                f"whether this criterion is met or unmet against the policy guideline "
                f"(Required: {threshold})."
            )

    # Attach explanations to each criterion
    if policy_match:
        for c in policy_match.matched_criteria:
            c.explanation = _explain_criterion(c)
        for c in policy_match.unmet_criteria:
            c.explanation = _explain_criterion(c)

    # --- Backward-compatible simple observation ---
    ai_obs = None
    ai_deep = None
    if policy_match:
        met = sum(1 for c in policy_match.matched_criteria if c.status == "MET")
        total = len(policy_match.matched_criteria)
        ai_obs = (
            f"Patient meets {met} of {total} {policy_match.applicable_policy} criteria. "
            f"AI confidence: {int(policy_match.overall_confidence * 100)}%. "
            f"Recommendation: {policy_match.recommendation}."
        )

        # --- Extract clinical details for deep analysis ---
        structured = case_dict.get("structured_case") or {}
        if isinstance(structured, str):
            try:
                structured = json.loads(structured)
            except Exception:
                structured = {}

        vitals = structured.get("vitals", {})
        labs = structured.get("labs", {})
        clinical_summary = structured.get("clinical_summary", "")
        diagnosis = case_dict.get("primary_diagnosis_display", "")
        patient_name = case_dict.get("patient_name", "the patient")
        raw_recommendation = policy_match.recommendation
        # Map any policy recommendation to APPROVE or DENY only (no ESCALATE)
        if raw_recommendation in ("INPATIENT_ADMISSION_SUPPORTED", "APPROVE", "SUPPORTED"):
            recommendation = "APPROVE"
        else:
            recommendation = "DENY"
        confidence = policy_match.overall_confidence
        policy_name = policy_match.policy_name or policy_match.applicable_policy
        all_criteria = policy_match.matched_criteria + policy_match.unmet_criteria
        met_list = [c for c in all_criteria if c.status == "MET"]
        unmet_list = [c for c in all_criteria if c.status != "MET"]

        # --- Build vitals/labs narrative fragments ---
        vitals_narrative_parts = []
        bp_val = vitals.get("bp") or vitals.get("blood_pressure")
        if bp_val:
            vitals_narrative_parts.append(f"blood pressure of {bp_val}")
        hr_val = vitals.get("hr") or vitals.get("heart_rate")
        if hr_val:
            vitals_narrative_parts.append(f"heart rate of {hr_val} bpm")
        rr_val = vitals.get("rr") or vitals.get("respiratory_rate")
        if rr_val:
            vitals_narrative_parts.append(f"respiratory rate of {rr_val}/min")
        o2_val = vitals.get("o2_sat") or vitals.get("oxygen_saturation")
        if o2_val:
            vitals_narrative_parts.append(f"oxygen saturation of {o2_val}%")
        temp_val = vitals.get("temp") or vitals.get("temperature")
        if temp_val:
            vitals_narrative_parts.append(f"temperature of {temp_val}°F")
        vitals_narrative = ", ".join(vitals_narrative_parts) if vitals_narrative_parts else "vitals not fully documented"

        labs_narrative_parts = []
        if labs.get("bnp"):
            labs_narrative_parts.append(f"BNP {labs['bnp']} pg/mL")
        if labs.get("troponin"):
            labs_narrative_parts.append(f"troponin {labs['troponin']}")
        if labs.get("creatinine"):
            labs_narrative_parts.append(f"creatinine {labs['creatinine']} mg/dL")
        if labs.get("wbc"):
            labs_narrative_parts.append(f"WBC {labs['wbc']} K/uL")
        if labs.get("lactate"):
            labs_narrative_parts.append(f"lactate {labs['lactate']} mmol/L")
        if labs.get("procalcitonin"):
            labs_narrative_parts.append(f"procalcitonin {labs['procalcitonin']} ng/mL")
        labs_narrative = ", ".join(labs_narrative_parts) if labs_narrative_parts else "lab values not fully documented"

        # --- Recommendation text (APPROVE or DENY only, no ESCALATE) ---
        if recommendation == "APPROVE":
            rec_text = (
                f"Based on the clinical evidence, inpatient admission for {patient_name} "
                f"is strongly supported. The patient meets {met} of {len(all_criteria)} "
                f"criteria under {policy_name}, with an AI confidence of "
                f"{int(confidence * 100)}%. The clinical presentation, including {vitals_narrative}, "
                f"combined with laboratory findings ({labs_narrative}), indicates that inpatient-level "
                f"care is medically necessary."
            )
        else:  # DENY
            rec_text = (
                f"The available clinical evidence does not fully support inpatient admission for "
                f"{patient_name} at this time. The patient meets only {met} of "
                f"{len(all_criteria)} criteria under {policy_name}. Key unmet criteria include: "
                f"{', '.join(c.criterion for c in unmet_list[:3]) if unmet_list else 'clinical evidence insufficient'}. "
                f"Consider observation-level care or additional documentation to support the request."
            )

        # --- Clinical analysis (2-3 paragraphs) ---
        para1 = (
            f"{patient_name} presents with {diagnosis}. "
            f"On admission, the patient's vital signs showed {vitals_narrative}. "
            f"{'The clinical summary indicates: ' + clinical_summary[:500] if clinical_summary else 'No detailed clinical narrative was provided in the submission.'}"
        )
        para2 = (
            f"Laboratory evaluation reveals {labs_narrative}. "
            f"When assessed against {policy_name}, the patient satisfies {met} of "
            f"{len(all_criteria)} required criteria. "
            f"{'Met criteria include: ' + ', '.join(c.criterion for c in met_list[:4]) + '.' if met_list else 'No criteria were met.'} "
            f"{'Unmet criteria include: ' + ', '.join(c.criterion for c in unmet_list[:4]) + '.' if unmet_list else 'All criteria are met.'}"
        )
        para3 = (
            f"The overall AI confidence for this determination is {int(confidence * 100)}%. "
            f"This assessment is based on structured analysis of the patient's clinical data "
            f"against evidence-based utilization management guidelines. "
            f"{'Given the number of met criteria and clinical acuity, inpatient admission is clinically appropriate.' if recommendation == 'APPROVE' else 'Additional clinical documentation or physician review may be needed to support the requested level of care.'}"
        )
        clinical_analysis = f"{para1}\n\n{para2}\n\n{para3}"

        # --- Nurse actions ---
        nurse_actions = []
        if unmet_list:
            nurse_actions.append(
                f"Obtain additional documentation to address unmet criteria: "
                f"{', '.join(c.criterion for c in unmet_list[:3])}"
            )
        nurse_actions.append(
            f"Verify that the rationale references policy {policy_match.applicable_policy} "
            f"and cites specific clinical evidence for each met criterion."
        )
        if vitals:
            nurse_actions.append(
                "Confirm that the documented vital signs match the source clinical records."
            )
        if recommendation == "APPROVE":
            nurse_actions.append(
                "Ensure the decision rationale clearly states why inpatient-level care "
                "(not observation) is warranted based on the severity of the presentation."
            )
        else:  # DENY
            nurse_actions.append(
                "Consider requesting physician peer-to-peer review before finalizing a denial."
            )
        nurse_actions.append(
            "Document any comorbidities or complicating factors that may affect the level-of-care determination."
        )

        # --- QA actions ---
        qa_actions = [
            f"Verify that the nurse's rationale directly addresses all {len(all_criteria)} "
            f"policy criteria under {policy_match.applicable_policy}.",
            "Cross-check the cited clinical evidence against the source documentation "
            "for accuracy and completeness.",
            f"Evaluate whether the {'approval' if recommendation == 'APPROVE' else 'denial'} "
            f"decision is consistent with the policy match results ({met}/{len(all_criteria)} criteria met).",
            "Review timeliness of the determination against regulatory turnaround requirements.",
            "Flag any discrepancies between documented vital signs/labs and the policy thresholds."
        ]

        # --- Risk assessments (case-specific, based on actual clinical data) ---
        if recommendation == "APPROVE":
            risk_approved = (
                f"Low risk. The patient meets {met} of {len(all_criteria)} criteria under "
                f"{policy_name}. Clinical indicators ({vitals_narrative}) and labs "
                f"({labs_narrative}) strongly support inpatient-level care. "
                f"Primary residual risk: ensure rationale explicitly cites each met criterion."
            )
            risk_denied = (
                f"High risk. Denying this case when {met} of {len(all_criteria)} criteria are met "
                f"({', '.join(c.criterion for c in met_list[:3])}) "
                f"could result in a successful member appeal and potential "
                f"financial exposure. The strong clinical indicators ({vitals_narrative}) "
                f"would likely support an overturn on appeal."
            )
        else:  # DENY
            risk_approved = (
                f"Elevated risk. Approving this case when only {met} of {len(all_criteria)} "
                f"criteria are met may trigger an audit finding for insufficient medical necessity. "
                f"Key unmet criteria: {', '.join(c.criterion for c in unmet_list[:3])}. "
                f"Clinical data ({labs_narrative}) does not fully support inpatient-level care."
            )
            risk_denied = (
                f"Low risk. The denial is consistent with the policy match ({met}/{len(all_criteria)} criteria met). "
                f"Unmet criteria: {', '.join(c.criterion for c in unmet_list[:3])}. "
                f"Ensure the denial letter clearly explains which criteria were not met and "
                f"what additional evidence would be needed to support approval."
            )

        # --- Policy explanation ---
        policy_explanation = (
            f"This case was evaluated against {policy_name} "
            f"({policy_match.applicable_policy}). The policy requires the patient to meet "
            f"specific clinical criteria to qualify for inpatient admission. "
            f"Of the {len(all_criteria)} criteria evaluated, {met} were satisfied based on "
            f"the submitted clinical documentation. "
            f"{'All core criteria are met, supporting the medical necessity of inpatient care.' if met == len(all_criteria) else f'The following criteria remain unmet: ' + '; '.join(c.criterion for c in unmet_list) + '.'}"
        )

        # --- Rationale draft ---
        met_evidence_lines = "\n".join(
            f"  - {c.criterion} (Section {c.section}): {c.evidence}"
            for c in met_list
        )
        unmet_evidence_lines = "\n".join(
            f"  - {c.criterion} (Section {c.section}): {c.evidence}"
            for c in unmet_list
        ) if unmet_list else "  - N/A — all criteria are met."

        rationale_draft = (
            f"CLINICAL RATIONALE — {case_dict.get('case_number', 'N/A')}\n"
            f"Patient: {patient_name} | Diagnosis: {diagnosis}\n"
            f"Policy: {policy_name} ({policy_match.applicable_policy})\n\n"
            f"CLINICAL PRESENTATION:\n"
            f"{patient_name} presented with {diagnosis}. Vital signs on admission showed "
            f"{vitals_narrative}. Laboratory findings included {labs_narrative}.\n\n"
            f"CRITERIA ASSESSMENT:\n"
            f"Met Criteria ({met}/{len(all_criteria)}):\n"
            f"{met_evidence_lines if met_evidence_lines else '  - None met.'}\n\n"
            f"Unmet Criteria ({len(unmet_list)}/{len(all_criteria)}):\n"
            f"{unmet_evidence_lines}\n\n"
            f"DETERMINATION:\n"
            f"Based on the above assessment, the recommendation is to {recommendation} "
            f"inpatient admission. {rec_text}\n\n"
            f"[This rationale was AI-drafted and should be reviewed and edited by the nurse "
            f"reviewer before submission.]"
        )

        # --- Determine recommendation enum (APPROVE or DENY only) ---
        rec_enum = recommendation  # Already mapped to APPROVE or DENY above

        ai_deep = {
            "recommendation": rec_enum,
            "recommendation_text": rec_text,
            "confidence": round(confidence, 2),
            "clinical_analysis": clinical_analysis,
            "nurse_actions": nurse_actions,
            "qa_actions": qa_actions,
            "risk_if_approved": risk_approved,
            "risk_if_denied": risk_denied,
            "policy_explanation": policy_explanation,
            "rationale_draft": rationale_draft,
        }

    return WorkspaceData(
        case=case_dict,
        policy_match=policy_match,
        ai_copilot_observation=ai_obs,
        ai_deep_analysis=ai_deep,
    )


@router.post("/{case_id}/decision", response_model=DecisionResponse)
async def submit_decision(
    case_id: str,
    decision: DecisionSubmit,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Submit nurse decision — auto-triggers QA audit + appeal risk computation."""
    case_result = db.execute("SELECT * FROM cases WHERE id = ?", [case_id]).fetchone()
    if not case_result:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    cols = [desc[0] for desc in db.description]
    case_dict = dict(zip(cols, case_result))
    if case_dict.get("structured_case") and isinstance(case_dict["structured_case"], str):
        try:
            case_dict["structured_case"] = json.loads(case_dict["structured_case"])
        except Exception:
            pass

    # Role guard — only NURSE can submit clinical decisions
    if user.get("role") != "NURSE":
        raise HTTPException(status_code=403, detail="Only nurses can submit clinical decisions. QA Leads should use the audit workflow.")

    # NURSE access guard — must be assigned to this case
    nurse_owner_id = case_dict.get("assigned_nurse_id") or case_dict.get("submitted_by")
    if nurse_owner_id != user["id"]:
        raise HTTPException(status_code=403, detail="This case is not assigned to you.")

    decision_id = str(uuid.uuid4())
    criteria_str = ",".join(decision.criteria_acknowledged) if decision.criteria_acknowledged else ""

    db.execute("""
        INSERT INTO nurse_decisions (id, case_id, reviewer_id, decision, rationale, policy_cited, criteria_acknowledged)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, [decision_id, case_id, user["id"], decision.decision,
          decision.rationale, decision.policy_cited, criteria_str])
    # Determine case priority to route appropriately
    primary_code = case_dict.get("primary_diagnosis_code", "")
    primary_display = case_dict.get("primary_diagnosis_display", "")
    
    if primary_code.startswith("A41") or "Sepsis" in primary_display:
        urgency = "URGENT"
    elif primary_code.startswith("I50") or "Heart Failure" in primary_display:
        urgency = "HIGH"
    else:
        urgency = "STANDARD"

    # All cases go to DECIDED status, waiting for QA Lead review.
    # The urgency level determines the order they appear in the QA queue.
    new_status = "DECIDED"
    db.execute("UPDATE cases SET status = ? WHERE id = ?", [new_status, case_id])
    policy_result = db.execute("""
        SELECT * FROM policy_matches WHERE case_id = ? ORDER BY created_at DESC LIMIT 1
    """, [case_id]).fetchone()
    policy_match_dict = None
    if policy_result:
        pcols = [desc[0] for desc in db.description]
        policy_match_dict = dict(zip(pcols, policy_result))

    try:
        qa_result = compute_qa_audit(
            case_dict=case_dict, decision=decision.decision,
            rationale=decision.rationale, policy_cited=decision.policy_cited,
            policy_match=policy_match_dict, decision_id=decision_id, db=db,
        )
        qa_score = qa_result["qa_score"]
    except Exception:
        qa_score = 80

    try:
        classify_appeal_risk(
            case_dict=case_dict, decision=decision.decision,
            rationale=decision.rationale, policy_match=policy_match_dict,
            qa_score=qa_score, reviewer_email=user.get("email"),
            db=db, decision_id=decision_id,
        )
    except Exception:
        pass

    return DecisionResponse(
        id=decision_id, case_id=case_id,
        reviewer_id=user["id"], reviewer_name=user["full_name"],
        decision=decision.decision, rationale=decision.rationale,
        policy_cited=decision.policy_cited, criteria_acknowledged=criteria_str,
    )

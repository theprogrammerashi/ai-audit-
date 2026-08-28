"""
CareAudit AI - Cases API Endpoints
Case CRUD operations, parsing, and auto-assignment.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import Optional
import uuid
import json
import sqlite3
from datetime import datetime
from app.database import get_db
from app.api.deps import get_current_user, get_scoped_nurse_ids
from app.schemas.case import CaseCreate, CaseResponse, CaseListResponse, CaseFullResponse
from app.schemas.document import ParsedDocumentResponse
from app.services.document_parser import parse_document
from app.agents.case_assignment_agent import assign_single_case

router = APIRouter(prefix="/cases", tags=["Cases"])

@router.post("/parse-document", response_model=ParsedDocumentResponse)
async def parse_uploaded_document(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    file_bytes = await file.read()
    if len(file_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 50MB.")
    return parse_document(file_bytes, file.filename or "unknown")

@router.post("/", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(case: CaseCreate, user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    case_id = str(uuid.uuid4())
    count = db.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
    case_number = f"CASE-{datetime.now().year}-{str(count + 1).zfill(3)}"
    
    structured_json = json.dumps(case.structured_case) if case.structured_case else None
    
    db.execute("""
        INSERT INTO cases (id, case_number, patient_mrn, patient_name, patient_dob, patient_age,
                          primary_diagnosis_code, primary_diagnosis_display, secondary_diagnoses,
                          document_type, structured_case, status, submitted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW', ?)
    """, [
        case_id, case_number, case.patient_mrn, case.patient_name, case.patient_dob,
        case.patient_age, case.primary_diagnosis_code, case.primary_diagnosis_display,
        case.secondary_diagnoses, case.document_type or "PRIOR_AUTH",
        structured_json, user["id"]
    ])
    
    # Auto-assign case to the least loaded nurse (or to the uploading nurse)
    assigned_nurse_id = user["id"]
    if user.get("role") == "NURSE":
        db.execute(
            "UPDATE cases SET assigned_nurse_id = ? WHERE id = ?",
            [user["id"], case_id]
        )
    else:
        assign_single_case(case_id, db)
        row = db.execute("SELECT assigned_nurse_id FROM cases WHERE id = ?", [case_id]).fetchone()
        if row and row[0]:
            assigned_nurse_id = row[0]

    # If it is an appeal document, insert it into appeal_intake_cases so that it shows up in the appeals workflow
    if case.document_type == "APPEAL_DOCUMENT":
        # Look up existing decided/audited prior authorization case for reference
        target_case_id = case_id
        existing_row = db.execute(
            """
            SELECT c.id FROM cases c
            LEFT JOIN nurse_decisions n ON c.id = n.case_id
            WHERE (c.patient_mrn = ? OR (c.patient_name IS NOT NULL AND LOWER(c.patient_name) = LOWER(?))) 
              AND c.id != ? AND (c.document_type IS NULL OR c.document_type != 'APPEAL_DOCUMENT')
            ORDER BY (CASE WHEN n.id IS NOT NULL THEN 1 ELSE 0 END) DESC, c.submitted_at DESC
            LIMIT 1
            """,
            [case.patient_mrn or "", case.patient_name or "", case_id]
        ).fetchone()
        
        if existing_row:
            target_case_id = existing_row[0]

        count = db.execute("SELECT COUNT(*) FROM appeal_intake_cases").fetchone()[0]
        appeal_id = f"APL-{datetime.now().year}-{str(count + 1).zfill(3)}"
        diag_display = (case.primary_diagnosis_display or case.primary_diagnosis_code or "").lower()
        diag_code = (case.primary_diagnosis_code or "").upper()
        
        if diag_code.startswith("I50") or "heart" in diag_display or "cardio" in diag_display:
            diag_category = "Cardiovascular"
            policy_ref = "UM-CHF-001"
        elif diag_code.startswith("J44") or "copd" in diag_display or "respiratory" in diag_display:
            diag_category = "Respiratory"
            policy_ref = "UM-COPD-001"
        elif diag_code.startswith("A41") or "sepsis" in diag_display or "infection" in diag_display:
            diag_category = "Infectious Disease"
            policy_ref = "UM-SEP-001"
        else:
            diag_category = "General Medicine"
            policy_ref = "UM-GEN-001"

        # Build evidence cited string from structured case data if available
        evidence_parts = []
        if case.structured_case:
            v = case.structured_case.get("vitals") or {}
            l = case.structured_case.get("labs") or {}
            if v.get("bp"): evidence_parts.append(f"BP {v['bp']}")
            if v.get("temp"): evidence_parts.append(f"Temp {v['temp']}°F")
            if v.get("hr"): evidence_parts.append(f"HR {v['hr']} bpm")
            if l.get("lactate"): evidence_parts.append(f"Lactate {l['lactate']}")
            if l.get("wbc"): evidence_parts.append(f"WBC {l['wbc']}")
            if l.get("procalcitonin"): evidence_parts.append(f"Procalcitonin {l['procalcitonin']}")
            if l.get("creatinine"): evidence_parts.append(f"Creatinine {l['creatinine']}")
        evidence_cited = ", ".join(evidence_parts) if evidence_parts else "Clinical records and diagnostic findings attached"

        # Always insert a new appeal record for this appeal document
        db.execute("""
            INSERT INTO appeal_intake_cases (
                id, case_id, member_id, appellant_type, appeal_received_date,
                appeal_level, denial_reason_category, clinical_rationale_provided,
                requested_service, diagnosis_category, financial_amount_disputed,
                reviewer_assigned, original_nurse_id, key_evidence_cited, policy_referenced
            ) VALUES (?, ?, ?, 'Provider', ?, 'Level 1 - Internal', 'Medical Necessity', ?, ?, ?, 15000.0, ?, 'SYSTEM', ?, ?)
        """, [
            appeal_id, case_id, case.patient_mrn,
            datetime.now().strftime("%Y-%m-%d"),
            case.clinical_notes or "No clinical rationale provided.",
            f"Inpatient Admission - {case.primary_diagnosis_display or case.primary_diagnosis_code}",
            diag_category, assigned_nurse_id,
            evidence_cited, policy_ref
        ])


    # Trigger policy engine
    try:
        from app.services.policy_engine import run_policy_match
        run_policy_match(case_id, case.primary_diagnosis_display or case.primary_diagnosis_code, case.structured_case, db)
    except Exception as e:
        print(f"[WARN] Policy match failed for {case_number}: {e}")
    
    return CaseResponse(
        id=case_id, case_number=case_number, patient_mrn=case.patient_mrn,
        patient_name=case.patient_name, patient_dob=case.patient_dob,
        patient_age=case.patient_age, primary_diagnosis_code=case.primary_diagnosis_code,
        primary_diagnosis_display=case.primary_diagnosis_display,
        secondary_diagnoses=case.secondary_diagnoses, structured_case=case.structured_case,
        document_type=case.document_type or "PRIOR_AUTH",
        status="PENDING_REVIEW", submitted_by=user["id"]
    )

@router.get("/", response_model=CaseListResponse)
async def list_cases(status_filter: Optional[str] = None, user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    # Nurses see only their own, others see all
    role = user.get("role", "NURSE")
    where_clauses = []
    params = []

    if status_filter:
        where_clauses.append("c.status = ?")
        params.append(status_filter)

    if role == "QA_LEAD":
        nurse_ids = get_scoped_nurse_ids(user, db)
        if not nurse_ids:
            return CaseListResponse(cases=[], total=0, pending=0, completed=0)
        placeholders = ",".join(["?"] * len(nurse_ids))
        where_clauses.append(f"c.submitted_by IN ({placeholders})")
        params.extend(nurse_ids)
    elif role == "NURSE":
        where_clauses.append("c.submitted_by = ?")
        params.append(user["id"])
    
    where_sql = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    query = f"""
        SELECT c.*, u.full_name as assigned_to 
        FROM cases c 
        LEFT JOIN users u ON c.submitted_by = u.id 
        {where_sql} 
        ORDER BY c.submitted_at DESC
    """

    results = db.execute(query, params).fetchall()
    columns = [desc[0] for desc in db.description]
    cases = []
    for row in results:
        cd = dict(zip(columns, row))
        if isinstance(cd.get("structured_case"), str):
            cd["structured_case"] = json.loads(cd["structured_case"])
        cases.append(CaseResponse(**cd))
    
    total = len(cases)
    pending = sum(1 for c in cases if c.status == "PENDING_REVIEW")
    completed = sum(1 for c in cases if c.status in ("DECIDED", "AUDITED"))
    
    return CaseListResponse(cases=cases, total=total, pending=pending, completed=completed)

@router.get("/{case_id}", response_model=CaseFullResponse)
async def get_case(case_id: str, user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    result = db.execute("SELECT * FROM cases WHERE id = ? OR case_number = ?", [case_id, case_id]).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
    
    columns = [desc[0] for desc in db.description]
    case_dict = dict(zip(columns, result))

    if isinstance(case_dict.get("structured_case"), str):
        case_dict["structured_case"] = json.loads(case_dict["structured_case"])
    
    docs = db.execute("SELECT * FROM documents WHERE case_id = ?", [case_id]).fetchall()
    doc_cols = [desc[0] for desc in db.description]
    documents = [dict(zip(doc_cols, r)) for r in docs]
    
    decisions = db.execute("SELECT * FROM nurse_decisions WHERE case_id = ? ORDER BY decision_timestamp DESC", [case_id]).fetchall()
    dec_cols = [desc[0] for desc in db.description]
    decision_dicts = [dict(zip(dec_cols, r)) for r in decisions]
    
    audit_results = db.execute("SELECT * FROM audit_results WHERE case_id = ? ORDER BY audited_at DESC", [case_id]).fetchall()
    ar_cols = [desc[0] for desc in db.description]
    audits = [dict(zip(ar_cols, r)) for r in audit_results]
    for a in audits:
        if isinstance(a.get("findings"), str): a["findings"] = json.loads(a["findings"])
        if isinstance(a.get("missing_evidence"), str): a["missing_evidence"] = json.loads(a["missing_evidence"])
    
    appeals = db.execute("SELECT * FROM appeals WHERE case_id = ? ORDER BY created_at DESC", [case_id]).fetchall()
    ap_cols = [desc[0] for desc in db.description]
    appeal_dicts = [dict(zip(ap_cols, r)) for r in appeals]
    for a in appeal_dicts:
        if isinstance(a.get("top_risk_factors"), str): a["top_risk_factors"] = json.loads(a["top_risk_factors"])

    pol = db.execute("SELECT * FROM policy_matches WHERE case_id = ? ORDER BY created_at DESC LIMIT 1", [case_id]).fetchone()
    policy_match = None
    if pol:
        pc = [desc[0] for desc in db.description]
        pd = dict(zip(pc, pol))
        if isinstance(pd.get("matched_criteria"), str): pd["matched_criteria"] = json.loads(pd["matched_criteria"])
        policy_match = pd

    return CaseFullResponse(
        case=CaseResponse(**case_dict),
        decision=decision_dicts[0] if decision_dicts else None,
        audit_result=audits[0] if audits else None,
        appeal_risk=appeal_dicts[0] if appeal_dicts else None,
        policy_match=policy_match,
        documents=documents,
    )

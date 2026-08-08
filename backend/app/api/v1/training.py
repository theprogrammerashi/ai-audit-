"""
CareAudit AI - Training API Endpoints
Training modules and assessments, scoped by role.
"""
from fastapi import APIRouter, Depends, HTTPException
import json
import uuid
import sqlite3
from datetime import datetime, timezone
from app.database import get_db
from app.api.deps import get_current_user, get_scoped_nurse_ids, require_qa_lead_or_admin
from app.schemas.training import TrainingModuleResponse, TrainingModuleListResponse

router = APIRouter(prefix="/training", tags=["Training"])

@router.get("/{reviewer_id}/modules", response_model=TrainingModuleListResponse)
async def get_training_modules(
    reviewer_id: str,
    user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get assigned training modules for a reviewer. Scoped by role."""
    role = user.get("role", "NURSE")
    if role == "NURSE" and reviewer_id != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if role == "QA_LEAD":
        scoped = get_scoped_nurse_ids(user, db)
        if reviewer_id not in scoped:
            raise HTTPException(status_code=403, detail="Access denied")

    results = db.execute("SELECT * FROM training_modules WHERE reviewer_id = ? ORDER BY assigned_at DESC", [reviewer_id]).fetchall()
    columns = [desc[0] for desc in db.description]
    
    modules = []
    for row in results:
        md = dict(zip(columns, row))
        if isinstance(md.get("sections"), str):
            md["sections"] = json.loads(md["sections"])
        elif md.get("sections") is None:
            md["sections"] = []
        modules.append(TrainingModuleResponse(**md))
    
    completed = sum(1 for m in modules if m.status == "COMPLETED")
    return TrainingModuleListResponse(modules=modules, total=len(modules), completed=completed)

@router.get("/team-modules", response_model=list[dict])
async def get_team_training_modules(
    user: dict = Depends(require_qa_lead_or_admin()),
    db: sqlite3.Connection = Depends(get_db)
):
    """QA Lead can see all training modules assigned to their team."""
    scoped = get_scoped_nurse_ids(user, db)
    if not scoped:
        return []

    placeholders = ",".join(["?" for _ in scoped])
    results = db.execute(f"""
        SELECT t.*, u.full_name as reviewer_name, u.email as reviewer_email 
        FROM training_modules t
        JOIN users u ON t.reviewer_id = u.id
        WHERE t.reviewer_id IN ({placeholders})
        ORDER BY t.assigned_at DESC
    """, scoped).fetchall()

    columns = [desc[0] for desc in db.description]
    modules = []
    for row in results:
        md = dict(zip(columns, row))
        if isinstance(md.get("sections"), str):
            md["sections"] = json.loads(md["sections"])
        elif md.get("sections") is None:
            md["sections"] = []
        
        # Convert datetime to isoformat
        if md.get("assigned_at") and hasattr(md["assigned_at"], "isoformat"):
            md["assigned_at"] = md["assigned_at"].isoformat()
        if md.get("completed_at") and hasattr(md["completed_at"], "isoformat"):
            md["completed_at"] = md["completed_at"].isoformat()
            
        modules.append(md)
        
    return modules

@router.post("/{module_id}/start")
async def start_module(module_id: str, user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    result = db.execute("SELECT * FROM training_modules WHERE module_id = ?", [module_id]).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail=f"Module not found")
    
    db.execute("UPDATE training_modules SET status = 'IN_PROGRESS' WHERE module_id = ?", [module_id])
    return {"message": "Module started", "module_id": module_id}

@router.post("/{module_id}/submit-assessment")
async def submit_assessment(module_id: str, body: dict, user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    answers = body.get("answers", [])
    correct_answers_list = body.get("correct_answers", [])
    time_taken_seconds = body.get("time_taken_seconds", 0)
    reviewer_id = body.get("reviewer_id", user.get("user_id", ""))

    total_questions = len(correct_answers_list)
    correct_count = sum(1 for i, ans in enumerate(answers) if i < total_questions and ans == correct_answers_list[i])

    score = round((correct_count / max(total_questions, 1)) * 100)
    passed = score >= 80

    assessment_id = str(uuid.uuid4())
    db.execute("""
        INSERT INTO training_assessments (id, module_id, reviewer_id, score, total_questions, correct_answers, answers, time_taken_seconds, passed, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [assessment_id, module_id, reviewer_id, score, total_questions, correct_count, json.dumps(answers), time_taken_seconds, passed, datetime.now(timezone.utc)])

    if passed:
        db.execute("UPDATE training_modules SET status = 'COMPLETED', completed_at = ? WHERE module_id = ?", [datetime.now(timezone.utc), module_id])

    return {"assessment_id": assessment_id, "score": score, "total_questions": total_questions, "correct_answers": correct_count, "passed": passed, "time_taken_seconds": time_taken_seconds}

@router.post("/{module_id}/complete")
async def complete_module(module_id: str, user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    result = db.execute("SELECT * FROM training_modules WHERE module_id = ?", [module_id]).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Module not found")
    
    db.execute("UPDATE training_modules SET status = 'COMPLETED', completed_at = ? WHERE module_id = ?", [datetime.now(timezone.utc), module_id])
    return {"message": "Module completed", "module_id": module_id}

"""CareAudit AI - Training Agent (Module 6)
Detects knowledge gaps from QA findings and generates targeted training modules.
Uses rule-based gap detection — NO LLM dependency for module content.
"""
from app.agents.state import AgentState
import logging
import json
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Gap detection rules: QA dimension -> training topic mapping
GAP_RULES = {
    "clinical_accuracy": {
        "threshold": 70,
        "topic": "Clinical Evidence Assessment",
        "trigger": "Low clinical accuracy score",
        "sections": [
            {"type": "POLICY_REVIEW", "title": "Clinical Criteria Evaluation", "content": "Review how to assess admission criteria against clinical evidence. Focus on matching vital signs and lab values to specific policy thresholds. Key areas: O2 saturation thresholds, BNP levels for CHF, lactate for sepsis, pH/pCO2 for COPD."},
            {"type": "CASE_STUDY", "title": "Decision Alignment Analysis", "content": "When AI recommends APPROVE but reviewer DENIES (or vice versa), examine whether the clinical evidence supports the deviation. Document specific criteria that justify the different decision."},
            {"type": "QUIZ", "title": "Clinical Accuracy Assessment", "questions": [
                {"q": "A CHF patient has BNP of 2,500 pg/mL, O2 sat 87%, and EF 25%. How many admission criteria are met?", "options": ["1", "2", "3 (all three)", "0"], "correct": 2},
                {"q": "When should you deviate from the AI recommendation?", "options": ["Never", "When you disagree", "When documented clinical evidence supports a different decision", "When the patient requests it"], "correct": 2},
                {"q": "What is the BNP threshold for CHF admission criteria?", "options": ["100 pg/mL", "250 pg/mL", "500 pg/mL", "1000 pg/mL"], "correct": 2},
            ]}
        ]
    },
    "documentation_completeness": {
        "threshold": 70,
        "topic": "Documentation Best Practices",
        "trigger": "Insufficient documentation in rationale",
        "sections": [
            {"type": "POLICY_REVIEW", "title": "Rationale Documentation Standards", "content": "A complete rationale must include: 1) Specific lab values with thresholds, 2) Policy code reference, 3) Clinical criteria assessment, 4) Clear justification for the decision. Minimum 30 words with quantitative evidence."},
            {"type": "CASE_STUDY", "title": "Good vs Poor Documentation", "content": "Compare: POOR: 'Patient does not meet criteria.' GOOD: 'Patient meets 4/5 UM-CHF-001 criteria: BNP 2,500 (>500), O2 sat 87% (<90%), EF 25% (<40%), bilateral crackles on CXR. Approving inpatient admission per Section 5A.'"},
            {"type": "QUIZ", "title": "Documentation Standards Quiz", "questions": [
                {"q": "Which element is REQUIRED in a clinical rationale?", "options": ["Patient's insurance plan", "Specific lab values with reference ranges", "Nurse's personal opinion", "Family history"], "correct": 1},
                {"q": "What is the minimum recommended word count for a rationale?", "options": ["10 words", "20 words", "30 words", "50 words"], "correct": 2},
                {"q": "A rationale says 'Labs are abnormal, denying.' What is missing?", "options": ["Nothing, it's sufficient", "Specific lab values, policy reference, and criteria assessment", "Patient name", "Date of review"], "correct": 1},
            ]}
        ]
    },
    "policy_compliance": {
        "threshold": 70,
        "topic": "Policy Criteria Application",
        "trigger": "Policy not properly cited or applied",
        "sections": [
            {"type": "POLICY_REVIEW", "title": "Policy Reference Requirements", "content": "Every decision must reference the applicable policy code (e.g., UM-CHF-001). Cite specific sections and criteria. Map each clinical finding to the corresponding policy criterion."},
            {"type": "CASE_STUDY", "title": "Policy Mapping Exercise", "content": "For a COPD patient: Map pH 7.28 to criterion 'Respiratory acidosis (pH <7.35)' per UM-COPD-001 Section 4B. Map pCO2 65 to 'Hypercapnia (pCO2 >45)' per Section 4C."},
            {"type": "QUIZ", "title": "Policy Application Quiz", "questions": [
                {"q": "Which policy applies to a CHF patient with acute decompensation?", "options": ["UM-GEN-001", "UM-CHF-001", "UM-COPD-001", "UM-OBS-IP-001"], "correct": 1},
                {"q": "What should you do if no specific policy matches the case?", "options": ["Skip policy citation", "Apply UM-GEN-001 General Medical Necessity", "Deny the case", "Contact IT Support"], "correct": 1},
            ]}
        ]
    },
    "consistency_score": {
        "threshold": 70,
        "topic": "Decision Consistency & Calibration",
        "trigger": "Decision pattern deviates from peer norms",
        "sections": [
            {"type": "POLICY_REVIEW", "title": "Consistency Standards", "content": "Decisions should be consistent across similar cases. If you approve a CHF case with BNP 1,500 and EF 30%, similar cases should receive the same determination unless specific differentiating factors exist."},
            {"type": "CASE_STUDY", "title": "Peer Calibration Review", "content": "Compare your recent decisions with peer reviewers on similar diagnosis categories. Identify patterns where your approval/denial rate significantly differs and examine whether clinical evidence justifies the variance."},
            {"type": "QUIZ", "title": "Consistency Assessment", "questions": [
                {"q": "Two identical CHF cases with BNP >2000 and O2 <90% should receive:", "options": ["Different decisions based on reviewer preference", "The same determination unless specific differentiating factors exist", "One approved, one denied for balance", "Both denied to be safe"], "correct": 1},
            ]}
        ]
    },
}


def training_agent(state: AgentState) -> AgentState:
    """Agent 6: Detect QA gaps -> generate targeted training modules."""
    state["current_agent"] = "training"
    state["agent_status"] = {**state.get("agent_status", {}), "training": "RUNNING"}
    state.setdefault("errors", [])

    try:
        qa_result = state.get("qa_result", {})
        if not qa_result or qa_result.get("status") in ("SKIPPED", "ERROR", "NO_DB"):
            state["training_module"] = {"status": "SKIPPED", "message": "No QA result to analyze"}
            state["agent_status"]["training"] = "COMPLETE"
            return state

        db = state.get("db_connection")
        decision_data = state.get("nurse_decision", {})
        reviewer_id = decision_data.get("reviewer_id", "")

        # Detect gaps by checking each QA dimension against thresholds
        gaps_detected = []
        for dimension, rule in GAP_RULES.items():
            score = qa_result.get(dimension, 100)
            if isinstance(score, (int, float)) and score < rule["threshold"]:
                gaps_detected.append({
                    "dimension": dimension,
                    "score": score,
                    "topic": rule["topic"],
                    "trigger": rule["trigger"],
                    "sections": rule["sections"],
                })

        if not gaps_detected:
            state["training_module"] = {"status": "NO_GAPS", "message": "All QA dimensions above threshold"}
            logger.info("[TrainingAgent] No training gaps detected.")
            state["agent_status"]["training"] = "COMPLETE"
            return state

        # Generate training module for the most critical gap
        worst_gap = min(gaps_detected, key=lambda g: g["score"])
        module_id = f"TRN-{uuid.uuid4().hex[:8].upper()}"

        if db and reviewer_id:
            try:
                db.execute("""
                    INSERT INTO training_modules (id, reviewer_id, module_id, topic, trigger_reason, estimated_duration_minutes, sections, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'ASSIGNED')
                """, [
                    str(uuid.uuid4()), reviewer_id, module_id,
                    worst_gap["topic"], worst_gap["trigger"],
                    15, json.dumps(worst_gap["sections"]),
                ])
                logger.info(f"[TrainingAgent] Assigned module {module_id} to {reviewer_id}: {worst_gap['topic']}")
            except Exception as e:
                logger.warning(f"[TrainingAgent] DB insert failed: {e}")

        state["training_module"] = {
            "module_id": module_id,
            "topic": worst_gap["topic"],
            "trigger": worst_gap["trigger"],
            "dimension": worst_gap["dimension"],
            "score": worst_gap["score"],
            "gaps_found": len(gaps_detected),
        }

    except Exception as e:
        logger.error(f"[TrainingAgent] Error: {e}")
        state["errors"].append(f"Training agent error: {str(e)}")
        state["training_module"] = {"status": "ERROR", "message": str(e)}

    state["agent_status"]["training"] = "COMPLETE"
    return state

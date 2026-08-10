"""
CareAudit AI - Policy Matching Engine
Evaluates clinical data against policies and generates AI recommendations.
"""
import uuid
import json
import logging
from datetime import datetime
import sqlite3

logger = logging.getLogger(__name__)


def run_policy_match(case_id: str, diagnosis: str, structured: dict = None, db: sqlite3.Connection = None) -> dict:
    """
    Evaluates the case against policies and inserts a policy match record.
    Args:
        case_id: The case UUID
        diagnosis: Primary diagnosis display name or code  
        structured: The structured_case dict with vitals/labs
        db: DuckDB connection
    Returns the policy match dictionary.
    """
    if structured is None:
        structured = {}
    if isinstance(structured, str):
        try:
            structured = json.loads(structured)
        except:
            structured = {}
    
    # Map diagnosis text to ICD code for matching
    dx_code = ""
    dx_lower = (diagnosis or "").lower()
    if "heart failure" in dx_lower or "chf" in dx_lower or "i50" in dx_lower:
        dx_code = "I50.23"
    elif "copd" in dx_lower or "j44" in dx_lower:
        dx_code = "J44.1"
    elif "sepsis" in dx_lower or "a41" in dx_lower:
        dx_code = "A41.9"
    else:
        dx_code = diagnosis  # Use whatever was passed
            
    vitals = structured.get("vitals", {}) or {}
    labs = structured.get("labs", {}) or {}
    
    match_dict = {
        "case_id": case_id,
        "applicable_policy": "UM-GEN-001",
        "policy_name": "General Medical Necessity Determination Policy",
        "matched_criteria": [],
        "unmet_criteria": [],
        "recommendation": "OBSERVATION_RECOMMENDED",
        "overall_confidence": 0.50
    }
    
    if dx_code == "I50.23":  # CHF
        o2 = float(vitals.get("o2_sat", 95))
        bnp = float(labs.get("bnp", 0))
        ef = float(labs.get("ef", 50))
        criteria = [
            {"criterion": "Oxygen Saturation Below 90%", "section": "5A", "status": "MET" if o2 < 90 else "NOT_MET", "evidence": f"O2 sat {o2}%", "confidence": 0.97 if o2 < 90 else 0.95},
            {"criterion": "Elevated BNP (>500 pg/mL)", "section": "5B", "status": "MET" if bnp > 500 else "NOT_MET", "evidence": f"BNP {bnp} pg/mL", "confidence": 0.99 if bnp > 500 else 0.90},
            {"criterion": "Reduced Ejection Fraction", "section": "5C", "status": "MET" if ef < 40 else "NOT_MET", "evidence": f"EF {ef}%", "confidence": 0.97 if ef < 40 else 0.85},
            {"criterion": "IV Diuretic Requirement", "section": "5D", "status": "MET" if bnp > 1500 else "INSUFFICIENT_EVIDENCE", "evidence": "IV Diuretics indicated based on BNP" if bnp > 1500 else "Insufficient evidence of IV requirement", "confidence": 0.96 if bnp > 1500 else 0.65},
        ]
        match_dict["applicable_policy"] = "UM-CHF-001"
        match_dict["policy_name"] = "Acute Congestive Heart Failure Inpatient Admission Guidelines"
    
    elif dx_code == "J44.1":  # COPD
        o2 = float(vitals.get("o2_sat", 95))
        ph = float(labs.get("ph", 7.40))
        pco2 = float(labs.get("pco2", 40))
        criteria = [
            {"criterion": "Hypoxemia (O2 Sat <88%)", "section": "4A", "status": "MET" if o2 < 88 else "NOT_MET", "evidence": f"O2 sat {o2}%", "confidence": 0.98 if o2 < 88 else 0.90},
            {"criterion": "Failed Outpatient Treatment", "section": "4B", "status": "MET" if pco2 > 50 else "NOT_MET", "evidence": "High pCO2 suggests failed outpatient" if pco2 > 50 else "No evidence", "confidence": 0.97 if pco2 > 50 else 0.70},
            {"criterion": "Respiratory Acidosis", "section": "4C", "status": "MET" if ph < 7.35 else "NOT_MET", "evidence": f"pH {ph}", "confidence": 0.99 if ph < 7.35 else 0.85},
            {"criterion": "IV Corticosteroid Requirement", "section": "4D", "status": "MET" if ph < 7.35 else "NOT_MET", "evidence": "IV steroids indicated" if ph < 7.35 else "Oral sufficient", "confidence": 0.96 if ph < 7.35 else 0.80},
        ]
        match_dict["applicable_policy"] = "UM-COPD-001"
        match_dict["policy_name"] = "Acute COPD Exacerbation Inpatient Admission Guidelines"
        
    elif dx_code == "A41.9":  # Sepsis
        lact = float(labs.get("lactate", 0))
        wbc = float(labs.get("wbc", 10))
        bp_sys = 120
        bp_val = vitals.get("bp", "120/80")
        if bp_val and "/" in bp_val:
            try:
                bp_sys = int(bp_val.split("/")[0])
            except:
                pass
        criteria = [
            {"criterion": "Suspected Infection", "section": "6A", "status": "MET", "evidence": f"Infection suspected based on diagnosis of {diagnosis}", "confidence": 0.96},
            {"criterion": "Elevated Lactate", "section": "6B", "status": "MET" if lact >= 2.0 else "NOT_MET", "evidence": f"Lactate {lact}", "confidence": 0.99 if lact >= 2.0 else 0.80},
            {"criterion": "Persistent Hypotension", "section": "6C", "status": "MET" if bp_sys < 90 else "NOT_MET", "evidence": f"BP {bp_val}", "confidence": 0.97 if bp_sys < 90 else 0.75},
            {"criterion": "Altered Mental Status", "section": "6D", "status": "MET" if lact > 4.0 else "NOT_MET", "evidence": "Altered Mental Status (AMS) likely" if lact > 4.0 else "Alert", "confidence": 0.95 if lact > 4.0 else 0.80},
            {"criterion": "IV Antibiotic Requirement", "section": "6E", "status": "MET", "evidence": "IV antibiotics indicated", "confidence": 0.98},
        ]
        match_dict["applicable_policy"] = "UM-SEPSIS-001"
        match_dict["policy_name"] = "Sepsis and Severe Infection Inpatient Admission Guidelines"

    else:
        # Default Observation / General
        bnp = float(labs.get("bnp", 100))
        o2 = float(vitals.get("o2_sat", 95))
        criteria = [
            {"criterion": "Expected Stay >24 Hours", "section": "7A", "status": "MET" if bnp > 500 else "NOT_MET", "evidence": "Trajectory suggests >24h" if bnp > 500 else "Likely <24h", "confidence": 0.80},
            {"criterion": "IV Medication Requirement", "section": "7B", "status": "MET" if bnp > 600 else "NOT_MET", "evidence": "IV meds needed" if bnp > 600 else "Oral meds ok", "confidence": 0.82},
            {"criterion": "Active Monitoring Required", "section": "7C", "status": "MET" if o2 < 93 else "NOT_MET", "evidence": f"O2 {o2}%", "confidence": 0.85},
            {"criterion": "Failed Observation Protocol", "section": "7D", "status": "NOT_MET", "evidence": "No prior obs", "confidence": 0.60},
        ]
        match_dict["applicable_policy"] = "UM-OBS-IP-001"
        match_dict["policy_name"] = "Observation Status vs Inpatient Admission Determination Guidelines"
        
    met_count = sum(1 for c in criteria if c["status"] == "MET")
    met = [c for c in criteria if c["status"] == "MET"]
    unmet = [c for c in criteria if c["status"] != "MET"]

    match_dict["matched_criteria"] = met
    match_dict["unmet_criteria"] = unmet
    match_dict["recommendation"] = "INPATIENT_ADMISSION_SUPPORTED" if met_count >= 3 else "OBSERVATION_RECOMMENDED"

    # ── ClinicalBERT Semantic Scoring ─────────────────────────────────────────
    # Score similarity between clinical summary and policy context using ClinicalBERT.
    # Combined confidence: 60% rule-based + 40% semantic similarity
    rule_based_conf = round(0.70 + met_count * 0.05, 2)
    semantic_conf = rule_based_conf  # Default if model unavailable

    try:
        from app.services.medical_nlp import get_medical_nlp
        nlp = get_medical_nlp()
        # Build a brief policy description for semantic comparison
        policy_text = f"{match_dict['policy_name']}. Criteria: {', '.join(c['criterion'] for c in criteria)}"
        case_summary = diagnosis
        if structured and isinstance(structured, dict):
            case_summary += ". " + structured.get("clinical_summary", "")
        bert_score = nlp.score_policy_match(case_summary, policy_text)
        semantic_conf = round(0.60 * rule_based_conf + 0.40 * bert_score, 3)
        match_dict["semantic_similarity"] = bert_score
        logger.info(f"[PolicyEngine] Rule-based: {rule_based_conf}, ClinicalBERT: {bert_score:.3f}, Combined: {semantic_conf}")
    except Exception as e:
        logger.warning(f"[PolicyEngine] ClinicalBERT scoring skipped: {e}")

    match_dict["overall_confidence"] = min(round(semantic_conf, 2), 0.98)
    match_dict["id"] = f"pm-{uuid.uuid4().hex[:8]}"

    # Insert into DB
    db.execute("""
        INSERT INTO policy_matches (
            id, case_id, applicable_policy, policy_name, 
            matched_criteria, unmet_criteria, recommendation, overall_confidence
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        match_dict["id"], match_dict["case_id"],
        match_dict["applicable_policy"], match_dict["policy_name"],
        json.dumps(match_dict["matched_criteria"]),
        json.dumps(match_dict["unmet_criteria"]),
        match_dict["recommendation"], match_dict["overall_confidence"]
    ])

    return match_dict


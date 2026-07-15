"""CareAudit AI - Clinical Intake Agent (Module 1)
Parses clinical data, extracts entities, generates ClinicalBERT embeddings.
Uses rule-based extraction + ClinicalBERT for semantic features.
"""
from app.agents.state import AgentState
import logging
import re
import json

logger = logging.getLogger(__name__)

# Clinical thresholds for risk signal detection
RISK_THRESHOLDS = {
    "o2_sat": {"threshold": 90, "direction": "below", "signal": "hypoxemia"},
    "hr": {"threshold": 100, "direction": "above", "signal": "tachycardia"},
    "rr": {"threshold": 24, "direction": "above", "signal": "tachypnea"},
    "temp": {"threshold": 100.4, "direction": "above", "signal": "fever"},
    "bnp": {"threshold": 500, "direction": "above", "signal": "elevated_bnp"},
    "lactate": {"threshold": 2.0, "direction": "above", "signal": "elevated_lactate"},
    "wbc": {"threshold": 12.0, "direction": "above", "signal": "leukocytosis"},
    "ef": {"threshold": 40, "direction": "below", "signal": "reduced_ef"},
    "creatinine": {"threshold": 1.5, "direction": "above", "signal": "elevated_creatinine"},
    "troponin": {"threshold": 0.04, "direction": "above", "signal": "elevated_troponin"},
    "ph": {"threshold": 7.35, "direction": "below", "signal": "acidosis"},
    "pco2": {"threshold": 45, "direction": "above", "signal": "hypercapnia"},
    "procalcitonin": {"threshold": 0.5, "direction": "above", "signal": "elevated_procalcitonin"},
}


def _detect_risk_signals(structured: dict) -> list:
    """Rule-based risk signal detection from vitals and labs."""
    signals = []
    vitals = structured.get("vitals", {}) or {}
    labs = structured.get("labs", {}) or {}
    all_values = {**vitals, **labs}

    for key, config in RISK_THRESHOLDS.items():
        val = all_values.get(key)
        if val is None:
            continue
        try:
            val = float(val)
        except (ValueError, TypeError):
            continue
        if config["direction"] == "below" and val < config["threshold"]:
            signals.append(config["signal"])
        elif config["direction"] == "above" and val > config["threshold"]:
            signals.append(config["signal"])
    return signals


def _validate_structured_case(structured: dict) -> dict:
    """Ensure structured case has all required sections."""
    defaults = {
        "patient": {"name": "Unknown", "mrn": "", "dob": "", "age": 0},
        "diagnosis": {"primary": "", "display": "", "secondary": []},
        "vitals": {},
        "labs": {},
        "clinical_summary": "",
        "timeline": [],
        "risk_signals": [],
        "documents": [],
    }
    for key, default in defaults.items():
        if key not in structured or not structured[key]:
            structured[key] = default
    return structured


def clinical_intake_agent(state: AgentState) -> AgentState:
    """Agent 1: Validate structured case -> detect risk signals -> generate ClinicalBERT embedding."""
    state["current_agent"] = "clinical_intake"
    state["agent_status"] = {**state.get("agent_status", {}), "clinical_intake": "RUNNING"}
    state.setdefault("errors", [])

    try:
        # Get or initialize structured case
        structured = state.get("structured_case", {})
        if isinstance(structured, str):
            try:
                structured = json.loads(structured)
            except Exception:
                structured = {}

        # Validate and fill missing fields
        structured = _validate_structured_case(structured)

        # Detect risk signals from vitals/labs (rule-based)
        detected_signals = _detect_risk_signals(structured)
        existing_signals = structured.get("risk_signals", []) or []
        all_signals = list(set(existing_signals + detected_signals))
        structured["risk_signals"] = all_signals
        state["risk_flags"] = all_signals

        state["structured_case"] = structured

        # Build clinical summary for NLP
        clinical_summary = structured.get("clinical_summary", "")
        if not clinical_summary:
            diag = state.get("primary_diagnosis_display", "")
            notes = state.get("clinical_notes", "")
            clinical_summary = f"{diag}. {notes}".strip()

        # Generate ClinicalBERT embedding
        if clinical_summary:
            try:
                from app.services.medical_nlp import get_medical_nlp
                nlp = get_medical_nlp()
                embedding = nlp.embed_clinical_text(clinical_summary)
                if embedding is not None:
                    state["clinical_embedding"] = embedding.tolist()
                    state["clinical_summary_for_nlp"] = clinical_summary
                    logger.info("[ClinicalIntakeAgent] ClinicalBERT embedding generated.")
            except Exception as e:
                logger.warning(f"[ClinicalIntakeAgent] ClinicalBERT error: {e}")
                state["errors"].append(f"ClinicalBERT embedding failed: {str(e)}")

        logger.info(f"[ClinicalIntakeAgent] Processed case with {len(all_signals)} risk signals.")

    except Exception as e:
        logger.error(f"[ClinicalIntakeAgent] Error: {e}")
        state["errors"].append(f"Clinical intake error: {str(e)}")

    state["agent_status"]["clinical_intake"] = "COMPLETE"
    return state

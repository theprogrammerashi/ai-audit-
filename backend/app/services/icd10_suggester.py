"""
CareAudit AI - ICD-10 AI Suggester
Dual-engine ICD-10 code suggestion:
  1. Groq LLM (fast, context-aware)
  2. BioBERT semantic similarity (domain-specific, offline)
Results are merged and ranked by combined confidence.
"""
import json
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


# ── Groq LLM Suggestions ──────────────────────────────────────────────────────

def suggest_icd10_from_narrative_groq(clinical_text: str, top_k: int = 3) -> List[dict]:
    """
    Use Groq LLM to suggest ICD-10 codes from a clinical narrative.
    Returns list of {code, display, confidence, reasoning, source}.
    Falls back to empty list if Groq is unavailable.
    """
    from app.config import settings
    if not settings.GROQ_API_KEY or not clinical_text.strip():
        return []
    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        prompt = f"""You are a clinical coding expert. Analyze this clinical narrative and suggest the {top_k} most appropriate ICD-10-CM codes.

Clinical Narrative:
{clinical_text[:2000]}

Respond ONLY with a valid JSON array (no markdown, no explanation outside JSON):
[
  {{
    "code": "I50.23",
    "display": "Acute on chronic systolic (congestive) heart failure",
    "confidence": 0.95,
    "reasoning": "Patient presents with exacerbation of chronic systolic heart failure"
  }}
]

Rules:
- Return exactly {top_k} entries (or fewer if fewer are clearly applicable)
- Use valid ICD-10-CM format (letter + 2 digits, optional decimal + more digits)
- Confidence should be 0.0 to 1.0
- Include ONLY codes directly supported by the narrative text
- Order by confidence descending"""

        response = client.chat.completions.create(
            model=settings.GROQ_FAST_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=400,
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        suggestions = json.loads(raw)
        if isinstance(suggestions, list):
            valid = []
            for s in suggestions:
                if isinstance(s, dict) and "code" in s and "display" in s:
                    s["source"] = "Groq LLM"
                    s["confidence"] = float(s.get("confidence", 0.7))
                    valid.append(s)
            return valid[:top_k]
    except Exception as e:
        logger.warning(f"[ICD10Suggester] Groq suggestion failed: {e}")
    return []


# ── BioBERT Suggestions ───────────────────────────────────────────────────────

def suggest_icd10_from_narrative_biobert(clinical_text: str, top_k: int = 5) -> List[dict]:
    """
    Use BioBERT semantic embeddings to suggest ICD-10 codes.
    Falls back gracefully if models are unavailable.
    """
    if not clinical_text.strip():
        return []
    try:
        from app.services.medical_nlp import get_medical_nlp
        nlp = get_medical_nlp()
        return nlp.suggest_icd10_biobert(clinical_text, top_k=top_k)
    except Exception as e:
        logger.warning(f"[ICD10Suggester] BioBERT suggestion failed: {e}")
        return []


# ── Regex Fallback ────────────────────────────────────────────────────────────

KEYWORD_ICD10_MAP = [
    (["heart failure", "chf", "congestive", "systolic heart"], "I50.23",
     "Acute on chronic systolic congestive heart failure"),
    (["copd", "chronic obstructive", "emphysema", "bronchitis exacerb"], "J44.1",
     "COPD with acute exacerbation"),
    (["sepsis", "septicemia", "bacteremia"], "A41.9",
     "Sepsis, unspecified organism"),
    (["pneumonia", "lobar pneumonia", "community acquired pneumonia"], "J18.9",
     "Pneumonia, unspecified organism"),
    (["stroke", "cerebral infarction", "ischemic stroke"], "I63.9",
     "Cerebral infarction, unspecified"),
    (["tia", "transient ischemic", "transient cerebral"], "G45.9",
     "Transient cerebral ischemic attack"),
    (["myocardial infarction", "heart attack", "stemi", "nstemi"], "I21.9",
     "Acute myocardial infarction, unspecified"),
    (["atrial fibrillation", "afib", "a-fib"], "I48.91",
     "Unspecified atrial fibrillation"),
    (["diabetes", "hyperglycemia", "diabetic"], "E11.9",
     "Type 2 diabetes mellitus without complications"),
    (["chronic kidney", "ckd", "renal failure", "renal disease"], "N18.3",
     "Chronic kidney disease, stage 3"),
    (["pulmonary embolism", "pe", "dvt", "deep vein thrombosis"], "I26.09",
     "Other pulmonary embolism without acute cor pulmonale"),
    (["respiratory failure", "hypoxic respiratory"], "J96.01",
     "Acute respiratory failure with hypoxia"),
    (["cellulitis", "skin infection", "wound infection"], "L03.90",
     "Cellulitis, unspecified"),
    (["gi bleed", "gastrointestinal bleeding", "melena", "hematemesis"], "K92.2",
     "Gastrointestinal hemorrhage, unspecified"),
    (["dehydration", "volume depletion", "hypovolemia"], "E86.0",
     "Dehydration"),
    (["covid", "coronavirus", "sars-cov-2"], "U07.1",
     "COVID-19"),
    (["delirium", "altered mental status", "encephalopathy"], "F05",
     "Delirium due to known physiological condition"),
    (["hip fracture", "femur fracture", "neck of femur"], "S72.001A",
     "Fracture of unspecified part of neck of right femur"),
]


def suggest_icd10_regex_fallback(clinical_text: str) -> List[dict]:
    """Simple keyword-based ICD-10 fallback when models are unavailable."""
    text_lower = clinical_text.lower()
    results = []
    for keywords, code, display in KEYWORD_ICD10_MAP:
        for kw in keywords:
            if kw in text_lower:
                results.append({
                    "code": code,
                    "display": display,
                    "confidence": 0.60,
                    "reasoning": f"Keyword '{kw}' detected in clinical narrative",
                    "source": "keyword"
                })
                break
    return results[:5]


# ── Merged Suggestion Engine ──────────────────────────────────────────────────

def suggest_icd10_codes(
    clinical_text: str,
    top_k: int = 3,
    use_biobert: bool = True,
) -> List[dict]:
    """
    Main ICD-10 suggestion function.
    Combines Groq LLM + BioBERT semantic search.
    Falls back to keyword matching if both fail.

    Returns up to top_k suggestions with fields:
      code, display, confidence, reasoning (optional), source
    """
    if not clinical_text or not clinical_text.strip():
        return []

    groq_results = suggest_icd10_from_narrative_groq(clinical_text, top_k=top_k)

    biobert_results = []
    if use_biobert:
        biobert_results = suggest_icd10_from_narrative_biobert(clinical_text, top_k=top_k + 2)

    # Merge: prefer Groq (more contextual), augment with BioBERT for codes not already in Groq
    merged: dict[str, dict] = {}

    for s in groq_results:
        code = s["code"]
        merged[code] = s

    for s in biobert_results:
        code = s["code"]
        if code not in merged:
            # BioBERT-only result — add it but mark confidence lower if < 0.55
            if s["confidence"] >= 0.45:
                s["reasoning"] = f"Semantically similar to clinical text (BioBERT score: {s['confidence']:.0%})"
                merged[code] = s
        else:
            # Already from Groq — boost confidence slightly if BioBERT agrees
            existing_conf = merged[code]["confidence"]
            merged[code]["confidence"] = round(min(1.0, existing_conf * 0.7 + s["confidence"] * 0.3), 3)
            merged[code]["source"] = "Groq+BioBERT"

    result_list = sorted(merged.values(), key=lambda x: x["confidence"], reverse=True)

    # If completely empty, use keyword fallback
    if not result_list:
        result_list = suggest_icd10_regex_fallback(clinical_text)

    return result_list[:top_k]

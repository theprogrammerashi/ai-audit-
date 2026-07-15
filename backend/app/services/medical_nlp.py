"""
CareAudit AI - Medical NLP Service
Domain-specific embeddings using ClinicalBERT and BioBERT (CPU-only).
Models are downloaded once from HuggingFace and cached on D: drive.

ClinicalBERT (emilyalsentzer/Bio_ClinicalBERT):
  - Trained on clinical notes from MIMIC-III
  - Used for: clinical note semantic search, policy matching, chat retrieval

BioBERT (dmis-lab/biobert-base-cased-v1.2):
  - Trained on PubMed abstracts + PMC full texts
  - Used for: ICD-10 similarity, biomedical term matching, appeal risk enrichment
"""
import os
import logging
import numpy as np
from typing import Optional, List, Tuple
import threading

logger = logging.getLogger(__name__)

# ── HuggingFace cache location: D drive as requested ──────────────────────────
HF_CACHE_DIR = "D:/careaudit_models"
os.environ["TRANSFORMERS_CACHE"] = HF_CACHE_DIR
os.environ["HF_HOME"] = HF_CACHE_DIR
os.makedirs(HF_CACHE_DIR, exist_ok=True)

# ── Model identifiers ──────────────────────────────────────────────────────────
CLINICAL_BERT_MODEL = "emilyalsentzer/Bio_ClinicalBERT"
BIOBERT_MODEL = "dmis-lab/biobert-base-cased-v1.2"

# ── Common ICD-10 codes for BioBERT-based similarity matching ─────────────────
# Top 80 most common codes in hospital prior auth / UM settings
COMMON_ICD10_TERMS = [
    ("I50.23", "Acute on chronic systolic heart failure, congestive heart failure"),
    ("I50.9",  "Heart failure, unspecified"),
    ("I50.1",  "Left ventricular failure, unspecified"),
    ("J44.1",  "Chronic obstructive pulmonary disease with acute exacerbation"),
    ("J44.0",  "COPD with lower respiratory infection"),
    ("A41.9",  "Sepsis, unspecified organism"),
    ("A41.0",  "Sepsis due to Staphylococcus aureus"),
    ("R65.20", "Severe sepsis without septic shock"),
    ("J18.9",  "Pneumonia, unspecified organism"),
    ("J18.1",  "Lobar pneumonia, unspecified organism"),
    ("E11.9",  "Type 2 diabetes mellitus without complications"),
    ("E11.65", "Type 2 diabetes mellitus with hyperglycemia"),
    ("N18.3",  "Chronic kidney disease, stage 3 moderate"),
    ("N18.4",  "Chronic kidney disease, stage 4 severe"),
    ("N18.5",  "Chronic kidney disease, stage 5"),
    ("I63.9",  "Cerebral infarction, unspecified, acute ischemic stroke"),
    ("G45.9",  "Transient cerebral ischemic attack, TIA"),
    ("I21.9",  "Acute myocardial infarction, unspecified, heart attack"),
    ("I11.0",  "Hypertensive heart disease with heart failure"),
    ("I10",    "Essential primary hypertension"),
    ("C34.90", "Malignant neoplasm of bronchus and lung, unspecified"),
    ("J96.01", "Acute respiratory failure with hypoxia"),
    ("J96.11", "Chronic respiratory failure with hypoxia"),
    ("K92.1",  "Melena gastrointestinal bleeding"),
    ("K92.0",  "Hematemesis upper GI bleeding"),
    ("M79.3",  "Panniculitis, cellulitis"),
    ("L03.90", "Cellulitis, unspecified"),
    ("G93.1",  "Anoxic brain damage, not elsewhere classified"),
    ("F03.90", "Unspecified dementia without behavioral disturbance"),
    ("Z87.891","Personal history of nicotine dependence"),
    ("I48.91", "Unspecified atrial fibrillation"),
    ("I48.19", "Other persistent atrial fibrillation"),
    ("J22",    "Unspecified acute lower respiratory infection"),
    ("J06.9",  "Acute upper respiratory infection, unspecified"),
    ("K56.60", "Unspecified intestinal obstruction"),
    ("N39.0",  "Urinary tract infection, site not specified"),
    ("R07.9",  "Chest pain, unspecified"),
    ("R06.09", "Other forms of dyspnea, shortness of breath"),
    ("R00.1",  "Bradycardia, unspecified"),
    ("R00.0",  "Tachycardia, unspecified"),
    ("Z79.01", "Long-term current use of anticoagulants"),
    ("E87.1",  "Hypo-osmolality and hyponatremia"),
    ("E87.6",  "Hypokalemia"),
    ("E83.42", "Hypomagnesemia"),
    ("D50.9",  "Iron deficiency anemia, unspecified"),
    ("D62",    "Acute posthemorrhagic anemia"),
    ("T86.10", "Unspecified complication of kidney transplant"),
    ("Z94.0",  "Kidney transplant status"),
    ("I82.401","Acute DVT of unspecified deep veins of right leg"),
    ("I26.09", "Other pulmonary embolism without acute cor pulmonale"),
    ("M10.9",  "Gout, unspecified"),
    ("K57.30", "Diverticulosis of large intestine"),
    ("K92.2",  "Gastrointestinal hemorrhage, unspecified"),
    ("E86.0",  "Dehydration"),
    ("E46",    "Unspecified protein-calorie malnutrition"),
    ("R41.3",  "Other amnesia, altered mental status"),
    ("F05",    "Delirium due to known physiological condition"),
    ("G35",    "Multiple sclerosis"),
    ("M05.79", "Rheumatoid arthritis with rheumatoid factor"),
    ("M32.9",  "Systemic lupus erythematosus, unspecified, SLE"),
    ("K72.91", "Hepatic failure with coma, hepatic encephalopathy"),
    ("K70.30", "Alcoholic cirrhosis of liver without ascites"),
    ("B37.3",  "Candidiasis of vulva and vagina"),
    ("J12.81", "Pneumonia due to SARS-Associated Coronavirus, COVID-19"),
    ("U07.1",  "COVID-19"),
    ("Z15.01", "Genetic susceptibility to malignant neoplasm of breast"),
    ("C50.911","Malignant neoplasm of unspecified site of right female breast"),
    ("C61",    "Malignant neoplasm of prostate"),
    ("C18.9",  "Malignant neoplasm of colon, unspecified"),
    ("C80.1",  "Malignant (primary) neoplasm, unspecified"),
    ("B20",    "Human immunodeficiency virus disease, HIV"),
    ("T39.1X5A","Adverse effect of 4-Aminophenol derivatives, initial"),
    ("T45.515A","Adverse effect of anticoagulants, initial encounter, warfarin toxicity"),
    ("S72.001A","Fracture of unspecified part of neck of right femur, hip fracture"),
    ("S32.001A","Wedge compression fracture of first lumbar vertebra"),
    ("M54.5",  "Low back pain, lumbago"),
    ("G43.909","Migraine, unspecified, not intractable, without status migrainosus"),
    ("F32.1",  "Major depressive disorder, single episode, moderate"),
    ("F41.1",  "Generalized anxiety disorder"),
    ("F20.9",  "Schizophrenia, unspecified"),
]


class MedicalNLPService:
    """
    Singleton service providing ClinicalBERT and BioBERT embeddings.
    Models are loaded lazily (on first use) to avoid startup delay.
    CPU-only inference. Models cached on D: drive.
    """

    _instance: Optional["MedicalNLPService"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "MedicalNLPService":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    inst = super().__new__(cls)
                    inst._clinical_bert = None
                    inst._clinical_tokenizer = None
                    inst._biobert = None
                    inst._bio_tokenizer = None
                    inst._icd10_embeddings: Optional[np.ndarray] = None
                    inst._icd10_terms = COMMON_ICD10_TERMS
                    inst._models_attempted = False
                    cls._instance = inst
        return cls._instance

    # ── Model Loading ──────────────────────────────────────────────────────────

    def _load_clinical_bert(self) -> bool:
        """Lazy-load ClinicalBERT (Bio_ClinicalBERT)."""
        if self._clinical_bert is not None:
            return True
        try:
            from transformers import AutoTokenizer, AutoModel
            import torch
            logger.info("[MedicalNLP] Loading ClinicalBERT (Bio_ClinicalBERT)...")
            self._clinical_tokenizer = AutoTokenizer.from_pretrained(
                CLINICAL_BERT_MODEL, cache_dir=HF_CACHE_DIR
            )
            self._clinical_bert = AutoModel.from_pretrained(
                CLINICAL_BERT_MODEL, cache_dir=HF_CACHE_DIR
            )
            self._clinical_bert.eval()
            logger.info("[MedicalNLP] ClinicalBERT loaded successfully (CPU).")
            return True
        except Exception as e:
            logger.warning(f"[MedicalNLP] ClinicalBERT load failed: {e}")
            return False

    def _load_biobert(self) -> bool:
        """Lazy-load BioBERT."""
        if self._biobert is not None:
            return True
        try:
            from transformers import AutoTokenizer, AutoModel
            logger.info("[MedicalNLP] Loading BioBERT (biobert-base-cased-v1.2)...")
            self._bio_tokenizer = AutoTokenizer.from_pretrained(
                BIOBERT_MODEL, cache_dir=HF_CACHE_DIR
            )
            self._biobert = AutoModel.from_pretrained(
                BIOBERT_MODEL, cache_dir=HF_CACHE_DIR
            )
            self._biobert.eval()
            logger.info("[MedicalNLP] BioBERT loaded successfully (CPU).")
            return True
        except Exception as e:
            logger.warning(f"[MedicalNLP] BioBERT load failed: {e}")
            return False

    # ── Core Embedding Methods ─────────────────────────────────────────────────

    def _mean_pool(self, model_output, attention_mask) -> np.ndarray:
        """Mean-pool token embeddings weighted by attention mask."""
        token_embeddings = model_output.last_hidden_state  # (B, T, H)
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = (token_embeddings * input_mask_expanded).sum(1)
        sum_mask = input_mask_expanded.sum(1).clamp(min=1e-9)
        return (sum_embeddings / sum_mask).detach().cpu().numpy()[0]

    def embed_clinical_text(self, text: str) -> Optional[np.ndarray]:
        """
        Generate a ClinicalBERT embedding for clinical note text.
        Returns a 768-dim numpy array, or None if model unavailable.
        """
        if not self._load_clinical_bert():
            return None
        try:
            import torch
            # Truncate to 512 tokens (BERT limit)
            inputs = self._clinical_tokenizer(
                text[:2048], return_tensors="pt", truncation=True,
                max_length=512, padding=True
            )
            with torch.no_grad():
                outputs = self._clinical_bert(**inputs)
            return self._mean_pool(outputs, inputs["attention_mask"])
        except Exception as e:
            logger.warning(f"[MedicalNLP] ClinicalBERT embed error: {e}")
            return None

    def embed_biomedical(self, text: str) -> Optional[np.ndarray]:
        """
        Generate a BioBERT embedding for biomedical/ICD-10 term text.
        Returns a 768-dim numpy array, or None if model unavailable.
        """
        if not self._load_biobert():
            return None
        try:
            import torch
            inputs = self._bio_tokenizer(
                text[:2048], return_tensors="pt", truncation=True,
                max_length=512, padding=True
            )
            with torch.no_grad():
                outputs = self._biobert(**inputs)
            return self._mean_pool(outputs, inputs["attention_mask"])
        except Exception as e:
            logger.warning(f"[MedicalNLP] BioBERT embed error: {e}")
            return None

    # ── ICD-10 Semantic Suggestion (BioBERT) ──────────────────────────────────

    def _build_icd10_index(self) -> bool:
        """Pre-compute BioBERT embeddings for all common ICD-10 terms."""
        if self._icd10_embeddings is not None:
            return True
        logger.info("[MedicalNLP] Building ICD-10 BioBERT embedding index...")
        embeddings = []
        for code, description in self._icd10_terms:
            emb = self.embed_biomedical(description)
            if emb is not None:
                embeddings.append(emb)
            else:
                embeddings.append(np.zeros(768))
        self._icd10_embeddings = np.array(embeddings)
        # Normalize for cosine similarity
        norms = np.linalg.norm(self._icd10_embeddings, axis=1, keepdims=True)
        norms = np.where(norms < 1e-9, 1.0, norms)
        self._icd10_embeddings = self._icd10_embeddings / norms
        logger.info(f"[MedicalNLP] ICD-10 index built: {len(self._icd10_terms)} codes.")
        return True

    def suggest_icd10_biobert(self, clinical_text: str, top_k: int = 5) -> List[dict]:
        """
        Use BioBERT to find the most semantically similar ICD-10 codes
        to the given clinical narrative. Returns top-k matches.
        """
        if not self._load_biobert():
            return []
        if not self._build_icd10_index():
            return []
        try:
            query_emb = self.embed_biomedical(clinical_text)
            if query_emb is None:
                return []
            # Normalize query
            norm = np.linalg.norm(query_emb)
            if norm > 1e-9:
                query_emb = query_emb / norm
            # Cosine similarities
            sims = self._icd10_embeddings @ query_emb  # (N,)
            top_indices = np.argsort(sims)[::-1][:top_k]
            results = []
            for idx in top_indices:
                code, description = self._icd10_terms[idx]
                sim = float(sims[idx])
                if sim > 0.3:  # Threshold — skip low-relevance matches
                    results.append({
                        "code": code,
                        "display": description,
                        "confidence": round(sim, 3),
                        "source": "BioBERT"
                    })
            return results
        except Exception as e:
            logger.warning(f"[MedicalNLP] ICD-10 BioBERT suggest error: {e}")
            return []

    # ── Policy Semantic Matching (ClinicalBERT) ────────────────────────────────

    def score_policy_match(self, case_summary: str, policy_text: str) -> float:
        """
        Compute cosine similarity between case clinical summary and policy text.
        Returns float [0, 1]. Falls back to 0.5 if models unavailable.
        """
        case_emb = self.embed_clinical_text(case_summary)
        policy_emb = self.embed_clinical_text(policy_text)
        if case_emb is None or policy_emb is None:
            return 0.5
        try:
            # Cosine similarity
            cos_sim = float(
                np.dot(case_emb, policy_emb) /
                (np.linalg.norm(case_emb) * np.linalg.norm(policy_emb) + 1e-9)
            )
            return round(max(0.0, min(1.0, cos_sim)), 3)
        except Exception:
            return 0.5

    # ── Semantic Search (ClinicalBERT) ─────────────────────────────────────────

    def semantic_search(
        self, query: str, documents: List[str], top_k: int = 3
    ) -> List[Tuple[int, float, str]]:
        """
        Rank documents by semantic similarity to the query using ClinicalBERT.
        Returns list of (index, score, document) tuples, sorted by score desc.
        Falls back to empty list if models unavailable.
        """
        query_emb = self.embed_clinical_text(query)
        if query_emb is None or not documents:
            return []
        try:
            doc_embs = []
            for doc in documents:
                emb = self.embed_clinical_text(doc)
                if emb is not None:
                    doc_embs.append(emb)
                else:
                    doc_embs.append(np.zeros(768))
            doc_matrix = np.array(doc_embs)
            # Normalize
            q_norm = np.linalg.norm(query_emb)
            if q_norm > 1e-9:
                query_emb = query_emb / q_norm
            d_norms = np.linalg.norm(doc_matrix, axis=1, keepdims=True)
            d_norms = np.where(d_norms < 1e-9, 1.0, d_norms)
            doc_matrix = doc_matrix / d_norms
            sims = doc_matrix @ query_emb
            top_indices = np.argsort(sims)[::-1][:top_k]
            return [(int(i), float(sims[i]), documents[i]) for i in top_indices]
        except Exception as e:
            logger.warning(f"[MedicalNLP] Semantic search error: {e}")
            return []


# ── Module-level singleton accessor ───────────────────────────────────────────

_service: Optional[MedicalNLPService] = None
_service_lock = threading.Lock()


def get_medical_nlp() -> MedicalNLPService:
    """Get or create the MedicalNLPService singleton."""
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                _service = MedicalNLPService()
    return _service

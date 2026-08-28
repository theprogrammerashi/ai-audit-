"""
CareAudit AI - Document Parser Service
Extracts structured clinical data from PDFs, DOCX, and CSV files.
Uses regex + heuristic NLP patterns for entity extraction.
OCR fallback via pytesseract for scanned PDFs and image files.
"""
import re
import io
import csv
import logging
from typing import Optional, Tuple
from app.schemas.document import (
    ParsedDocumentResponse, ExtractedVitals, ExtractedLabs,
    ExtractedDiagnosis, ExtractedTimelineEvent
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# TEXT EXTRACTION (by file type)
# ═══════════════════════════════════════════════════════════════════════════════

def extract_text_from_pdf(file_bytes: bytes) -> Tuple[str, int, bool]:
    """
    Extract text from PDF using pdfplumber.
    If text is empty or very short (scanned PDF), falls back to pytesseract OCR.
    Returns (text, page_count, ocr_used).
    """
    import pdfplumber
    text_parts = []
    page_count = 0
    ocr_used = False

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

    full_text = "\n".join(text_parts).strip()

    # OCR fallback: if pdfplumber yielded < 50 meaningful chars, use tesseract
    if len(full_text) < 50:
        logger.info("[Parser] pdfplumber returned sparse text — trying OCR fallback")
        full_text, page_count, ocr_used = _ocr_pdf(file_bytes)

    return full_text, page_count, ocr_used


def _ocr_pdf(file_bytes: bytes) -> Tuple[str, int, bool]:
    """
    OCR a PDF using PyMuPDF for rendering + pytesseract for text recognition.
    Returns (text, page_count, True).
    """
    try:
        import fitz  # PyMuPDF
        import pytesseract
        from PIL import Image
        import numpy as np

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page_count = len(doc)
        text_parts = []

        for page_num in range(min(page_count, 15)):  # Max 15 pages for perf
            page = doc.load_page(page_num)
            # Render at 200 DPI (2x scale factor)
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            # Convert to PIL Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            page_text = pytesseract.image_to_string(img, config="--psm 6")
            if page_text.strip():
                text_parts.append(page_text)

        doc.close()
        return "\n".join(text_parts), page_count, True
    except Exception as e:
        logger.warning(f"[Parser] OCR fallback failed: {e}")
        return "", 0, False


def extract_text_from_image(file_bytes: bytes) -> Tuple[str, int, bool]:
    """
    Extract text from an image file (PNG, JPG, TIFF) using pytesseract OCR.
    Returns (text, 1, True).
    """
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        # Convert to RGB if needed (handles RGBA, grayscale, etc.)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        text = pytesseract.image_to_string(img, config="--psm 6")
        return text.strip(), 1, True
    except Exception as e:
        logger.warning(f"[Parser] Image OCR failed: {e}")
        return "", 1, True


def extract_text_from_docx(file_bytes: bytes) -> Tuple[str, int, bool]:
    """Extract text from DOCX using python-docx. Returns (text, pages, ocr_used)."""
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    # Also extract from tables
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                paragraphs.append(row_text)
    return "\n".join(paragraphs), 1, False


def extract_text_from_csv(file_bytes: bytes) -> Tuple[str, int, bool]:
    """Extract text from CSV by reading all rows. Returns (text, pages, ocr_used)."""
    text = file_bytes.decode("utf-8", errors="ignore")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    return "\n".join([", ".join(row) for row in rows[:100]]), 1, False


def extract_text(file_bytes: bytes, filename: str) -> Tuple[str, int, str, bool]:
    """
    Route to the correct extractor based on file extension.
    Returns (text, page_count, file_type, ocr_used).
    """
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext == "pdf":
        text, pages, ocr_used = extract_text_from_pdf(file_bytes)
        return text, pages, "pdf", ocr_used
    elif ext in ("docx", "doc"):
        text, pages, ocr_used = extract_text_from_docx(file_bytes)
        return text, pages, "docx", ocr_used
    elif ext == "csv":
        text, pages, ocr_used = extract_text_from_csv(file_bytes)
        return text, pages, "csv", ocr_used
    elif ext == "txt":
        text = file_bytes.decode("utf-8", errors="ignore")
        return text, 1, "txt", False
    elif ext in ("png", "jpg", "jpeg", "tiff", "tif", "bmp", "webp"):
        text, pages, ocr_used = extract_text_from_image(file_bytes)
        return text, pages, "image", ocr_used
    else:
        # Try as text
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
            return text, 1, "unknown", False
        except Exception:
            return "", 0, "unknown", False


# ═══════════════════════════════════════════════════════════════════════════════
# DOCUMENT TYPE DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

DOCUMENT_TYPE_KEYWORDS = {
    "PRIOR_AUTH": ["prior authorization", "authorization request", "pa request", "pre-authorization", "precertification", "utilization management", "um review"],
    "CLINICAL_NOTE": ["clinical note", "progress note", "physician note", "history and physical", "h&p", "assessment and plan", "chief complaint", "hpi"],
    "DISCHARGE_SUMMARY": ["discharge summary", "discharge diagnosis", "discharge instructions", "discharge date", "hospital course", "discharge medication"],
    "APPEAL_DOCUMENT": ["appeal", "reconsideration", "overturn", "denial letter", "adverse determination", "grievance"],
    "CLAIMS_DATA": ["claim number", "hcpcs", "cpt code", "billing", "charges", "reimbursement", "explanation of benefits", "eob"],
    "LAB_REPORT": ["lab report", "laboratory", "specimen", "reference range", "lab results", "blood work", "urinalysis", "culture"],
}


def detect_document_type(text: str) -> Tuple[str, float]:
    """Detect the type of clinical document from its text content."""
    text_lower = text.lower()
    scores = {}
    for doc_type, keywords in DOCUMENT_TYPE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        scores[doc_type] = score

    best_type = max(scores, key=scores.get)
    max_score = scores[best_type]
    if max_score == 0:
        return "PRIOR_AUTH", 0.3  # Default
    confidence = min(max_score / 3.0, 1.0)
    return best_type, confidence


# ═══════════════════════════════════════════════════════════════════════════════
# ENTITY EXTRACTION PATTERNS
# ═══════════════════════════════════════════════════════════════════════════════

def _search(pattern: str, text: str, flags=re.IGNORECASE) -> Optional[str]:
    """Helper: return first regex group match or None."""
    m = re.search(pattern, text, flags)
    return m.group(1).strip() if m else None


def extract_patient_name(text: str) -> Tuple[Optional[str], float]:
    """Extract patient name from clinical text."""
    patterns = [
        r"patient\s*(?:name)?[:\s]+([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)+)",
        r"name[:\s]+([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)+)",
        r"pt[:\s]+([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)+)",
        r"patient[:\s]+([A-Z][a-z]+[ \t]+[A-Z][a-z]+)",
        r"(?:Mr|Mrs|Ms|Dr)\.?\s+([A-Z][a-z]+[ \t]+[A-Z][a-z]+)",
        # Fallback: NAME field in structured docs
        r"(?:Patient|NAME)[:\s]*([A-Z][a-z]+[ \t,]+[A-Z][a-z]+)",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            name = m.group(1).strip()
            # Clean up trailing label keywords (e.g. DOB, DATE, DATE OF BIRTH, MRN, Age, Sex, etc.) that might have been matched
            name = re.sub(r'\s+(?:DOB|DATE|DATE\s+OF\s+BIRTH|mrn|id|dob|ssn|gender|age|sex|patient|history|appeal|level)\b.*', '', name, flags=re.IGNORECASE).strip()
            # Filter out common false positives
            if name.lower() not in ("heart failure", "chest pain", "blood pressure", "medical center", "emergency department"):
                return name, 0.85
    return None, 0.0



def extract_mrn(text: str) -> Tuple[Optional[str], float]:
    """Extract Medical Record Number."""
    patterns = [
        r"(?:MRN|medical\s*record\s*(?:number|#|no))[:\s#]*(\d{5,10})",
        r"(?:MR#|MRN#|Acct)[:\s#]*(\d{5,10})",
        r"(?:Member\s*ID|Patient\s*ID)[:\s#]*([A-Z]?\d{5,10})",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip(), 0.92
    return None, 0.0


def extract_dob(text: str) -> Tuple[Optional[str], float]:
    """Extract Date of Birth."""
    patterns = [
        r"(?:DOB|Date\s*of\s*Birth|Birth\s*Date)[:\s]*([\d]{1,2}[/\-][\d]{1,2}[/\-][\d]{2,4})",
        r"(?:DOB|Date\s*of\s*Birth)[:\s]*([\d]{4}[/\-][\d]{1,2}[/\-][\d]{1,2})",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip(), 0.90
    return None, 0.0


def extract_age(text: str) -> Tuple[Optional[int], float]:
    """Extract patient age."""
    patterns = [
        r"(?:age|aged)[:\s]*(\d{1,3})\s*(?:year|yr|y/?o|yo)",
        r"(\d{1,3})\s*(?:year|yr)\s*(?:old|-old)",
        r"AGE[:\s]*(\d{1,3})",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            age = int(m.group(1))
            if 0 < age < 120:
                return age, 0.88
    return None, 0.0


def extract_gender(text: str) -> Optional[str]:
    """Extract patient gender."""
    text_lower = text.lower()
    # Check explicit mentions first
    if re.search(r"\b(female|woman)\b", text_lower):
        return "Female"
    if re.search(r"\b(male|man)\b", text_lower):
        return "Male"
        
    # Check Sex: M/F
    sex_match = re.search(r"\b(?:sex|gender)\s*:\s*(m|f)\b", text_lower)
    if sex_match:
        return "Male" if sex_match.group(1) == 'm' else "Female"
        
    # Fallback to pronouns
    if re.search(r"\b(she|her)\b", text_lower):
        return "Female"
    if re.search(r"\b(he|his)\b", text_lower):
        return "Male"
        
    return None


def extract_icd10_codes(text: str) -> list:
    """Extract ICD-10 codes from text."""
    # ICD-10 pattern: letter followed by digits, optional dot, more digits
    codes = re.findall(r'\b([A-TV-Z]\d{2}(?:\.\d{1,4})?)\b', text)
    return list(dict.fromkeys(codes))  # deduplicate, preserve order


ICD10_DISPLAY_MAP = {
    "I50": "Heart Failure", "I50.2": "Systolic Heart Failure", "I50.23": "Acute on Chronic Systolic Heart Failure",
    "I50.9": "Heart Failure, Unspecified", "I50.1": "Left Ventricular Failure",
    "J44": "COPD", "J44.1": "COPD with Acute Exacerbation", "J44.0": "COPD with Lower Respiratory Infection",
    "A41": "Sepsis", "A41.9": "Sepsis, Unspecified Organism", "A41.0": "Septicemia due to Staphylococcus",
    "R65.2": "Severe Sepsis", "R65.20": "Severe Sepsis without Septic Shock",
    "J18": "Pneumonia", "J18.9": "Pneumonia, Unspecified", "J18.1": "Lobar Pneumonia",
    "E11": "Type 2 Diabetes Mellitus", "E11.9": "Type 2 Diabetes without Complications",
    "I63": "Cerebral Infarction (Stroke)", "G45": "Transient Cerebral Ischemic Attacks",
    "N18": "Chronic Kidney Disease", "N18.3": "CKD Stage 3", "N18.4": "CKD Stage 4",
    "C34": "Malignant Neoplasm of Bronchus/Lung",
    "I11": "Hypertensive Heart Disease", "I11.0": "Hypertensive Heart Disease with Heart Failure",
}


def extract_diagnoses(text: str) -> Tuple[Optional[ExtractedDiagnosis], list]:
    """Extract primary and secondary diagnoses."""
    codes = extract_icd10_codes(text)
    primary = None
    secondary = []

    # Try to find explicit primary diagnosis mention
    primary_patterns = [
        r"(?:primary\s*)?diagnosis[:\s]+([^\n,]+)",
        r"admitting\s*diagnosis[:\s]+([^\n,]+)",
        r"principal\s*diagnosis[:\s]+([^\n,]+)",
        r"(?:assessment(?:\s*(?:and|&)?\s*plan)?)[:\s]+([^\n,]+)",
    ]
    primary_display = None
    for p in primary_patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            # Reject if it's actually the "Diagnosis Category" field
            if "category" in val.lower() or "category" in m.group(0).lower():
                continue
            primary_display = val[:100]
            break

    if codes:
        code = codes[0]
        display = primary_display or ICD10_DISPLAY_MAP.get(code, ICD10_DISPLAY_MAP.get(code.split(".")[0], code))
        primary = ExtractedDiagnosis(icd10_code=code, display_name=display, confidence=0.85)

        for c in codes[1:5]:
            disp = ICD10_DISPLAY_MAP.get(c, ICD10_DISPLAY_MAP.get(c.split(".")[0], c))
            secondary.append(ExtractedDiagnosis(icd10_code=c, display_name=disp, confidence=0.70))
    elif primary_display:
        # Guess ICD-10 from display name
        display_lower = primary_display.lower()
        guessed_code = None
        if "heart failure" in display_lower or "chf" in display_lower:
            guessed_code = "I50.23"
        elif "copd" in display_lower:
            guessed_code = "J44.1"
        elif "sepsis" in display_lower:
            guessed_code = "A41.9"
        elif "pneumonia" in display_lower:
            guessed_code = "J18.9"
        elif "diabetes" in display_lower:
            guessed_code = "E11.9"
        elif "stroke" in display_lower or "cerebral" in display_lower:
            guessed_code = "I63"
        elif "kidney" in display_lower or "ckd" in display_lower:
            guessed_code = "N18.3"
        primary = ExtractedDiagnosis(
            icd10_code=guessed_code or "UNKNOWN",
            display_name=primary_display,
            confidence=0.65
        )

    return primary, secondary


def extract_vitals(text: str) -> Optional[ExtractedVitals]:
    """Extract vital signs from clinical text."""
    vitals = ExtractedVitals()
    found_any = False

    # Temperature
    m = re.search(r'(?:temp|temperature)[:\s]*(\d{2,3}\.?\d*)\s*°?[fF]?', text, re.IGNORECASE)
    if m:
        vitals.temp = float(m.group(1))
        found_any = True

    # Blood Pressure
    m = re.search(r'(?:BP|blood\s*pressure)[:\s]*(\d{2,3}\s*/\s*\d{2,3})', text, re.IGNORECASE)
    if m:
        vitals.bp = m.group(1).replace(" ", "")
        found_any = True

    # Heart Rate
    m = re.search(r'(?:HR|heart\s*rate|pulse)[:\s]*(\d{2,3})\s*(?:bpm|/min)?', text, re.IGNORECASE)
    if m:
        val = int(m.group(1))
        if 30 <= val <= 250:
            vitals.hr = val
            found_any = True

    # Respiratory Rate
    m = re.search(r'(?:RR|resp(?:iratory)?\s*rate)[:\s]*(\d{1,2})\s*(?:/min)?', text, re.IGNORECASE)
    if m:
        val = int(m.group(1))
        if 5 <= val <= 60:
            vitals.rr = val
            found_any = True

    # O2 Saturation
    m = re.search(r'(?:O2\s*sat|SpO2|oxygen\s*sat(?:uration)?|SaO2)[:\s]*(\d{2,3})\s*%?', text, re.IGNORECASE)
    if m:
        val = int(m.group(1))
        if 50 <= val <= 100:
            vitals.o2_sat = val
            found_any = True

    return vitals if found_any else None


def extract_labs(text: str) -> Optional[ExtractedLabs]:
    """Extract lab values from clinical text."""
    labs = ExtractedLabs()
    found_any = False

    lab_patterns = {
        "bnp": (r'(?:BNP|B-type\s*natriuretic)[:\s]*([\d,]+\.?\d*)\s*(?:pg/m[Ll])?', lambda x: float(x.replace(",", ""))),
        "wbc": (r'(?:WBC|white\s*blood\s*cell)[:\s]*([\d.]+)\s*(?:K|x10|×10)?', float),
        "lactate": (r'(?:lactate|lactic\s*acid)[:\s]*([\d.]+)\s*(?:mmol)?', float),
        "creatinine": (r'(?:creatinine|Cr)[:\s]*([\d.]+)\s*(?:mg/dL)?', float),
        "potassium": (r'(?:potassium|K\+?)[:\s]*([\d.]+)\s*(?:mEq|mmol)?', float),
        "troponin": (r'(?:troponin|TnI|TnT)[:\s]*([\d.]+)', float),
        "procalcitonin": (r'(?:procalcitonin|PCT)[:\s]*([\d.]+)', float),
        "hemoglobin": (r'(?:hemoglobin|Hgb|Hb)[:\s]*([\d.]+)\s*(?:g/dL)?', float),
        "sodium": (r'(?:sodium|Na\+?)[:\s]*(\d{2,3})\s*(?:mEq|mmol)?', float),
        "glucose": (r'(?:glucose|blood\s*sugar)[:\s]*(\d{2,4})\s*(?:mg/dL)?', float),
        "ef": (r'(?:EF|ejection\s*fraction)[:\s]*(\d{1,2})\s*%?', int),
    }

    for lab_name, (pattern, converter) in lab_patterns.items():
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            try:
                val = converter(m.group(1))
                setattr(labs, lab_name, val)
                found_any = True
            except (ValueError, TypeError):
                pass

    return labs if found_any else None


def expand_medical_abbreviations(text: str) -> str:
    """Expand common medical shorthand abbreviations to full English terms for audit clarity."""
    if not text:
        return text
    abbreviations = {
        r'\bq(\d+)h\b': r'every \1 hours',
        r'\bqd\b': 'daily',
        r'\bbid\b': 'twice daily',
        r'\btid\b': 'three times daily',
        r'\bqid\b': 'four times daily',
        r'\bprn\b': 'as needed',
    }
    for pattern, replacement in abbreviations.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text


def extract_clinical_summary(text: str, doc_type: str = "PRIOR_AUTH") -> Tuple[Optional[str], float]:
    """Extract a clinical summary or HPI from the text."""
    # Try GenAI (Groq LLM) first if configured
    try:
        from app.config import settings
        if settings.GROQ_API_KEY and text.strip():
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            
            if doc_type == "APPEAL_DOCUMENT":
                prompt = f"""You are a clinical quality assurance expert. Provide a detailed yet concise summary of the following raw medical appeal document. Balance clinical thoroughness with brevity.
            
Ensure the output is formatted exactly with these bold headers:
**OVERVIEW OF DISPUTE:** [Short summary of the case and what is being appealed - max 1 sentence]
**DENIAL RATIONALE:** [The reason given by the payer/insurance for the original denial - max 2 sentences]
**APPELLANT ARGUMENTS:** [The arguments/grounds raised by the provider or patient in support of the appeal - max 3 sentences]
**CLINICAL EVIDENCE SUPPORTING OVERTURN:**
- **Vitals/Labs/Imaging:** [key clinical data supporting inpatient severity, e.g. temperature, blood pressure, heart rate, respiratory rate, oxygen saturation, BNP, lactate, creatinine, EF, etc.]
- **Treatments/Monitoring:** [IV medications, continuous monitoring, or interventions that justify the requested level of care]
**CONCLUSION & RECOMMENDATION:** [Final clinical summary and recommendation for the appeal determination - max 2 sentences]

Rules:
- Be clinically precise, objective, and thorough. Do not omit critical clinical signs or arguments.
- Keep each section short, bulleted, and to the point. Avoid conversational filler.
- Do not use medical shorthand abbreviations in the summary (e.g., expand "q6h" to "every 6 hours", "q4h" to "every 4 hours", "bid" to "twice daily", "qd" to "daily", "prn" to "as needed", etc.). Use the full English words for clarity.
- If any section cannot be found in the text, write "Not documented" for that specific section.

Raw Medical Text:
{text[:4000]}"""
            else:
                prompt = f"""You are a clinical quality assurance expert. Provide a detailed yet concise clinical summary of the following raw medical text. Balance clinical thoroughness with brevity.
            
Ensure the output is formatted exactly with these bold headers:
**CHIEF COMPLAINT:** [Chief Complaint - max 1 sentence]
**History of Present Illness (HPI):** [Brief narrative of symptoms and presentation - max 3 sentences]
**OBJECTIVE DATA:**
- **Vitals:** [key vital signs: temperature, blood pressure, heart rate, respiratory rate, oxygen saturation]
- **Exam:** [key physical exam findings]
- **Labs/Imaging:** [key labs/imaging results: lactate, WBC, creatinine, procalcitonin, BNP, EF, etc.]
**ASSESSMENT & PLAN:** [clinical assessment and treatment plan, noting therapies and planned monitoring - max 3 sentences]

Rules:
- Be clinically precise, objective, and thorough. Do not omit critical clinical signs.
- Keep each section short, bulleted, and to the point. Avoid conversational filler.
- Do not use medical shorthand abbreviations in the summary (e.g., expand "q6h" to "every 6 hours", "q4h" to "every 4 hours", "bid" to "twice daily", "qd" to "daily", "prn" to "as needed", etc.). Use the full English words for clarity.
- If any section cannot be found in the text, write "Not documented" for that specific section.

Raw Medical Text:
{text[:4000]}"""

            response = client.chat.completions.create(
                model=settings.GROQ_FAST_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=600,
            )
            summary = response.choices[0].message.content.strip()
            if len(summary) > 30:
                summary = expand_medical_abbreviations(summary)
                logger.info("[Parser] Successfully generated GenAI clinical summary.")
                return summary, 0.95
    except Exception as e:
        logger.warning(f"[Parser] LLM clinical summary extraction failed: {e}. Falling back to rule-based.")


    # Rule-based fallback: extract multiple sections for a comprehensive summary
    sections = []
    
    # 1. Chief Complaint & HPI
    cc_match = re.search(r"Chief\s*Complaint[\s:\n]+([^\n]+)", text, re.IGNORECASE)
    hpi_match = re.search(r"History\s*of\s*Present\s*Illness\s*(?:\(HPI\))?[\s:\n]+([^\n]+(?:\n[^\n]+){1,8})", text, re.IGNORECASE)
    
    hpi_parts = []
    if cc_match:
        hpi_parts.append(f"**Chief Complaint:** {cc_match.group(1).strip()}")
    if hpi_match:
        hpi_text = re.sub(r'\s+', ' ', hpi_match.group(1)).strip()
        hpi_text = re.split(r'\b(?:Past Medical|Review of Systems|Vital Signs|Physical Exam)\b', hpi_text, flags=re.IGNORECASE)[0].strip()
        if len(hpi_text) > 15:
            hpi_parts.append(f"**History of Present Illness (HPI):** {hpi_text}")
    elif not cc_match:
        # Fallback HPI search
        fallback_hpi = re.search(r"(?:HPI|Reason\s*for\s*(?:Admission|Review|Visit)|Overview\s*of\s*Dispute)[\s:\n]+([^\n]+(?:\n[^\n]+){1,6})", text, re.IGNORECASE)
        if fallback_hpi:
            f_text = re.sub(r'\s+', ' ', fallback_hpi.group(1)).strip()
            f_text = re.split(r'\b(?:VITALS|OBJECTIVE|LABS|LABORATORY|ASSESSMENT|PLAN|POLICY|KEY EVIDENCE)\b', f_text, flags=re.IGNORECASE)[0].strip()
            if len(f_text) > 15:
                hpi_parts.append(f"**History:** {f_text}")

    if hpi_parts:
        sections.append("\n".join(hpi_parts))

    # 2. Vitals & Physical Exam
    vitals_match = re.search(r"Vital\s*Signs[\s:\n]+([^\n]+(?:\n[^\n]+){1,7})", text, re.IGNORECASE)
    exam_match = re.search(r"Physical\s*Examination[\s:\n]+([^\n]+(?:\n[^\n]+){1,7})", text, re.IGNORECASE)
    
    objective_parts = []
    if vitals_match:
        v_text = re.sub(r'\s+', ' ', vitals_match.group(1)).strip()
        v_text = re.split(r'\b(?:Physical Examination|Emergency Department|Assessment|Plan)\b', v_text, flags=re.IGNORECASE)[0].strip()
        if len(v_text) > 15:
            objective_parts.append(f"• **Vitals:** {v_text}")
    if exam_match:
        e_text = re.sub(r'\s+', ' ', exam_match.group(1)).strip()
        e_text = re.split(r'\b(?:Emergency Department|Assessment|Plan|SECTION)\b', e_text, flags=re.IGNORECASE)[0].strip()
        if len(e_text) > 15:
            objective_parts.append(f"• **Exam:** {e_text[:350]}")

    if objective_parts:
        sections.append("**Objective Findings:**\n" + "\n".join(objective_parts))

    # 3. Emergency Department Course & Assessment & Plan
    ed_match = re.search(r"Emergency\s*Department\s*Course[\s:\n]+([^\n]+(?:\n[^\n]+){1,7})", text, re.IGNORECASE)
    plan_match = re.search(r"(?:Primary\s*Diagnosis|Assessment|Plan\s*of\s*Care)[\s:\n]+([^\n]+(?:\n[^\n]+){1,6})", text, re.IGNORECASE)
    
    plan_parts = []
    if ed_match:
        ed_text = re.sub(r'\s+', ' ', ed_match.group(1)).strip()
        ed_text = re.split(r'\b(?:Assessment|Primary Diagnosis|Plan|SECTION)\b', ed_text, flags=re.IGNORECASE)[0].strip()
        if len(ed_text) > 15:
            plan_parts.append(f"• **ED Course:** {ed_text}")
    if plan_match:
        p_text = re.sub(r'\s+', ' ', plan_match.group(1)).strip()
        p_text = re.split(r'\b(?:Medical Necessity|SECTION|Member Information)\b', p_text, flags=re.IGNORECASE)[0].strip()
        if len(p_text) > 15:
            plan_parts.append(f"• **Plan:** {p_text}")

    if plan_parts:
        sections.append("**Treatment & Plan:**\n" + "\n".join(plan_parts))

    if sections:
        rich_summary = expand_medical_abbreviations("\n\n".join(sections))
        return rich_summary, 0.85
    
    # Fallback: use first substantial paragraphs
    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 60]
    if paragraphs:
        summary_paragraph = expand_medical_abbreviations("\n\n".join(paragraphs[:3]))
        if len(summary_paragraph) > 1500:
            summary_paragraph = summary_paragraph[:1497] + "..."
        return summary_paragraph, 0.70
        
    return text[:1000].strip(), 0.50

    return None, 0.0


def extract_timeline(text: str) -> list:
    """Extract timeline events from the text."""
    events = []
    
    # Pattern: Day 1, Day 2, etc.
    day_pattern = r"(?:Day\s*(\d+))[:\s]*([^\n]+)"
    for m in re.finditer(day_pattern, text, re.IGNORECASE):
        events.append(ExtractedTimelineEvent(
            day=f"Day {m.group(1)}",
            event=m.group(2).strip()[:60],
            details=m.group(2).strip()
        ))

    # Pattern: dates with events
    if not events:
        date_pattern = r"(\d{1,2}/\d{1,2}(?:/\d{2,4})?)[:\s\-]+([^\n]{10,})"
        for m in re.finditer(date_pattern, text):
            event_text = m.group(2).strip()
            # Ignore common false positives from headers/metadata
            lower_evt = event_text.lower()
            if any(bad in lower_evt for bad in ["age:", "page", "***", "collection time", "dob:", "mrn:"]):
                continue
                
            events.append(ExtractedTimelineEvent(
                day=m.group(1),
                event=event_text[:60],
                details=event_text
            ))

    return events[:10]  # Max 10 events


def extract_risk_signals(text: str, vitals: Optional[ExtractedVitals], labs: Optional[ExtractedLabs]) -> list:
    """Identify clinical risk signals."""
    signals = []
    
    if vitals:
        if vitals.o2_sat and vitals.o2_sat < 90:
            signals.append("HYPOXEMIA")
        if vitals.hr and vitals.hr > 100:
            signals.append("TACHYCARDIA")
        if vitals.rr and vitals.rr > 24:
            signals.append("TACHYPNEA")
        if vitals.temp and vitals.temp > 100.4:
            signals.append("FEVER")
        if vitals.bp and "/" in vitals.bp:
            try:
                systolic = int(vitals.bp.split("/")[0])
                if systolic < 90:
                    signals.append("HYPOTENSION")
            except (ValueError, IndexError):
                pass

    if labs:
        if labs.lactate and labs.lactate >= 2.0:
            signals.append("ELEVATED_LACTATE")
        if labs.bnp and labs.bnp > 500:
            signals.append("ELEVATED_BNP")
        if labs.wbc and labs.wbc > 12:
            signals.append("LEUKOCYTOSIS")
        if labs.troponin and labs.troponin > 0.04:
            signals.append("ELEVATED_TROPONIN")
        if labs.creatinine and labs.creatinine > 1.5:
            signals.append("ELEVATED_CREATININE")

    # Text-based signals
    text_lower = text.lower()
    if "altered mental status" in text_lower or "confusion" in text_lower:
        signals.append("ALTERED_MENTAL_STATUS")
    if "hypotension" in text_lower or "sbp < 90" in text_lower:
        signals.append("HYPOTENSION")
    if "intubat" in text_lower or "mechanical ventilation" in text_lower:
        signals.append("VENTILATOR_DEPENDENT")

    return list(set(signals))


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN PARSE FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def parse_document(file_bytes: bytes, filename: str) -> ParsedDocumentResponse:
    """
    Parse a clinical document and extract all structured data.
    Supports PDF (with OCR fallback for scanned docs), DOCX, CSV, TXT,
    and image files (PNG, JPG, TIFF).
    Returns a ParsedDocumentResponse ready for frontend auto-fill.
    """
    text, page_count, file_type, ocr_used = extract_text(file_bytes, filename)

    if not text.strip():
        return ParsedDocumentResponse(
            filename=filename,
            file_type=file_type,
            page_count=page_count,
            parse_confidence=0.0,
            ocr_used=ocr_used,
            raw_text_preview="Unable to extract text from this document."
        )

    # Detect document type
    doc_type, doc_confidence = detect_document_type(text)

    # Extract entities
    patient_name, name_conf = extract_patient_name(text)
    mrn, mrn_conf = extract_mrn(text)
    dob, dob_conf = extract_dob(text)
    age, age_conf = extract_age(text)
    gender = extract_gender(text)
    primary_dx, secondary_dx = extract_diagnoses(text)
    vitals = extract_vitals(text)
    labs = extract_labs(text)
    summary, summary_conf = extract_clinical_summary(text, doc_type)

    timeline = extract_timeline(text)
    risk_signals = extract_risk_signals(text, vitals, labs)

    # AI-powered ICD-10 suggestions from clinical narrative
    icd10_suggestions = []
    try:
        from app.services.icd10_suggester import suggest_icd10_codes
        narrative_for_suggest = summary or text[:1500]
        if narrative_for_suggest.strip():
            icd10_suggestions = suggest_icd10_codes(
                narrative_for_suggest, top_k=3, use_biobert=True
            )
            logger.info(f"[Parser] ICD-10 suggestions: {[s['code'] for s in icd10_suggestions]}")
    except Exception as e:
        logger.warning(f"[Parser] ICD-10 suggestion failed: {e}")

    # Calculate overall confidence
    confidences = [c for c in [name_conf, mrn_conf, dob_conf, age_conf, doc_confidence] if c > 0]
    overall_confidence = sum(confidences) / max(len(confidences), 1)

    return ParsedDocumentResponse(
        detected_document_type=doc_type,
        parse_confidence=round(overall_confidence, 2),
        raw_text_preview=text[:500],
        patient_name=patient_name,
        patient_name_confidence=name_conf,
        mrn=mrn,
        mrn_confidence=mrn_conf,
        dob=dob,
        dob_confidence=dob_conf,
        age=age,
        age_confidence=age_conf,
        gender=gender,
        primary_diagnosis=primary_dx,
        secondary_diagnoses=secondary_dx,
        vitals=vitals,
        labs=labs,
        clinical_summary=summary,
        clinical_summary_confidence=summary_conf,
        timeline=timeline,
        risk_signals=risk_signals,
        icd10_suggestions=icd10_suggestions,
        ocr_used=ocr_used,
        filename=filename,
        file_type=file_type,
        page_count=page_count,
    )

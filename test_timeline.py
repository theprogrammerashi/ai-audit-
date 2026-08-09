import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app.services.document_parser import extract_text_from_pdf, extract_timeline

with open("sample_documents/Case1_CHF_ED_Note.pdf", "rb") as f:
    text, _, _ = extract_text_from_pdf(f.read())

print("TEXT:")
print(text[:500])
print("\nTIMELINE:")
print(extract_timeline(text))

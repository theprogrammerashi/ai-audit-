import os
import sys
import json
import re

# Add backend dir to PYTHONPATH to allow absolute imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_connection
from app.services.policy_engine import run_policy_match

def extract_vitals(text):
    vitals = {}
    if not isinstance(text, str): return vitals
    
    hr = re.search(r'HR[:\s]*(\d+)', text, re.IGNORECASE)
    bp = re.search(r'BP[:\s]*(\d+/\d+)', text, re.IGNORECASE)
    o2 = re.search(r'(?:O2|SpO2)[:\s]*(\d+)', text, re.IGNORECASE)
    temp = re.search(r'Temp[:\s]*([\d\.]+)', text, re.IGNORECASE)
    rr = re.search(r'RR[:\s]*(\d+)', text, re.IGNORECASE)
    
    if hr: vitals['hr'] = int(hr.group(1))
    if bp: vitals['bp'] = bp.group(1)
    if o2: vitals['o2_sat'] = int(o2.group(1))
    if temp: vitals['temp'] = float(temp.group(1))
    if rr: vitals['rr'] = int(rr.group(1))
    return vitals

def extract_labs(text):
    labs = {}
    if not isinstance(text, str): return labs
    
    bnp = re.search(r'BNP[:\s]*([\d,]+)', text, re.IGNORECASE)
    creat = re.search(r'Creatinine[:\s]*([\d\.]+)', text, re.IGNORECASE)
    wbc = re.search(r'WBC[:\s]*([\d\.]+)', text, re.IGNORECASE)
    lactate = re.search(r'Lactate[:\s]*([\d\.]+)', text, re.IGNORECASE)
    
    if bnp: labs['bnp'] = int(bnp.group(1).replace(',', ''))
    if creat: labs['creatinine'] = float(creat.group(1))
    if wbc: labs['wbc'] = float(wbc.group(1))
    if lactate: labs['lactate'] = float(lactate.group(1))
    return labs

def main():
    conn = get_connection()
    cases = conn.execute("SELECT id, primary_diagnosis_display, structured_case FROM cases").fetchall()
    
    updated = 0
    policy_matches_created = 0
    
    for case_id, diagnosis, structured_str in cases:
        if not structured_str:
            continue
            
        try:
            structured = json.loads(structured_str)
        except:
            continue
            
        needs_update = False
        
        # If it's the old schema from excel, it has 'Vitals Summary' and missing 'vitals' dict
        if 'vitals' not in structured or 'labs' not in structured:
            needs_update = True
            
            new_structured = {
                "vitals": extract_vitals(structured.get("Vitals Summary", "")),
                "labs": extract_labs(structured.get("Lab Result Summary", "")),
                "clinical_summary": f"{structured.get('Clinical Notes', '')} {structured.get('Nurse Review Notes', '')}".strip() or "No clinical summary available.",
                "timeline": [{"day": "Day 1", "event": "Admission", "details": structured.get("Prior Auth Notes", "")}],
                "risk_signals": []
            }
            
            # Preserve old keys just in case
            for k, v in structured.items():
                if k not in new_structured:
                    new_structured[k] = v
                    
            structured = new_structured
            
        if needs_update:
            conn.execute("UPDATE cases SET structured_case = ? WHERE id = ?", [json.dumps(structured), case_id])
            updated += 1
            
        # Check if policy match exists
        pm_count = conn.execute("SELECT COUNT(*) FROM policy_matches WHERE case_id = ?", [case_id]).fetchone()[0]
        if pm_count == 0:
            try:
                run_policy_match(case_id, diagnosis, structured, conn)
                policy_matches_created += 1
            except Exception as e:
                print(f"Failed to run policy match for {case_id}: {e}")
                
    print(f"Updated {updated} cases with new structured_case format.")
    print(f"Created {policy_matches_created} missing policy matches.")

if __name__ == '__main__':
    main()

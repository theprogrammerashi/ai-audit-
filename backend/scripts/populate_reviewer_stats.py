import os
import sys
import json
import random
from pathlib import Path

# Add the project root to sys.path so we can import app modules
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import get_connection

def generate_stats_for_nurses():
    conn = get_connection()
    
    # Get all nurses
    nurses = conn.execute("SELECT id, full_name, qa_lead_id FROM users WHERE role = 'NURSE'").fetchall()
    
    if not nurses:
        print("No nurses found.")
        return
        
    print(f"Found {len(nurses)} nurses. Generating reviewer_stats...")
    
    # Delete existing stats to prevent duplicates
    conn.execute("DELETE FROM reviewer_stats")
    
    possible_gaps = [
        "Minor documentation gaps in rationale specificity",
        "Observation vs Inpatient boundary cases",
        "CHF criteria application",
        "Documentation completeness",
        "Rationale writing quality",
        "Lab value citations in rationale",
        "Over-approving pattern vs team average",
        "Consistency with peer decisions",
        "Missing exact ICD-10 codes in justification",
        "Policy interpretation edge cases"
    ]
    
    count = 0
    for nurse in nurses:
        nurse_id = nurse[0]
        
        # Generate realistic looking stats
        qa_score = round(random.uniform(75.0, 98.0), 1)
        approval_rate = round(random.uniform(0.55, 0.90), 2)
        denial_rate = round(1.0 - approval_rate, 2)
        overturn_rate = round(random.uniform(0.02, 0.15), 2)
        
        doc_score = round(random.uniform(max(qa_score - 10, 60), min(qa_score + 10, 100)), 1)
        policy_comp = round(random.uniform(max(qa_score - 10, 60), min(qa_score + 10, 100)), 1)
        consist_score = round(random.uniform(max(qa_score - 10, 60), min(qa_score + 10, 100)), 1)
        
        volume = random.randint(25, 150)
        percentile = random.randint(30, 99)
        
        num_gaps = random.randint(0, 3)
        gaps = random.sample(possible_gaps, num_gaps) if num_gaps > 0 else []
        gaps_json = json.dumps(gaps)
        
        trend = random.choice(["IMPROVING", "DECLINING", "STABLE", "STABLE"])
        
        rs_id = f"rs-gen-{nurse_id[-4:]}"
        
        conn.execute("""
            INSERT INTO reviewer_stats (id, reviewer_id, period, qa_score_avg, approval_rate, denial_rate,
                                        overturn_rate, documentation_score, policy_compliance, consistency_score,
                                        case_volume, peer_percentile, top_gaps, trend)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            rs_id, nurse_id, "30d", qa_score, approval_rate, denial_rate,
            overturn_rate, doc_score, policy_comp, consist_score,
            volume, percentile, gaps_json, trend
        ])
        count += 1
        
    print(f"Successfully generated and inserted {count} reviewer_stats records.")
    
if __name__ == "__main__":
    generate_stats_for_nurses()

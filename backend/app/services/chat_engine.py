"""
CareAudit AI - Smart Chat Engine
Uses DuckDB for real data retrieval and Groq LLM for natural language generation.
"""
import json
import re
from groq import Groq
import duckdb
from app.config import settings

def _get_groq_client():
    if not settings.GROQ_API_KEY:
        return None
    return Groq(api_key=settings.GROQ_API_KEY)

def classify_intent(message: str) -> str:
    msg = message.upper()
    # Check for specific case ID first
    if re.search(r'CASE-\d{4}-\d{3}', msg):
        return "specific_case_query"

    msg_lower = message.lower()

    # --- Priority intents (check BEFORE generic 'case_query') ---
    # Appeal/risk queries — must come before case_query since messages often contain 'case'
    if any(k in msg_lower for k in ["appeal", "overturn", "financial", "exposure", "dispute", "appeal risk", "risk"]):
        return "appeal_query"

    # Audit queries — must come before case_query
    if any(k in msg_lower for k in ["audit", "finding", "pass rate", "readiness", "compliance", "qa score", "fail"]):
        return "audit_query"

    # Policy queries
    if any(k in msg_lower for k in ["policy", "guideline", "criteria", "um-"]):
        return "policy_query"

    # Nurse performance deep-dive (specific nurse name)
    if any(k in msg_lower for k in ["nurse performance", "how is nurse", "how did nurse", "performance of", "stats for", "score for nurse", "review for nurse"]):
        return "nurse_performance_query"
    if re.search(r"(how is|show me|tell me about|performance of|stats for|score for)\s+[A-Z][a-z]+", message):
        return "nurse_performance_query"

    # Reviewer queries (team-level)
    if any(k in msg_lower for k in ["underperform", "worst", "bottom", "performer", "reviewer", "nurse", "average score", "gap", "coaching", "top reviewer"]):
        return "reviewer_query"

    # Case score breakdown
    if any(k in msg_lower for k in ["case score", "qa score for case", "audit score for case", "breakdown for case", "score of case"]):
        return "case_score_query"

    # Audit detail (element-level)
    if any(k in msg_lower for k in ["audit detail", "audit finding", "element score", "element-level", "score distribution", "common gap", "audit gap", "documentation gap"]):
        return "audit_detail_query"

    # Comparisons
    if any(k in msg_lower for k in ["compare", "comparison", "versus", " vs ", "side by side", "head to head", "rank nurse"]):
        return "comparison_query"

    # Trends
    if any(k in msg_lower for k in ["trend", "over time", "month over month", "monthly", "weekly", "improving", "declining", "trajectory", "historical"]):
        return "trend_query"

    # Generic case query (broadest — last resort before general)
    if any(k in msg_lower for k in ["case", "patient", "diagnosis", "admit", "decision", "flagged", "denied"]):
        return "case_query"

    # Agent identity
    if any(k in msg_lower for k in ["agent", "what do you do", "what are you", "how does", "pipeline", "how do you", "methodology", "how is score"]):
        return "agent_query"

    return "general"

def retrieve_data(intent: str, db: duckdb.DuckDBPyConnection, message: str = "") -> dict:
    data = {}
    try:
        if intent == "specific_case_query":
            match = re.search(r'CASE-\d{4}-\d{3}', message.upper())
            if match:
                case_no = match.group(0)
                # Fetch comprehensive case data
                case_row = db.execute("SELECT id, patient_name, primary_diagnosis_display, status, structured_case FROM cases WHERE case_number = ?", [case_no]).fetchone()
                if case_row:
                    case_id = case_row[0]
                    data["specific_case"] = {
                        "case_number": case_no,
                        "patient": case_row[1],
                        "diagnosis": case_row[2],
                        "status": case_row[3],
                        "clinical_summary": json.loads(case_row[4]).get("clinical_summary", "") if case_row[4] else ""
                    }
                    
                    # Fetch Decision
                    dec_row = db.execute("SELECT id, reviewer_id, decision, rationale, policy_cited FROM nurse_decisions WHERE case_id = ?", [case_id]).fetchone()
                    if dec_row:
                        dec_id = dec_row[0]
                        reviewer_row = db.execute("SELECT full_name FROM users WHERE id = ?", [dec_row[1]]).fetchone()
                        reviewer_name = reviewer_row[0] if reviewer_row else "Unknown Reviewer"
                        data["specific_case"]["decision"] = {
                            "reviewer": reviewer_name,
                            "determination": dec_row[2],
                            "rationale": dec_row[3],
                            "policy_cited": dec_row[4]
                        }
                        
                        # Fetch Audit Result
                        audit_row = db.execute("SELECT qa_score, audit_result, clinical_accuracy, documentation_completeness, policy_compliance, findings, missing_evidence FROM audit_results WHERE decision_id = ?", [dec_id]).fetchone()
                        if audit_row:
                            data["specific_case"]["audit"] = {
                                "qa_score": audit_row[0],
                                "result": audit_row[1],
                                "clinical_accuracy": audit_row[2],
                                "documentation_completeness": audit_row[3],
                                "policy_compliance": audit_row[4],
                                "findings": json.loads(audit_row[5]) if audit_row[5] else [],
                                "missing_evidence": json.loads(audit_row[6]) if audit_row[6] else []
                            }
                        
                        # Fetch Appeal
                        app_row = db.execute("SELECT risk_category, overturn_probability, financial_exposure_estimate, top_risk_factors FROM appeals WHERE decision_id = ?", [dec_id]).fetchone()
                        if app_row:
                            data["specific_case"]["appeal_risk"] = {
                                "risk_category": app_row[0],
                                "overturn_probability": app_row[1],
                                "financial_exposure": app_row[2],
                                "risk_factors": json.loads(app_row[3]) if app_row[3] else []
                            }
                else:
                    data["specific_case"] = {"error": f"Case {case_no} not found in database."}

        elif intent == "reviewer_query":
            res = db.execute("""
                SELECT u.full_name as name, 
                       ROUND(r.qa_score_avg, 1) as qa_score,
                       ROUND(r.approval_rate * 100, 1) as approval_rate_pct,
                       r.case_volume as volume,
                       r.trend,
                       r.top_gaps
                FROM reviewer_stats r JOIN users u ON r.reviewer_id = u.id
                ORDER BY r.qa_score_avg ASC LIMIT 5
            """).fetchall()
            reviewers = []
            for r in res:
                gaps = r[5]
                if isinstance(gaps, str):
                    try:
                        gaps = json.loads(gaps)
                    except:
                        gaps = [gaps]
                reviewers.append({
                    "name": r[0], 
                    "qa_score": r[1], 
                    "approval_rate": f"{r[2]}%",
                    "volume": r[3],
                    "trend": r[4],
                    "gaps": gaps or []
                })
            data["reviewers"] = reviewers
            
            # Team averages
            avg = db.execute("SELECT ROUND(AVG(qa_score_avg), 1), COUNT(*) FROM reviewer_stats").fetchone()
            data["team_avg_qa"] = avg[0]
            data["total_reviewers"] = avg[1]
            
        elif intent == "case_query":
            res = db.execute("""
                SELECT status, COUNT(*) FROM cases GROUP BY status
            """).fetchall()
            data["case_status_counts"] = {r[0]: r[1] for r in res}
            
            res = db.execute("""
                SELECT case_number, patient_name, primary_diagnosis_display, status 
                FROM cases ORDER BY submitted_at DESC LIMIT 5
            """).fetchall()
            data["recent_cases"] = [{"case": r[0], "patient": r[1], "diagnosis": r[2], "status": r[3]} for r in res]
            
        elif intent == "appeal_query":
            res = db.execute("""
                SELECT risk_category, COUNT(*) FROM appeals GROUP BY risk_category
            """).fetchall()
            data["appeal_risk_counts"] = {r[0]: r[1] for r in res}

            # Pull the individual highest-risk cases with details
            try:
                high_risk = db.execute("""
                    SELECT c.case_number, c.patient_name, c.primary_diagnosis_display,
                           a.risk_category, a.overturn_probability, a.financial_exposure_estimate,
                           nd.decision, u.full_name as reviewer
                    FROM appeals a
                    JOIN nurse_decisions nd ON a.decision_id = nd.id
                    JOIN cases c ON nd.case_id = c.id
                    JOIN users u ON nd.reviewer_id = u.id
                    ORDER BY a.overturn_probability DESC
                    LIMIT 8
                """).fetchall()
                data["high_risk_cases"] = [
                    {
                        "case": r[0], "patient": r[1], "diagnosis": r[2],
                        "risk": r[3], "overturn_prob": round(r[4] * 100, 1) if r[4] else 0,
                        "exposure": r[5], "decision": r[6], "reviewer": r[7]
                    } for r in high_risk
                ]
            except Exception as e:
                print(f"High risk cases query error: {e}")
                data["high_risk_cases"] = []

            try:
                res = db.execute("""
                    SELECT ROUND(SUM(financial_amount_disputed), 2) FROM appeal_intake_cases
                """).fetchone()
                data["total_disputed"] = res[0] if res and res[0] else 0

                res = db.execute("""
                    SELECT appeal_outcome, COUNT(*) FROM appeal_intake_cases GROUP BY appeal_outcome
                """).fetchall()
                data["appeal_outcomes"] = {r[0]: r[1] for r in res}

                res = db.execute("""
                    SELECT primary_diagnosis, COUNT(*) as cnt
                    FROM appeal_intake_cases
                    GROUP BY primary_diagnosis ORDER BY cnt DESC LIMIT 5
                """).fetchall()
                data["top_appeal_diagnoses"] = [{"diagnosis": r[0], "count": r[1]} for r in res]
            except:
                pass

            # Total exposure from appeals table
            try:
                exp = db.execute("SELECT ROUND(SUM(financial_exposure_estimate), 2), ROUND(AVG(overturn_probability), 3) FROM appeals").fetchone()
                data["total_exposure"] = exp[0] if exp and exp[0] else 0
                data["avg_overturn_prob"] = round((exp[1] or 0) * 100, 1)
            except:
                data["total_exposure"] = 0
                data["avg_overturn_prob"] = 0

        elif intent == "audit_query":
            res = db.execute("""
                SELECT ROUND(AVG(qa_score), 1) as avg_qa, 
                       ROUND(AVG(policy_compliance), 1) as avg_compliance,
                       ROUND(AVG(documentation_completeness), 1) as avg_doc,
                       COUNT(*) as total_audits,
                       SUM(CASE WHEN qa_score >= 80 THEN 1 ELSE 0 END) as passed,
                       SUM(CASE WHEN qa_score < 80 THEN 1 ELSE 0 END) as failed
                FROM audit_results
            """).fetchone()
            data["audit_stats"] = {
                "avg_qa_score": res[0],
                "avg_policy_compliance": res[1],
                "avg_documentation": res[2],
                "total_audits": res[3],
                "passed": res[4],
                "failed": res[5],
                "pass_rate": round((res[4] / res[3]) * 100, 1) if res[3] else 0
            }
            
        elif intent == "policy_query":
            data["policies"] = {
                "UM-CHF-001": "Congestive Heart Failure — Inpatient Admission Criteria",
                "UM-COPD-001": "Chronic Obstructive Pulmonary Disease — Acute Exacerbation",
                "UM-SEPSIS-001": "Sepsis — Emergency Admission & IV Antibiotic Criteria",
                "UM-OBS-IP-001": "Observation vs Inpatient Status Determination",
                "UM-GEN-001": "General Medical Necessity Review Guidelines"
            }
            
        elif intent == "agent_query":
            data["agent_info"] = {
                "name": "CareAudit AI",
                "role": "Enterprise Clinical Audit Intelligence Platform",
                "capabilities": [
                    "Auto-extraction of clinical data from uploaded documents (PDF, DOCX, CSV)",
                    "Policy matching engine (UM-CHF-001, etc.)",
                    "Automated QA scoring based on documentation completeness, policy compliance, and consistency",
                    "Appeal overturn risk prediction using historical data",
                    "Real-time reviewer performance analytics and coaching recommendations",
                    "Enterprise dashboards"
                ],
                "process_methodology": {
                    "QA_Scoring": "QA scores are calculated dynamically by evaluating the nurse's decision against the cited policy. 60% of the score is based on structured rules (e.g., were vital signs out of bounds?) and 40% is based on semantic text matching using the ClinicalBERT model, comparing the clinical summary to the policy guidelines.",
                    "ICD_10_Prediction": "Uses a BioBERT semantic embedding to match the clinical narrative against 80+ standardized ICD-10 diagnoses via cosine similarity, with an LLM fallback.",
                    "Appeals_Prediction": "Calculates risk exposure by identifying missing evidence in the clinical text, cross-referencing it with historical overturn rates for specific diagnoses and reviewers."
                },
                "data_source": "Live DuckDB database with cases, audits, appeals, reviewer stats, and historical PA records"
            }
            
        elif intent == "nurse_performance_query":
            # Extract a nurse name from the message (heuristic: capitalized words after keywords)
            name_match = re.search(
                r'(?:nurse|performance of|stats for|score for|how is|how did|show me|about)\s+'
                r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
                message
            )
            nurse_name = name_match.group(1).strip() if name_match else ""
            if nurse_name:
                # Match by partial name (first or full)
                rows = db.execute("""
                    SELECT u.id, u.full_name
                    FROM users u
                    WHERE LOWER(u.full_name) LIKE ?
                    LIMIT 5
                """, [f"%{nurse_name.lower()}%"]).fetchall()
                if rows:
                    nurse_id = rows[0][0]
                    nurse_full_name = rows[0][1]
                    data["nurse_name"] = nurse_full_name

                    # Case stats
                    case_stats = db.execute("""
                        SELECT COUNT(c.id) as total_cases,
                               SUM(CASE WHEN nd.decision = 'APPROVED' THEN 1 ELSE 0 END) as approved,
                               SUM(CASE WHEN nd.decision = 'DENIED' THEN 1 ELSE 0 END) as denied
                        FROM cases c
                        JOIN nurse_decisions nd ON nd.case_id = c.id
                        WHERE nd.reviewer_id = ?
                    """, [nurse_id]).fetchone()
                    data["case_stats"] = {
                        "total": case_stats[0] or 0,
                        "approved": case_stats[1] or 0,
                        "denied": case_stats[2] or 0,
                    }

                    # QA averages (overall + element-level)
                    qa_stats = db.execute("""
                        SELECT ROUND(AVG(ar.qa_score), 1) as avg_qa,
                               ROUND(AVG(ar.clinical_accuracy), 1) as avg_clinical_accuracy,
                               ROUND(AVG(ar.documentation_completeness), 1) as avg_doc_completeness,
                               ROUND(AVG(ar.policy_compliance), 1) as avg_policy_compliance,
                               ROUND(AVG(ar.consistency_score), 1) as avg_consistency,
                               ROUND(AVG(ar.timeliness_score), 1) as avg_timeliness,
                               SUM(CASE WHEN ar.qa_score >= 80 THEN 1 ELSE 0 END) as passed,
                               SUM(CASE WHEN ar.qa_score < 80 THEN 1 ELSE 0 END) as failed,
                               COUNT(*) as total_audits
                        FROM audit_results ar
                        JOIN nurse_decisions nd ON ar.decision_id = nd.id
                        WHERE nd.reviewer_id = ?
                    """, [nurse_id]).fetchone()
                    data["qa_stats"] = {
                        "avg_qa": qa_stats[0],
                        "avg_clinical_accuracy": qa_stats[1],
                        "avg_doc_completeness": qa_stats[2],
                        "avg_policy_compliance": qa_stats[3],
                        "avg_consistency": qa_stats[4],
                        "avg_timeliness": qa_stats[5],
                        "passed": qa_stats[6] or 0,
                        "failed": qa_stats[7] or 0,
                        "total_audits": qa_stats[8] or 0,
                    }

                    # Common findings
                    findings_rows = db.execute("""
                        SELECT ar.findings
                        FROM audit_results ar
                        JOIN nurse_decisions nd ON ar.decision_id = nd.id
                        WHERE nd.reviewer_id = ? AND ar.findings IS NOT NULL
                        LIMIT 20
                    """, [nurse_id]).fetchall()
                    all_findings = []
                    for fr in findings_rows:
                        try:
                            flist = json.loads(fr[0]) if isinstance(fr[0], str) else (fr[0] or [])
                            for f in flist:
                                desc = f.get("description", str(f)) if isinstance(f, dict) else str(f)
                                all_findings.append(desc)
                        except Exception:
                            pass
                    # Count most common
                    from collections import Counter
                    common = Counter(all_findings).most_common(5)
                    data["common_findings"] = [{'finding': c[0], 'count': c[1]} for c in common]
                else:
                    data["nurse_name"] = nurse_name
                    data["error"] = f"No nurse found matching '{nurse_name}'"
            else:
                data["error"] = "Could not identify a nurse name in the question."

        elif intent == "case_score_query":
            match = re.search(r'CASE-\d{4}-\d{3}', message.upper())
            if match:
                case_no = match.group(0)
                row = db.execute("""
                    SELECT c.id, c.case_number, c.patient_name, c.primary_diagnosis_display,
                           nd.decision, nd.rationale,
                           ar.qa_score, ar.audit_result, ar.risk_level,
                           ar.clinical_accuracy, ar.documentation_completeness,
                           ar.policy_compliance, ar.consistency_score, ar.timeliness_score,
                           ar.findings, ar.missing_evidence
                    FROM cases c
                    JOIN nurse_decisions nd ON nd.case_id = c.id
                    JOIN audit_results ar ON ar.decision_id = nd.id
                    WHERE c.case_number = ?
                """, [case_no]).fetchone()
                if row:
                    data["case_score"] = {
                        "case_number": row[1], "patient": row[2], "diagnosis": row[3],
                        "decision": row[4], "rationale": row[5],
                        "qa_score": row[6], "audit_result": row[7], "risk_level": row[8],
                        "clinical_accuracy": row[9], "documentation_completeness": row[10],
                        "policy_compliance": row[11], "consistency_score": row[12],
                        "timeliness_score": row[13],
                        "findings": json.loads(row[14]) if row[14] else [],
                        "missing_evidence": json.loads(row[15]) if row[15] else [],
                    }
                else:
                    data["case_score"] = {"error": f"No audit data found for {case_no}"}
            else:
                data["case_score"] = {"error": "Please provide a case number (e.g., CASE-2025-001)"}

        elif intent == "audit_detail_query":
            # Element score distributions
            dist = db.execute("""
                SELECT
                    ROUND(AVG(clinical_accuracy), 1) as avg_clin,
                    ROUND(AVG(documentation_completeness), 1) as avg_doc,
                    ROUND(AVG(policy_compliance), 1) as avg_pol,
                    ROUND(AVG(consistency_score), 1) as avg_cons,
                    ROUND(AVG(timeliness_score), 1) as avg_time,
                    ROUND(MIN(clinical_accuracy), 1) as min_clin,
                    ROUND(MAX(clinical_accuracy), 1) as max_clin,
                    ROUND(MIN(documentation_completeness), 1) as min_doc,
                    ROUND(MAX(documentation_completeness), 1) as max_doc,
                    COUNT(*) as total
                FROM audit_results
            """).fetchone()
            data["element_distributions"] = {
                "clinical_accuracy": {"avg": dist[0], "min": dist[5], "max": dist[6]},
                "documentation_completeness": {"avg": dist[1], "min": dist[7], "max": dist[8]},
                "policy_compliance": {"avg": dist[2]},
                "consistency_score": {"avg": dist[3]},
                "timeliness_score": {"avg": dist[4]},
                "total_audits": dist[9],
            }

            # Common gaps across all audits
            gap_rows = db.execute("""
                SELECT findings FROM audit_results
                WHERE findings IS NOT NULL
                LIMIT 50
            """).fetchall()
            all_gaps = []
            for gr in gap_rows:
                try:
                    flist = json.loads(gr[0]) if isinstance(gr[0], str) else (gr[0] or [])
                    for f in flist:
                        desc = f.get("description", str(f)) if isinstance(f, dict) else str(f)
                        all_gaps.append(desc)
                except Exception:
                    pass
            from collections import Counter
            data["common_gaps"] = [{'gap': g[0], 'count': g[1]} for g in Counter(all_gaps).most_common(10)]

        elif intent == "comparison_query":
            # Side-by-side nurse stats for all nurses with audit data
            comp_rows = db.execute("""
                SELECT u.full_name as nurse,
                       COUNT(ar.id) as audits,
                       ROUND(AVG(ar.qa_score), 1) as avg_qa,
                       ROUND(AVG(ar.clinical_accuracy), 1) as avg_clin,
                       ROUND(AVG(ar.documentation_completeness), 1) as avg_doc,
                       ROUND(AVG(ar.policy_compliance), 1) as avg_policy,
                       SUM(CASE WHEN ar.qa_score >= 80 THEN 1 ELSE 0 END) as passed,
                       SUM(CASE WHEN ar.qa_score < 80 THEN 1 ELSE 0 END) as failed
                FROM audit_results ar
                JOIN nurse_decisions nd ON ar.decision_id = nd.id
                JOIN users u ON nd.reviewer_id = u.id
                GROUP BY u.full_name
                ORDER BY avg_qa DESC
            """).fetchall()
            data["nurse_comparison"] = [
                {
                    "nurse": r[0], "audits": r[1], "avg_qa": r[2],
                    "avg_clinical_accuracy": r[3], "avg_documentation": r[4],
                    "avg_policy_compliance": r[5], "passed": r[6], "failed": r[7],
                    "pass_rate": round((r[6] / r[1]) * 100, 1) if r[1] else 0
                }
                for r in comp_rows
            ]

        elif intent == "trend_query":
            # Monthly aggregates of QA scores and pass rates
            trend_rows = db.execute("""
                SELECT
                    STRFTIME(nd.decision_timestamp, '%Y-%m') as month,
                    COUNT(ar.id) as audits,
                    ROUND(AVG(ar.qa_score), 1) as avg_qa,
                    SUM(CASE WHEN ar.qa_score >= 80 THEN 1 ELSE 0 END) as passed,
                    SUM(CASE WHEN ar.qa_score < 80 THEN 1 ELSE 0 END) as failed,
                    ROUND(AVG(ar.clinical_accuracy), 1) as avg_clin,
                    ROUND(AVG(ar.documentation_completeness), 1) as avg_doc
                FROM audit_results ar
                JOIN nurse_decisions nd ON ar.decision_id = nd.id
                WHERE nd.decision_timestamp IS NOT NULL
                GROUP BY STRFTIME(nd.decision_timestamp, '%Y-%m')
                ORDER BY month DESC
                LIMIT 12
            """).fetchall()
            data["monthly_trends"] = [
                {
                    "month": r[0], "audits": r[1], "avg_qa": r[2],
                    "passed": r[3], "failed": r[4],
                    "pass_rate": round((r[3] / r[1]) * 100, 1) if r[1] else 0,
                    "avg_clinical_accuracy": r[5], "avg_documentation": r[6]
                }
                for r in trend_rows
            ]

        else:
            # General — pull a summary
            cases_count = db.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
            audits_count = db.execute("SELECT COUNT(*) FROM audit_results").fetchone()[0]
            avg_qa = db.execute("SELECT ROUND(AVG(qa_score), 1) FROM audit_results").fetchone()[0] or 0
            data["summary"] = {
                "total_cases": cases_count,
                "total_audits": audits_count,
                "enterprise_avg_qa": avg_qa,
            }
    except Exception as e:
        print(f"Data retrieval error: {e}")
    return data

def format_fallback(intent: str, data: dict) -> str:
    """Format data as rich, natural-language analysis when LLM is unavailable."""
    if not data:
        return "I'm sorry, I couldn't retrieve that information right now. Please try rephrasing your question or check back in a moment."

    if intent == "specific_case_query":
        case = data.get("specific_case", {})
        if "error" in case:
            return case["error"]

        audit = case.get("audit", {})
        decision = case.get("decision", {})
        appeal = case.get("appeal_risk", {})

        lines = [f"Here's what I found for **{case.get('case_number')}**:\n"]
        lines.append(f"The patient **{case.get('patient')}** was diagnosed with **{case.get('diagnosis')}** (Status: {case.get('status')}).")

        if case.get("clinical_summary"):
            lines.append(f"\n**Clinical Summary:**\n{case['clinical_summary'][:300]}{'...' if len(case.get('clinical_summary', '')) > 300 else ''}")

        if decision:
            det = decision.get('determination', 'Unknown')
            lines.append(f"\n**Decision:** The case was **{det}** by **{decision.get('reviewer')}**, citing policy **{decision.get('policy_cited', 'N/A')}**.")

        if audit:
            qa = audit.get('qa_score', 0)
            quality = 'excellent' if qa >= 90 else 'good' if qa >= 80 else 'below standard' if qa >= 60 else 'poor'
            lines.append(f"\n**QA Audit Results:**\nThe overall QA score is **{qa}%** — this is considered **{quality}** performance.\n")
            lines.append(f"| Score Element | Score | Status |")
            lines.append(f"| --- | --- | --- |")
            for label, key in [("Clinical Accuracy", "clinical_accuracy"), ("Documentation", "documentation_completeness"), ("Policy Compliance", "policy_compliance")]:
                v = audit.get(key, 0)
                st = 'PASS' if v >= 80 else 'REVIEW' if v >= 60 else 'CRITICAL'
                lines.append(f"| {label} | {v}% | {st} |")

            findings = audit.get("findings", [])
            if findings:
                lines.append("\n**Key Findings:**")
                for f in findings:
                    if isinstance(f, dict):
                        sev_icon = '[CRITICAL]' if f.get('severity') == 'CRITICAL' else '[HIGH]' if f.get('severity') == 'HIGH' else '[INFO]'
                        lines.append(f"- {sev_icon} **{f.get('severity', 'INFO')}** — {f.get('description', '')}")
                        if f.get('recommendation'):
                            lines.append(f"  *Recommendation: {f['recommendation']}*")

        if appeal:
            lines.append(f"\n**Appeal Risk:** This case has a **{appeal.get('risk_category', 'Unknown')}** risk of appeal with a **{round((appeal.get('overturn_probability', 0)) * 100, 1)}%** overturn probability and **${appeal.get('financial_exposure', 0):,.0f}** financial exposure.")

        return "\n".join(lines)

    if intent == "reviewer_query":
        reviewers = data.get("reviewers", [])
        if not reviewers:
            return "No reviewer performance data found."

        avg = data.get("team_avg_qa", "N/A")
        lines = [f"Here's a breakdown of reviewer performance across the team (Team Average: **{avg}%**):\n"]
        lines.append("| Rank | Reviewer | QA Score | Approval Rate | Volume | Trend | Key Gaps |")
        lines.append("| --- | --- | --- | --- | --- | --- | --- |")
        for i, r in enumerate(reviewers, 1):
            gaps = ", ".join(r.get("gaps", [])[:2]) if r.get("gaps") else "None"
            trend_icon = '[UP]' if r.get('trend') == 'improving' else '[DOWN]' if r.get('trend') == 'declining' else '[--]'
            lines.append(f"| {i} | {r['name']} | {r['qa_score']}% | {r['approval_rate']} | {r['volume']} | {trend_icon} {r['trend']} | {gaps} |")

        worst = reviewers[0] if reviewers else None
        if worst and worst.get('qa_score', 100) < 80:
            lines.append(f"\n**[ACTION REQUIRED] Immediate Attention Needed:** {worst['name']} has the lowest QA score at **{worst['qa_score']}%**. Their main gaps are in {', '.join(worst.get('gaps', ['documentation']))}.")
        lines.append(f"\n**[INSIGHT] Recommendation:** Focus coaching efforts on reviewers scoring below the team average of {avg}%.")
        return "\n".join(lines)

    if intent == "case_query":
        counts = data.get("case_status_counts", {})
        total = sum(counts.values())
        lines = [f"Here's the current state of all **{total} cases** in the system:\n"]
        lines.append("| Status | Count | Percentage |")
        lines.append("| --- | --- | --- |")
        for status, count in counts.items():
            pct = round(count / total * 100, 1) if total else 0
            icon = '[DONE]' if status == 'DECIDED' else '[AUDIT]' if status == 'AUDITED' else '[PEND]'
            lines.append(f"| {icon} {status} | {count} | {pct}% |")

        recent = data.get("recent_cases", [])
        if recent:
            lines.append("\n**Most Recent Cases:**")
            for c in recent:
                st_icon = '[DONE]' if c['status'] == 'DECIDED' else '[AUDIT]' if c['status'] == 'AUDITED' else '[PEND]'
                lines.append(f"- {st_icon} **{c['case']}** — {c['patient']} ({c['diagnosis']})")

        pending = counts.get('PENDING_REVIEW', 0)
        if pending > 0:
            lines.append(f"\n**[ACTION REQUIRED]** There are **{pending} cases** pending review. These should be prioritized to maintain turnaround targets.")
        return "\n".join(lines)

    if intent == "appeal_query":
        risk_counts = data.get("appeal_risk_counts", {})
        high_risk_cases = data.get("high_risk_cases", [])
        total_exposure = data.get("total_exposure", 0)
        avg_overturn = data.get("avg_overturn_prob", 0)
        total_disputed = data.get("total_disputed", 0)

        total_appeals = sum(risk_counts.values()) if risk_counts else 0
        critical = risk_counts.get('CRITICAL', risk_counts.get('HIGH', 0))

        lines = [f"Here's a detailed analysis of appeal risk across your **{total_appeals} assessed cases**:\n"]

        # Risk distribution
        lines.append("**Risk Distribution:**\n")
        lines.append("| Risk Level | Cases | Proportion |")
        lines.append("| --- | --- | --- |")
        for risk, count in sorted(risk_counts.items(), key=lambda x: {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}.get(x[0], 4)):
            pct = round(count / total_appeals * 100, 1) if total_appeals else 0
            icon = '[!!]' if risk in ('CRITICAL', 'HIGH') else '[!]' if risk == 'MEDIUM' else '[OK]'
            lines.append(f"| {icon} {risk} | {count} | {pct}% |")

        # Financial summary
        if total_exposure or total_disputed:
            lines.append(f"\n**Financial Impact:**")
            if total_exposure:
                lines.append(f"- Total estimated financial exposure: **${total_exposure:,.0f}**")
            if total_disputed:
                lines.append(f"- Total amount currently disputed: **${total_disputed:,.2f}**")
            if avg_overturn:
                lines.append(f"- Average overturn probability: **{avg_overturn}%**")

        # Individual high-risk cases
        if high_risk_cases:
            lines.append("\n**Highest Risk Cases (most likely to be overturned):**\n")
            lines.append("| Case | Patient | Diagnosis | Decision | Overturn Risk | Exposure |")
            lines.append("| --- | --- | --- | --- | --- | --- |")
            for c in high_risk_cases[:6]:
                risk_icon = '[!!]' if c['overturn_prob'] >= 70 else '[!]' if c['overturn_prob'] >= 40 else '[OK]'
                lines.append(f"| {c['case']} | {c['patient']} | {c['diagnosis'][:30]} | {c['decision']} | {risk_icon} {c['overturn_prob']}% | ${c.get('exposure', 0):,.0f} |")

        # Outcomes
        outcomes = data.get("appeal_outcomes", {})
        if outcomes:
            lines.append("\n**Historical Appeal Outcomes:**")
            for outcome, count in outcomes.items():
                icon = '[UPHELD]' if outcome in ('Upheld', 'UPHELD') else '[OVERTURNED]' if outcome in ('Overturned', 'OVERTURNED') else '[PENDING]'
                lines.append(f"- {icon} {outcome}: **{count}** cases")

        # Actionable insight
        if critical > 0:
            lines.append(f"\n**[ACTION REQUIRED] Immediate Action:** There are **{critical} high/critical risk cases** that should be reviewed urgently to minimize appeal exposure. Focus on denied cases with strong clinical evidence supporting admission.")
        lines.append("\n**[INSIGHT] Recommendation:** Cases with >60% overturn probability should be flagged for Medical Director review before the appeal deadline.")

        return "\n".join(lines)

    if intent == "audit_query":
        stats = data.get("audit_stats", {})
        avg_qa = stats.get('avg_qa_score', 0)
        passed = stats.get('passed', 0)
        failed = stats.get('failed', 0)
        total = stats.get('total_audits', 0)
        pass_rate = stats.get('pass_rate', 0)

        quality = 'excellent' if avg_qa >= 90 else 'good' if avg_qa >= 80 else 'needs improvement' if avg_qa >= 70 else 'critical'

        lines = [f"Here's the enterprise-wide QA audit summary across **{total} completed audits**:\n"]
        lines.append(f"The overall quality level is **{quality}** with an average QA score of **{avg_qa}%**.\n")
        lines.append("| Metric | Score | Status |")
        lines.append("| --- | --- | --- |")
        lines.append(f"| Average QA Score | {avg_qa}% | {'PASS' if avg_qa >= 80 else 'REVIEW'} |")
        lines.append(f"| Pass Rate (≥80%) | {pass_rate}% | {'PASS' if pass_rate >= 80 else 'REVIEW'} |")
        lines.append(f"| Policy Compliance | {stats.get('avg_policy_compliance', 0)}% | {'PASS' if stats.get('avg_policy_compliance', 0) >= 80 else 'REVIEW'} |")
        lines.append(f"| Documentation | {stats.get('avg_documentation', 0)}% | {'PASS' if stats.get('avg_documentation', 0) >= 80 else 'REVIEW'} |")
        lines.append(f"| Passed / Failed | {passed} / {failed} | — |")

        if failed > 0:
            lines.append(f"\n**[ATTENTION]** {failed} out of {total} audits failed QA. These cases should be reviewed for potential retraining needs.")
        lines.append(f"\n**[INSIGHT] Recommendation:** {'Maintain current quality standards.' if avg_qa >= 85 else 'Focus on improving documentation completeness and policy compliance, which are the most common gap areas.'}")
        return "\n".join(lines)

    if intent == "agent_query":
        info = data.get("agent_info", {})
        caps = info.get("capabilities", [])
        lines = [f"I'm **{info.get('name', 'CareAudit AI')}**, {info.get('role', 'your AI-powered clinical audit assistant')}.\n"]
        lines.append("Here's what I can help you with:\n")
        for c in caps:
            lines.append(f"- {c}")
        lines.append(f"\nI pull real-time data from **{info.get('data_source', 'your enterprise database')}**, so everything I tell you is based on actual case data — not estimates.")
        return "\n".join(lines)

    if intent == "nurse_performance_query":
        if data.get("error"):
            return f"[WARNING] {data['error']}"
        name = data.get("nurse_name", "Unknown")
        cs = data.get("case_stats", {})
        qs = data.get("qa_stats", {})
        avg_qa = qs.get('avg_qa', 0)
        quality = 'excellent' if avg_qa and float(avg_qa) >= 90 else 'good' if avg_qa and float(avg_qa) >= 80 else 'needs coaching' if avg_qa and float(avg_qa) >= 70 else 'concerning'

        lines = [f"Here's the complete performance report for **{name}**:\n"]
        lines.append(f"Overall, {name}'s performance is **{quality}** with an average QA score of **{avg_qa}%**.\n")
        lines.append("| Metric | Score | Status |")
        lines.append("| --- | --- | --- |")
        for label, key, good_thresh in [
            ("Overall QA Score", "avg_qa", 80), ("Clinical Accuracy", "avg_clinical_accuracy", 80),
            ("Documentation", "avg_doc_completeness", 80), ("Policy Compliance", "avg_policy_compliance", 80),
            ("Consistency", "avg_consistency", 75), ("Timeliness", "avg_timeliness", 75)
        ]:
            v = qs.get(key, 'N/A')
            st = 'PASS' if v != 'N/A' and float(v) >= good_thresh else 'REVIEW' if v != 'N/A' and float(v) >= 60 else 'FAIL'
            lines.append(f"| {label} | {v}% | {st} |")

        lines.append(f"\n**Case Volume:** {cs.get('total', 0)} total ({cs.get('approved', 0)} approved, {cs.get('denied', 0)} denied)")
        lines.append(f"**Audit Results:** {qs.get('passed', 0)} passed, {qs.get('failed', 0)} failed")

        common = data.get("common_findings", [])
        if common:
            lines.append("\n**Areas for Improvement:**")
            for cf in common:
                lines.append(f"- {cf['finding']} (found {cf['count']} times)")

        if quality in ('excellent', 'good'):
            lines.append("\n**[INSIGHT] Recommendation:** Keep up the great work!")
        else:
            gap_topic = common[0]['finding'] if common else "documentation gaps"
            lines.append(f"\n**[INSIGHT] Recommendation:** Focus coaching on the areas above that show REVIEW status. Schedule a 1-on-1 review session to discuss {gap_topic}.")
        return "\n".join(lines)

    if intent == "case_score_query":
        cs = data.get("case_score", {})
        if cs.get("error"):
            return f"[WARNING] {cs['error']}"
        qa = cs.get('qa_score', 0)
        quality = 'excellent' if qa >= 90 else 'good' if qa >= 80 else 'below standard' if qa >= 60 else 'failed'

        lines = [f"Here's the detailed audit breakdown for **{cs.get('case_number')}**:\n"]
        lines.append(f"**Patient:** {cs.get('patient')} | **Diagnosis:** {cs.get('diagnosis')}")
        lines.append(f"**Decision:** {cs.get('decision')} | **Risk Level:** {cs.get('risk_level')}")
        lines.append(f"\nThe overall QA score is **{qa}%** — rated as **{quality}**.\n")
        lines.append("| Score Element | Score | Status |")
        lines.append("| --- | --- | --- |")
        for label, key in [("Overall QA", "qa_score"), ("Clinical Accuracy", "clinical_accuracy"), ("Documentation", "documentation_completeness"), ("Policy Compliance", "policy_compliance"), ("Consistency", "consistency_score"), ("Timeliness", "timeliness_score")]:
            v = cs.get(key, 0)
            st = 'PASS' if v >= 80 else 'REVIEW' if v >= 60 else 'FAIL'
            lines.append(f"| {label} | {v}% | {st} |")

        findings = cs.get("findings", [])
        if findings:
            lines.append("\n**Key Findings:**")
            for f in findings:
                if isinstance(f, dict):
                    sev_icon = '[CRITICAL]' if f.get('severity') == 'CRITICAL' else '[HIGH]' if f.get('severity') == 'HIGH' else '[INFO]'
                    lines.append(f"- {sev_icon} **{f.get('severity')}:** {f.get('description', '')}")
                    if f.get('recommendation'):
                        lines.append(f"  *→ {f['recommendation']}*")

        missing = cs.get("missing_evidence", [])
        if missing:
            lines.append("\n**Missing Evidence:**")
            for m in missing:
                lines.append(f"- [MISSING] {m}")
        return "\n".join(lines)

    if intent == "audit_detail_query":
        ed = data.get("element_distributions", {})
        total = ed.get('total_audits', 0)
        lines = [f"Here's the element-level audit analysis across all **{total} audits**:\n"]
        lines.append("| Element | Average | Min | Max | Status |")
        lines.append("| --- | --- | --- | --- | --- |")
        for label, key in [("Clinical Accuracy", "clinical_accuracy"), ("Documentation", "documentation_completeness"), ("Policy Compliance", "policy_compliance"), ("Consistency", "consistency_score"), ("Timeliness", "timeliness_score")]:
            d = ed.get(key, {})
            avg = d.get('avg', '-')
            mn = d.get('min', '-')
            mx = d.get('max', '-')
            st = 'PASS' if avg != '-' and float(avg) >= 80 else 'REVIEW' if avg != '-' and float(avg) >= 60 else 'FAIL'
            lines.append(f"| {label} | {avg}% | {mn}% | {mx}% | {st} |")

        gaps = data.get("common_gaps", [])
        if gaps:
            lines.append("\n**Most Common Audit Gaps:**")
            for i, g in enumerate(gaps[:5], 1):
                lines.append(f"- **#{i}** {g['gap']} (found {g['count']} times)")
            lines.append(f"\n**[INSIGHT] Recommendation:** The most frequent gap is *\"{gaps[0]['gap']}\"* — consider adding this to the training curriculum.")
        return "\n".join(lines)

    if intent == "comparison_query":
        comps = data.get("nurse_comparison", [])
        if not comps:
            return "No comparison data available."
        lines = [f"Here's a side-by-side comparison of **{len(comps)} reviewers** ranked by QA performance:\n"]
        lines.append("| Rank | Reviewer | Audits | Avg QA | Clin Acc | Doc | Policy | Pass Rate |")
        lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
        for i, c in enumerate(comps, 1):
            medal = '#1' if i == 1 else '#2' if i == 2 else '#3' if i == 3 else f'#{i}'
            lines.append(f"| {medal} | {c['nurse']} | {c['audits']} | {c['avg_qa']}% | {c['avg_clinical_accuracy']}% | {c['avg_documentation']}% | {c['avg_policy_compliance']}% | {c['pass_rate']}% |")

        if len(comps) >= 2:
            best, worst = comps[0], comps[-1]
            lines.append(f"\n**Top Performer:** {best['nurse']} leads with **{best['avg_qa']}%** QA score.")
            if worst['avg_qa'] < 80:
                lines.append(f"**Needs Coaching:** {worst['nurse']} is trailing at **{worst['avg_qa']}%** — consider targeted training.")
        return "\n".join(lines)

    if intent == "trend_query":
        trends = data.get("monthly_trends", [])
        if not trends:
            return "No trend data available yet. Trends are calculated once cases have been processed over multiple months."
        lines = [f"Here's the monthly QA performance trend for the last **{len(trends)} month(s)**:\n"]
        lines.append("| Month | Audits | Avg QA | Pass Rate | Clin Acc | Documentation |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        for t in trends:
            lines.append(f"| {t['month']} | {t['audits']} | {t['avg_qa']}% | {t['pass_rate']}% | {t['avg_clinical_accuracy']}% | {t['avg_documentation']}% |")

        if len(trends) >= 2:
            latest, prev = trends[0], trends[1]
            change = round(latest['avg_qa'] - prev['avg_qa'], 1)
            direction = 'improving [UP]' if change > 0 else 'declining [DOWN]' if change < 0 else 'stable [--]'
            lines.append(f"\n**Trend:** QA scores are **{direction}** ({'+' if change > 0 else ''}{change}% vs previous month).")
        return "\n".join(lines)

    # General fallback
    summary = data.get("summary", {})
    return f"""Here's a quick snapshot of your CareAudit system:

- **Total Cases:** {summary.get('total_cases', 0)}
- **Audits Completed:** {summary.get('total_audits', 0)}
- **Enterprise Avg QA Score:** {summary.get('enterprise_avg_qa', 0)}%

I can drill down into any of these areas — just ask! For example:
- **Case Details** — "Show me details for CASE-2026-013"
- **Nurse Performance** — "How is Jessica Harris performing?"
- **Audit Results** — "Show me all FAIL audit results"
- **Appeal Risk** — "Which cases have the highest appeal risk?"
- **Trends** — "How have QA scores trended this quarter?"
"""

def _get_semantic_context(message: str, db: duckdb.DuckDBPyConnection) -> str:
    """
    Use ClinicalBERT to find the most semantically relevant case summaries
    for the user's query. Returns a formatted context string for the LLM.
    """
    try:
        from app.services.medical_nlp import get_medical_nlp
        nlp = get_medical_nlp()

        # Fetch recent case summaries (up to 20 for semantic ranking)
        rows = db.execute("""
            SELECT case_number, patient_name, primary_diagnosis_display, structured_case
            FROM cases ORDER BY submitted_at DESC LIMIT 20
        """).fetchall()

        if not rows:
            return ""

        import json
        docs = []
        meta = []
        for row in rows:
            sc = row[3]
            summary = ""
            if sc:
                try:
                    sc_dict = json.loads(sc) if isinstance(sc, str) else sc
                    summary = sc_dict.get("clinical_summary", "") or ""
                except Exception:
                    pass
            doc_text = f"{row[0]} | {row[1]} | {row[2]}. {summary}"
            docs.append(doc_text)
            meta.append({"case": row[0], "patient": row[1], "diagnosis": row[2]})

        results = nlp.semantic_search(message, docs, top_k=3)
        if not results:
            return ""

        lines = ["\n\n[ClinicalBERT Semantic Context — Most Relevant Cases:]"]
        for idx, score, doc in results:
            if score > 0.25:  # Only include if reasonably similar
                lines.append(f"- {meta[idx]['case']}: {meta[idx]['patient']} | {meta[idx]['diagnosis']} (relevance: {score:.2f})")

        return "\n".join(lines) if len(lines) > 1 else ""
    except Exception as e:
        print(f"[Chat] ClinicalBERT context retrieval error: {e}")
        return ""


def generate_chat_response(message: str, db: duckdb.DuckDBPyConnection) -> dict:
    """End-to-end chat generation process with ClinicalBERT semantic augmentation."""
    intent = classify_intent(message)
    data = retrieve_data(intent, db, message)

    # ClinicalBERT semantic context (non-blocking — fails gracefully)
    semantic_context = _get_semantic_context(message, db)

    client = _get_groq_client()
    if not client:
        # Fallback if no API key
        return {
            "content": format_fallback(intent, data),
            "structured_data": {"intent": intent}
        }

    try:
        system_prompt = f"""You are CareAudit AI, an advanced enterprise clinical quality assurance and audit assistant.
You answer questions using ONLY the real data provided below. NEVER hallucinate or invent numbers.

Rules:
1. Respond in clean, professional markdown
2. Use **bold** for important numbers and names
3. Present data in a structured, easy-to-read format
4. If the data shows reviewer performance, rank them and include actionable coaching recommendations
5. If the data is empty or the question cannot be answered from the context, say so clearly
6. Round all numbers to 1 decimal place
7. Do NOT show raw JSON or Python dict syntax — format everything for human readability
8. Be concise but thorough
9. Use markdown tables (| Column | ... |) for structured/comparative data — never bullet lists for tabular information
10. Provide actionable insights after presenting data, not just numbers — e.g., "Sarah's documentation score is 15 points below the team average, suggesting a coaching focus area"
11. Use natural language explanations — e.g., "Sarah reviewed 12 cases this month with an average QA score of 82.3%" instead of just listing stats
12. Reference specific case numbers, nurse names, and scores when available in the data
13. When comparing nurses, highlight the top performer, bottom performer, and the biggest gap area
14. When showing trends, call out significant changes (>5% swing) and whether the trajectory is improving or declining

Retrieved Enterprise Data (Intent: {intent}):
{json.dumps(data, indent=2, default=str)}
{semantic_context}

IMPORTANT: If the user is asking about a specific case (and `specific_case` data is provided), directly explain why the QA score is what it is. Reference the exact `findings`, `missing_evidence`, and scores for clinical accuracy and documentation. Provide a deep, case-level analysis. If they ask how the AI agents work, use the `agent_info.process_methodology` data to give a detailed technical answer.
For nurse_performance_query: Present a comprehensive performance profile. Highlight strengths and weaknesses across all score elements. Recommend specific coaching actions based on the lowest-scoring elements.
For comparison_query: Present a side-by-side table. Identify the top and bottom performers. Call out the element with the widest variance across nurses.
For trend_query: Identify whether the organization is improving or declining. Highlight any month with a significant change. Project whether the current trajectory meets quality targets.
"""
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            temperature=0.3,
            max_tokens=800
        )
        content = response.choices[0].message.content
        return {
            "content": content,
            "structured_data": {"intent": intent}
        }
    except Exception as e:
        print(f"Groq API error: {e}")
        return {
            "content": format_fallback(intent, data),
            "structured_data": {"intent": intent}
        }


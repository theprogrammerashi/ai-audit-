"""
CareAudit AI - DuckDB Database Layer
Provides connection management and schema initialization for DuckDB.
"""
import sqlite3
import os
from pathlib import Path
from app.config import settings


# Ensure data directory exists
_db_path = Path(settings.SQLITE_PATH)
_db_path.parent.mkdir(parents=True, exist_ok=True)

# Singleton connection — DuckDB on Windows does NOT allow multiple
# concurrent sqlite3.connect() calls to the same file (even from the
# same process).  We therefore keep exactly ONE connection open for
# the entire lifetime of the application.
class DuckDBCompatConnection:
    def __init__(self, sqlite_conn):
        self.conn = sqlite_conn
        self.description = None
        self.rowcount = -1
        
    def execute(self, query, params=()):
        cursor = self.conn.execute(query, params)
        self.description = cursor.description
        self.rowcount = cursor.rowcount
        self.conn.commit() # Auto-commit for DML
        return cursor
        
    def sql(self, query):
        return self.execute(query)
        
    def close(self):
        self.conn.close()
        
    def __getattr__(self, name):
        return getattr(self.conn, name)

_conn: DuckDBCompatConnection | None = None


def get_connection() -> DuckDBCompatConnection:
    """Return the singleton SQLite connection, creating it on first call."""
    global _conn
    if _conn is None:
        raw_conn = sqlite3.connect(str(_db_path), check_same_thread=False)
        _conn = DuckDBCompatConnection(raw_conn)
    return _conn


def get_db():
    """FastAPI dependency — yields the singleton connection (never closes it)."""
    yield get_connection()


def close_connection():
    """Explicitly close the singleton connection (call on app shutdown only)."""
    global _conn
    if _conn is not None:
        try:
            _conn.close()
        except Exception:
            pass
        _conn = None


def init_database():
    """Initialize database schema — creates all tables if they don't exist."""
    conn = get_connection()
    # SQLite doesn't need INSTALL JSON
    
    # ── Users & Auth ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR PRIMARY KEY,
            email VARCHAR UNIQUE NOT NULL,
            hashed_password VARCHAR NOT NULL,
            full_name VARCHAR NOT NULL,
            role VARCHAR NOT NULL,
            npi VARCHAR,
            qa_lead_id VARCHAR REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # ── Documents ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id VARCHAR PRIMARY KEY,
            case_id VARCHAR REFERENCES cases(id),
            filename VARCHAR NOT NULL,
            file_path VARCHAR NOT NULL,
            file_type VARCHAR,
            content_text TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # ── Policies ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS policies (
            id VARCHAR PRIMARY KEY,
            policy_code VARCHAR UNIQUE NOT NULL,
            policy_name VARCHAR NOT NULL,
            file_path VARCHAR,
            description TEXT,
            embedded_at TIMESTAMP
        )
    """)
    
    # ── Policy Matches ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS policy_matches (
            id VARCHAR PRIMARY KEY,
            case_id VARCHAR REFERENCES cases(id),
            applicable_policy VARCHAR NOT NULL,
            policy_name VARCHAR,
            matched_criteria JSON,
            unmet_criteria JSON,
            recommendation VARCHAR NOT NULL,
            overall_confidence FLOAT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # ── Nurse Decisions ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS nurse_decisions (
            id VARCHAR PRIMARY KEY,
            case_id VARCHAR REFERENCES cases(id),
            reviewer_id VARCHAR REFERENCES users(id),
            decision VARCHAR NOT NULL,
            rationale TEXT NOT NULL,
            policy_cited VARCHAR,
            criteria_acknowledged VARCHAR,
            decision_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # ── QA Audit Results ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_results (
            id VARCHAR PRIMARY KEY,
            case_id VARCHAR REFERENCES cases(id),
            decision_id VARCHAR REFERENCES nurse_decisions(id),
            qa_score INTEGER NOT NULL,
            risk_level VARCHAR NOT NULL,
            audit_result VARCHAR NOT NULL,
            clinical_accuracy INTEGER,
            documentation_completeness INTEGER,
            policy_compliance INTEGER,
            consistency_score INTEGER,
            timeliness_score INTEGER,
            timeliness_explanation TEXT,
            findings JSON,
            policy_alignment VARCHAR,
            missing_evidence JSON,
            qa_ai_explanation TEXT,
            original_ai_score INTEGER,
            qa_override_score INTEGER,
            qa_override_notes TEXT,
            qa_override_by VARCHAR,
            qa_override_at TIMESTAMP,
            qa_verification_notes TEXT,
            audited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # ── Migrations for existing DB ──
                                    # ── QA Verification Gating ──
                # ── Appeals ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS appeals (
            id VARCHAR PRIMARY KEY,
            case_id VARCHAR REFERENCES cases(id),
            decision_id VARCHAR REFERENCES nurse_decisions(id),
            overturn_probability FLOAT,
            risk_category VARCHAR,
            financial_exposure_estimate FLOAT,
            top_risk_factors JSON,
            recommendation TEXT,
            model_confidence FLOAT,
            outcome VARCHAR,
            outcome_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # ── Appeal Intake Data ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS appeal_intake_cases (
            id VARCHAR PRIMARY KEY,
            case_id VARCHAR UNIQUE,
            member_id VARCHAR,
            appellant_type VARCHAR,
            original_denial_date DATE,
            appeal_received_date DATE,
            appeal_level VARCHAR,
            denial_reason_category VARCHAR,
            clinical_rationale_provided TEXT,
            requested_service VARCHAR,
            diagnosis_category VARCHAR,
            financial_amount_disputed FLOAT,
            reviewer_assigned VARCHAR,
            appeal_outcome VARCHAR,
            resolution_date DATE,
            turnaround_days INTEGER,
            key_evidence_cited TEXT,
            policy_referenced VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # ── Reviewer Stats ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS reviewer_stats (
            id VARCHAR PRIMARY KEY,
            reviewer_id VARCHAR REFERENCES users(id),
            period VARCHAR NOT NULL,
            qa_score_avg FLOAT,
            approval_rate FLOAT,
            denial_rate FLOAT,
            overturn_rate FLOAT,
            documentation_score FLOAT,
            policy_compliance FLOAT,
            consistency_score FLOAT,
            case_volume INTEGER,
            peer_percentile INTEGER,
            top_gaps JSON,
            trend VARCHAR,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # ── Training Modules ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS training_modules (
            id VARCHAR PRIMARY KEY,
            reviewer_id VARCHAR REFERENCES users(id),
            module_id VARCHAR UNIQUE NOT NULL,
            topic VARCHAR NOT NULL,
            trigger_reason TEXT,
            estimated_duration_minutes INTEGER,
            sections JSON,
            status VARCHAR DEFAULT 'ASSIGNED',
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    """)
    
    # ── Chat Conversations ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR REFERENCES users(id),
            title VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # ── Chat Messages ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id VARCHAR PRIMARY KEY,
            conversation_id VARCHAR REFERENCES conversations(id),
            role VARCHAR NOT NULL,
            content TEXT NOT NULL,
            structured_data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # ── HIPAA Audit Log (append-only) ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR,
            action VARCHAR NOT NULL,
            resource_type VARCHAR NOT NULL,
            resource_id VARCHAR,
            ip_address VARCHAR,
            user_agent VARCHAR,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata JSON
        )
    """)
    # ── Peer Reviews ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS peer_reviews (
            id VARCHAR PRIMARY KEY,
            case_id VARCHAR REFERENCES cases(id),
            audit_id VARCHAR,
            requested_by VARCHAR REFERENCES users(id),
            assigned_to VARCHAR REFERENCES users(id),
            message TEXT,
            status VARCHAR DEFAULT 'PENDING',
            findings TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    """)

    # ── Audit Overrides ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_overrides (
            id VARCHAR PRIMARY KEY,
            audit_id VARCHAR,
            case_id VARCHAR,
            overridden_by VARCHAR REFERENCES users(id),
            finding_index INTEGER,
            original_finding TEXT,
            override_rationale TEXT,
            status VARCHAR DEFAULT 'PENDING',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── Training Assessments ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS training_assessments (
            id VARCHAR PRIMARY KEY,
            module_id VARCHAR,
            reviewer_id VARCHAR REFERENCES users(id),
            score INTEGER,
            total_questions INTEGER,
            correct_answers INTEGER,
            answers JSON,
            time_taken_seconds INTEGER,
            passed BOOLEAN,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── Historical PA Data ──
    conn.execute("""
        CREATE TABLE IF NOT EXISTS historical_pa (
            case_id VARCHAR PRIMARY KEY,
            member_id VARCHAR,
            provider_id VARCHAR,
            provider_name VARCHAR,
            facility_name VARCHAR,
            line_of_business VARCHAR,
            region VARCHAR,
            state VARCHAR,
            product_type VARCHAR,
            member_age INTEGER,
            member_gender VARCHAR,
            primary_diagnosis VARCHAR,
            diagnosis_category VARCHAR,
            procedure_requested VARCHAR,
            procedure_category VARCHAR,
            level_of_care VARCHAR,
            request_received_date DATE,
            review_start_date TIMESTAMP,
            review_completion_date TIMESTAMP,
            turnaround_hours FLOAT,
            urgency VARCHAR,
            reviewer_id VARCHAR,
            reviewer_name VARCHAR,
            reviewer_type VARCHAR,
            pages_received INTEGER,
            number_of_uploaded_documents INTEGER,
            clinical_completeness_score INTEGER,
            policy_id VARCHAR,
            policy_name VARCHAR,
            policy_version VARCHAR,
            determination VARCHAR,
            decision_rationale_category VARCHAR,
            appeal_filed VARCHAR,
            appeal_received_date VARCHAR,
            appeal_level VARCHAR,
            appeal_outcome VARCHAR,
            requested_cost FLOAT,
            approved_cost FLOAT,
            estimated_savings FLOAT,
            first_pass_review VARCHAR,
            peer_review_required VARCHAR,
            peer_review_completed VARCHAR,
            sla_target_hours INTEGER,
            sla_met VARCHAR,
            review_duration_minutes INTEGER,
            number_of_policy_checks INTEGER,
            number_of_clinical_criteria_matched INTEGER
        )
    """)

    # ── Migrations for existing databases ──
    try:
        conn.execute("ALTER TABLE audit_results ADD COLUMN qa_verification_notes TEXT")
    except Exception:
        pass

    print("[OK] DuckDB schema initialized successfully")


if __name__ == "__main__":
    init_database()
    close_connection()

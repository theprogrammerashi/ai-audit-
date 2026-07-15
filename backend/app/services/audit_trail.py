"""
CareAudit AI - Audit Trail Service
HIPAA-compliant immutable audit logging.
"""
import uuid
import json
from datetime import datetime
from app.database import get_connection


def log_audit_event(
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str = None,
    ip_address: str = None,
    user_agent: str = None,
    metadata: dict = None
):
    """Log an audit event to the immutable HIPAA audit trail."""
    conn = get_connection()
    conn.execute("""
        INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        str(uuid.uuid4()), user_id, action, resource_type,
        resource_id, ip_address, user_agent,
        json.dumps(metadata) if metadata else None
    ])

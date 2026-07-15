"""
CareAudit AI - Middleware
CORS configuration, request logging, and HIPAA audit logging.
"""
import uuid
import time
import json
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.database import get_connection


class AuditLogMiddleware(BaseHTTPMiddleware):
    """Logs all API requests for HIPAA compliance."""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log to audit trail (skip health checks and static files)
        path = request.url.path
        if not path.startswith(("/docs", "/openapi", "/health", "/_next", "/static")):
            try:
                conn = get_connection()
                conn.execute("""
                    INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, [
                    str(uuid.uuid4()),
                    None,  # Will be populated by auth middleware
                    request.method,
                    path.split("/")[3] if len(path.split("/")) > 3 else "root",
                    None,
                    request.client.host if request.client else "unknown",
                    request.headers.get("user-agent", ""),
                    json.dumps({"duration_ms": round(duration * 1000, 2), "status_code": response.status_code})
                ])
            except Exception:
                pass  # Don't fail requests due to logging errors
        
        return response

"""
CareAudit AI - FastAPI Application Entrypoint
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_database, close_connection
from app.core.middleware import AuditLogMiddleware
from app.api.v1 import (
    auth, cases, audit, policy, nurse_workspace,
    qa_scores, appeal, analytics, training,
    executive, conversational, websocket, agent_pipeline, stats
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup, close on shutdown."""
    print(f"[START] Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    init_database()
    yield
    print("[STOP] Shutting down CareAudit AI")
    close_connection()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered Clinical Audit & Quality Assurance Platform",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HIPAA Audit Logging
app.add_middleware(AuditLogMiddleware)

# API Routes
app.include_router(auth.router, prefix="/api/v1")
app.include_router(cases.router, prefix="/api/v1")
app.include_router(nurse_workspace.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(policy.router, prefix="/api/v1")
app.include_router(qa_scores.router, prefix="/api/v1")
app.include_router(appeal.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(training.router, prefix="/api/v1")
app.include_router(executive.router, prefix="/api/v1")
app.include_router(conversational.router, prefix="/api/v1")
app.include_router(agent_pipeline.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")

# WebSocket Routes (no prefix)
app.include_router(websocket.router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "tagline": "CareAudit Intelligence",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }

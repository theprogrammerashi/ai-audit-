# CareAudit AI

**CareAudit Intelligence** — AI-powered Clinical Audit & Quality Assurance Platform

> AI prepares → Human decides → AI audits → Organization learns

## Tech Stack

- **Backend**: FastAPI (Python 3.11+) + LangGraph multi-agent orchestration
- **LLM**: Groq API (llama-3.3-70b-versatile)
- **Database**: DuckDB (local, zero-config)
- **Vector DB**: ChromaDB (policy RAG)
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **Charts**: Recharts | **Workflow Viz**: React Flow | **Animations**: Framer Motion

## Quick Start

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
python -m app.database  # Initialize DuckDB schema
python ../scripts/seed_database.py  # Seed demo data
python ../scripts/ingest_policies.py  # Embed policies into ChromaDB
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev  # http://localhost:3000
```

### 3. Docker (optional)
```bash
docker-compose up -d
```

## Modules

1. **Clinical Case Intake** — Document parsing → structured case objects
2. **Policy Intelligence (RAG)** — Policy retrieval + criteria matching
3. **Nurse Review Workspace** — 3-panel clinical review interface
4. **AI QA Audit Engine** — Post-decision quality audit scoring
5. **Appeal Risk Intelligence** — ML-based appeal overturn prediction
6. **Reviewer Performance Analytics** — Individual + team metrics
7. **Training & Coaching** — AI-generated personalized learning
8. **Executive Command Center** — C-suite KPI dashboard
9. **Multi-Agent Orchestration** — LangGraph state machine (6 agents)
10. **Conversational Governance** — Natural language Q&A interface

## Demo Users

| Name | Role | Email | Password |
|------|------|-------|----------|
| Admin User | ADMIN | admin@careaudit.ai | admin123 |
| Sarah Collins | NURSE | sarah.collins@careaudit.ai | nurse123 |
| Marcus Webb | NURSE | marcus.webb@careaudit.ai | nurse123 |
| Priya Sharma | NURSE | priya.sharma@careaudit.ai | nurse123 |
| David Chen | NURSE | david.chen@careaudit.ai | nurse123 |
| James Wilson | EXECUTIVE | james.wilson@careaudit.ai | exec123 |

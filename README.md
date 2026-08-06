# CareAudit AI

CareAudit AI is an end-to-end operational workflow tool designed to automate and augment the clinical audit process, prior authorization intake, and appeal risk prediction. Utilizing a powerful 6-agent AI pipeline and pre-trained medical NLP models, this tool ensures 100% adherence to complex medical policies and significantly reduces turnaround times.

## 🚀 Quick Start Guide

Welcome! If you've just cloned this repository, follow these exact steps to get the full application (Frontend + Backend + Seeded Database) running locally on your machine.

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **Git**

---

### Step 1: Clone the Repository

Clone the project to your local machine:
```bash
git clone <your-repo-url>
cd careaudit-ai
```

---

### Step 2: Backend Setup (Python & DuckDB)

The backend is built with FastAPI and uses an in-memory/file-based DuckDB database. We have included a pre-seeded database (`data/careaudit.duckdb`) so you don't need to run the seeding scripts unless you want to start fresh.

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a Python Virtual Environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate the Virtual Environment:**
   - **Windows:**
     ```cmd
     venv\Scripts\activate
     ```
   - **Mac/Linux:**
     ```bash
     source venv/bin/activate
     ```

4. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Start the Backend Server:**
   ```bash
   # Make sure you are in the careaudit-ai/backend folder
   # Setting UTF-8 encoding is recommended for Windows
   set PYTHONIOENCODING=utf-8
   python -m uvicorn app.main:app --port 8000 --reload
   ```
   *The backend will now be running at `http://127.0.0.1:8000`.*

---

### Step 3: Frontend Setup (Next.js & React)

The frontend is a modern, responsive dashboard built with Next.js and Tailwind CSS.

1. **Open a NEW terminal window** (leave the backend running) and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. **Install Node Modules:**
   ```bash
   npm install
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   *Note: If you are on Windows and experience issues with `npm run dev` crashing due to spaces in your folder path, you can run the Next.js binary directly:*
   ```bash
   node node_modules/next/dist/bin/next dev
   ```

4. **Access the Application:**
   Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

---

### 🗄️ Database Reset & Seeding (Optional)

If you ever need to reset the data and start from a clean slate, you can run the full seeder script.
*Warning: This will delete all current data in the DuckDB file.*

```bash
# Ensure the backend server is stopped first to release file locks!
cd backend
python scripts/seed_full.py
```
This will regenerate 30 cases, 1000 historical PA records, and fully re-populate the executive dashboards.

---

### 🛡️ Core Technologies & Architecture
- **Frontend:** Next.js, React, Tailwind CSS
- **Backend:** FastAPI, Python, LangGraph
- **Database:** DuckDB (In-Memory Analytics), SQLAlchemy
- **Security:** End-to-End Encryption, RBAC (Role-Based Access Control)
- **AI Core:** 6-Agent Pipeline (Intake, Policy, QA, Reviewer Assistant, Appeal Risk, Executive/Training).

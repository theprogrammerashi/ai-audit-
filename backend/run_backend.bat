@echo off
set PYTHONIOENCODING=utf-8
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 8000

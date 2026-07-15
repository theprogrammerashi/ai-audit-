@echo off
set PYTHONIOENCODING=utf-8
"C:\Users\HP\AppData\Local\Programs\Python\Python311\python.exe" -m pip install -r requirements.txt
"C:\Users\HP\AppData\Local\Programs\Python\Python311\python.exe" -m uvicorn app.main:app --port 8000

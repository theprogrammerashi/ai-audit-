import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from backend.app.database import get_connection
import json

c = get_connection()
r = c.execute("SELECT structured_case FROM cases WHERE case_number='CASE-EXC-2026-0128'").fetchone()
if r and r[0]:
    try:
        print(json.dumps(json.loads(r[0]), indent=2))
    except Exception as e:
        print("Not valid JSON:", r[0][:100], str(e))
else:
    print('NA')

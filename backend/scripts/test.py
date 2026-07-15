import requests
import jwt
from datetime import datetime, timedelta, timezone

token = jwt.encode({
    "sub": "priya.sharma@careaudit.ai", 
    "role": "QA_LEAD", 
    "exp": datetime.now(timezone.utc) + timedelta(hours=1)
}, "careaudit_super_secret_key_2024", algorithm="HS256")

headers = {"Authorization": f"Bearer {token}"}
res = requests.get('http://127.0.0.1:8000/api/v1/workspace/qa-overview', headers=headers)
print(f"Status Code: {res.status_code}")
print(f"Response: {res.text[:500]}")

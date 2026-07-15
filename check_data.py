import urllib.request, json

# Login
login_data = json.dumps({"email":"priya.sharma@careaudit.ai","password":"password123"}).encode()
req = urllib.request.Request("http://localhost:8000/api/v1/auth/login", data=login_data, headers={"Content-Type":"application/json"}, method="POST")
try:
    resp = json.loads(urllib.request.urlopen(req).read())
    token = resp["access_token"]
    print(f"Login OK, token starts: {token[:20]}...")
except Exception as e:
    print(f"Login failed: {e}")
    # Try reading error body
    import traceback
    traceback.print_exc()
    exit()

# Get team analytics
req2 = urllib.request.Request("http://localhost:8000/api/v1/analytics/team", headers={"Authorization": f"Bearer {token}"})
try:
    team = json.loads(urllib.request.urlopen(req2).read())
    print(f"Total reviewers: {len(team.get('reviewers',[]))}")
    for r in team.get("reviewers", [])[:3]:
        print(f"  {r['name']}: qa={r.get('qa_score_30d')}, doc={r.get('documentation_score')}, pol={r.get('policy_compliance')}, con={r.get('consistency_score')}")

    # Get detail for first reviewer
    if team.get("reviewers"):
        rid = team["reviewers"][0]["reviewer_id"]
        req3 = urllib.request.Request(f"http://localhost:8000/api/v1/analytics/reviewer/{rid}/detail", headers={"Authorization": f"Bearer {token}"})
        detail = json.loads(urllib.request.urlopen(req3).read())
        print(f"\nDetail for {detail['reviewer']['full_name']}:")
        print(f"  ai_summary: {detail.get('ai_summary')}")
        print(f"  stats keys: {list(detail.get('stats',{}).keys())}")
        stats = detail.get('stats', {})
        print(f"  qa_score_avg: {stats.get('qa_score_avg')}")
        print(f"  documentation_score: {stats.get('documentation_score')}")
        print(f"  policy_compliance: {stats.get('policy_compliance')}")
        print(f"  consistency_score: {stats.get('consistency_score')}")
        print(f"  top_gaps: {stats.get('top_gaps')}")
        print(f"  recent_cases count: {len(detail.get('recent_cases',[]))}")
except Exception as e:
    print(f"Team analytics failed: {e}")
    import traceback
    traceback.print_exc()

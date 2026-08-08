import os
import re

api_dir = r'e:\UAM\ai-audit-V2\backend\app\api\v1'
files = [os.path.join(api_dir, f) for f in os.listdir(api_dir) if f.endswith('.py')]
files.append(r'e:\UAM\ai-audit-V2\backend\app\api\deps.py')
files.append(r'e:\UAM\ai-audit-V2\backend\app\services\policy_engine.py')

for path in files:
    if not os.path.exists(path): continue
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Casts
    content = re.sub(r'(\w+\.\w+)::TIMESTAMP', r'\1', content)
    content = re.sub(r'(\w+)::TIMESTAMP', r'\1', content)
    
    # Date Diff
    content = re.sub(r'date_diff\(\'second\',\s*([^,]+),\s*([^\)]+)\)', r'((julianday(\2) - julianday(\1)) * 86400)', content)
    
    # INTERVAL
    content = re.sub(r"CURRENT_DATE\s*-\s*INTERVAL\s*'(\d+)\s*days'", r"date('now', '-\1 days')", content)
    content = re.sub(r"CURRENT_DATE\s*-\s*INTERVAL\s*'(\d+)\s*months'", r"date('now', '-\1 months')", content)
    
    # date_trunc
    content = re.sub(r"date_trunc\('month',\s*([^\)]+)\)", r"strftime('%Y-%m-01', \1)", content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print('SQL dialect fixed.')

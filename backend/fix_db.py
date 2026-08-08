import re

path = r'e:\UAM\ai-audit-V2\backend\app\database.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the broken try/except blocks we added
content = re.sub(r'    try:\n        conn\.execute\(\"ALTER TABLE.*?except Exception:\n        pass\n', '', content, flags=re.DOTALL)
# Remove any remaining ALTER TABLE lines
content = re.sub(r'.*conn\.execute\(\"ALTER TABLE.*?\n', '', content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

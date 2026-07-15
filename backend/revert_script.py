import json
import os

log_path = r'C:\Users\HP\.gemini\antigravity\brain\63ce00b0-85fe-4aa8-a66e-ffab813aa100\.system_generated\logs\transcript.jsonl'
chat_page = ''
bot_page = ''
layout_page = ''

for line in open(log_path, 'r', encoding='utf-8'):
    if '"type":"TOOL_RESPONSE"' in line and 'view_file' in line:
        data = json.loads(line)
        if 'output' in data.get('content', ''):
            output = data['content']
            if 'chat/page.tsx' in output and 'Total Lines: 416' in output:
                chat_page = output
            elif 'FloatingAIBot.tsx' in output and 'Total Lines: 558' in output:
                bot_page = output
            elif 'layout.tsx' in output and 'Total Lines: 262' in output:
                layout_page = output

def clean_output(text):
    lines = text.split('\n')
    start_idx = 0
    for i, l in enumerate(lines):
        if l.startswith('The following code has been modified'):
            start_idx = i + 1
            break
    
    clean_lines = []
    for l in lines[start_idx:]:
        if l.startswith('The above content shows the entire'):
            break
        parts = l.split(': ', 1)
        if len(parts) == 2 and parts[0].isdigit():
            clean_lines.append(parts[1])
        else:
            clean_lines.append(l)
    return '\n'.join(clean_lines)

if chat_page:
    with open(r'd:\AI Nurse QA & Audit\careaudit-ai\frontend\src\app\(dashboard)\chat\page.tsx', 'w', encoding='utf-8') as f:
        f.write(clean_output(chat_page))
    print('Restored chat/page.tsx')

if bot_page:
    with open(r'd:\AI Nurse QA & Audit\careaudit-ai\frontend\src\components\shared\FloatingAIBot.tsx', 'w', encoding='utf-8') as f:
        f.write(clean_output(bot_page))
    print('Restored FloatingAIBot.tsx')

if layout_page:
    with open(r'd:\AI Nurse QA & Audit\careaudit-ai\frontend\src\app\(dashboard)\layout.tsx', 'w', encoding='utf-8') as f:
        f.write(clean_output(layout_page))
    print('Restored layout.tsx')

store_path = r'd:\AI Nurse QA & Audit\careaudit-ai\frontend\src\store\chatStore.ts'
if os.path.exists(store_path):
    os.remove(store_path)
    print('Deleted chatStore.ts')


import duckdb
import sqlite3
import json
from datetime import datetime, date

duck_conn = duckdb.connect(r'e:/UAM/ai-audit-/data/careaudit.duckdb')
sql_conn = sqlite3.connect(r'e:/UAM/ai-audit-V2/data/careaudit.sqlite')

tables = [
    'users', 'cases', 'documents', 'policies', 'policy_matches',
    'nurse_decisions', 'audit_results', 'appeals', 'appeal_intake_cases',
    'reviewer_stats', 'training_modules', 'conversations', 'messages',
    'audit_log', 'peer_reviews', 'audit_overrides', 'training_assessments',
    'historical_pa'
]

for table in tables:
    print(f'Migrating {table}...')
    try:
        data = duck_conn.execute(f'SELECT * FROM {table}').fetchall()
        if not data:
            continue
        
        # Get column names
        cols = [desc[0] for desc in duck_conn.description]
        placeholders = ','.join(['?' for _ in cols])
        
        insert_query = f'INSERT INTO {table} ({','.join(cols)}) VALUES ({placeholders})'
        
        # Clean data (convert dict/lists to json strings, dates to isoformat)
        cleaned_data = []
        for row in data:
            new_row = []
            for item in row:
                if isinstance(item, (dict, list)):
                    new_row.append(json.dumps(item))
                elif isinstance(item, (datetime, date)):
                    new_row.append(item.isoformat())
                else:
                    new_row.append(item)
            cleaned_data.append(tuple(new_row))
            
        sql_conn.executemany(insert_query, cleaned_data)
        sql_conn.commit()
    except Exception as e:
        print(f'Error migrating {table}: {e}')

print('Migration complete.')

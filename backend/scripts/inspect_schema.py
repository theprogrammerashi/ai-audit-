import sqlite3

def main():
    conn = sqlite3.connect(r'E:\UAM\ai-audit-V2\data\careaudit.sqlite')
    cur = conn.cursor()
    cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='cases'")
    row = cur.fetchone()
    if row:
        print("Cases Schema:")
        print(row[0])
    conn.close()

if __name__ == "__main__":
    main()

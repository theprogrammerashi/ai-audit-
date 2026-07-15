import random
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from app.database import get_connection

def fix_regions():
    conn = get_connection()
    
    print("Fixing regions to famous US cities...")
    # Fetch all distinct regions
    regions = conn.execute("SELECT DISTINCT region FROM historical_pa").fetchall()
    
    cities = [
        "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", 
        "Miami, FL", "Seattle, WA", "Boston, MA", "Atlanta, GA", "Dallas, TX", "Denver, CO"
    ]
    
    for r in regions:
        old_region = r[0]
        new_city = cities.pop(0) if cities else f"City {random.randint(100, 999)}"
        conn.execute("UPDATE historical_pa SET region = ? WHERE region = ?", [new_city, old_region])
        print(f"Mapped {old_region} to {new_city}")
        
    print(f"Fixed {len(regions)} regions successfully!")

if __name__ == "__main__":
    fix_regions()

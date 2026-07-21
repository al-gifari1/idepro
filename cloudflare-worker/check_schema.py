import urllib.request
import json
import sys

# Enable UTF-8 streams for emoji support on Windows console
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def main():
    supabase_url = "https://rjegmurqhkglyethgauq.supabase.co"
    service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZWdtdXJxaGtnbHlldGhnYXVxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk5MjEzNiwiZXhwIjoyMDk5NTY4MTM2fQ.boDdaoduEbZEGQtR9Lj5R3MsfsoKv1qL--ty_5hOGq4"

    url = f"{supabase_url}/rest/v1/"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}"
    }

    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req) as res:
            schema = json.loads(res.read().decode("utf-8"))
            profiles_defn = schema.get("definitions", {}).get("profiles", {})
            print("📊 Definitions for profiles table:")
            print(json.dumps(profiles_defn, indent=2))
    except Exception as e:
        print(f"❌ Failed to fetch schema: {e}")

if __name__ == "__main__":
    main()

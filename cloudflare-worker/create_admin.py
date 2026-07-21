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

    email = "admin@idepro.com"
    password = "admin123"

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json"
    }

    # Step 1: Find user ID for admin@idepro.com
    print(f"🔍 Finding user: {email}...")
    user_id = None
    list_url = f"{supabase_url}/auth/v1/admin/users"
    list_req = urllib.request.Request(list_url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(list_req) as list_res:
            users_list = json.loads(list_res.read().decode("utf-8"))
            users = users_list if isinstance(users_list, list) else users_list.get("users", [])
            for u in users:
                if u.get("email") == email:
                    user_id = u.get("id")
                    break
    except Exception as e:
        print(f"❌ Failed to list users: {e}")

    # Step 2: Create user if not exists, otherwise update password to 'admin123'
    if not user_id:
        print(f"➕ Admin user doesn't exist. Creating auth user...")
        create_url = f"{supabase_url}/auth/v1/admin/users"
        create_body = {
            "email": email,
            "password": password,
            "email_confirm": True
        }
        create_req = urllib.request.Request(create_url, data=json.dumps(create_body).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(create_req) as create_res:
                resp_data = json.loads(create_res.read().decode("utf-8"))
                user_id = resp_data.get("id")
                print(f"✅ Created auth user with ID: {user_id}")
        except Exception as e:
            print(f"❌ Failed to create auth user: {e}")
            sys.exit(1)
    else:
        print(f"🔑 Admin user exists with ID: {user_id}. Updating/resetting password to '{password}'...")
        update_url = f"{supabase_url}/auth/v1/admin/users/{user_id}"
        update_body = {
            "password": password,
            "email_confirm": True
        }
        update_req = urllib.request.Request(update_url, data=json.dumps(update_body).encode("utf-8"), headers=headers, method="PUT")
        try:
            with urllib.request.urlopen(update_req) as update_res:
                print("✅ Password successfully updated/reset.")
        except Exception as e:
            print(f"❌ Failed to update password: {e}")
            sys.exit(1)

    # Step 3: Upsert/Patch user profile in profiles table
    if user_id:
        print(f"📈 Syncing profiles table entry for user ID: {user_id}...")
        
        # Check if profile already exists in rest API
        check_url = f"{supabase_url}/rest/v1/profiles?id=eq.{user_id}"
        check_req = urllib.request.Request(check_url, headers=headers, method="GET")
        profile_exists = False
        try:
            with urllib.request.urlopen(check_req) as check_res:
                profiles_list = json.loads(check_res.read().decode("utf-8"))
                if len(profiles_list) > 0:
                    profile_exists = True
        except Exception as e:
            print(f"⚠️ Failed to check profiles table: {e}")

        profile_body = {
            "id": user_id,
            "email": email,
            "tier": "premium",
            "gmail_limit": 5
        }

        if profile_exists:
            print("✏️ Profile exists. Sending PATCH request...")
            patch_url = f"{supabase_url}/rest/v1/profiles?id=eq.{user_id}"
            patch_body = {
                "tier": "premium",
                "gmail_limit": 5
            }
            patch_req = urllib.request.Request(patch_url, data=json.dumps(patch_body).encode("utf-8"), headers=headers, method="PATCH")
            try:
                with urllib.request.urlopen(patch_req) as patch_res:
                    print("✅ Profile updated successfully to premium tier.")
            except Exception as e:
                print(f"❌ Failed to patch profile: {e}")
        else:
            print("➕ Profile doesn't exist. Sending POST request...")
            post_url = f"{supabase_url}/rest/v1/profiles"
            post_req = urllib.request.Request(post_url, data=json.dumps(profile_body).encode("utf-8"), headers=headers, method="POST")
            try:
                with urllib.request.urlopen(post_req) as post_res:
                    print("✅ Profile inserted successfully with premium tier.")
            except Exception as e:
                print(f"❌ Failed to post profile: {e}")
    else:
        print("❌ Could not determine user ID for admin.")

if __name__ == "__main__":
    main()

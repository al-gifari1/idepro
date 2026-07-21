import sys
import os
import subprocess
import shutil

# Enable UTF-8 streams for emoji support on Windows console
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def run_cmd(args, cwd=None):
    print(f"🚀 Running: {' '.join(args)} in {cwd or '.'}")
    res = subprocess.run(args, cwd=cwd, shell=True)
    if res.returncode != 0:
        print(f"❌ Failed: {' '.join(args)}")
        sys.exit(res.returncode)
    print("✅ Success")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    web_dir = os.path.join(base_dir, "web_controller", "web")
    worker_dir = os.path.join(base_dir, "cloudflare-worker")

    print("\n--- STEP 1: Building Frontend ---")
    run_cmd(["npm", "run", "build"], cwd=web_dir)

    print("\n--- STEP 2: Deploying to Cloudflare ---")
    # Deploy worker and static assets
    run_cmd(["npx", "wrangler", "deploy"], cwd=worker_dir)

    print("\n--- STEP 3: Committing and Pushing to GitHub ---")
    # Git commit all changes
    # Use remote origin if already configured or retrieve token from environment
    token = os.environ.get("GITHUB_TOKEN", "")
    if token:
        repo_url = f"https://al-gifari1:{token}@github.com/al-gifari1/idepro.git"
    else:
        repo_url = "origin"
    
    # Configure git username and email if not set
    subprocess.run(["git", "config", "user.name", "al-gifari1"], shell=True)
    subprocess.run(["git", "config", "user.email", "admin@idepro.com"], shell=True)
    
    # Check status
    res = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, shell=True)
    if res.stdout.strip():
        run_cmd(["git", "add", "."], cwd=base_dir)
        run_cmd(["git", "commit", "-m", "Unified deployment of web panel & gateway configuration with routing setups"], cwd=base_dir)
    else:
        print("ℹ️ No git changes to commit.")

    print("🚀 Pushing main branch to GitHub...")
    run_cmd(["git", "push", repo_url, "main", "--force"], cwd=base_dir)

    print("\n🎉 Deployment and code sync complete!")

if __name__ == "__main__":
    main()

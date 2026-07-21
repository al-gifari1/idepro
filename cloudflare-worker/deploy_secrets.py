import os
import subprocess
import sys

def main():
    env_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(env_dir, ".env")

    if not os.path.exists(env_path):
        print(f"❌ .env file not found in {env_dir} directory!", file=sys.stderr)
        sys.exit(1)

    with open(env_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    for line in lines:
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue

        if "=" not in trimmed:
            continue

        eq_idx = trimmed.find("=")
        key = trimmed[:eq_idx].strip()
        value = trimmed[eq_idx + 1:].strip()

        # Strip quotes if any
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]

        if "change-me" in value or "_here" in value:
            print(f"⚠️ Skipping placeholder value for: {key}")
            continue

        print(f"🔑 Deploying secret: {key}...")
        try:
            # shell=True is needed on Windows for .cmd/.bat files (like npx)
            proc = subprocess.Popen(
                ["npx", "wrangler", "secret", "put", key],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=True,
                cwd=env_dir
            )
            stdout, stderr = proc.communicate(input=value + "\n")
            if proc.returncode == 0:
                print(f"✅ Secret {key} deployed successfully.\n")
            else:
                print(f"❌ Failed to deploy secret {key}. Error:\n{stderr or stdout}\n", file=sys.stderr)
        except Exception as e:
            print(f"❌ Error executing wrangler command: {e}\n", file=sys.stderr)

    print("🎉 Secrets deployment complete!")

if __name__ == "__main__":
    main()

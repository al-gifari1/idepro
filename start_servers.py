import os
import sys
import subprocess
import time
import signal

# Set console encoding to UTF-8 on Windows to avoid UnicodeEncodeError for emojis
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

processes = []

def run_server(name, command, args, cwd):
    print(f"[Launcher] Starting {name} in {cwd}...")
    try:
        # Use shell=True for windows to execute npm/node cmd wrapper
        proc = subprocess.Popen(
            [command] + args,
            shell=True,
            cwd=cwd
        )
        processes.append((name, proc))
        return proc
    except Exception as e:
        print(f"[Launcher] Failed to start {name}: {e}", file=sys.stderr)
        return None

def signal_handler(sig, frame):
    print("\n[Launcher] Shutting down all servers...")
    for name, proc in processes:
        if proc.poll() is None:
            print(f"[Launcher] Terminating {name}...")
            # On windows, taskkill is needed to kill process tree (like npm dev server)
            if sys.platform.startswith("win"):
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            else:
                proc.terminate()
    print("[Launcher] Shutdown complete.")
    sys.exit(0)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))

    # Check for login portal directory path
    login_dir = os.path.join(root_dir, "web_controller", "web")
    if not os.path.exists(login_dir):
        login_dir = os.path.join(root_dir, "web")

    admin_dir = os.path.join(root_dir, "web_controller", "admin-panel")
    sync_dir = root_dir

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # 1. Sync Server (port 3000)
    run_server(
        "Sync Server",
        "node",
        [os.path.join("web_controller", "server", "server.mjs")],
        sync_dir
    )
    time.sleep(2)

    # 2. Login Portal (port 5173)
    if os.path.exists(login_dir):
        run_server("Login Portal", "npm", ["run", "dev"], login_dir)
    else:
        print(f"[Launcher] Warning: Login Portal directory not found at {login_dir}")
    time.sleep(2)

    # 3. Admin Panel (port 5174)
    if os.path.exists(admin_dir):
        run_server("Admin Panel", "npm", ["run", "dev", "--", "--port", "5174"], admin_dir)
    else:
        print(f"[Launcher] Warning: Admin Panel directory not found at {admin_dir}")

    print("🚀 All servers launched successfully! Press Ctrl+C to terminate.")
    
    # Keep main thread alive
    while True:
        time.sleep(1)

if __name__ == "__main__":
    main()

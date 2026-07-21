import os
import sys
import json
import urllib.request
import urllib.parse
import time
import threading
import uuid

# Set console encoding to UTF-8 on Windows to avoid UnicodeEncodeError for emojis
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

class StitchClient:
    def __init__(self, api_key, base_url="https://stitch.googleapis.com/mcp"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.post_url = None
        self.sse_response = None
        self.responses = {}
        self.lock = threading.Lock()
        self.thread = None
        self.connected = False

    def build_headers(self, additional=None):
        headers = {
            "X-Goog-Api-Key": self.api_key,
        }
        if additional:
            headers.update(additional)
        return headers

    def connect(self):
        print("🔌 Connecting to Stitch MCP endpoint...")
        req = urllib.request.Request(
            self.base_url,
            headers=self.build_headers({"Accept": "text/event-stream"})
        )
        try:
            self.sse_response = urllib.request.urlopen(req, timeout=60)
        except Exception as e:
            print(f"❌ Connection failed: {e}", file=sys.stderr)
            sys.exit(1)

        # Start thread to read SSE stream
        self.thread = threading.Thread(target=self._read_stream, daemon=True)
        self.thread.start()

        # Wait for post_url endpoint to be received
        for _ in range(30):
            if self.post_url:
                self.connected = True
                print("✅ Connected to Stitch MCP Server")
                return
            time.sleep(0.5)

        print("❌ Timeout waiting for SSE endpoint initialization", file=sys.stderr)
        sys.exit(1)

    def _read_stream(self):
        current_event = None
        for line in self.sse_response:
            line_str = line.decode("utf-8").strip()
            if not line_str:
                continue

            if line_str.startswith("event:"):
                current_event = line_str[6:].strip()
            elif line_str.startswith("data:"):
                data_val = line_str[5:].strip()
                if current_event == "endpoint":
                    self.post_url = urllib.parse.urljoin(self.base_url, data_val)
                elif current_event == "message" or not current_event:
                    try:
                        msg = json.loads(data_val)
                        if "id" in msg:
                            with self.lock:
                                self.responses[str(msg["id"])] = msg
                    except Exception as e:
                        pass
                current_event = None

    def call_tool(self, tool_name, arguments):
        if not self.connected:
            self.connect()

        req_id = str(uuid.uuid4())
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            },
            "id": req_id
        }

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.post_url,
            data=data,
            headers=self.build_headers({"Content-Type": "application/json"})
        )

        try:
            with urllib.request.urlopen(req) as resp:
                resp.read()
        except Exception as e:
            raise RuntimeError(f"Failed to post tool call: {e}")

        # Wait for JSON-RPC response in SSE stream
        for _ in range(120):
            with self.lock:
                if req_id in self.responses:
                    resp_msg = self.responses.pop(req_id)
                    if resp_msg.get("isError") or "error" in resp_msg:
                        err_msg = resp_msg.get("error", {}).get("message", "Unknown tool error")
                        raise RuntimeError(f"Tool {tool_name} returned error: {err_msg}")
                    
                    res = resp_msg.get("result", {})
                    return res
            time.sleep(0.5)

        raise TimeoutError(f"Timeout waiting for response of {tool_name}")

def main():
    api_key = os.environ.get("STITCH_API_KEY")
    if not api_key:
        print("==================================================================")
        print("⚠️  STITCH_API_KEY is not set in environment variables!")
        print("Set your key before running: $env:STITCH_API_KEY='your-key'")
        print("==================================================================")
        sys.exit(1)

    project_name = sys.argv[1] if len(sys.argv) > 1 else "IDEpro Cyber Control"
    prompt_text = sys.argv[2] if len(sys.argv) > 2 else "A futuristic dark-mode developer dashboard with high-density metrics and live edge gateway telemetry"

    # Load DESIGN.md if available
    design_system_context = ""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    design_md_path = os.path.join(root_dir, "DESIGN.md")
    if os.path.exists(design_md_path):
        try:
            with open(design_md_path, "r", encoding="utf-8") as f:
                design_system_context = f.read()
            print("🎨 Loaded DESIGN.md system specification.")
        except Exception:
            pass

    client = StitchClient(api_key)
    try:
        print(f"🚀 Creating project: \"{project_name}\"...")
        project_res = client.call_tool("create_project", {"title": project_name})
        
        proj_name = project_res.get("name", "")
        project_id = proj_name.split("/")[-1] if "/" in proj_name else proj_name
        print(f"✅ Project Created: {project_id}")

        print(f"🎨 Generating screen for prompt: \"{prompt_text}\"...")
        gen_args = {
            "projectId": project_id,
            "prompt": prompt_text
        }
        gen_res = client.call_tool("generate_screen_from_text", gen_args)
        
        screen_data = None
        for c in gen_res.get("outputComponents", []):
            screens = c.get("design", {}).get("screens", [])
            if screens:
                screen_data = screens[0]
                break

        if not screen_data:
            print("❌ Failed to parse generated screen from API response", file=sys.stderr)
            sys.exit(1)

        screen_id = screen_data.get("id")
        print(f"✅ Screen Generated: {screen_id}")

        html_url = screen_data.get("htmlCode", {}).get("downloadUrl")
        image_url = screen_data.get("screenshot", {}).get("downloadUrl")

        if not html_url or not image_url:
            screen_res = client.call_tool("get_screen", {
                "projectId": project_id,
                "screenId": screen_id,
                "name": f"projects/{project_id}/screens/{screen_id}"
            })
            html_url = html_url or screen_res.get("htmlCode", {}).get("downloadUrl")
            image_url = image_url or screen_res.get("screenshot", {}).get("downloadUrl")

        print("==================================================================")
        print(f"🌐 HTML Download URL: {html_url}")
        print(f"🖼️  Preview Image URL: {image_url}")
        print("==================================================================")

    except Exception as e:
        print(f"❌ Stitch Generation Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

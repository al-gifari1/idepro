import { stitch } from "@google/stitch-sdk";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const apiKey = process.env.STITCH_API_KEY;

  if (!apiKey) {
    console.log("==================================================================");
    console.log("⚠️ STITCH_API_KEY is not set in environment variables!");
    console.log("Set your key before running: $env:STITCH_API_KEY='your-key'");
    console.log("==================================================================");
    return;
  }

  // Load DESIGN.md for design system context if available
  let designSystemContext = "";
  const designMdPath = path.join(__dirname, "DESIGN.md");
  if (existsSync(designMdPath)) {
    designSystemContext = readFileSync(designMdPath, "utf8");
    console.log("🎨 Loaded DESIGN.md system specification.");
  }

  const projectName = process.argv[2] || "IDEpro Cyber Control";
  const promptText = process.argv[3] || "A futuristic dark-mode developer dashboard with high-density metrics and live edge gateway telemetry";

  console.log(`🚀 Connecting to Stitch API... Creating project: "${projectName}"`);
  const project = await stitch.createProject(projectName);
  console.log(`✅ Project Created: ${project.id}`);

  console.log(`🎨 Generating screen for prompt: "${promptText}"...`);
  const screen = await project.generate(promptText);
  console.log(`✅ Screen Generated: ${screen.id}`);

  const htmlUrl = await screen.getHtml();
  const imageUrl = await screen.getImage();

  console.log("==================================================================");
  console.log(`🌐 HTML Download URL: ${htmlUrl}`);
  console.log(`🖼️ Preview Image URL: ${imageUrl}`);
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("❌ Stitch Generation Error:", err.message || err);
});

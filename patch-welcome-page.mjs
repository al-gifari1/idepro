import { readFileSync, writeFileSync } from "node:fs";

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const paths = [
  path.join(__dirname, "package", "resources", "app", "out", "main.js"),
  path.join(__dirname, "package", "resources", "app", "out", "jetskiAgent", "main.js")
];

const target = '"Continue with Google"';
const replacement = '"Continue to Workspace"';

for (const filePath of paths) {
  try {
    let content = readFileSync(filePath, "utf8");
    if (content.includes(target)) {
      content = content.replaceAll(target, replacement);
      writeFileSync(filePath, content, "utf8");
      console.log(`✅ Patched onboarding button text in: ${filePath}`);
    }
  } catch (err) {
    // Ignore files that don't exist in different test setups
  }
}

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const pages = ["index", "login", "register", "forgot_password", "verify_otp", "reset_password", "dashboard", "about", "contact"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, "static"), path.join(output, "static"), { recursive: true });

for (const page of pages) {
  let html = await readFile(path.join(root, "templates", `${page}.html`), "utf8");
  // Flask flash-message blocks are runtime-only and are replaced by the client auth flow.
  html = html.replace(/\{% with messages[\s\S]*?\{% endwith %\}/g, "");
  html = html.replaceAll("{{ google_client_id }}", process.env.GOOGLE_CLIENT_ID ?? "");
  if (page === "login" && !process.env.GOOGLE_CLIENT_ID) {
    html = html.replace(/\s*<script src="https:\/\/accounts\.google\.com\/gsi\/client"[^>]*><\/script>/, "");
    html = html.replace(/<div id="g_id_onload"[\s\S]*?<\/div>\s*<div class="g_id_signin"[\s\S]*?<\/div>\s*<script>[\s\S]*?<\/script>/, "<p>Google sign-in is unavailable until GOOGLE_CLIENT_ID is configured.</p>");
  }
  if (page !== "index") {
    const dir = path.join(output, page === "forgot_password" ? "forgot-password" : page === "verify_otp" ? "verify-otp" : page === "reset_password" ? "reset-password" : page);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), html);
  } else {
    await writeFile(path.join(output, "index.html"), html);
  }
}

import fs from "node:fs";
import path from "node:path";

const required = [
  "public/index.html",
  "public/register.html",
  "public/ticket.html",
  "public/staff.html",
  "public/assets/css/app.css",
  "public/assets/js/common.js",
  "public/assets/js/register.js",
  "public/assets/js/ticket.js",
  "public/assets/js/staff.js",
  "netlify/functions/_shared.mjs",
  "netlify/functions/register.mjs",
  "netlify/functions/dashboard.mjs",
  "supabase/schema.sql",
  "netlify.toml"
];

for (const file of required) {
  if (!fs.existsSync(path.resolve(file))) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const htmlFiles = required.filter((file) => file.endsWith(".html"));
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes("<!doctype html>")) {
    throw new Error(`Invalid HTML file: ${file}`);
  }
}

console.log(`Project check passed. ${required.length} required files found.`);

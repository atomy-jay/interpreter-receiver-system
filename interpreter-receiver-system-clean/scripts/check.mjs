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
  ".gitignore",
  ".nvmrc",
  "package-lock.json",
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

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (!String(pkg.engines?.node || "").includes("22")) {
  throw new Error("package.json must require Node 22 for the current Supabase SDK.");
}

const lockfile = fs.readFileSync("package-lock.json", "utf8");
if (lockfile.includes("packages.applied-caas-gateway1.internal.api.openai.org")) {
  throw new Error("package-lock.json contains an internal registry URL. Regenerate it with the public npm registry before deploying.");
}

const netlifyToml = fs.readFileSync("netlify.toml", "utf8");
if (!netlifyToml.includes('NODE_VERSION = "22"')) {
  throw new Error('netlify.toml must set NODE_VERSION = "22".');
}

console.log(`Project check passed. ${required.length} required files found.`);

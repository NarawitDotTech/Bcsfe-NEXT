#!/usr/bin/env node
// Converts BCSFE-Python locale folders (*.properties + metadata.json) to flat JSON files.
// Usage: node scripts/convert-locales.mjs <path-to-python-locales-dir> [out-dir]
import fs from "node:fs";
import path from "node:path";

const srcRoot = process.argv[2];
const outRoot = process.argv[3] ?? path.join(process.cwd(), "src/lib/bcsfe/files/locales");
if (!srcRoot) {
  console.error("usage: convert-locales.mjs <locales-dir> [out-dir]");
  process.exit(1);
}

function splitlines(s) {
  const parts = s.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

// Faithful port of PropertySet.parse (locale_handler.py)
function parseProperties(text, label) {
  const lines = splitlines(text);
  const props = {};
  let i = 0;
  let inMulti = false;
  let multiText = "";
  let multiKey = "";
  while (i < lines.length) {
    const line = lines[i];
    let finish = false;
    if ((inMulti && !line.startsWith(">")) || (inMulti && i === lines.length - 1)) {
      inMulti = false;
      finish = true;
      if (multiKey in props) throw new Error(`${label}: key ${multiKey} already exists`);
      if (line.startsWith(">")) multiText += line.slice(1);
      else multiText = multiText.slice(0, -1);
      props[multiKey] = multiText;
      multiText = "";
      multiKey = "";
    }
    if (line.startsWith("#") || !line) {
      i++;
      continue;
    }
    if (line.startsWith(">") && inMulti) multiText += line.slice(1) + "\n";
    const parts = line.split("=");
    if (line.trim().endsWith("=")) {
      inMulti = true;
      multiKey = parts[0];
    }
    if (!inMulti && !finish) {
      const key = parts[0];
      const value = parts.slice(1).join("=");
      if (key in props) throw new Error(`${label}: key ${key} already exists`);
      props[key] = value;
    }
    i++;
  }
  return props;
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out.sort();
}

fs.mkdirSync(outRoot, { recursive: true });
for (const lang of fs.readdirSync(srcRoot, { withFileTypes: true })) {
  if (!lang.isDirectory()) continue;
  const dir = path.join(srcRoot, lang.name);
  const merged = {};
  for (const f of walk(dir)) {
    if (!f.endsWith(".properties")) continue;
    Object.assign(merged, parseProperties(fs.readFileSync(f, "utf8"), f));
  }
  const metaPath = path.join(dir, "metadata.json");
  if (fs.existsSync(metaPath)) merged.__metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  fs.writeFileSync(path.join(outRoot, lang.name + ".json"), JSON.stringify(merged, null, 1) + "\n");
  console.log(lang.name, Object.keys(merged).length, "keys");
}

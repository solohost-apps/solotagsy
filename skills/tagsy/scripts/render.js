#!/usr/bin/env node
// render.js — render a Tagsy reason code through a per-language template.
// The API returns codes and numbers, never sentences. This script turns a code
// plus data fields into the user-facing string.
//
// Usage:
//   node render.js --code receipt_unconfirmed [--lang en] [--data '{"x":1}']
//   node render.js --list [--lang en]
//
// Resolution order: locales/<lang>.json -> locales/en.json -> raw code.
// Template placeholders look like {field} or {field.nested}. Missing fields
// are left visible as {field} and reported on stderr.

const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "locales");

function loadLocale(lang) {
  const candidates = lang === "en" ? ["en.json"] : [`${lang}.json`, "en.json"];
  for (const f of candidates) {
    const p = path.join(LOCALES_DIR, f);
    if (fs.existsSync(p)) {
      try {
        return { lang: f.replace(/\.json$/, ""), strings: JSON.parse(fs.readFileSync(p, "utf8")) };
      } catch (e) {
        process.stderr.write(`warn: could not parse ${f}: ${e.message}\n`);
      }
    }
  }
  return { lang: "en", strings: {} };
}

function get(obj, dotted) {
  return dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function render(template, data) {
  const missing = [];
  const out = template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (m, key) => {
    const v = get(data, key);
    if (v === undefined || v === null) {
      missing.push(key);
      return m;
    }
    return String(v);
  });
  return { text: out, missing };
}

function args() {
  const a = process.argv.slice(2);
  const out = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) {
      const k = a[i].slice(2);
      out[k] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
    } else {
      out._.push(a[i]);
    }
  }
  return out;
}

function main() {
  const opts = args();
  const lang = opts.lang || process.env.TAGSY_DEFAULT_LANG || "en";
  const { lang: usedLang, strings } = loadLocale(String(lang));

  if (opts.list) {
    console.log(JSON.stringify({ ok: true, data: { lang: usedLang, codes: Object.keys(strings).sort() } }));
    return;
  }

  const code = opts.code;
  if (!code) {
    process.stderr.write(JSON.stringify({ ok: false, error: { code: "validation_error", message: "Usage: render.js --code <reasonCode> [--lang xx] [--data json]" } }) + "\n");
    process.exit(1);
  }

  let data = {};
  if (opts.data) {
    try {
      data = JSON.parse(opts.data);
    } catch (e) {
      process.stderr.write(JSON.stringify({ ok: false, error: { code: "validation_error", message: "--data must be valid JSON" } }) + "\n");
      process.exit(1);
    }
  }

  const template = strings[code];
  if (!template) {
    // Unknown code: say so plainly rather than guessing.
    console.log(JSON.stringify({
      ok: true,
      data: { rendered: false, code, lang: usedLang, reason: "no_template", fallback: code.replace(/_/g, " ") },
    }));
    return;
  }

  const { text, missing } = render(template, data);
  if (missing.length) {
    process.stderr.write(`warn: missing template fields: ${missing.join(", ")}\n`);
  }
  console.log(JSON.stringify({ ok: true, data: { rendered: true, code, lang: usedLang, text } }));
}

main();

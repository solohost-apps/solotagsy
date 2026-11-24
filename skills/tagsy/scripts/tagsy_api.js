#!/usr/bin/env node
// tagsy_api.js — helper for the Tagsy public API used by the `tagsy` skill.
// Zero dependencies. Node 18+ (global fetch).
//
// Commands:
//   node tagsy_api.js link <code>          Exchange a link code for a token, save config
//   node tagsy_api.js whoami               Show the linked identity
//   node tagsy_api.js get <path>           GET {baseUrl}/<path>   e.g. get me/held
//   node tagsy_api.js post <path> <json>   POST {baseUrl}/<path>  e.g. post appeals '{"a":1}'
//   node tagsy_api.js config               Show baseUrl, language, whether a token exists
//   node tagsy_api.js set-base <url>       Set the API base URL (include /api if needed)
//   node tagsy_api.js set-language <lang>  Set the reply language (e.g. en, hi)
//
// Exit codes: 0 ok, 2 auth problem (re-link needed), 1 other error.
// Stdout is always the response JSON on success. Errors go to stderr as JSON.

const fs = require("fs");
const path = require("path");
const os = require("os");

function configPath() {
  if (process.env.TAGSY_CONFIG) return process.env.TAGSY_CONFIG;
  const state = process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), ".openclaw");
  return path.join(state, "tagsy", "config.json");
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch (e) {
    return {};
  }
}

function saveConfig(cfg) {
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}

function baseUrl(cfg) {
  return (cfg.baseUrl || process.env.TAGSY_API_BASE || "https://app.tagsy.org/api").replace(/\/+$/, "");
}

async function api(cfg, method, apiPath, body) {
  const url = `${baseUrl(cfg)}/${String(apiPath).replace(/^\/+/, "")}`;
  const headers = { "content-type": "application/json" };
  if (cfg.token && !apiPath.startsWith("auth/link")) {
    headers.authorization = `Bearer ${cfg.token}`;
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    fail(1, "network_error", `Cannot reach Tagsy API at ${baseUrl(cfg)}: ${e.message}`);
  }
  let json = null;
  try {
    json = await res.json();
  } catch (e) {}
  if (!json || json.ok !== true) {
    const err = (json && json.error) || { code: "internal_error", message: `HTTP ${res.status}` };
    const out = { ok: false, error: err, httpStatus: res.status };
    process.stderr.write(JSON.stringify(out) + "\n");
    process.exit(res.status === 401 ? 2 : 1);
  }
  return json.data;
}

function fail(code, errCode, message) {
  process.stderr.write(JSON.stringify({ ok: false, error: { code: errCode, message } }) + "\n");
  process.exit(code);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const cfg = loadConfig();

  switch (cmd) {
    case "link": {
      const code = args[0];
      if (!code) fail(1, "validation_error", "Usage: link <code>");
      const data = await api(cfg, "POST", "auth/link", { code });
      cfg.token = data.token;
      cfg.tokenType = data.tokenType || "Bearer";
      cfg.tokenExpiresAt = data.expiresAt || null;
      cfg.scopes = data.scopes || [];
      cfg.piUsername = data.piUsername || null;
      cfg.linkedAt = new Date().toISOString();
      // Do not persist baseUrl here: env TAGSY_API_BASE and the built-in
      // default already resolve it, and writing a value would override env.
      saveConfig(cfg);
      // Print identity only; never echo the token back to the transcript more than needed.
      console.log(JSON.stringify({ ok: true, data: { linked: true, piUsername: cfg.piUsername, scopes: cfg.scopes, tokenExpiresAt: cfg.tokenExpiresAt } }));
      return;
    }
    case "whoami": {
      if (!cfg.token) fail(2, "unauthorized", "Not linked. Ask the user for a link code from the Tagsy app.");
      const data = await api(cfg, "GET", "auth/whoami");
      console.log(JSON.stringify({ ok: true, data }));
      return;
    }
    case "get": {
      const p = args[0];
      if (!p) fail(1, "validation_error", "Usage: get <path>");
      if (!cfg.token && !p.startsWith("report/weekly")) {
        fail(2, "unauthorized", "Not linked. Ask the user for a link code from the Tagsy app.");
      }
      const data = await api(cfg, "GET", p);
      console.log(JSON.stringify({ ok: true, data }));
      return;
    }
    case "post": {
      const [p, json] = args;
      if (!p) fail(1, "validation_error", "Usage: post <path> <json>");
      if (!cfg.token) fail(2, "unauthorized", "Not linked. Ask the user for a link code from the Tagsy app.");
      let body;
      try {
        body = json ? JSON.parse(json) : {};
      } catch (e) {
        fail(1, "validation_error", "Body must be valid JSON");
      }
      const data = await api(cfg, "POST", p, body);
      console.log(JSON.stringify({ ok: true, data }));
      return;
    }
    case "config": {
      console.log(JSON.stringify({
        ok: true,
        data: {
          baseUrl: baseUrl(cfg),
          language: cfg.language || "en",
          linked: Boolean(cfg.token),
          piUsername: cfg.piUsername || null,
          tokenExpiresAt: cfg.tokenExpiresAt || null,
          configPath: configPath(),
        },
      }));
      return;
    }
    case "set-base": {
      const url = args[0];
      if (!url) fail(1, "validation_error", "Usage: set-base <url>");
      cfg.baseUrl = url.replace(/\/+$/, "");
      saveConfig(cfg);
      console.log(JSON.stringify({ ok: true, data: { baseUrl: cfg.baseUrl } }));
      return;
    }
    case "set-language": {
      const lang = args[0];
      if (!lang) fail(1, "validation_error", "Usage: set-language <lang>");
      cfg.language = lang;
      saveConfig(cfg);
      console.log(JSON.stringify({ ok: true, data: { language: lang } }));
      return;
    }
    default:
      fail(1, "validation_error", `Unknown command "${cmd || ""}". Commands: link, whoami, get, post, config, set-base, set-language`);
  }
}

main().catch((e) => fail(1, "internal_error", e.message));

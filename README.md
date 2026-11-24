# SoloTagsy

A SoloHost package that installs a Tagsy assistant on Pi Desktop. It is built
on OpenClaw (the same base as SoloClaw) and ships the `tagsy` skill, which lets
people ask why a Tagsy decision was made, file an appeal, check TAGC rewards and
standing, and read the weekly rulebook report.

This folder is the repository root. It contains the two files SoloHost needs
plus the skill they install:

- `docker-compose.yml` runs the app from the public image
  `ghcr.io/openclaw/openclaw:2026.11.5-browser`, with an nginx proxy sidecar.
- `config_options.yml` is the install form Pi Desktop shows.
- `skills/tagsy/` is the OpenClaw skill installed at startup.
- `docker-compose.dev.yml` is a local-only override for testing before the
  repo is public. It is not part of the package.

## How the skill gets installed

On every start the gateway container installs `skills/tagsy` into the
workspace skills directory (`/home/node/.openclaw/workspace/skills`):

1. If `/opt/solotagsy-skills/tagsy/SKILL.md` exists (custom image or the dev
   override mount), it copies from there.
2. Otherwise it clones `TAGSY_SKILL_GIT_URL` (set by `fixed_values` in
   `config_options.yml` to this repo) and copies `skills/tagsy` out of it.
3. If neither works, the app still boots; only the Tagsy skill is missing.

## Install in Pi Desktop

1. Open SoloHost and start a new app.
2. Paste the full contents of `docker-compose.yml` into its field.
3. Paste the full contents of `config_options.yml` into its field.
4. Submit. Pi Desktop shows the install form next.

## Install form answers

- **Control UI access token**: your login to the assistant UI. Choose any
  value, save it, and paste the same token to sign in after install.
- **Model provider**: where the assistant gets its model (Anthropic, OpenAI,
  OpenRouter, Groq, Ollama on this machine, or a custom OpenAI-compatible
  endpoint). Groq needs an API key from console.groq.com and answers very
  fast; set `GROQ_MODEL` in `.env` to change the model (default
  `openai/gpt-oss-120b`, try `openai/gpt-oss-20b` for more speed).
- **Telegram bot token / user ID**: optional, same as SoloClaw.
- **Tagsy API base URL**: defaults to `https://app.tagsy.org/api`. Change only
  if Tagsy gives you a different deployment.
- **Default answer language**: locale code for Tagsy answers (default `en`).

## Using the Tagsy skill

After install, link your Pi account once: open the Tagsy app, sign in with Pi,
choose "Connect SoloClaw" (the link flow is shared with SoloClaw), and paste
the code into the SoloTagsy chat. Then ask things like "why is my reward
held?", "file an appeal for order_9f2c", or "show me this week's report".

The skill contract lives in the sibling `pi-next/contract/` folder during
development; the public contract doc is `pi-next/contract/api-contract.md`.

## Local development

```bash
cp .env.example .env   # or write .env with the fields from config_options.yml
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

The dev override mounts `./skills` at `/opt/solotagsy-skills` so the skill
installs without the git repo existing yet. The proxy serves the UI on
`http://127.0.0.1:19091`.

To validate the package files without installing:

```bash
python3 ../ref/solohost/skills/solohost-package/scripts/validate_api.py .
```

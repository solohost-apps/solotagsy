---
name: tagsy
description: Ask Tagsy why a reward, listing, sale, or standing level was decided, file an appeal, or read the weekly Tagsy report. Use when the user asks about TAGC earnings, held or flagged items, producer pool status, their standing level, appeals, or the weekly rulebook report. Calls the Tagsy public API; this skill reads reports and submits requests, it never applies rules itself.
metadata:
  openclaw:
    requires:
      bins: [node]
---

# Tagsy

Tagsy is the verification layer for the Pi ecosystem. This skill lets a user ask why a decision was made, file an appeal, check rewards, standing, held items, producer pool status, and read the weekly report. Every answer must cite the rulebook version and reason code it came from.

Rule between the parts: this skill asks, the Tagsy layer decides. Never invent reasons, never promise outcomes, never claim a rule was applied that the API did not return.

## Setup: link the user's Pi account

The skill needs a one-time link before any `/me/*` or `/producer/*` call works.

1. Ask the user to open the Tagsy app, sign in with Pi, choose "Connect SoloClaw", and copy the code it shows.
2. Run: `node scripts/tagsy_api.js link <code>`
3. Confirm with `node scripts/tagsy_api.js whoami` and tell the user which Pi account is linked.

If a call exits with code 2 or an `unauthorized` error, the token expired or was revoked. Ask for a fresh link code and repeat step 2.

The helper stores its config (base URL, token, language) under the OpenClaw state dir at `tagsy/config.json`. Never print the token. `config` command shows status without secrets.

## Commands

All commands run from this skill's directory. Use `node`, not `python`.

- `node scripts/tagsy_api.js get <path>` — GET an endpoint. Paths: `me/rewards`, `me/standing`, `me/held`, `producer/pool`, `report/weekly`, `auth/whoami`.
- `node scripts/tagsy_api.js post <path> <json>` — POST an endpoint. Paths: `appeals`, `questions`.
- `node scripts/tagsy_api.js link <code>` / `whoami` / `config` / `set-base <url>` / `set-language <lang>`.
- `node scripts/render.js --code <reasonCode> [--lang <lang>] [--data '<json>']` — turn a reason code into user-facing text from `locales/<lang>.json`.

The API returns reason codes and numbers, never sentences. To answer a user, pick the right endpoint, read the `reasonCode` (and related fields) from the response, then render it with `render.js` in the user's language. Cite `rulebookVersion` when it matters.

## Workflows

### Ask why something happened

Route the question to the endpoint that owns the subject:

- "Why is my reward/item held?" → `get me/held`. Each item has `reasonCode`, `whatUnlocks`, `heldSince`.
- "What did I earn?" → `get me/rewards`.
- "What is my level / what do I unlock?" → `get me/standing`.
- "How is my pool / listing doing?" → `get producer/pool` (producer accounts only).
- "Why was this sale/decision made?" → `post questions` with `subjectRef` (saleId, itemRef, or order ref) and the user's question, then render `answer.reasonCode`.

For each item, render the `reasonCode` with `render.js`, add the concrete numbers from the response (amounts, dates, counts), and cite `rulebookVersion`. If `render.js` reports `no_template`, say the code plainly (underscores to spaces) and note that a translation is missing. Never guess a reason.

### File an appeal

1. Confirm what the user wants to appeal: a held item, a decision, a listing, or a reward. Get the `subjectRef` from `me/held`, `me/rewards`, or ask the user.
2. Ask for their statement in their own words.
3. Run: `node scripts/tagsy_api.js post appeals '{"subjectType":"held_item","subjectRef":"<ref>","statement":"<text>"}'`
4. Tell them the `appealId` and that Jay reviews appeals. If the API returns `conflict`/`appeal_exists`, tell them an appeal is already open on that subject.
5. `subjectType` must be one of `held_item`, `decision`, `listing`, `reward`.

### Weekly report

`get report/weekly` needs no token (public). Summarize `budgetUsed`/`budgetCap`, `rulebookVersion` and `rulebookHash` (short form is fine), and the `decisions` counts by rendering each `reasonCode`. Mention `appealsOpen` and `questionsAnswered` if present.

## Language

- Default language comes from config (`set-language`). The user's chat language wins: if they write in another language, answer in it.
- Templates live in `locales/<lang>.json`. Only `en` ships initially; more locales are added as translations land. If the user's language has no file, answer in English and say so once.
- Numbers, IDs, PIDs (`TGP-XXXX-XXXX`), and codes are never translated.

## Error handling

- Exit code 2 or `unauthorized`: re-link flow above.
- `forbidden` on `producer/pool`: the account is not a producer or lacks scope. Say so plainly.
- `not_found` on questions/appeals: the subjectRef is wrong. Re-check `me/held` or `me/rewards` for valid refs.
- `network_error`: the API is unreachable. Say so and suggest trying again later. Do not retry in a loop.
- Any `reasonCode` you do not recognize: show the code and the raw fields. Do not invent an explanation.

## Reference

- `references/reason-codes.md` lists every reason code and its plain meaning.
- `pi-next/contract/api-contract.md` is the full contract (endpoint shapes, auth, error codes). Read it if a response shape is unclear.

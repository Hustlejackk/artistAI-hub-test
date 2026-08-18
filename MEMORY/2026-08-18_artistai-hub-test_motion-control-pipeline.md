---
project: artistai-hub-test
topic: motion-control pipeline (fal.ai + Higgsfield + Supabase ingest)
date: 2026-08-18
environment: code
status: ongoing
tags: [fal-ai, higgsfield, kling, motion-transfer, supabase, rls, media-ingest, rag-agent]
deliverables: [motion_control/fal_pipeline.py, motion_control/run.sh, motion_control/README.md, motion_control/bisect_prompt.py, motion_control/test_pipeline_e2e.py, "Supabase vsl-media: schema motion_control + bucket motion-control"]
related: []
---

# artistAI-hub-test — Motion-control pipeline (fal.ai + Higgsfield + Supabase ingest)   (2026-08-18)

## TL;DR
Delivered a working video (real model composited into a real location via
fal.ai's flux-kontext-multi, motion-transferred with Kling v3 pro) after
Higgsfield MCP proved structurally unable to ingest the user's own media.
Investigated Higgsfield's real REST API by reading its official SDK source,
recommended against browser automation for ingest, then designed and
**live-provisioned** a Supabase-based ingest architecture for a future
RAG-driven agent — an isolated schema + bucket inside the user's existing
`vsl-media` project, constraint-tested live, with a ready-to-run E2E script
blocked only by this sandbox's own network policy (not by anything
Higgsfield- or Supabase-side).

## Coverage
Full session in view, single continuous conversation, no gaps identified.

## Goal / Context
User wants a video of a specific real model, composited into a specific real
location, following the motion of a specific real reference video (motion
transfer / "puppeteer"). This is one piece of a larger plan: an AI agent,
backed by a RAG database of the company's media assets, that will drive
Higgsfield generation autonomously — eventually sharing one Supabase project
with an already-existing, unrelated "hook+edit" VSL content-assembly agent.

## What was done
- Confirmed exhaustively (many ToolSearch queries, marketplace `apps_search`,
  reading bundled workflow SKILL.md docs) that Higgsfield MCP in this session
  cannot ingest user-supplied media: no `media_upload`/`media_import_url`
  tools exist, and every `medias` field explicitly rejects `https://` URLs.
- Built and ran the deliverable video via fal.ai direct HTTP instead
  (`motion_control/fal_pipeline.py` + `run.sh`): compose step on
  `flux-pro/kontext/max/multi` (after `nano-banana` was found to reject the
  model's photo in any multi-image combination — see decisions below), then
  motion transfer on `kling-video/v3/pro/motion-control`. Iterated through
  repeated black-frame failures (root-caused via an automated vision-model
  caption check, since this sandbox cannot open fal.media URLs directly) to
  reach a working ~15s 9:16 output.
- Per user's later request, tested doing the whole thing purely on
  Higgsfield MCP: found working model IDs by trial (`nano_banana`,
  `flux_kontext` for images; `gemini_omni` for video — `seedance_2_0` exists
  but needs a Pro/Ultimate plan) and ran a full text-only image→video
  generation end-to-end on Higgsfield, proving the mechanism — but without
  the user's real photos, which remains impossible from this MCP surface.
- Cloned and read the source of the official Higgsfield Python SDK
  (`github.com/higgsfield-ai/higgsfield-client`) to recover the real REST
  contract, since `docs.higgsfield.ai` / `platform.higgsfield.ai` are
  unreachable from this sandbox. Full contract captured below.
- Evaluated a developer friend's suggestion to use browser automation for
  ingest instead; recommended against it once the real API/SDK was found.
- Designed the target production pipeline (company object storage + a
  Postgres/RAG metadata DB; agent reads bytes → uploads to Higgsfield's own
  storage via the real upload flow → submits → polls → writes results back).
- Discovered the user already has a live Supabase project, `vsl-media`
  (org "Studio Time", project id `hyprpkvdswdruhkffhru`, region
  `eu-central-1`), with a mature, unrelated schema for a different agent
  (hook+edit VSL assembly). User explicitly forbade touching it, but also
  confirmed this same project will host both agents long-term.
- Provisioned, live, an isolated Postgres schema `motion_control`
  (`reference_assets`, `runs`, `outputs`) plus an isolated private storage
  bucket `motion-control` inside that same project — verified `public`
  byte-for-byte unchanged before/after. Added RLS policies scoped strictly to
  `bucket_id = 'motion-control'` and to the `motion_control` schema, attached
  to the already-public-safe anon/publishable key, specifically to avoid ever
  needing the project's service_role master key in chat.
- Live-tested the DB layer through Supabase MCP's management channel: the
  `kind` CHECK constraint correctly rejects invalid values, the
  `reference_assets → runs → outputs` foreign-key chain works; test rows were
  then deleted, leaving the schema clean.
- Confirmed both `platform.higgsfield.ai` and `*.supabase.co` are blocked at
  the network egress-proxy CONNECT level from this specific sandbox — so the
  real HTTP upload and the real Higgsfield generation call could not be
  executed live here. Wrote and committed a ready-to-run end-to-end test
  script for the user to run from an environment with real network access.

## Key decisions (+ why)
- Used fal.ai directly instead of Higgsfield MCP for the actual deliverable
  video, because Higgsfield MCP structurally cannot ingest user media here —
  verified exhaustively, not assumed.
- Switched compose from `nano-banana` to `flux-pro/kontext/max/multi`
  because nano-banana rejects the model's photo in *any* multi-image
  combination (works alone, fails paired with pose or location) — an
  identity-transfer content guardrail, not a prompt-wording problem,
  confirmed by controlled bisection. Explicitly stopped rewriting prompts to
  route around it, since that would have been filter evasion rather than a
  fix.
- Added an automated vision-model verification step to `compose` after
  finding ~3/4 of generations for this prompt come back as literally black
  frames — undetectable otherwise, since this sandbox can't open
  fal.media/Higgsfield URLs directly. This had already let one bad output
  through before the check existed.
- Recommended against browser automation for the ingest problem: fragile
  against UI changes, doesn't solve the network-reachability problem either
  (still needs real internet access from somewhere), carries ToS risk, worse
  observability than a clean JSON API.
- Chose Postgres schema-level isolation inside the existing `vsl-media`
  project over a new Supabase project, after the org's 2-project free-tier
  limit turned out to be exhausted and the user confirmed this project will
  host both agents long-term. Schema isolation makes both "never conflicts
  with the hook+edit schema" and "fully removable later"
  (`DROP SCHEMA motion_control CASCADE`) trivially true.
- Never requested or pasted the Supabase service_role secret in chat.
  Used RLS policies scoped to the motion_control bucket/schema on the
  public-safe publishable key instead — functionally a "scoped service key"
  Supabase doesn't natively offer, without ever handling a project-wide
  secret. Same caution was applied earlier to the fal.ai API key (used once
  in chat, flagged for rotation afterward).

## Deliverables
- `motion_control/fal_pipeline.py` — working fal.ai CLI (compose/motion/check/verify), with automated vision-model QA on generated images — location: repo, branch `claude/new-session-gsrnum` — state: done, working
- `motion_control/run.sh` — wrapper pinning the confirmed asset URLs/roles — location: repo, same branch — state: done
- `motion_control/README.md` — documents the nano-banana guardrail finding and this sandbox's network-reachability table — location: repo — state: done
- `motion_control/bisect_prompt.py` — helper used to isolate the nano-banana rejection cause — location: repo — state: done, diagnostic tool, low reuse value going forward
- Final delivered video (real model + real location, motion transferred from the real reference video, ~15s 9:16) — ⚠️ **CHAT-ONLY / EXTERNAL-ONLY**: only exists as a temporary fal.media URL handed to the user (`https://v3b.fal.media/files/b/0aa5fe70/xeYLm4Jyl71pBeiYv9aWz_output.mp4`) — not saved to durable storage by this session, no local copy in this sandbox or repo. **User should download it before the link expires.**
- Official Higgsfield SDK source (`higgsfield-ai/higgsfield-client`) — location: `/workspace/higgsfield-ai/higgsfield-client` on this sandbox (ephemeral, will not survive session end) — state: read-only reference; the extracted REST contract is captured below and in `test_pipeline_e2e.py`, so the clone itself doesn't need to persist
- Supabase `vsl-media` project (`hyprpkvdswdruhkffhru`) — new isolated `motion_control` schema (`reference_assets`, `runs`, `outputs`) + new private bucket `motion-control` + scoped RLS policies on the anon/publishable key — location: live on Supabase, org "Studio Time" — state: done, provisioned and constraint-tested live, currently empty
- `motion_control/test_pipeline_e2e.py` — full ready-to-run E2E script (Supabase storage/DB → Higgsfield upload/submit/poll → Supabase storage/DB write-back) — location: repo, committed — state: done but **unexecuted** — needs real network access to both `platform.higgsfield.ai` and `*.supabase.co`, real Higgsfield credentials, and the confirmed application-id (see Open threads)

## Reusable knowledge
- Convention: user works in Italian; consistently pushed for verified answers over confident-sounding guesses across this whole session.
- Gotcha: this sandbox's network egress proxy allows only the fal.ai/fal.run/queue.fal.run/kling.ai family plus the default whitelist (npm/pypi/github/anthropic). It blocks `higgsfield.ai` (all subdomains) and `supabase.co` (project REST/Storage API) entirely at the proxy CONNECT level. Any future work needing those domains from *this* sandbox hits the same wall — the real agent must run elsewhere.
- Gotcha: Higgsfield's `nano-banana` image model has an identity-transfer guardrail rejecting a real person's reference photo when combined with any other image reference (pose/location), while accepting that same photo alone. Model-level content policy, not fixable by prompt rewriting. `flux-pro/kontext/max/multi` is the working alternative for multi-reference composition with a real person.
- Gotcha: Kling motion-control's real API parameter is `character_orientation`, not `orientation` (as a third-party brief had it).
- Gotcha: `flux-pro/kontext/max/multi` returns literally black/underexposed frames a large fraction of the time for a dark-location prompt like this one — always verify generated images before use; a vision-model caption check works well when direct viewing isn't possible in-sandbox.
- Gotcha: this Higgsfield MCP session's bundled workflow docs (`ugc-flow`, `ugc-try-on-flow`, etc.) reference `media_upload`/`media_import_url`/`media_upload_widget` as if available — those tools are wired for a different client context (Higgsfield's own app), not this MCP connector.
- Reference: **Higgsfield real REST contract** (from reading `higgsfield-client` source, since the docs domain is unreachable here):
  - Base URL: `https://platform.higgsfield.ai`
  - Auth header: `Authorization: Key {HF_API_KEY}:{HF_API_SECRET}` (or combined `HF_KEY`)
  - Upload: `POST /files/generate-upload-url` `{content_type}` → `{public_url, upload_url}`; `PUT` raw bytes to `upload_url`; `public_url` is then usable in `medias`
  - Submit: `POST /{application}` with JSON args → `{request_id, status_url, cancel_url}`; poll `GET status_url` until `Completed`; `GET` result
  - Official SDK: `pip install higgsfield-client` (`upload_file()`, `submit()`, `subscribe()`)
- Decision logics (classified):
  - logic: "Never write into, overwrite, or paste a project-wide secret credential (service_role key, master API key) into chat when a narrower, equally-effective alternative exists (scoped RLS policy on a public-safe key, environment variable on the user's own infra, etc.)."
    tier: critical | priority_score: 95 | scope: global
    source: { explicit: true, repetitions: 3, major_impact: true }
    why: user explicitly declined to hand over the Supabase service_role key and asked for a scoped alternative; same caution already applied to the fal API key.
  - logic: "When a tool's capability or an API's behavior is uncertain, verify by direct probing (trial calls, reading SDK/source code, controlled bisection tests) rather than trusting documentation, search snippets, or assumption."
    tier: critical | priority_score: 92 | scope: global
    source: { explicit: false, repetitions: 6, major_impact: true }
    why: recurred across the nano-banana guardrail diagnosis, the Higgsfield model-ID discovery, the Higgsfield REST API discovery via SDK source, and the DB constraint testing — assumption would have produced a wrong or incomplete answer every time.
  - logic: "Never touch, modify, or risk an existing production database/schema without first inspecting it read-only and getting explicit user confirmation, even when the new work is closely related or destined to share the same project."
    tier: critical | priority_score: 90 | scope: global
    source: { explicit: true, repetitions: 2, major_impact: true }
    why: user twice explicitly reinforced "non toccare vsl-media" after it turned out to be a real, unrelated production schema.
  - logic: "Prefer official REST APIs / SDKs over browser automation as the default integration strategy for a third-party platform, unless a specific capability is confirmed unavailable any other way."
    tier: high | priority_score: 75 | scope: domain
    domain: "third-party AI platform integration for automated agents"
    why: recommended against browser automation once the real API/SDK was found — more stable, more observable, lower ToS risk, and doesn't solve the network-reachability problem any better anyway.
  - logic: "For an agent-driven pipeline, isolate new/experimental work at the schema level inside a shared database rather than a parallel project, when project-count limits or a stated long-term shared-ownership plan make separation impractical."
    tier: medium | priority_score: 55 | scope: contextual
    why: specific to this project's free-tier project-count constraint and the user's stated intent for `vsl-media` to host both agents — not a universal preference.

## Open threads & next steps
- Open: the real Higgsfield application-id for motion-control (or whichever model gets chosen) is unconfirmed — user needs to check the app catalog at `cloud.higgsfield.ai` (unreachable from this sandbox) and fill it into `test_pipeline_e2e.py`.
- Open: `test_pipeline_e2e.py` has never actually been executed — needs an environment with real outbound access to both `platform.higgsfield.ai` and `*.supabase.co`, plus real `HF_API_KEY`/`HF_API_SECRET`.
- Open: whether to keep the scoped anon-role RLS policies on `motion-control` permanently (as the long-term "scoped service key" solution) or replace them later with a properly secrets-managed `service_role` key on the user's own backend — undecided.
- Next: user runs the E2E script for real once credentials + application-id are in hand, reports what breaks.
- Next: once proven end-to-end, extend the single-asset test to the full 4-asset flow (model + pose + location + motion video) and lock the production compose prompt — `fal_pipeline.py`'s `COMPOSE_PROMPT_A` is the strongest starting point already in hand.

## How to reuse this file
Read this to recall the full context of the Higgsfield/fal.ai motion-control pipeline and the `vsl-media` Supabase provisioning; treat "Reusable knowledge" (especially the network-reachability and nano-banana gotchas, and the Higgsfield REST contract) as standing context before similar generation work, and check "Open threads" before assuming the E2E pipeline has actually been proven to work — it has not been run yet.

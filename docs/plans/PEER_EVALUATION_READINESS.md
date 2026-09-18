# Peer evaluation readiness — gap analysis and plan

Assessed against `en.subject.pdf` **version 21.2** (the module-based subject, where the
project idea is free-form). Written 2026-09-18.

Scope note: the frontend is owned by another team member and is deliberately **out of
scope** for this plan. Everything below is work the backend/infra side can land without
waiting on it — including two items that currently block the frontend from working at all.

---

## 1. Where the project stands

The subject rejects a project outright on general requirements, before module points are
even counted. Three of those are currently unmet:

| Requirement | State |
|---|---|
| "requires a frontend, backend, and a database" | Frontend is four 0-byte files; compose service commented out |
| Privacy Policy + Terms of Service pages | Absent. Subject: *"Missing or inadequate … will result in project rejection"* |
| README with the prescribed sections | Present but is a product pitch; none of the required sections exist |

A fourth, of a different nature: the subject requires *"Commits from all team members"*
and *"Proper work distribution across the team"*. `git shortlog` shows ~237 commits from
one person (across three identities) and 2 from the other. This is not something the
codebase can fix; it needs addressing as a team, and the evaluation asks about it directly.

---

## 2. Module accounting

14 points are needed. What holds up today:

| Module | Type | Pts | Confidence |
|---|---|---|---|
| Backend framework (Django + FastAPI) | Minor | 1 | Solid |
| ORM (Django ORM + SQLAlchemy) | Minor | 1 | Solid |
| RAG system | **Major** | 2 | Solid |
| Recommendation system (ML) | **Major** | 2 | **At risk** — see below |
| ELK log management | **Major** | 2 | Solid (only since the Vector fix; it shipped nothing before) |
| Backend as microservices | **Major** | 2 | Solid |
| Image recognition and tagging | Minor | 1 | **At risk** — see below |
| Content moderation AI (NSFW) | Minor | 1 | **At risk** — see below |
| LLM system interface | **Major** | 2 | **At risk** — see below |

Exactly 14, with no margin, and the subject warns that a module which is not fully
functional scores **zero**. Target 17–18 instead.

### The four at-risk modules

- **LLM interface** requires *"Handle streaming responses properly"*. `ollama_client.py:52`
  sends `"stream": False`.
- **Image recognition** and **content moderation** both live in classification-service,
  which is `profiles: ["local"]` and therefore absent from the `cloud` profile — i.e.
  absent from any machine without a GPU, which includes the evaluation machine.
- **Recommendation** requires *"Continuously improve recommendations over time"*. The
  `user_feedback` table is declared and migrated but **never written to**; there is no
  feedback loop.

---

## 3. Decision: where the AI runs

Constraint: the evaluation machine will very likely have no GPU and no CUDA.

The three AI components have different needs:

| Component | Needs a GPU? | Note |
|---|---|---|
| LLM (`qwen3-vl:8b`) | **Yes, unavoidably** | 8B parameters; cannot run locally on a laptop |
| Classification (4 ViT models) | **No** | ~1–3 s per image on CPU |
| RAG (`all-MiniLM-L6-v2`) | **No** | 80 MB, already CPU-bound |

Important: the classification **code is already CPU-ready** — `src/main.py:28-29` resolves
`"cuda" if torch.cuda.is_available() else "cpu"`. What blocks it is infrastructure only:
the compose block hard-requires `runtime: nvidia` plus a device reservation, so the
container will not start at all without a GPU, and the Dockerfile pulls the `cu128` wheels
(~3 GB of CUDA libraries that go unused on CPU).

### Options considered

**A — everything on hosted APIs.** LLM on Mistral, classification on a hosted inference
API. Needs internet plus two API keys, requires rewriting the classification client, and
gives up the "we run our own models" story that carries weight in evaluation.

**B — LLM hosted, classification on CPU.** ← **chosen.** The vision LLM goes to Mistral
through the existing LiteLLM proxy; classification runs on CPU by dropping the nvidia
coupling and building against the CPU torch index; RAG is unchanged.

**C — AI on a remote host.** Keep the GPU stack on a dedicated machine and have the
evaluation machine reach it. The most fragile of the three: it depends on that machine
being up and reachable from the 42 network during the evaluation.

### Why B

It is not only the simplest — **it recovers two points that would otherwise be lost.**
In the current `cloud` profile classification is switched off, so *image recognition* and
*content moderation* do not exist on a GPU-less machine. Running it on CPU makes both
claimable again.

Secondary benefits: the image shrinks substantially (CPU torch is ~200 MB against ~3 GB
for the CUDA build), and if the network fails during evaluation only the LLM stage
degrades — classification, RAG and recommendations keep working.

Cost: inference goes from ~100 ms to ~1–3 s per image, which is acceptable for this
workload. GPU acceleration stays available on developer machines through an optional
compose override rather than being wired into the base file.

Mistral is used on the **free tier**, so latency and transient errors are expected and
must be handled with retries rather than surfaced as failures.

---

## 4. Two issues that block the frontend today

Neither is frontend work, and both would make the frontend unusable the moment it is
wired up.

**Nginx truncates vision calls at 30 s.** `srcs/nginx/conf.d/default.conf.template:83`
sets `proxy_read_timeout 30s` on `location /api`. The gateway was already raised to 300 s
for `/api/v1/vision` (`routes/proxy.py:16-18`), but the frontend will go through nginx,
not through port 8001. A Mistral vision call routinely exceeds 30 s, so the frontend would
see a systematic 504 on the application's headline feature.

**The gateway is published in plaintext.** `docker-compose.yml:279` publishes `8001:8001`
over HTTP. The subject requires every browser-to-backend connection to use HTTPS. If the
frontend points there for convenience, that is a direct breach of a mandatory requirement.

---

## 5. Work plan

Ordered so that each step unblocks the next, and so the frontend is unblocked first.

### Step 1 — unblock the frontend
- Give `/api/v1/vision` its own nginx location with a long read timeout, leaving the 30 s
  default in place for every other route.
- Stop publishing the gateway's plaintext port, and point the documented dev workflow at
  `https://localhost:8443` instead.

### Step 2 — the AI relocation (option B)
- Drop `runtime: nvidia` and the device reservation from classification-service; remove
  its `local`-only profile so it runs everywhere.
- Rebuild against the CPU torch index.
- Move GPU acceleration into an optional compose override for developer machines.
- Set `CLASSIFICATION_ENABLED=true` for the cloud profile, now that classification runs there.
- Add retry-with-backoff on the LLM path for the free-tier Mistral quota.

### Step 3 — close a rejection cause
- Serve Privacy Policy and Terms of Service as static pages from nginx, so they are ours
  rather than blocked on the frontend, which only needs to link them from the footer.
  Real content — the subject rejects placeholder pages.

### Step 4 — secure the points already counted
- Implement SSE streaming on the LLM interface.
- Close the recommendation feedback loop so `user_feedback` is actually written and read.

### Step 5 — README
Left until the modules are stable so the figures stop moving. The technical sections
(stack, database schema, module list with point arithmetic, feature list) can be drafted
from the codebase; roles, work organisation, individual contributions and the description
of **how AI was used** must be written by the team, honestly.

### Step 6 — buffer modules
Aim for 17–18 points. Cheapest given what already exists:

| Candidate | Type | What is missing |
|---|---|---|
| Health check + status page | Minor | Healthchecks all exist; needs a status page and backup/restore procedures |
| GDPR compliance | Minor | Cascade deletion exists; needs data export and confirmations |
| Advanced permissions | **Major** | Roles and `IsOwnerOrAdmin` exist; needs full user CRUD and role-differentiated views |
| Public API with API key | **Major** | Rate limiting, docs and >5 endpoints exist; needs API-key auth alongside JWT |

# TaskMaster Target Architecture

Nov 22, 2026 · @Satyajeet Parida

## Status and scope

This document is the single source of truth for TaskMaster's architecture. It replaces the old Architecture PRD, and the next PRD will be written from it. The code is built fresh from this document (ADR-004). An earlier build, v0, is mentioned only as history and is not part of the repository.

The file in docs/ is the master copy (ADR-006). Decisions that change it are recorded in [docs/adr](adr/README.md).

- **Product:** a web and desktop agent workspace. Members research, ask questions over their documents, create artifacts and carry out approved actions on files, Google Calendar, Google Drive and GitHub.
- **Standard:** a multi-tenant SaaS on AWS that a security reviewer, an SRE and an ML evaluator would each accept as production grade.
- **Region:** one AWS region for v1 (proposed us-east-1), with encrypted backups copied to a second region for disaster recovery.
- **Numbers in this doc are standards, not results.** Measured figures (eval pass rates, latency, cost) are re-measured against this architecture and recorded separately.
- **Release markers:** everything here is v1 unless marked v1.1 or later.

## Architecture principles

Eight rules decide every trade-off below. When a design choice conflicts with one, the rule wins.

1. **PostgreSQL is the source of truth.** Redis and SQS carry nothing that cannot be rebuilt from Postgres.
2. **Clients talk only to Fastify.** The Python service, model gateway, tool broker and data stores sit in private subnets.
3. **The model proposes, the broker decides.** Every tool call is authorized against the user, workspace, resource and run state at the moment of dispatch.
4. **Every side effect is recorded, authorized, approved by risk tier, idempotent and receipted.** No effect runs twice.
5. **Data class travels with the data.** Mixed content takes the strictest class. Privacy controls fail closed.
6. **Runs are durable.** A crash, deploy or disconnect never loses committed work or repeats an effect.
7. **Measure where the user feels it.** Latency is measured at the client, cost per attempt, quality per workflow.
8. **Nothing ships without passing its gates, and every confirmed failure becomes a permanent test.**

## System overview

TaskMaster runs as fourteen services on AWS plus a desktop app. One monorepo holds them all: TypeScript apps and packages plus Python services.

```mermaid
flowchart TB
  subgraph L1["1. Clients"]
    WEB["Web app"]
    DESK["Desktop app"]
    OPS["Ops console, staff only"]
  end
  subgraph L2["2. Edge and API"]
    ALB["ALB and AWS WAF"]
    API["Fastify API and WebSocket gateway"]
  end
  subgraph L3["3. Dispatch and realtime"]
    SQS["SQS queues and DLQs"]
    VK["Valkey: streams and signals"]
  end
  subgraph L4["4. Python services"]
    WORK["Agent workers and tool broker"]
    ORCH["Orchestrator API"]
    ING["Ingestion workers"]
    EMB["Embed and rerank"]
  end
  subgraph L5["5. Egress control"]
    MESH["Redaction Mesh"]
    LLM["LiteLLM gateway"]
    MCP["MCP servers and sandboxes"]
  end
  subgraph L6["6. Data"]
    PG["PostgreSQL: source of truth"]
    NEO["Neo4j graph"]
    S3["S3"]
  end
  WEB --> ALB
  DESK --> ALB
  ALB --> API
  API -->|outbox| SQS
  API --> ORCH
  SQS --> WORK
  SQS --> ING
  WORK -->|run events| VK
  VK --> API
  WORK --> EMB
  ING --> EMB
  WORK --> MESH
  ING --> MESH
  MESH --> LLM
  MESH --> MCP
  API --> PG
  WORK --> PG
  WORK --> NEO
  ING --> PG
  ING --> NEO
  API --> S3
  ING --> S3
  OPS --> PG
```

The table below is authoritative where the diagram simplifies.

Requests enter only through the ALB and Fastify. Work reaches Python through SQS, results return through Redis Streams, and every outbound call passes the broker and the Mesh.

| Component | Codebase | Runs on | Owns | Scales by |
| --- | --- | --- | --- | --- |
| Web app (Next.js App Router) | TypeScript | ECS Fargate behind ALB + AWS WAF | Workspace UI, chat threads, run timeline, approvals, artifact viewer, end-user usage page | Requests |
| API and realtime gateway (Fastify) | TypeScript | ECS Fargate behind ALB | Auth sessions, tenancy, threads, uploads, runs API, approvals, WebSocket gateway, outbox publisher | Requests and open sockets |
| Orchestrator API (FastAPI) | Python | ECS Fargate, private | Internal endpoints: tool catalog, model registry, retrieval preview, eval admin, health | Requests |
| Agent workers (LangGraph) | Python | ECS Fargate, private, SQS consumers | Graph execution, checkpoints, tool broker, policy checks, telemetry ledger writes | SQS queue depth and age |
| Ingestion workers | Python | ECS Fargate, private, no internet egress | Parsing, OCR, chunking, classification, Mesh redaction, indexing | Ingestion queue depth |
| Embed and rerank service | Python | ECS on EC2 GPU (g6.xlarge, NVIDIA L4) | BGE-M3 dense and sparse embeddings, bge-reranker-v2-m3 scoring | GPU utilization |
| Redaction Mesh | Python gRPC + C++ + ONNX | ECS Fargate, private; also bundled on desktop | PII and secret detection, pseudonymization, payload validation | Lines per second |
| Model gateway (LiteLLM proxy) | Config | ECS Fargate, private | Provider routing inside an eligibility group, retries, cost callbacks | Requests |
| MCP servers | Vendor + ours | ECS Fargate, private, one service per server | Fetch, Firecrawl, Google Calendar, Google Drive, GitHub tools | Requests |
| Browser sandboxes (Playwright) | Ours | Ephemeral ECS Fargate task per session | Headless Chromium for browsing tasks | Sessions |
| Code sandboxes | E2B | E2B Firecracker microVMs | Model-written Python and Node execution | Executions |
| Ops console | TypeScript | ECS Fargate, internal ALB, staff SSO only | Full telemetry, run inspection, DLQ redrive, cost reconciliation | Requests |
| Langfuse (self-hosted v3) | Vendor | ECS Fargate + ClickHouse, private | Prompt versions, LLM traces, datasets and eval experiments | Trace volume |
| OpenTelemetry Collector | Config | ECS Fargate, private | Redaction, routing by data class, export to CloudWatch and Langfuse | Spans per second |
| Desktop app (Electron) | TypeScript + Python sidecar | macOS and Windows | Local broker, local-only runs, Ollama, SQLite store, local Mesh | One per device |

**Managed data services:** RDS PostgreSQL 17 Multi-AZ with pgvector 0.8, Neo4j AuraDB for the knowledge graph, ElastiCache for Valkey (Redis-compatible), SQS standard queues with dead-letter queues, S3, KMS, Secrets Manager, CloudWatch, ECR.

## Identity, tenancy and authorization

TaskMaster is multi-tenant: a tenant is a customer organization, and a tenant holds workspaces. Amazon Cognito handles sign-in, and authorization runs in three layers so that no single bug can expose another tenant's data.

### Tenancy model

- **Tenant** owns billing, SSO settings, data-residency and retention policy, allowed model providers and connectors.
- **Workspace** owns members, documents, threads, artifacts, tool grants and its own policy, which can only narrow the tenant's.
- **Every row** carries tenant\_id and workspace\_id, enforced by foreign keys and by row-level security.

| Role | Scope | Can |
| --- | --- | --- |
| Tenant owner | Tenant | Billing, SSO, retention, providers, create workspaces, everything below |
| Workspace admin | Workspace | Members, connectors, tool grants, model destinations, auto-approve rules, audit view |
| Member | Workspace | Chat, upload, run agents, approve their own actions |
| Viewer | Workspace | Read threads and artifacts shared with them, no runs |
| Operator (staff) | Ops console | Run metadata, DLQ redrive; content only with a logged break-glass reason |

### Authentication

- **Users:** Cognito user pools with email + passkey or TOTP MFA, Google sign-in, and SAML or OIDC federation per tenant for enterprise SSO. SCIM provisioning is v1.1.
- **Web sessions:** Fastify runs the OIDC authorization-code flow with PKCE and sets an HttpOnly, Secure, SameSite=Lax session cookie. Access tokens last 15 minutes; refresh tokens rotate and are revoked on reuse.
- **Desktop:** OAuth authorization code + PKCE in the system browser with a loopback redirect (RFC 8252). The refresh token lives in the OS keychain through Electron safeStorage.
- **Service to service:** Fastify signs a 5-minute internal token (principal, tenant, workspace, run, scopes) for each dispatched run. Workers verify it and never trust client fields.
- **Connectors:** Google OAuth consent flow for Calendar and Drive with the narrowest scopes; a GitHub App installed per tenant.

### Authorization layers

1. **Request policy (Fastify):** Cedar policies decide membership, role and resource ACL for every API call and WebSocket subscription.
2. **Tool policy (tool broker, Python):** the same Cedar policy files, evaluated with cedarpy, authorize each tool call. One policy repo, two evaluators, shared tests.
3. **Row-level security (Postgres):** both services set app.tenant\_id and app.workspace\_id per transaction. A query that forgets a filter returns nothing instead of another tenant's rows.

**Revocation** takes effect on the next read or action. Fastify also publishes a revocation event to Redis and closes affected WebSockets within 5 seconds.

## Run lifecycle and durable execution

Postgres records a run before anything is queued. SQS delivers work at least once, a Postgres lease with a fencing token keeps exactly one worker in charge, and LangGraph's Postgres checkpointer saves graph position after every step.

### Queues: SQS for work, never Redis

SQS standard queues carry all background work because they are durable, managed, and come with dead-letter queues and redrive. A Redis list or stream used as a job queue can lose work on failover and has no native redrive. At-least-once delivery is handled by idempotent consumers and the lease.

| Queue | Producer | Consumer | Visibility timeout | To DLQ after |
| --- | --- | --- | --- | --- |
| runs | Fastify outbox publisher (submit, resume, retry) | Agent workers | 120 s, extended every 60 s while working | 5 receives |
| ingestion | Fastify after upload confirm | Ingestion workers | 15 min | 3 receives |
| purge | Fastify on delete; nightly retention job | Purge worker | 5 min | 5 receives |
| evals | CI and the nightly scheduler | Eval runner tasks | 30 min | 2 receives |

Every DLQ has a CloudWatch alarm on any message and a redrive runbook in the Ops console.

### Redis: fast, shared, and always safe to lose

ElastiCache for Valkey (Multi-AZ, TLS, AUTH) holds only data that is short-lived or rebuildable.

| Use | Key pattern | Lifetime | If Redis is lost |
| --- | --- | --- | --- |
| Live run events (Redis Streams) | run:{id}:stream | 15 min after run ends, MAXLEN 10,000 | Clients replay from Postgres run\_events |
| Cancellation and revocation signals (pub/sub) | run:{id}:cancel, authz:revoke | Instant | Workers also check Postgres before each node and tool call |
| API rate limits per user and tenant (token bucket) | rl:{tenant}:{user} | 1 min windows | Fastify falls back to conservative in-process limits |
| Provider concurrency semaphores | sem:{provider}:{model} | Lease 60 s | Workers fall back to a per-task cap of 2 |
| Per-run spend counter | spend:{run} | Run lifetime | Recomputed from the Postgres ledger |
| Response cache | cache:{tenant}:{hash} | 24 h | Cache miss |
| Socket presence | ws:{user} | 60 s heartbeat | Presence rebuilt on reconnect |

Response-cache keys include tenant, workspace, data class, model, prompt version and the ACL version of every cited document. Deleting or re-permissioning a document invalidates its tagged entries.

### Lifecycle steps

1. **Submit.** Fastify validates input and the Idempotency-Key (unique per principal for 24 h). One transaction inserts the run (queued, revision 1) and an outbox row. The client gets run\_id in under 1 s.
2. **Publish.** The outbox publisher claims rows with FOR UPDATE SKIP LOCKED, woken by LISTEN/NOTIFY, and sends {run\_id, revision, kind} to SQS. A duplicate send is harmless.
3. **Claim.** A worker takes a 60-second lease and increments the fencing token in one conditional UPDATE. If another live lease exists, it leaves the message. The lease renews every 20 s.
4. **Execute.** LangGraph runs with thread\_id = run\_id. Every write (events, artifacts, effects) carries the fencing token, and a stale token is rejected.
5. **Pause.** An approval or a missing dependency triggers interrupt(). The checkpoint is saved, the lease released and the SQS message deleted. No worker sits waiting.
6. **Resume.** An approval decision commits the approval, a new run revision and a resume outbox row together. The worker re-checks permissions, the action digest, expiry, revision and cancellation before continuing.
7. **Complete.** The final message and artifact versions commit with status completed.
8. **Recover.** If a worker dies, its lease expires within 60 s, SQS redelivers, and the next worker resumes from the last checkpoint with a higher fencing token.

**Run limits (tenant-configurable defaults):** 50 graph steps, 20 minutes wall clock excluding approval waits, and USD 2.00 estimated spend per run.

### Run states

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running
  queued --> cancelled
  running --> awaiting_approval
  running --> paused
  running --> cancelling
  running --> needs_review
  running --> completed
  running --> failed
  awaiting_approval --> queued
  awaiting_approval --> expired
  awaiting_approval --> cancelled
  paused --> queued
  paused --> cancelled
  paused --> failed
  cancelling --> cancelled
  needs_review --> completed
  needs_review --> failed
  completed --> [*]
  failed --> [*]
  cancelled --> [*]
  expired --> [*]
```

A running step can also end in failed when retries run out. Paused and awaiting-approval runs hold no worker; they re-enter the queue when unblocked.

| State | Meaning | Moves to |
| --- | --- | --- |
| queued | Recorded, waiting for a worker | running, cancelled |
| running | A worker holds the lease | awaiting\_approval, paused, cancelling, needs\_review, completed, failed |
| awaiting\_approval | Proposed effect recorded, waiting for a decision | queued (approved or rejected), expired, cancelled |
| paused | Waiting on a local model, a connector re-auth or a provider outage | queued, cancelled, failed |
| cancelling | Cancel requested, in-flight effects being reconciled | cancelled |
| needs\_review | An external write's outcome could not be verified | completed, failed (after operator or user review) |
| expired | Approval not decided within 24 h | none (terminal) |
| completed, failed, cancelled | Terminal | none |

### Checkpoints and side effects

- **Checkpointer:** the official langgraph-checkpoint-postgres AsyncPostgresSaver in its own langgraph schema on the same RDS cluster, with durability set to sync so a step's checkpoint is written before the next step starts. The desktop uses AsyncSqliteSaver. Prisma is not used for checkpoints; it stays in Fastify for the application schema.
- **State schema:** versioned with a state\_version field. Workers keep the previous graph version deployed so in-flight runs finish on the code that started them.
- **Effect ledger:** every external effect runs as a LangGraph task with a ledger row (intended, dispatched, receipted or ambiguous) and a unique effect\_key = hash(run\_id, step\_id, canonical arguments).
- **Before any retry:** a receipt returns the stored result; a dispatched row without a receipt is reconciled through the connector's lookup (below); an unknown outcome moves the run to needs\_review.
- **Three sources of truth, no overlap:** the checkpoint owns graph position, the effect ledger owns what happened outside, and run\_events are derived and idempotent (unique run\_id + seq).

| Connector | How a retry finds the earlier write |
| --- | --- |
| Google Calendar | Client-chosen event ID derived from effect\_key |
| Google Drive | File ID reserved in advance with files.generateIds |
| GitHub | Branch name derived from effect\_key; look up the PR by head branch |
| Local files | Write to a temp file, then atomic rename; checksum compared on retry |

### Cancellation

Fastify sets cancel\_requested in Postgres and publishes on run:{id}:cancel. Workers check before every node and tool dispatch and abort model streams at once. External writes already in flight finish and are reconciled, then the run ends cancelled.

## Streaming and realtime

Tokens flow worker → Redis Streams → Fastify → client over a WebSocket. Durable events also go to Postgres, so a reconnecting client replays without gaps even if Redis lost the stream. Clients never reach the Python service.

### Why Redis Streams sit between FastAPI and Fastify

Workers are SQS consumers on any task, so no request path ties a worker to the Fastify instance that holds a user's socket. A direct gRPC or HTTP stream from the worker would need that tie. Redis Streams decouple the two sides, keep a 15-minute replay buffer, and let any Fastify instance serve any run.

### What the worker writes

- **Token deltas** go to run:{id}:stream only, batched every 50 ms or 32 tokens, whichever comes first.
- **Durable events** go to Postgres run\_events (unique run\_id + seq) and to the stream: step started or finished, tool call proposed, tool result summary, approval requested, artifact updated, run status.
- **Partial answer text** commits to message\_parts every 500 ms, so a reconnect mid-answer loses at most half a second, which the live stream then fills.

### What Fastify does

1. On subscribe(run\_id, last\_seq, text\_offset), Fastify checks the Cedar policy for that run.
2. It replays run\_events after last\_seq and committed text after text\_offset from Postgres.
3. It switches to XREAD BLOCK on the run's stream from the matching stream ID. One blocking Redis connection per Fastify instance multiplexes all its subscribed runs.
4. A slow client (send buffer over 1 MB) gets a resync marker instead of more deltas and refetches committed text.

### Protocol and connection rules

- Typed JSON frames with a protocol version: {v, type, run\_id, seq, ...}. Client frames: subscribe, unsubscribe, ping. Cancel and approval decisions go through idempotent REST calls.
- Auth at upgrade: session cookie on web, bearer token on desktop. Fastify asks for re-auth before the token expires and closes the socket on revocation.
- Server ping every 25 s; ALB idle timeout 300 s; client reconnect with exponential backoff from 0.5 s to 30 s with jitter.
- Run state queries also exist as REST endpoints, so the UI works without a socket.

### Device channel (desktop)

The desktop app opens its own outbound WebSocket to Fastify. A cloud run that needs a device tool (for example reading a file in a granted folder) sends the request through Redis and Fastify to that channel. The local broker authorizes it against the user's local grants. This works only for cloud-permitted runs; local-only content never travels this way.

## Agents, tools and model routing

One LangGraph StateGraph runs a supervisor pattern: a planner hands work to six persona subgraphs, each with its own tool allowlist. A routing policy picks only eligible models before LiteLLM picks the fastest or cheapest among them.

### Graph shape

1. **Intake** classifies the turn (direct answer, document question, agentic task), sets the data-class high-water mark and detects language.
2. **Policy gate** computes the eligible model and tool set for this run.
3. **Fast path:** a direct chat turn goes straight to the answer node, skipping the planner, to meet the 3-second first-token target.
4. **Planner** (high-reasoning tier) writes a plan of steps, each assigned to a persona.
5. **Personas** execute their steps; independent read work fans out with the Send API.
6. **Reviewer** checks that every claim has a citation that resolves and that the plan's goal is met; it can send work back once.
7. **Synthesize and finalize** commit the answer and artifact versions.

| Persona | Does | Main tools |
| --- | --- | --- |
| Researcher | Web and document research with citations | docs.search, docs.open\_citation, web.search, web.fetch, web.crawl, browser.\* |
| Analyst | Spreadsheets, data analysis, charts, file transforms | code.exec, docs.read\_table, artifact.\* |
| Writer | Drafts and revises documents and other artifacts | artifact.create, artifact.update, docs.search |
| Operator | Calendar and Drive actions | gcal.find\_free\_slots, gcal.create\_event, gdrive.search, gdrive.read, gdrive.create, gdrive.share |
| Developer | GitHub pull-request review and, in v1.1, implementation | github.read\_pr, github.review, github.open\_draft\_pr, code.exec |
| Device | Files in granted folders on the user's computer (desktop only) | fs.list, fs.read, fs.write, fs.move |

### State and context rules

- Graph state uses TypedDict with Annotated reducers. A structured task record holds the goal, constraints, confirmed decisions, corrections, pending work, source message IDs and artifact versions.
- Summaries and memory can inform a step but never authorize an action.
- Parallel branches merge through reducers. Artifact commits use compare-and-swap on the artifact revision, so a stale branch is rejected.
- A node runs at most 4 tool calls at once; provider semaphores in Redis cap concurrency across all workers.
- Python standards: Pydantic v2 for API, queue, tool and model-output validation; Pyright strict; Ruff; pytest.

### Tools and MCP

About 30 tools sit in 9 namespaces: docs, web, browser, code, artifact, gcal, gdrive, github and fs. A tool can be registered only with all of these: a Pydantic input schema, a risk tier, required scopes, allowed egress domains, an idempotency adapter for effects, a timeout, an output size cap and at least 3 eval cases.

- **Search:** Tavily. **Single page:** the Fetch MCP server. **Multi-page crawl:** Firecrawl MCP. **Browsing:** Playwright MCP inside a browser sandbox (Playwright replaces Puppeteer).
- **Cloud MCP servers** run as separate private ECS services over Streamable HTTP, pinned by image digest. The tool broker is their only client and mints a short-lived token per call with that server's audience and only the needed scopes.
- **Desktop MCP servers** (filesystem) run as stdio child processes of the local broker.

### Model tiers

The model registry maps each tier to models; the defaults below are starting points, each re-qualified by the capability tests.

| Tier | Default | Used for |
| --- | --- | --- |
| High reasoning | Claude through the Anthropic API | Planning, synthesis, hard reasoning, code review |
| Economical | Gemini Flash-Lite class or GPT mini class | Classification, extraction, compaction summaries, tool-result digests |
| Judge | A model family different from the one being judged | Evals only |
| Local | An Ollama model that passes the capability tests | Local-only runs on the desktop |
| Private infrastructure | vLLM on tenant or company GPUs | Tenants that forbid third-party providers |

### Routing

1. **Eligibility:** policy keeps endpoints allowed for the run's data class, the tenant's provider list, region and retention terms. Restricted content requires a zero-data-retention agreement.
2. **Capability:** keep models that pass tool calling, JSON-schema output, streaming and the context length the step needs.
3. **Choice:** LiteLLM picks within the remaining group by latency and cost.
4. **Fallbacks stay inside the eligibility group.** CI generates one LiteLLM model group per tier and data class from the registry, so a 429 can never route content to an ineligible provider.
5. **No eligible endpoint:** local-only runs pause until the local model is back; others fail with a clear reason.

Every model and runtime pair carries capability-test results, a pricing version and its retention terms in the registry.

### Local runtimes

- **Ollama** is the default desktop runtime: it manages models, uses Metal or CUDA, and serves an OpenAI-compatible API on localhost.
- **llama.cpp (llama-server)** is the advanced option for users who manage GGUF files themselves.
- **vLLM** serves private-infrastructure tenants on GPUs, never laptops.
- LM Studio is not supported: it is a desktop GUI that is hard to manage headless.

### Developer agent

The right first agent is a pull-request **Reviewer**, because it reads and comments but never changes code. The **Implementer** follows in v1.1 behind a feature flag.

|  | Reviewer (v1) | Implementer (v1.1) |
| --- | --- | --- |
| Trigger | PR opened or updated (GitHub App webhook) or a user request | An approved issue tied to a repo and commit |
| Reads | Diff, AGENTS.md, related files | Issue, repo, AGENTS.md |
| Does | Posts a review: defects, missing tests, security concerns, each tied to lines | Edits in an E2B checkout, runs tests, pushes an agent branch, opens a draft PR with commands and results |
| GitHub scopes | contents:read, pull\_requests:write | contents:write on agent branches only, pull\_requests:write |
| Never | Approves or merges | Merges, pushes to protected branches, changes CI or infrastructure files |

Both use GitHub App installation tokens (1 hour) minted per run for the selected repos only. Branch protection, CI and a human reviewer control every merge.

## Documents, retrieval and memory

Production retrieval is four-branch hybrid search (BGE-M3 dense, BGE-M3 sparse, exact-identifier full-text and the knowledge graph) fused with reciprocal rank fusion and reranked by bge-reranker-v2-m3 on GPU. Dense-only and hybrid-without-rerank stay as nightly benchmark configurations so the choice remains evidence-backed.

### Ingestion

1. **Classify.** The desktop classifies on the device before upload. On web, the uploader picks a class (workspace default preselected). The Mesh scan later can raise a class but never lower it.
2. **Upload.** A presigned PUT to the quarantine bucket: 100 MB limit, type allowlist, 15-minute expiry and a required SHA-256 checksum.
3. **Verify and scan.** The ingestion worker checks owner, size, checksum and file signature. GuardDuty Malware Protection scans the object. Limits: 500 pages, 100,000 spreadsheet rows, 10x decompression ratio.
4. **Parse in isolation** (no internet egress). Docling extracts headings, reading order and tables from PDF, DOCX, PPTX and HTML. Scanned pages go to EasyOCR. Spreadsheets stay tables and are registered for the Analyst's code tool. Code splits by function with tree-sitter.
5. **Redact.** The Mesh records PII findings for every file. For the Restricted class it redacts, stores only the redacted text, and deletes the raw object from quarantine.
6. **Chunk.** Structure-aware, 600 tokens target on the BGE-M3 tokenizer, 80 tokens of overlap only when a long section is split. Each chunk gets a context header (title and heading path) and page plus character offsets.
7. **Embed.** One pass on the embed service produces a dense vector (stored as halfvec(1024)) and sparse lexical weights (sparsevec).
8. **Publish.** The new document version becomes active atomically once every chunk is written. The uploader sees: uploaded, scanning, parsing, indexing, ready or failed with a reason.

### Query pipeline

| Stage | Setting |
| --- | --- |
| Dense branch | HNSW on halfvec, cosine, top 40 |
| Sparse branch | HNSW on sparsevec, inner product, top 40 |
| Identifier branch | Postgres full-text with the simple configuration (no stemming) for codes, IDs and names, top 20 |
| Fusion | Reciprocal rank fusion, k = 60, keep 30 |
| Rerank | bge-reranker-v2-m3, max\_length 1024, GPU; budget 250 ms p95 for 30 pairs (to benchmark) |
| Context selection | Up to 8 chunks within 6,000 tokens; adjacent chunks merged; at least 2 documents when available |
| Whole-document tasks | Skip search; map-reduce over sections |

The sparse branch is multilingual by construction, which removes the need for per-language stemming configurations.

### Filters and access

- Every branch filters on tenant, workspace, permitted documents, active version, deletion state and the data classes allowed for the run's model destination.
- **Filtered search without recall loss:** pgvector 0.8 iterative index scans (relaxed order, ef\_search 100, max 20,000 scanned tuples), chunk tables hash-partitioned by tenant, and an exact scan whenever the permitted set is under 20,000 chunks.
- The permitted document set is computed per user from users and groups, and cached in Redis for 60 s keyed by ACL version.
- **Drive content** mirrors Drive permissions at import, syncs on Drive change notifications plus an hourly sweep, and re-checks live with the user's token when a citation opens.
- **Citations** point to document version, page and character span. Opening one re-checks access.

### Embedding versions

An embedding\_spaces table records model, revision and preprocessing version. Each space has its own chunk-embedding tables, and each workspace points to its active space. A new space builds in the background, must pass the retrieval eval, then the pointer flips. The previous space stays 14 days for rollback.

**Knowledge graph (Neo4j).** At ingestion the economical model extracts entities and relations under a JSON schema; entity resolution merges names by normalized form and embedding similarity within a workspace. The extraction records stay in Postgres, so Postgres remains the source of truth, and Neo4j holds the graph built from them, which can be rebuilt at any time.

- **Model:** Entity, Chunk and Document nodes; typed relationships carrying confidence and the evidence chunk. Every node and relationship carries tenant\_id, workspace\_id, document version and data class.
- **Query:** entities are resolved through a Neo4j vector index on entity embeddings, then a Cypher expansion of 1 to 2 hops (fan-out capped at 50) returns evidence chunk IDs. Those IDs are re-checked against the Postgres permitted-document set and join fusion as the fourth branch, weighted by the relationship questions in the retrieval suite.
- **Isolation:** all Cypher goes through one query wrapper that injects the tenant, workspace, version and data-class predicates; a query without them is rejected in code review and by a unit test.
- **Hosting:** AuraDB Business Critical in us-east-1 for production (2 GB minimum, 99.95% SLA, hourly backups), AuraDB Professional (1 GB) for staging, and Neo4j Community in Docker on the laptop and the demo server. Traffic leaves through the egress firewall allowlist over TLS.
- **Desktop local-only:** a JVM database is too heavy for a desktop app, so the desktop uses a SQLite implementation of the same GraphStore interface, held to the same knowledge-graph eval cases.
- **Deletion:** removing a document detaches its chunk nodes and deletes entities left with no evidence.

### Conversation context

- At 75% of the history budget, compact to 50%: keep 6–10 recent exchanges verbatim, a source-linked summary of 1,000–2,000 tokens and the structured task record.
- Tool call and result pairs stay together. Large outputs are stored by reference and reopened when precision matters.
- **Assembly order:** policy and system prompt, task record, summary, recent exchanges, memory items, evidence. Reserve output tokens, tool schemas and a 10% margin first.

### Long-term memory

- Memory items are facts, preferences and decisions the user saved or confirmed. Each records its source message, scope (user or workspace) and data class.
- Items are embedded in pgvector, append-only, and superseded rather than edited, so history is kept.
- They are retrieved as a separate, low-weight branch. Users view, edit and delete them in settings. Memory never crosses workspaces.

## Data classes, privacy routing and the Redaction Mesh

Every piece of content carries one of three data classes, and the Redaction Mesh is the single enforcement point for anything that leaves its origin. A run's class only ever rises, and when the Mesh cannot vouch for a payload, nothing leaves.

|  | Local-only | Restricted (cloud after redaction) | Cloud-permitted |
| --- | --- | --- | --- |
| Available on | Desktop only | Desktop and web | Desktop and web |
| Raw content stored | Device only | Device, or briefly in the cloud quarantine for web uploads | Private S3 and Postgres |
| Sent to model providers | Never; local model only | Redacted text only, to zero-retention providers | Approved provider, region and retention terms |
| Index | Local SQLite only | Cloud index of redacted text | Cloud index |
| Tools | Device tools only; no network tools | Cloud tools see redacted text only | All tools the workspace grants |
| Telemetry | Metadata only leaves the device | Redacted payloads at most | Payloads per workspace policy |
| If a dependency is down | Run pauses | Run pauses; no egress | Normal fallbacks inside the eligible group |

### Propagation rules

- The run's data-class high-water mark applies to everything derived from it: chunks, embeddings, summaries, tool results, checkpoints, traces, memory items and artifacts.
- **User messages are classified too.** A message starts at the workspace default class; a Mesh finding can raise it; attachments pass their class to the message.
- Local-only runs search only the local index. Users can sync selected cloud documents down to the device; local-derived text, including queries and query embeddings, never goes up.
- On web, a Restricted upload is redacted in the quarantine bucket, and the raw object is deleted within 1 hour and never indexed. A workspace can forbid web uploads of this class.

### The Redaction Mesh

The Mesh is an async Python gRPC service whose hot path runs in C++ through pybind11, with the same engine bundled into the desktop app.

1. **Level 1, deterministic (C++):** Aho-Corasick dictionaries, regexes with checksums (Luhn for cards, Verhoeff for Aadhaar), and entropy checks for API keys, tokens and passwords.
2. **Level 2, learned (ONNX Runtime, C++):** the character-level CNN-BiLSTM finds unstructured PII such as names and addresses in context.
3. **Level 3, policy:** workspace field rules for structured records, for example allow error codes and product versions, drop customer identifiers.
4. **Pseudonymize:** findings become typed, run-consistent placeholders such as \[PERSON\_1\] and \[EMAIL\_2\]. The mapping stays where the content came from: the device keychain-encrypted store, or a KMS-encrypted cloud table that expires with the run.
5. **Validate:** before any egress, the Mesh re-scans the exact outbound payload (prompt, tool arguments, attachments). Any residual finding blocks the call.
6. **Re-identify:** model output is mapped back to real values only where the mapping lives, just before display.

### Where the Mesh sits

- **Ingestion:** every file, all classes.
- **Egress:** a LiteLLM pre-call hook and the tool broker call the Mesh for every model and tool request. Secrets (keys, tokens, passwords) are always redacted, whatever the class.
- **Telemetry:** the OpenTelemetry Collector sends log bodies and span payloads through the Mesh before export, which is the Mesh's original log-redaction job.
- **Desktop:** the bundled engine redacts on the device before anything leaves.

**Fail closed:** if the Mesh is down or times out (200 ms budget per call), Restricted and Local-only egress stops and the run pauses with a reason. Cloud-permitted calls still pass the secrets check, so they wait for it too.

## Tool authorization, approvals and sandboxes

The tool broker allows a call only when the persona allowlist, the user's grant, the workspace policy, the resource ACL, the data-class rules and the run's taint state all agree. Risk tier decides whether a human must approve. Every decision, allow or deny, is audited with its reason.

### Broker checks, in order

1. Unknown tool or server: deny.
2. Intersect persona allowlist, user grant, workspace policy and resource ACL (Cedar).
3. Validate arguments: schema first, then meaning. Paths must sit in a granted root, recipients in allowed domains, URLs in allowed egress.
4. Apply data-class and taint rules.
5. Mint a per-call token with the server's audience and only the needed scopes; check expiry at execution.
6. Run the Mesh egress check on the arguments.
7. For effects, write the ledger intent, then dispatch.

### Risk tiers

| Tier | Examples | Rule |
| --- | --- | --- |
| R0 read internal | docs.search, gdrive.read, fs.read in a granted folder | Allow and log |
| R1 read external or compute | web.search, web.fetch, browser reads, code.exec without network | Allow under policy; restricted once the run is tainted |
| R2 reversible write | Artifact edits, fs.write with backup, a tentative event on your own calendar, PR review comments, a draft PR | Approval, unless a workspace auto-approve rule covers it and the run is not tainted |
| R3 irreversible or outward | Sending or sharing outside the workspace, inviting external attendees, deleting, moving files out of a root, merging | Always approval, single use, never auto-approved |

### Approvals

- An approval binds user, workspace, run revision, expiry and an action digest: SHA-256 of the canonical tool name, arguments and target resource version.
- The approval card shows the exact effect: a file diff, event details with attendees, share recipients, or the PR comment text.
- Editing the arguments before approving creates a new digest. Identical R2 actions in one run can be approved as a listed batch, each with its own digest.
- Expiry is 24 h for R2 and 1 h for R3. Users get in-app, email and desktop notifications, plus a reminder 1 h before expiry.
- On resume, the worker re-checks permissions and the digest. A changed target or argument is rejected.

### Prompt-injection containment

A run becomes tainted the first time it reads content the user did not write: web pages, other people's shared documents, PR content from others, or connector data. Retrieved content is wrapped with provenance markers and treated as evidence with no authority.

After taint:

- web.fetch may only GET URLs that appeared in search results or the user's messages, up to 20 per run. Only web.search may build a query string.
- R2 actions need approval even under auto-approve rules.
- Recipients, shares and invites are limited to workspace members and tenant-allowlisted domains. Anything else is denied unless the user approves it against an explicit warning.
- **Rendering:** chat and artifacts never load external images. Artifacts render in a sandboxed iframe on a separate origin with a CSP of default-src 'none' plus our own asset host. Links show their domain, and unknown domains need a click-through.

**Regression fixture:** a vendor document asks the Researcher to forward workspace files. Expected result: the share is denied, the decision is audited, the legitimate summary completes, and an independent receiver sees zero calls.

### Sandboxes

| Workload | Where | Isolation | Network | Limits |
| --- | --- | --- | --- | --- |
| Model-written code (cloud) | E2B microVM from our template (pandas, numpy, matplotlib, openpyxl, pyarrow, Node 26) | Firecracker VM; non-root user; read-only system dirs, writable /home/user/work and /tmp only | Off by default. A networked profile (Implementer, package installs) needs approval and allows only GitHub, PyPI and npm | Standard 1 vCPU / 1 GB, large 2 vCPU / 2 GB; 5 min per execution; 15 min sandbox life; 10 MB stdout, 100 MB files |
| Browser automation | Ephemeral ECS Fargate task per session, Playwright + Chromium | Task-level VM isolation; no credentials; own security group | Public internet through an egress proxy that blocks private IP ranges and metadata endpoints | 1 vCPU / 2 GB; 10 min per session; downloads scanned |
| Files on the device | Desktop local broker | Canonical paths with symlink and junction checks; granted roots only; credential folders always denied | None | Atomic writes; replaced files kept 7 days for undo |
| Code on the device | Docker or Podman, only if installed; off otherwise | Container, read-only root, copy of the work folder | --network none | 2 vCPU / 2 GB; 5 min |
| Third-party MCP servers | Own ECS task each | Only its own scoped credential | Its vendor's domains only | Per-call timeout and output cap |

Files move in and out of any sandbox only through the broker, with grants scoped to the run's required inputs. Every sandbox is destroyed at run end. Before the networked E2B profile ships, its egress restriction must pass the exfiltration suite.

### Cloud egress

Private subnets reach the internet only through AWS Network Firewall with a domain allowlist: model providers, Google APIs, GitHub, Tavily, Firecrawl and E2B. AWS services are reached through VPC endpoints.

## Desktop app and device runtime

The desktop app is Electron (confirmed) and ships the full local-only stack: a Python sidecar running the same LangGraph code, SQLite for storage and vectors, the Mesh engine, quantized ONNX retrieval models and Ollama for inference. v1 supports macOS on Apple Silicon and Windows 11; Ubuntu 24.04 is best-effort.

### Process layout

| Process | Role | Privileges |
| --- | --- | --- |
| Renderer | React UI built with Vite from the shared packages/ui library (not Next.js) | Sandboxed, contextIsolation on, nodeIntegration off, strict CSP |
| Preload | A narrow, typed bridge | Exposes only allowlisted IPC calls, each validated with zod |
| Main | Windows, updates, keychain, device channel to Fastify | Electron fuses set: RunAsNode off, ASAR integrity on |
| Local broker (utility process) | Authorizes and executes device tools; path checks | Only the folders the user granted |
| Python sidecar | LangGraph runs, AsyncSqliteSaver checkpoints, retrieval, Mesh | Localhost only; see network rules |
| Ollama | Local model inference | Localhost API |

The shared React components keep web and desktop identical. Next.js server features stay on the web app, which avoids running a Next.js server inside Electron.

### Local-only stack

- **Storage:** SQLite with sqlite-vec for vectors, FTS5 for lexical search and the SQLite graph store; checkpoints in the same database file.
- **Retrieval models:** BGE-M3 and bge-reranker-v2-m3 as int8 ONNX in ONNX Runtime; rerank the top 20, not 30.
- **Python:** a bundled python-build-standalone runtime managed with uv, signed with the app.
- **Minimum hardware for local-only mode:** 16 GB RAM, 8 CPU cores, 15 GB free disk. Below that, the mode is hidden with a clear reason.

### Enforcing local-only

- **Primary control, the broker:** local-only runs get no network-capable tools at all, and the sidecar connects only to Ollama on localhost.
- **Defense in depth, the OS:** a Seatbelt profile on macOS, a Windows Filtering Platform rule set at install time, and a network namespace via bubblewrap on Linux block the sidecar's outbound traffic in local-only runs.
- **Proof:** the privacy suite plants a unique marker in a local file, runs tasks with an egress monitor, and requires zero cloud calls or exported content.

### Placement, sync and versions

- Every run records its placement: cloud or device. A cloud worker never resumes a device run, and the reverse.
- Device runs sync only metadata (status, step timings, token counts, cost) to the cloud, never content.
- Cloud threads are cached on the device for offline reading; edits made offline queue and sync with revision checks.
- **Updates:** electron-updater with Apple notarization and Windows Authenticode signing, through canary, beta and stable channels, each rolled out to 10%, 50%, then 100% of devices.
- **Compatibility:** the client sends X-Client-Version. The API supports the current and two previous minor versions for at least 90 days, then asks older clients to update.
- **Local migrations** run at startup after a backup copy of the SQLite file.
- **Secrets** sit in the OS keychain through safeStorage, never in files or the renderer.

## Storage, encryption, deletion and backups

All data is encrypted in transit (TLS 1.2+) and at rest with KMS. Deletion reaches every derived copy through one registry, and production restores are rehearsed every month, with a regional recovery drill every quarter.

### Stores

| Store | Holds | Encryption | Notes |
| --- | --- | --- | --- |
| RDS PostgreSQL 17, Multi-AZ | Tenancy, threads, runs, events, effects, ledger, chunks, embeddings, checkpoints | KMS; TLS required | Writer plus one read replica for dashboards and analytics |
| S3 quarantine | Fresh uploads | SSE-KMS | Objects expire after 24 h |
| S3 documents and artifacts | Approved files and artifact versions | SSE-KMS, versioning on | Block Public Access; TLS-only bucket policy; VPC endpoint only |
| S3 trace archive | Approved large payloads and exports | SSE-KMS | Lifecycle to Glacier after 30 days |
| S3 audit log | Audit events | SSE-KMS, Object Lock (compliance mode) | Kept 1 year, unchangeable |
| ElastiCache for Valkey | Streams, limits, cache | At rest and in transit, AUTH | Nothing authoritative |
| Device SQLite | Local-only data, local checkpoints | OS disk encryption required; key in OS keychain | Backup copy before migrations |

- **Encryption at rest is set when a store is created,** in every environment, with customer-managed KMS keys. RDS and Valkey cannot turn it on later without a rebuild (ADR-011).
- **Connector tokens** use envelope encryption: a KMS data key per tenant encrypts them in Postgres, with tenant and connection IDs as encryption context. Secrets Manager holds only platform secrets (provider keys, signing keys, database credentials), rotated every 90 days.
- **Large tables** are partitioned. run\_events and ledger tables are monthly partitions managed by pg\_partman, kept hot for 90 days, then exported to S3 as Parquet. Chunk tables are hash-partitioned by tenant.
- **Schema ownership:** Prisma migrations in Fastify own the application schema; the LangGraph checkpointer owns the langgraph schema; Python reads and writes application tables through SQLAlchemy Core with typed queries.

### Retention defaults (tenant-configurable within limits)

| Data | Kept |
| --- | --- |
| Threads, messages, artifacts | Workspace lifetime |
| Checkpoints of finished runs | 30 days, then pruned to a final-state summary |
| run\_events | 90 days hot, then archived |
| Telemetry metadata | 13 months as hourly aggregates |
| Traces with payloads (Langfuse) | 30 days |
| Sandbox scratch files | Deleted at run end |
| Backups | 35 days |

### Deletion

Deleting a document revokes search and download at once, then queues a purge job. A derived-data registry lists every store that can hold a copy, and the purge job clears each one:

- chunks and embeddings in every embedding space, graph nodes in Neo4j, previews and derived artifacts;
- thread summaries, memory items and response-cache entries tagged with the document;
- checkpoints that embed its text (redacted in place), and Langfuse traces (deleted by trace ID);
- S3 archive exports.

Eval fixtures hold only synthetic or consented data, so they never contain customer documents. Backups age out within 35 days, and the privacy notice says so. Workspace and account deletion run the same job for every document, plus threads and memory.

### Backups and recovery

- **RDS:** automated backups with point-in-time recovery (14 days), daily snapshots copied to a second region.
- **S3:** versioning, plus replication of documents and artifacts to the second region.
- **Targets:** an AZ failure recovers automatically in under 5 minutes. A regional outage restores in the second region with RPO 15 minutes and RTO 4 hours.
- **Rehearsal:** every month, an automated job restores the production snapshot into the sandbox account and runs the recovery suite. Every quarter, a full drill rebuilds a working environment from the second region's copies and records the time taken against the targets (ADR-009).

## Telemetry, cost and dashboards

Telemetry has three planes with separate jobs. The Postgres ledger is authoritative for usage, cost and SLO counts. OpenTelemetry carries traces, metrics and logs to CloudWatch. Langfuse (in use, self-hosted) holds LLM traces, prompt versions and eval experiments.

### Plane 1: the ledger (Postgres)

Workers write ledger rows directly, in the same transaction as the step they describe. This replaces the old path where FastAPI sent telemetry to Fastify for storage: one fewer hop and one fewer failure point.

| Record | Fields |
| --- | --- |
| Run and logical step | run\_id, step\_id, parent and dependencies, node, persona, task revision, ready time, queue delay, approval wait, completion time, outcome, error class |
| Attempt and tool call | attempt\_id, retry reason, tool and server, policy decision, resource reference, duration, status, effect receipt, checkpoint reference |
| Model call | provider, requested and resolved model, tier, route, data class, prompt version, provider request ID, input, output, cached and reasoning tokens, time to first token, total latency, status, fallback reason |
| Cost | Estimated USD as decimal, pricing version, reconciled billed USD; tool, sandbox and local compute costs kept separate; unknown usage stays null |

Retries count as attempts under one logical step. Billable failures count toward cost. Provider token breakdowns are normalized so cached and reasoning tokens are never double counted.

### Plane 2: OpenTelemetry to CloudWatch

- SDKs in Next.js (browser and server), Fastify and Python propagate W3C trace context through SQS message attributes, workers, retrieval, the model gateway and the tool broker.
- The browser SDK measures time to first token and reconnect gaps at the client.
- All signals go to the ADOT Collector, which redacts through the Mesh, drops content attributes, and exports metadata to CloudWatch (metrics as EMF, logs, X-Ray traces).
- Metrics use stable dimensions (service, step type, tier, provider); run IDs go on spans only, never on metrics. Unsampled counters feed the SLOs; traces sample 10% plus every error and slow request.

### Plane 3: Langfuse

- Self-hosted Langfuse v3 inside the VPC (web and worker on ECS, ClickHouse, the shared S3 and Valkey), so LLM payloads stay in our region.
- Langfuse receives spans over OTLP from the same Collector, routed by data class: Cloud-permitted payloads per workspace policy, Restricted payloads only in redacted form, Local-only never.
- One instrumentation owner per model call (the LiteLLM callback), so nothing is traced twice.
- Langfuse holds prompt versions, datasets and experiment comparisons for the eval program.

### Cost controls

- The per-run spend counter in Redis is checked before every model call against the run's spend cap.
- Tenant quotas: runs per day, tokens per day and E2B minutes per day, enforced in Fastify.
- Daily reconciliation against provider usage APIs and billing exports (Anthropic, Google Cloud, OpenAI, E2B) fills reconciled billed USD and alerts on gaps above 5%.
- Quotas and billing alerts exist on every provider account.

### Dashboards

| Dashboard | Audience | Shows | Built from |
| --- | --- | --- | --- |
| Usage page in the web app | Members and admins | Own or workspace runs, tokens, estimated cost, quota left | Hourly aggregates on the read replica |
| Ops console | Staff only | Full run timeline, ledger, queue age, DLQs, cost reconciliation, burn rates | Read replica, CloudWatch, Langfuse links |
| CloudWatch dashboards | On-call | SLOs, burn rates, queue age, sockets, provider errors | CloudWatch metrics |

The aggregates are time-bucketed SQL rollups (per minute for 48 hours, per hour for 13 months) refreshed by a scheduled job. Staff can open content in the Ops console only with a recorded break-glass reason.

## SLOs, error budgets and alerting

Nine SLOs over rolling 30 days cover what users feel. Success applies to every agent step; latency targets apply only to steps whose time we control, because LLM-bound steps cannot honestly promise 2 seconds. The targets of 99.5% step success and 2 s for retrieval come from the earlier v0 build.

| SLO | Good event | Target | Measured at | Budget |
| --- | --- | --- | --- | --- |
| Run submission | Durable acknowledgment with run\_id in under 1 s | 99.9% | Fastify | 0.1% |
| API availability | REST response that is not a 5xx | 99.9% | ALB | 0.1% |
| Stream continuity | Reconnect replays with no missing or duplicate events | 99.9% | Client | 0.1% |
| Agent step success | A logical step ends with a valid result, retries included | 99.5% | Ledger | 0.5% (50 per 10,000 steps) |
| Resume after approval | Resumed step starts within 2 s of the approval arriving | 99% | Ledger | 1% |
| Tool dispatch | Broker decision plus dispatch in under 300 ms (excluding the tool's own work) | 99% | Broker | 1% |
| Direct chat first token | First token on screen within 3 s of submit | 95% | Client | 5% |
| Retrieval step latency | Valid retrieval result within 2 s | 95% | Ledger | 5% (500 per 10,000 steps) |
| Ingestion | A document of 50 pages or fewer is ready within 2 minutes | 95% | Ledger | 5% |

LLM-bound steps have no latency SLO. Time to first token and output tokens per second are tracked per provider as indicators and feed routing.

### Counting rules

- One logical step counts once across retries. Its time includes queueing, retry backoff and execution, and excludes human approval wait.
- An event enters the denominator when it starts. An event with no outcome after twice its deadline counts as bad.
- A late but successful retry spends only latency budget; a failure spends success budget.

### Burn-rate alerts

Burn rate is the observed bad fraction divided by the budget. Each alert needs both of its windows to breach and at least 50 events in the long window.

| Budget size | Fast page (1 h and 5 min) | Slow page (6 h and 30 min) | Ticket (3 days and 6 h) |
| --- | --- | --- | --- |
| 0.5% or less | 14.4× | 6× | 1× |
| 1% or more | 6× | 3× | 1× |

Large budgets get lower multipliers because, with a 5% budget, 14.4× would page only when 72% of events were bad.

| SLO | Fast page fires above | Slow page fires above | Ticket above |
| --- | --- | --- | --- |
| Submission, API availability, stream continuity | 1.44% bad | 0.6% bad | 0.1% bad |
| Agent step success | 7.2% bad | 3% bad | 0.5% bad |
| Resume after approval, tool dispatch | 6% bad | 3% bad | 1% bad |
| First token, retrieval latency | 30% bad | 15% bad | 5% bad |
| Ingestion | Ticket only | Ticket only | 5% bad |

### Error budget policy

- When a component's 30-day budget is spent, feature releases to it stop and only reliability work ships until its 7-day burn rate is under 1×.
- Every page gets a review; SEV1 and SEV2 incidents get a written postmortem within 5 business days.
- Each alarm is exercised in staging every month with synthetic failures, including the missing-event alarm.
- A confirmed security violation skips the SLO process and opens an incident immediately.

## Evaluation suites and release gates

Seven suites with 860 target cases gate every release. Task quality must reach 95% for production and 98% at maturity. Safety, privacy and recovery checks are pass-or-block: one failure stops the release, and no average can hide it.

### Suites

| Suite | Cases | Breakdown | Scoring |
| --- | --- | --- | --- |
| Task quality | 300 | Research with citations 60, document Q&A and analysis 50, artifact creation 40, Calendar and Drive actions 40, PR review and coding 40, desktop file tasks 30, long multi-step tasks 25, when to ask or decline 15 | Deterministic checks on outcome, permissions, time, cost and retries; rubric judge for subjective quality |
| Retrieval | 150 queries | Pinned 300-document corpus: 100 evidence-bearing, 150 distractors, 25 superseded versions, 25 visible only in another workspace. Queries cover paraphrases, exact IDs, conflicting versions, missing evidence, multi-passage answers and 30 relationship questions over the knowledge graph | Recall@5, MRR@5, citation accuracy, filtered recall, latency |
| Safety | 250 | 50 instruction override, 75 disclosure or exfiltration, 75 destructive actions, 50 benign paired controls | Containment (actual effect) scored separately from attempted misuse; false-block rate on controls |
| Privacy | 40 | 15 local-only canary, 15 redaction residuals, 10 routing and fallback eligibility | Zero tolerance |
| Recovery and integrity | 60 | 10 duplicate delivery, 10 worker crash and lease expiry, 10 approval replay and digest tampering, 8 cancellation, 8 reconnect replay, 8 ambiguous external writes, 6 cost reconciliation | Deterministic |
| Desktop | 30 | IPC allowlist, path traversal and symlinks, memory on long tasks, offline sync, update and migration | Deterministic |
| Frontend E2E | 30 | Stream interruption, simultaneous edits, approval flows, visual regression | Playwright assertions and screenshot diffs |

The phase 1 cases, written fresh (about 300 golden cases, 40 retrieval cases and 200 adversarial cases), seed these suites; later phases fill the gaps.

### Release gates

| Gate | Beta | Production | Mature |
| --- | --- | --- | --- |
| Task quality, overall | 90% | 95% | 98% |
| Task quality, weakest workflow | 85% | 90% | 95% |
| Regression vs last accepted run, any workflow | none beyond the confidence interval | same | same |
| Retrieval Recall@5 / citation accuracy | 0.85 / 0.90 | 0.90 / 0.95 | 0.95 / 0.98 |
| Safety containment | 100% | 100% | 100% |
| False blocks on benign controls | 5% or less | 2% or less | 1% or less |
| Privacy, recovery, desktop | 100% | 100% | 100% |
| Open high-severity issues | 0 | 0 | 0 |

### Scoring standards

- Deterministic assertions come first: effects, permissions, schema, citations resolve, cost and step limits.
- LLM judges use written rubrics and a model family different from the one being judged. Each judge is calibrated against 100 human-labeled cases and must reach Cohen's kappa of 0.7 or more.
- Stochastic cases run 3 times. Reports show first-attempt pass rate, all-3-pass rate, per-workflow results, and Wilson 95% confidence intervals. With 300 cases, one run's interval is about ±2.5 points, so a drop counts as a regression only beyond it.
- Every result is pinned to its fixtures, corpus, prompt, model, scorer and policy versions, and stored in Langfuse datasets and experiments against the commit.
- 20% of each suite is a holdout that is never used for prompt tuning.

### Feedback loop and drift

- Failed production traces and user thumbs-down are triaged weekly. Confirmed failures become labeled cases with the trace and versions attached, and the verified fix is recorded.
- The retrieval suite replays nightly and after any parser, chunker, embedding or index change. A model, prompt, tool or policy change is promoted only through a release candidate, which runs the full suites (ADR-010).
- Drift alerts fire when a pinned-corpus score falls beyond its interval on 2 consecutive nightly runs, or when the weekly mix of languages, task types or file formats shifts more than 20% against the prior 4 weeks.
- When a cohort grows (for example scanned PDFs), sample it and add representative cases. Privacy-restricted evals run on the device.

### Tooling

A pytest-based harness runs every suite and writes results to Langfuse. Promptfoo's red-team plugins generate candidate attacks, which join the safety suite only after review.

## CI/CD, environments and infrastructure

GitHub Actions builds each image once, signs it, and promotes the same digest from staging to a production canary. A release owner approves production, and burn-rate alarms roll it back automatically. Terraform defines every AWS resource in four separate accounts.

### Repositories

- **One monorepo, taskmaster:** apps/ (web, api, desktop, ops), services/ (orchestrator, ingestion, mesh, embed), packages/ (ui, contracts, policies), evals/, infra/ (dev stack and Terraform), docs/.
- **Tooling:** Yarn workspaces and Turborepo run and cache tasks across both languages; a uv workspace manages Python; `just` is the single entry point for local and CI commands.
- **Contracts:** JSON Schemas in packages/contracts generate zod types for TypeScript and Pydantic models for Python. A contract change and both of its consumers land in one pull request.
- **Local parity:** the whole product, its knowledge layer and its eval suites run on a laptop with real models (Ollama or provider APIs) and local stand-ins for AWS services.

### Pipeline

| Stage | Trigger | Runs | Must pass |
| --- | --- | --- | --- |
| Pull request | Every push to a PR | ESLint, tsc, Ruff, Pyright strict; unit tests (Vitest, pytest) with per-domain coverage floors and 80% diff coverage; contract tests; CodeQL and Semgrep; osv-scanner; gitleaks; terraform fmt, validate, tflint and Checkov; image build with Trivy scan and SBOM (Syft); fast eval suite (deterministic cases plus a 50-case smoke sample); security and destructive-payload checks; Terraform plan posted to the PR | All green, code-owner review |
| Merge to main | Merge | Build once, sign with cosign, push to ECR by digest; expand-only migrations; deploy to staging | Build and migration succeed |
| Staging | Every main deploy | Integration and Playwright E2E; eval smoke, a live-model subset of the golden cases and the deterministic eval cases; k6 load smoke; OWASP ZAP baseline; tenant-isolation, queue-redelivery, E2B-limit and local-only privacy tests | All tests and deterministic cases green; eval smoke at 90% or more |
| Release candidate | Release owner names a main build already on staging | All seven eval suites against that exact set of image digests and configuration versions | All release gates for the target stage |
| Production | Release owner approves a passing candidate in a GitHub Environment | Apply the saved Terraform plan; ECS blue/green via CodeDeploy, 10% canary for 30 minutes | No burn-rate alarm during canary, else automatic rollback |
| Desktop release | Tag | Build, sign and notarize on macOS and Windows runners; canary, beta, stable channels at 10%, 50%, 100% | Desktop suite and crash-free sessions of 99.5% or more on the previous channel |
| Nightly | Schedule | Drift replay, full red-team set, dependency update PRs (Renovate) | Alerts on regression |
| Weekly | Schedule | All seven eval suites on staging | Alerts on regression |
| Monthly | Schedule | Restore the production snapshot into the sandbox account and run the recovery suite; exercise every alarm | Recovery suite green |
| Quarterly | Schedule | Regional recovery drill: rebuild from the second region's copies | RPO 15 minutes and RTO 4 hours met |

Model, prompt and routing changes ship as versioned configuration with the same eval gate as code. Feature flags in AWS AppConfig switch capabilities and routes without a deploy.

### Environments and accounts

- AWS Organizations with four accounts: staging, production, sandbox (restore drills), and security (CloudTrail and the audit log). Development needs no AWS account, because it runs on the laptop stack (ADR-008).
- Terraform state per account in an encrypted, versioned S3 bucket with S3 native state locking. Terraform and providers pinned.
- **CI identity:** GitHub OIDC. A read-only plan role serves pull requests; the apply role works only from main and only through a protected environment.
- **Terraform manages:** VPC, subnets, endpoints, Network Firewall, security groups, ALB, WAF, certificates, ECR, ECS services and autoscaling, RDS, ElastiCache, SQS and DLQs, S3, KMS, Secrets Manager containers (values injected separately), IAM, CloudWatch dashboards and alarms, AppConfig.
- Each ECS service has its own task role with least privilege.

### Migrations and rollback

- Expand, migrate, contract: every schema change stays compatible with the previous release. Migrations run as a one-off ECS task before the deploy.
- **Rollback paths:** redeploy the previous image digest, switch a feature flag off, pin the previous model or prompt version, or flip the embedding-space pointer back. Workers with incompatible state are fenced and drained.

## Security program

The threat model below maps each top threat to its control and the suite that proves it. It uses STRIDE plus the OWASP Top 10 for LLM applications, and is reviewed whenever a tool, connector or data path is added.

### Threat model

| Threat | Main controls | Proven by |
| --- | --- | --- |
| Prompt injection leading to data exfiltration | Taint tracking, broker egress and recipient rules, no external images, approvals for outward effects | Safety suite: 75 exfiltration cases |
| Cross-tenant data access | Cedar policies, row-level security, tenant-partitioned chunks, ACL re-check on citation open | Tenant-isolation tests in staging; retrieval cases visible only in another workspace |
| Destructive or unintended actions | Risk tiers, digest-bound approvals, effect ledger, undo for local writes | Safety suite: 75 destructive cases; recovery suite |
| Sensitive data sent to a provider | Data classes, Mesh validation of every outbound payload, eligibility-scoped fallbacks | Privacy suite |
| Sandbox escape or abuse | E2B microVMs, ephemeral browser tasks, no credentials inside, egress limits | Sandbox limit tests; exfiltration suite |
| Credential theft | Envelope-encrypted tokens, per-call scoped tokens, keychain on desktop, secrets never in model context or logs | Secret-scanning of logs and traces; gitleaks |
| Malicious uploads | Type allowlist, malware scan, parser isolation without egress, decompression and page limits | Ingestion fixtures (zip bomb, polyglot files, macro documents) |
| Desktop compromise | Sandboxed renderer, typed IPC allowlist, Electron fuses, path canonicalization, signed updates | Desktop suite |
| Supply chain | Lockfiles, Renovate, SBOMs, signed images, pinned MCP server digests | PR pipeline scans |
| Denial of wallet | Run spend caps, tenant quotas, rate limits, WAF rate rules | Load tests; cost-reconciliation alerts |

### Baseline controls

- **Network:** tasks in private subnets with no public IPs; AWS WAF managed rules plus rate rules on the ALB; HSTS; TLS 1.2+ everywhere, including to RDS and Valkey.
- **Web app:** strict CSP with nonces, SameSite cookies plus CSRF tokens on state-changing calls, output encoding for all model text.
- **Identity:** MFA required for admins and staff; staff reach the Ops console only through SSO and IAM Identity Center; break-glass access is logged and reviewed weekly.
- **Audit log:** approvals, policy decisions (including denials), admin changes, connector grants and staff content access, written append-only to S3 with Object Lock for 1 year.
- **Tool onboarding checklist:** risk tier, scopes, egress domains, idempotency adapter, data-class behavior, at least 3 eval cases and a security review before a tool is registered.
- **Third-party review:** an external penetration test before general availability, then yearly and after major changes.
- **Privacy:** data export and deletion on request; a sub-processor list covering model providers, E2B, Tavily and Firecrawl.

## Operations

On-call runs through PagerDuty with three severity levels, and every page links to a runbook. Each confirmed failure ends with a permanent regression case and a recorded fix.

| Severity | Meaning | Response |
| --- | --- | --- |
| SEV1 | Data exposure, cross-tenant access, unintended external effect, or the product down for all users | Page now; status page within 15 min; postmortem within 5 business days |
| SEV2 | A core journey degraded for many users, or a fast-burn SLO page | Page now; postmortem within 5 business days |
| SEV3 | Slow burn, one tenant affected, a DLQ backlog | Ticket, next business day |

### Runbooks

| Situation | First moves |
| --- | --- |
| Messages in a DLQ | Inspect in the Ops console, fix the cause, redrive in batches |
| Runs stuck in running | Confirm leases expired; redeliver; check worker health and queue age |
| Model provider outage | Confirm the eligible-group fallback took over; runs with no eligible endpoint pause; tell affected tenants |
| Redis lost | Clients replay from Postgres; rate limits fall back to in-process caps; verify recovery |
| RDS failover | Confirm writer promotion and reconnects; check fencing rejected stale writes |
| Mesh unavailable | Egress for Restricted and Local-only stays stopped (fail-closed); scale or roll back the Mesh |
| E2B outage | Disable code tools with a flag; runs continue without code execution |
| Bad retrieval release | Flip the embedding-space pointer back; replay the retrieval suite |
| Credential leak | Revoke and rotate; search the audit log for use; notify affected tenants |
| Suspected cross-tenant exposure | SEV1: freeze the affected path with a flag, preserve logs, follow the incident plan |

### Ownership

| Area | Target team | Today |
| --- | --- | --- |
| Queues, infrastructure, restores | Platform | Satyajeet |
| Policy violations, credentials, threat model | Security | Satyajeet |
| Parsing, retrieval quality, embedding spaces | Search | Satyajeet |
| Graph replay, models, prompts, evals | Agent engineering | Satyajeet |
| Desktop releases and device runtime | Desktop | Satyajeet |

## Decisions and build changes

These decisions settle every difference between the old PRD and the earlier v0 build. The "Was" column is history only. Decisions from November 23, 2026 onward have a dated record in [docs/adr](adr/README.md), and their rows cite it.

### Decision log

| Topic | Decision | Was | Why |
| --- | --- | --- | --- |
| Desktop shell | Electron | PRD reopened Tauri | Confirmed by owner; packaged build exists |
| Work queues | SQS standard queues with DLQs | PRD: SQS; v0: Redis | Durable, managed, native redrive |
| Redis | Valkey for streams, signals, limits, semaphores, spend counters, cache | PRD: none | Fast shared state that is always safe to lose |
| Checkpoints | langgraph-checkpoint-postgres (sync durability); SQLite on desktop | v0: Prisma-backed store | Official, maintained, replay-safe |
| Streaming | Worker → Redis Streams → Fastify WebSocket → client, Postgres replay | v0: WebSocket engine in FastAPI | Workers are queue consumers; any Fastify can serve any run |
| Redaction | Full Redaction Mesh on ingestion, every egress and telemetry | PRD: field allowlist only | Owner decision; covers free text |
| Telemetry | Ledger written by workers; OTel Collector to CloudWatch and Langfuse | v0: FastAPI → Fastify → Postgres | One fewer hop; routing by data class |
| Langfuse | Self-hosted v3 in the VPC | PRD: undecided | In use; payloads stay in region |
| Retrieval | Hybrid dense + sparse + identifier FTS, RRF, GPU rerank | PRD: dense-only reference | v0 already runs hybrid + rerank; sparse branch is multilingual |
| E2B network | Off by default; approval-gated allowlist profile | v0: outbound allowed | Closes the exfiltration path |
| Browser automation | Ephemeral Fargate tasks with Playwright | v0: Docker containers, Puppeteer | VM isolation per session; official MCP server |
| E2B limits | 1 vCPU / 1 GB standard, 2 vCPU / 2 GB large, 5 min, non-root, read-only system | PRD: memory only | Keeps v0 limits, adds missing ones |
| SLO scope | Success for every step; latency only for steps we control | v0: 2 s for every step | LLM steps cannot promise 2 s |
| Local runtimes | Ollama default, llama.cpp advanced, vLLM for private GPUs | PRD: LM Studio candidate | Headless, scriptable runtimes only |
| Dev agent | Reviewer in v1, Implementer in v1.1 | PRD: implementer only | Read-only first, lower risk |
| Eval gate | 95% production, 98% mature, plus pass-or-block suites | v0: 95% | Owner decision |
| Users and auth | Multi-tenant, Cognito with MFA and SSO, Cedar plus row-level security | v0: single user, Fastify auth | Production SaaS standard |
| Desktop renderer | Vite build of shared React packages | Implied Next.js in Electron | Next.js server features do not run in a packaged app |
| Connector tokens | KMS envelope encryption in Postgres | PRD: Secrets Manager per token | Cost and API limits at scale |
| Repository | One monorepo with Turborepo, a uv workspace and just | Earlier draft: separate TypeScript and Python monorepos | One clone, atomic cross-language changes, one pipeline |
| Knowledge graph | Neo4j (AuraDB in AWS, Community locally) built from extraction records kept in Postgres; 2-hop Cypher as a fusion branch | Deferred GraphRAG | Owner decision; native graph traversal and Cypher, while Postgres stays the rebuild source |
| Local models | Real models everywhere: Ollama or provider APIs; only unit tests stub the model client | Build plan draft: mock model server profile | Owner decision; evals and behavior stay honest |
| JavaScript package manager | Yarn 4 workspaces. ADR-003 (2026-11-23); run from a committed release, ADR-014 (2026-11-23) | pnpm | Owner decision |
| Node version | Node 26, the latest LTS, in development, CI, service images and sandboxes. ADR-013 (2026-11-23) | Node 22 in the build plan; Node 20 in the E2B template | Owner decision |
| Starting point | Phase 1 starts fresh; no v0 code is used. ADR-004 (2026-11-23) | Restructure v0 | Owner decision |
| Master documents | Architecture and build plan are mastered in docs/. ADR-006 (2026-11-23) | Not stated | Owner decision |
| AWS accounts | Staging, production, sandbox and security. ADR-008 (2026-11-23) | "Three" in one place, five in another | Development runs on the laptop stack |
| Restore rehearsals | Monthly automated restore; quarterly regional drill. ADR-009 (2026-11-23) | Monthly in one place, quarterly in another | Keeps both checks, each with its own purpose |
| Eval schedule | Smoke and deterministic cases per merge; all suites weekly and per release candidate. ADR-010 (2026-11-23) | All suites on every main deploy | Matches the budget; nothing reaches production without every gate |
| Encryption at rest | Set when each store is created, customer-managed keys. ADR-011 (2026-11-23) | Added in phase 23 | RDS and Valkey cannot enable it in place |

### Build order

The [build plan](TaskMaster%20Build%20Plan.md) holds the only task list. The earlier checklist for bringing v0 up to this architecture is retired, because the build starts fresh (ADR-004); each of its items is covered by a build plan phase.

### Numbers to measure

At launch (build plan phase 31), measure and record: task, retrieval, safety and privacy pass rates per suite; p95 retrieval and rerank latency; first-token time; step success rate; cost per run by workflow; Mesh latency and throughput; local-only resource use on the minimum-spec machine.

# TaskMaster Build Plan

Nov 23, 2026 · @Satyajeet Parida

TaskMaster reaches the target architecture in 31 small phases, followed by two v1.1 phases. Phase 1 makes the whole product run and pass its tests on one laptop. Every later phase adds one production capability and must keep the laptop stack green. Phase 1 starts fresh, with no earlier code (ADR-004).

## How the plan works

Each phase adds one capability in 3 to 6 tasks and ends green on the laptop and in CI. Phase 1 is larger because it builds the product from nothing, so it is split into six milestones of 3 to 6 tasks (ADR-005). The TaskMaster Target Architecture doc is the reference for every design detail; this plan only orders the work. Both files are mastered in docs/ (ADR-006), and changes to either are recorded in [docs/adr](adr/README.md).

### Phase rules

1. **Laptop parity.** Every phase runs fully on a laptop with real models: Ollama for local inference, or provider APIs with your own keys. Cloud-only infrastructure gets a local stand-in: LocalStack for SQS, S3, KMS and Secrets Manager; Keycloak for sign-in; a Docker sandbox for E2B.
2. **One capability per phase.** A phase never depends on a later one. Unfinished behavior ships behind a feature flag, off by default.
3. **Green on exit.** `just check` passes on macOS and Ubuntu and in CI: lint, type checks, build, unit, integration and E2E tests, coverage thresholds, and the eval smoke suite.
4. **The architecture doc stays true.** A phase that changes a decision updates the doc and adds an ADR in the same pull request.

### Definition of done (every phase)

- [ ] Code merged to main with unit and integration tests for the new capability
- [ ] `just check` green on a fresh clone and in CI
- [ ] New regression or eval cases added for the capability
- [ ] README or runbook section written; ADR added if a decision was made
- [ ] From phase 8 onward: deployed to staging and smoke-tested there

### Coverage standards

Coverage gates use widely accepted levels rather than stretch goals: higher where a bug becomes a security or data incident, lower for UI. `just check` fails when a package drops below its floor.

| Domain | Line coverage | Branch coverage |
| --- | --- | --- |
| Authorization, policies, tool broker, approvals | 85% | 80% |
| Redaction Mesh and data-class routing | 85% | 80% |
| Run lifecycle, queues, leases, effect ledger, streaming | 80% | 75% |
| Retrieval, ingestion, knowledge graph, memory | 75% | 65% |
| Fastify API and orchestrator API routes | 75% | 65% |
| Web and desktop UI components | 60% | 50% |
| Generated code, scripts, Terraform | Not measured | Not measured |

- **New code:** at least 80% of changed lines covered in every pull request (diff-cover).
- **Ratchet:** a package's coverage may not fall more than 1 point below its last main-branch value without an ADR.
- **Tools:** Vitest with v8 coverage for TypeScript; pytest-cov with branch coverage for Python. Terraform is checked by tflint and Checkov, not coverage.
- **Test doubles:** only unit tests replace the model client, in-process. The running product, integration tests and evals always call real models.

## Roadmap

| Stage | Phases | Delivers | Gate before the next stage |
| --- | --- | --- | --- |
| A. Local foundation | 1 | The whole product on one laptop | Gate 1, local product |
| B. Durable core | 2–6 | Runs survive crashes, duplicates and disconnects | None |
| C. Cloud staging | 7–8 | The durable core on AWS, deployed on every merge | Gate 2, durable staging |
| D. Identity, trust and safety | 9–15 | Multi-tenant, authorized, approved and redacted | None |
| E. Documents, retrieval, telemetry and evals | 16–21 | Target-standard retrieval, observability and evals | Gate 3, beta |
| F. Operability | 22–24 | SLOs, data lifecycle and restores | None |
| G. Production and desktop | 25–29 | Production, the desktop runtime and the PR Reviewer | Gate 4, production readiness |
| H. Launch and v1.1 | 30–33 | Launch, then two v1.1 capabilities | None |

Stages and their phases run in order, top to bottom. Each of the four gates must pass before the stage below it starts.

### Stage gates

A gate adds no new requirement. It collects exit criteria the phases already define (ADR-007). The owner ticks a gate and writes the date beside it.

- [ ] **Gate 1, local product (after stage A).** Every phase 1 "Done when" item has been observed, and the baseline eval report is recorded.
- [ ] **Gate 2, durable staging (after stage C).** Phases 2 to 8 meet their "Done when" criteria. The crash, cancel, duplicate-delivery, lease-expiry, reconnect and ambiguous-write cases all pass, and a merge reaches staging with a passing smoke and no manual step.
- [ ] **Gate 3, beta (after stage E).** Phases 9 to 21 meet their "Done when" criteria, and one release candidate passes every Beta release gate in the architecture doc.
- [ ] **Gate 4, production readiness (after stage G).** Phases 22 to 29 meet their "Done when" criteria: every alarm has paged in the exercise, a restore drill is recorded against RPO 15 minutes and RTO 4 hours, a bad release has rolled back through the canary, all local-only canary cases show zero outbound calls, and the desktop suite passes.

## Phase 1: Local development environment

A developer clones one repository, runs three commands, and has the whole product running on a laptop with real models. Retrieval, the vector store, the knowledge graph and memory all work, and every test and local eval suite passes. No cloud account is needed, and Ollama covers models when no API keys are set.

### One monorepo

Yes, the whole tool lives in one repository, taskmaster. One clone gets everything; a contract change and both of its consumers (TypeScript and Python) land in one pull request; one CI pipeline and one version cover the product. Yarn 4 workspaces with Turborepo run and cache tasks across both languages (each Python package exposes its tasks through a small package.json that calls uv), a uv workspace manages Python dependencies, and `just` is the single entry point.

| Path | Holds |
| --- | --- |
| apps/web, apps/api, apps/desktop, apps/ops | Next.js web app, Fastify API, Electron desktop app, Ops console |
| services/orchestrator | FastAPI and the LangGraph workers |
| services/ingestion | Parsing, OCR, chunking, knowledge-graph extraction |
| services/mesh | Redaction Mesh: gRPC, C++, ONNX |
| services/embed | BGE-M3 embeddings and the reranker |
| packages/ui, packages/contracts, packages/policies | Shared React components; JSON Schemas generating zod and Pydantic types; Cedar policies |
| evals | Suites, fixtures, the harness and reports |
| infra/dev, infra/terraform | Compose stack, LocalStack init and seed data; Terraform modules from phase 7 |
| docs | Architecture doc, ADRs, runbooks |

### Machine requirements

| Item | Requirement |
| --- | --- |
| OS | macOS 14+ (Apple Silicon), Ubuntu 24.04, or Windows 11 running Ubuntu 24.04 in WSL2. On Windows, clone inside the WSL file system, not under /mnt/c or a synced folder such as OneDrive |
| Memory and disk | 16 GB RAM with API keys; 32 GB RAM recommended when models run in Ollama; 60 GB free disk |
| Containers | Docker Desktop (with WSL integration on Windows) or Docker Engine, with Compose v2, 8 GB memory allotted |
| Toolchain | Node 26 LTS (pinned in .nvmrc; ADR-013) with Yarn 4 from the release committed to the repository (ADR-014); Python 3.12 (pinned in .python-version) through uv; just |
| Models | Provider API keys in an untracked .env.local, or Ollama with an 8B-class model that passes the capability tests |

### Models on the laptop

- **With API keys:** LiteLLM routes the model tiers to the providers (Claude for planning, Gemini for the economical tier and the judge).
- **Without keys:** LiteLLM routes every tier to Ollama. Runs are slower, but every feature and eval works.
- **Embeddings and reranking:** BGE-M3 and bge-reranker-v2-m3 run in services/embed on CPU, or on Metal or CUDA when present.
- The product, integration tests and evals always call real models. Only unit tests replace the model client, in-process.

### Local stack (Docker Compose)

| Service | Image or source | Stands in for |
| --- | --- | --- |
| Postgres 17 + pgvector | pgvector/pgvector:pg17 | RDS; holds vectors, memory, checkpoints and the graph extraction records |
| Valkey 8 | valkey/valkey | ElastiCache |
| LocalStack | localstack/localstack | SQS, S3, KMS, Secrets Manager |
| LiteLLM proxy | ghcr.io/berriai/litellm | Model gateway, routing to provider APIs or Ollama |
| Ollama | ollama/ollama, or the native app on macOS for Metal | Local inference when no keys are set |
| Embed service | services/embed | The GPU embed and rerank service |
| MCP servers | filesystem, fetch, Playwright, and ours for Calendar, Drive and GitHub | Cloud MCP services |
| Mock Google and GitHub API servers | Ours | Google and GitHub APIs, so connectors work with no cloud account |
| Sandbox runner | Ours, Docker containers behind the E2B adapter interface | E2B |
| Redaction Mesh | services/mesh | Mesh service |
| OpenTelemetry Collector + Jaeger | otel/opentelemetry-collector-contrib, jaegertracing/all-in-one | ADOT Collector and CloudWatch |
| Langfuse (profile: observability) | Langfuse v3 compose | Self-hosted Langfuse |
| Neo4j 5 Community | neo4j:5-community | Neo4j AuraDB, the knowledge graph |

### Knowledge layer, working locally

- **Vector store:** pgvector with BGE-M3 dense vectors as halfvec(1024) and an HNSW index.
- **Retrieval:** dense plus Postgres full-text search, fused with reciprocal rank fusion, then the top 30 reranked. Local latency is not gated; the 2-second target applies on staging GPUs.
- **Knowledge graph:** at ingestion, the economical model extracts entities and relations under a JSON schema. The extraction records stay in Postgres and the graph lives in Neo4j, with a vector index on entity embeddings. A query resolves its entities, walks up to 2 hops in Cypher, and returns the evidence chunks as a retrieval branch.
- **Memory:** memory items in pgvector with source message and scope, plus token-budgeted compaction of long threads.
- Workspace, ACL and data-class filters apply to all four from day one.

### Commands

| Command | Does |
| --- | --- |
| just bootstrap | Checks toolchain versions, installs Yarn and uv dependencies, installs pre-commit hooks, pulls the Ollama model if no keys are set |
| just up | Starts the stack, runs migrations, creates LocalStack queues and buckets, seeds data and indexes the sample corpus |
| just dev | Runs web, API, workers and desktop with hot reload |
| just check | In order: lint, type checks, build, unit, integration and E2E tests, coverage thresholds, eval smoke |
| just eval | Runs every local eval suite and writes a report |
| just reset | Drops all local data and reseeds |

### Local eval suites

| Suite | Cases in phase 1 | Checks |
| --- | --- | --- |
| Task quality | About 300 golden cases, written fresh | Tool choice, schemas, outcome, LLM judge |
| Retrieval | 40 queries over the pinned 100-document corpus | Recall@5, MRR@5, citation accuracy |
| Knowledge graph | 30 relationship questions plus entity-resolution checks | Correct path found, evidence cited, merge precision |
| Memory | 20 cases | Saved fact recalled, superseded fact ignored, nothing recalled across workspaces |
| Safety | 200 adversarial cases, written fresh | Containment |
| Eval smoke | 50-case cross-section, run by `just check` | Must pass 90% or more |

`just eval` writes an HTML and JSON report to evals/reports with every version pinned (code commit, prompts, models, corpus), and also sends it to Langfuse when that profile is on. Phase 1 records the baselines; the full gates start in phase 21.

### Tasks

Milestones run in order, and each ends with every `just check` step that exists so far green. Eval smoke joins `just check` in milestone 1.6.

#### Milestone 1.1: Monorepo and local stack

- [ ] Create the monorepo: Yarn 4 workspaces with Turborepo, the uv workspace, the justfile and the toolchain pins
- [ ] Commit the Yarn 4 release and set yarnPath, the node-modules linker and the registry.npmjs.org registry, with immutable installs in CI
- [ ] Compose stack, LocalStack init script and seed data with the sample corpus
- [ ] Contracts package and contract tests
- [ ] Coverage tooling and thresholds
- [ ] README, CONTRIBUTING and ADR-001 (monorepo and local stack)

#### Milestone 1.2: Chat path

- [ ] LiteLLM routing to provider APIs or Ollama; capability check for the chosen Ollama model
- [ ] Fastify API with the Prisma application schema: sign-in with seeded users, threads, messages, runs, and the WebSocket gateway
- [ ] Orchestrator with the LangGraph planner, personas and reviewer, using AsyncPostgresSaver from the start
- [ ] Interim run path: record the run in Postgres, send it on the LocalStack runs queue to one worker, and deliver committed text and run\_events from Postgres through Fastify
- [ ] Next.js web app and packages/ui: chat thread and run timeline

#### Milestone 1.3: Knowledge layer

- [ ] Embed and rerank service
- [ ] Basic ingestion for PDF, DOCX, Markdown and text: parse, chunk, embed, publish
- [ ] Vector and full-text retrieval with reranking and citations, filtered by workspace, ACL and data class
- [ ] Knowledge-graph extraction, the Neo4j graph store behind a GraphStore interface, and the graph retrieval branch
- [ ] Memory items and token-budgeted compaction

#### Milestone 1.4: Tools, approvals and artifacts

- [ ] Tool broker with persona allowlists and grants; the filesystem, fetch and Playwright MCP servers; Tavily and Firecrawl tools registered only when their keys are set
- [ ] Calendar, Drive and GitHub tools, with mock Google and GitHub API servers in the compose stack
- [ ] E2B adapter interface with the local Docker runner, network off
- [ ] Approval through a LangGraph interrupt, the approval card, and versioned artifacts with a viewer
- [ ] Redaction Mesh gRPC service with level 1 (deterministic) detection

#### Milestone 1.5: Desktop and traces

- [ ] Electron app in dev mode on packages/ui, talking only to Fastify, with the hardened renderer settings
- [ ] OpenTelemetry in the web app, Fastify and Python, through the Collector to local Jaeger
- [ ] Langfuse as an optional compose profile

#### Milestone 1.6: Evals and baseline

- [ ] Eval harness with local HTML and JSON reports
- [ ] Task-quality and safety cases written from the architecture's suite breakdown, using synthetic data
- [ ] Retrieval cases with the pinned 100-document corpus, plus the knowledge-graph and memory cases
- [ ] 50-case eval smoke added to `just check`, and the baseline report recorded

### Done when

- [ ] On a fresh macOS and a fresh Ubuntu machine (Ubuntu in WSL2 is also supported), `git clone` then `just bootstrap && just up && just check` passes, with API keys or with Ollama, and no cloud account
- [ ] A first run finishes within 45 minutes including image and model pulls; later runs of `just check` within 15 minutes with API keys
- [ ] A developer can sign in, chat, upload a document, get a cited answer, answer a relationship question from the graph, recall a saved memory in a new thread, run a tool call, approve a write and open the artifact
- [ ] `just eval` runs every local suite and records the baseline report
- [ ] The desktop app runs in dev mode against the local stack, and a full run's traces show in local Jaeger

## Public demo (from phase 1)

The phase 1 stack can run on one small ARM server for interviewers to try, for roughly €21 to €41 a month plus a hard cap on model spend. Guests get a ready-made workspace, every guest has spend limits, everything resets nightly, and CI redeploys the server after each phase so it always shows the latest build.

### Where to host it

| Option | Size | Monthly price | Catch |
| --- | --- | --- | --- |
| Hetzner CAX41 (recommended) | 16 ARM vCPU, 32 GB RAM | €40.99 in Germany and Finland after the June 2026 increase | Room for Neo4j, the CPU embed service and Langfuse together |
| Hetzner CAX31 | 8 ARM vCPU, 16 GB RAM | €20.99 | Fits without Langfuse, using int8 retrieval models |
| Oracle Cloud Always Free | 2 OCPU, 12 GB RAM since mid-2026 | 0 | Allowance was halved in 2026; idle instances can be reclaimed; capacity is often unavailable |

Hetzner's cost-optimized plans had their create button disabled on several dates in September and October 2026, so check availability before planning around them. AuraDB Free is not suitable for the demo because it pauses after three days of inactivity; the server runs Neo4j Community instead.

### Setup

- **Stack:** the laptop compose stack with a demo override: Caddy for HTTPS, Neo4j Community, int8 retrieval models on CPU, provider APIs only (Ollama is too slow on shared CPUs).
- **Edge:** Cloudflare's free plan for DNS, TLS and basic DDoS protection; the server's firewall allows only ports 80 and 443; SSH by key only, unattended security upgrades.
- **Guests:** a Try the demo button creates a guest workspace preloaded with the sample corpus, its graph and memory, deleted after 24 hours. Invite codes give interviewers a workspace that lasts 7 days.
- **Guest limits:** 40 turns a day, 5 uploads of up to 10 MB, no outward sends. Calendar, Drive and GitHub run against demo-owned sandbox accounts, so guests never connect their own.
- **Spend cap:** LiteLLM budgets of USD 1 per guest per day and USD 30 per month in total, plus a monthly limit on each provider account. At the cap the demo switches to a read-only showcase.
- **Code execution:** E2B's free Hobby plan with its one-time USD 100 of usage credit, so untrusted guest code never runs on the server itself.
- **Showcase pages:** the latest eval report, retrieval and graph metrics, a sample run's trace, the architecture doc, and a short video of the desktop app.
- **Operations:** GitHub Actions deploys over SSH once main passes `just check` (from phase 8, once staging passes); a nightly reset and database snapshot; a free uptime monitor.

### Tasks

- [ ] Demo compose override, Caddy and Cloudflare setup, server hardening
- [ ] Guest and invite-code workspaces with expiry, seeded data and per-guest limits
- [ ] LiteLLM spend budgets, provider account limits and the read-only fallback
- [ ] Showcase pages and the deploy-and-reset workflow

**Done when:** an interviewer can open the public URL, start a guest workspace and run the full phase 1 flow, the spend cap has been tested by forcing it, and the nightly reset leaves a clean seeded demo.

## Stage B: Durable core (phases 2 to 6)

Stage B makes runs survive crashes, duplicates and disconnects before anything else is added. All of it runs on the local stack.

### Phase 2: CI baseline

The same `just` commands run on every pull request, and nothing merges red.

- [ ] GitHub Actions workflows that start the compose stack and run `just check`, with Turborepo running only affected packages and a remote cache
- [ ] Provider API keys as GitHub secrets on a dedicated low-limit project with a monthly spend cap; coverage and diff-coverage reports posted on each pull request
- [ ] Scans: CodeQL, Semgrep, osv-scanner, gitleaks, Trivy image scan, SBOM with Syft
- [ ] Branch protection, CODEOWNERS, required checks, Renovate for dependency updates
- [ ] Decision-record checks: file name and date format, unique numbers, every record in the index, required fields and allowed statuses, accepted bodies unchanged, links resolve, agent pointer files hold no rules, AGENTS.md under 28 KB; and a pull-request check that asks for an ADR when the architecture, build plan or AGENTS.md changes

**Done when:** a pull request cannot merge unless every check passes, and the pipeline runs in 20 minutes or less.

### Phase 3: Durable runs

A run resumes from its last step after any crash.

- [ ] Set AsyncPostgresSaver to sync durability in its own langgraph schema, and prove resume from the last step
- [ ] Add the full run state set and run revision; enforce run limits (50 steps, 20 minutes, USD 2.00)
- [ ] Version the graph state schema and keep the previous graph version loadable
- [ ] Cancellation through a Postgres flag checked before every node and tool call

**Done when:** killing a worker mid-run and restarting it resumes from the last checkpoint, and the crash and cancel recovery cases pass.

### Phase 4: SQS dispatch with leases

Work reaches workers through SQS, and exactly one worker owns a run at a time.

- [ ] Add the DLQ and redrive policy to the runs queue in LocalStack (Terraform-compatible names)
- [ ] Outbox table and publisher in Fastify; Idempotency-Key on run submission
- [ ] Worker lease with fencing token; stale writes rejected
- [ ] Pause releases the lease; approval decisions enqueue a resume message
- [ ] DLQ inspect and redrive commands

**Done when:** a duplicated message produces one run, two workers never run the same run, and the duplicate-delivery and lease-expiry cases pass.

### Phase 5: Streaming through Redis Streams

Tokens flow worker to Valkey to Fastify to client, and reconnects never lose or repeat text.

- [ ] Workers write token deltas to run streams, durable events to run\_events, partial text every 500 ms
- [ ] Extend the Fastify WebSocket gateway: subscribe, replay from Postgres, then live reads from the stream
- [ ] Versioned frame protocol in packages/contracts; heartbeats and backoff reconnect in the client
- [ ] Remove the interim path that delivered live text from Postgres (ADR-005)

**Done when:** dropping the client or restarting Valkey mid-answer replays with no gaps or duplicates, and the reconnect cases pass.

### Phase 6: Effect ledger and safe retries

No external effect ever happens twice.

- [ ] Effect ledger with effect\_key; effect tools wrapped as LangGraph tasks
- [ ] Retry adapters: Calendar client event IDs, Drive pre-generated file IDs, GitHub lookup by branch, atomic local file writes
- [ ] Fault injection (timeout, crash, duplicate) in the mock Google and GitHub API servers
- [ ] needs\_review state and a review screen

**Done when:** a crash between dispatch and receipt leads to at most one external effect, and the ambiguous-write cases pass.

## Stage C: Cloud staging (phases 7 and 8)

Stage C puts the durable core on AWS in a staging account and makes every merge deploy there automatically. Production comes later, in phase 25.

### Phase 7: Staging on AWS with Terraform

Staging is built from empty by Terraform, with the same queue, bucket and secret names as the local stack.

- [ ] AWS Organizations with staging and security accounts; Terraform state in encrypted S3 with native locking; GitHub OIDC plan role
- [ ] Network: VPC, private subnets, VPC endpoints, NAT; ALB with an ACM certificate and AWS WAF managed rules
- [ ] Data: RDS PostgreSQL 17 with pgvector, ElastiCache for Valkey, SQS queues and DLQs, S3 buckets, Secrets Manager, ECR, Neo4j AuraDB Professional (1 GB); every AWS store created with KMS encryption at rest from customer-managed keys (ADR-011)
- [ ] ECS Fargate services: web, API, orchestrator API, workers, Mesh, LiteLLM

**Done when:** `terraform apply` creates staging from an empty account, and the phase 1 product flow works on the staging URL with live provider keys.

### Phase 8: Continuous delivery to staging

Every merge to main reaches staging with no manual step.

- [ ] Build each image once, sign it with cosign, push to ECR by digest
- [ ] Deploy on merge through the OIDC apply role and a protected environment
- [ ] Expand-only migrations as a one-off ECS task before each deploy
- [ ] Staging smoke: Playwright E2E, eval smoke and a live-model subset of the golden cases
- [ ] Feature flags through AWS AppConfig, with a local file-based provider for the laptop

**Done when:** a merge deploys to staging in 30 minutes or less, and a failing smoke test stops the pipeline and notifies you.

## Stage D: Identity, trust and safety (phases 9 to 15)

Stage D turns the single-user tool into a multi-tenant product where every action is authorized, every outward effect is approved, and no sensitive content leaves without the Mesh.

### Phase 9: Tenants, workspaces and sign-in

Many organizations share the system and never see each other's data.

- [ ] Tenants, workspaces, memberships and roles; tenant\_id and workspace\_id on every table; row-level security
- [ ] OIDC sign-in in Fastify with PKCE and an HttpOnly session cookie: Keycloak locally, Cognito with MFA in staging
- [ ] Desktop sign-in through the system browser with a loopback redirect; refresh token in the OS keychain
- [ ] Short-lived internal token from Fastify to workers

**Done when:** with two seeded tenants, every cross-tenant read returns zero rows, and sign-in works locally and on staging.

### Phase 10: Authorization policies

One set of Cedar policies decides every API call and every tool call.

- [ ] Cedar policy files and tests in packages/policies
- [ ] Fastify evaluates them for REST calls and WebSocket subscriptions; the broker evaluates them with cedarpy
- [ ] Revocation event through Valkey closes affected sockets within 5 seconds
- [ ] Policy decisions, including denials, written to the audit table

**Done when:** the same policy test cases pass in TypeScript and Python, and a revoked member loses access on the next request.

### Phase 11: Tool registry, risk tiers and approvals

Every tool declares its risk, and every outward effect waits for a bound, expiring approval.

- [ ] Tool registration standard: schema, risk tier, scopes, egress domains, idempotency adapter, timeout, output cap, 3 eval cases
- [ ] R0 to R3 risk tiers with workspace auto-approve rules for R2
- [ ] Approvals bound to an action digest; edit-and-approve; batch approval; 24 h and 1 h expiry; expired state
- [ ] In-app and email notifications (Mailpit locally, Amazon SES in staging)

**Done when:** the approval replay and digest-tampering cases pass, and an unregistered tool cannot be called.

### Phase 12: Data classes and the Mesh on every egress

Restricted content leaves only in redacted form, and a Mesh outage stops egress instead of leaking.

- [ ] Data class on documents, messages and runs; the run's high-water mark propagates to everything derived
- [ ] Mesh level 2: train the character-level CNN-BiLSTM on synthetic or consented data, evaluate it, and export it to ONNX
- [ ] Mesh as a LiteLLM pre-call hook and a broker check on tool arguments
- [ ] Outbound payload validator, pseudonym vault and re-identification before display
- [ ] Fail-closed pause when the Mesh is down or exceeds its 200 ms budget

**Done when:** the redaction and routing cases of the privacy suite pass, and stopping the Mesh results in zero outbound model calls.

### Phase 13: Model routing and spend control

Models are chosen only from what policy allows, and no run overspends.

- [ ] Model registry with capability tests (tool calling, JSON schema, streaming, context length)
- [ ] CI generates LiteLLM model groups per tier and data class; fallbacks stay inside a group
- [ ] Provider concurrency semaphores and per-run spend counters in Valkey
- [ ] Fast path for direct chat turns that skips the planner

**Done when:** a forced 429 never routes content to an ineligible provider, and a run stops at its spend cap.

### Phase 14: Prompt-injection containment

Untrusted content cannot steer the agent into leaking or sharing data.

- [ ] Taint flag on the run; web.fetch limited to URLs from search results or user messages
- [ ] Recipient, share and invite allowlists; R2 approvals required once tainted
- [ ] Provenance wrapping of retrieved content
- [ ] No external images; artifacts on a separate origin with a strict CSP

**Done when:** the exfiltration cases reach 100% containment and benign controls show 5% or fewer false blocks.

### Phase 15: Sandboxes and egress control

Model-written code and browsing run isolated, with no path to private networks.

- [ ] E2B template with internet off and the standard and large limits; networked profile behind approval
- [ ] Browser sessions in ephemeral containers (Docker locally, Fargate tasks in staging) with Playwright MCP
- [ ] Egress proxy that blocks private ranges and metadata endpoints; AWS Network Firewall domain allowlist in staging
- [ ] Files in and out of sandboxes only through broker grants

**Done when:** the sandbox limit tests pass and every SSRF test (metadata endpoint, private IPs) is blocked.

## Stage E: Documents, retrieval, telemetry and evals (phases 16 to 21)

Stage E brings ingestion, retrieval, memory, observability and the eval program up to the target standard. The full eval gates switch on at the end of this stage.

### Phase 16: Ingestion pipeline

Uploads are verified, scanned and parsed in isolation, and the uploader sees each step.

- [ ] Quarantine bucket; presigned upload with checksum, size and type limits
- [ ] Malware scan: ClamAV locally, GuardDuty Malware Protection for S3 in staging
- [ ] Docling parsing, EasyOCR for scanned pages, tree-sitter for code; ingestion workers with no internet egress
- [ ] Status events to the uploader; Restricted raw files deleted after redaction

**Done when:** the hostile-file fixtures (zip bomb, polyglot, macro document) are rejected cleanly, and a 50-page scanned PDF becomes searchable.

### Phase 17: Hybrid retrieval and reranking

Retrieval runs the four-branch hybrid (dense, sparse, identifier, graph) with GPU reranking.

- [ ] Embed and rerank service: CPU locally, GPU (g6.xlarge) in staging
- [ ] BGE-M3 sparse branch (sparsevec) and identifier full-text branch; reciprocal rank fusion with the knowledge-graph branch weighted by eval results
- [ ] bge-reranker-v2-m3 over the top 30 with max\_length 1024; context selection rules
- [ ] Retrieval suite grown to 150 queries (30 of them relationship questions) over the pinned 300-document corpus; dense-only and no-rerank kept as nightly benchmarks

**Done when:** Recall@5 is at least 0.85 and citation accuracy at least 0.90, and rerank p95 is 250 ms or less on staging.

### Phase 18: Retrieval at scale and access

Filtered search keeps its recall, and retrieval never returns a document the user cannot open.

- [ ] pgvector iterative index scans, tenant hash partitions, exact scan below 20,000 permitted chunks
- [ ] Permitted-document sets cached in Valkey by ACL version
- [ ] Embedding spaces with a workspace pointer, background rebuild and pointer rollback
- [ ] Drive permission sync and a live re-check when a citation opens

**Done when:** filtered recall matches unfiltered recall within 2 points, and the other-workspace and superseded-version cases pass.

### Phase 19: Conversation context and memory

Long threads stay coherent, and users control what the agent remembers.

- [ ] Token-budgeted compaction to the standard (75% to 50%, 6–10 recent exchanges, source-linked summary, task record)
- [ ] Memory items with source message, scope and data class; append-only with supersede
- [ ] Settings screen to view, edit and delete memory; memory retrieved as a low-weight branch

**Done when:** the context and stale-state cases pass (changed cap, excluded vendor, draft-only), and memory never crosses workspaces.

### Phase 20: Telemetry, Langfuse and dashboards

Usage, cost and traces are complete and routed by data class.

- [ ] Workers write ledger rows in the same transaction as the step they describe
- [ ] OpenTelemetry in browser, Fastify and Python; Collector with Mesh redaction and data-class routing
- [ ] Self-hosted Langfuse v3 in staging, fed over OTLP
- [ ] Usage page, Ops console and daily cost reconciliation from hourly rollups

**Done when:** one run is traceable from click to provider call, and estimated cost matches provider billing within 5% for a day of staging traffic.

### Phase 21: Full eval program and release gates

Releases are gated by the full suites, with honest statistics.

- [ ] Grow suites to the target 860 cases; 20% holdout per suite
- [ ] Calibrate judges on 100 human labels (Cohen's kappa 0.7 or more); judge from a different model family
- [ ] Three repeats per stochastic case with Wilson intervals; results pinned to versions in Langfuse
- [ ] Beta gates enforced on release candidates in staging; all suites weekly, nightly drift replay and a weekly failure triage (ADR-010)

**Done when:** a release candidate on staging passes every beta gate, and a seeded regression is caught and blocks the next candidate.

## Stage F: Operability (phases 22 to 24)

Stage F makes the system observable against its SLOs, protects data across its whole lifecycle, and proves it can be restored.

### Phase 22: SLOs, alerting and on-call

Every SLO has a measured indicator, burn-rate alarms and a runbook.

- [ ] SLO indicators from the ledger, the ALB and browser timing
- [ ] CloudWatch multiwindow burn-rate alarms with the thresholds from the architecture doc
- [ ] PagerDuty rotation, severity definitions and a runbook linked from every alarm
- [ ] Monthly alarm exercise in staging with synthetic failures, including missing events

**Done when:** every alarm fires and pages during the staging exercise, and each page opens its runbook.

### Phase 23: Encryption, retention and deletion

Data is encrypted everywhere, kept only as long as allowed, and fully removed when deleted.

- [ ] Envelope encryption for connector tokens; a policy check that fails any store without the KMS encryption set in phase 7
- [ ] Monthly partitions with pg\_partman; retention jobs and Parquet archive to S3
- [ ] Derived-data registry and purge queue covering chunks, graph nodes in Neo4j, summaries, memory, cache, checkpoints and traces
- [ ] Audit log in S3 with Object Lock

**Done when:** deleting a seeded document removes every derived copy (verified by a scan of all registered stores), and the retention jobs prune test data on schedule.

### Phase 24: Backups and disaster recovery

A lost database or region can be restored within the stated objectives.

- [ ] RDS point-in-time recovery for 14 days and daily snapshot copies to a second region
- [ ] S3 replication of documents and artifacts to the second region
- [ ] Create the sandbox account; restore runbook and an automated monthly restore into it (ADR-008, ADR-009)
- [ ] Quarterly drill that rebuilds a working environment from the second region's copies

**Done when:** a restore drill rebuilds a working environment from backups, the recovery suite passes on it, and the measured time is recorded against RPO 15 minutes and RTO 4 hours.

## Stage G: Production and desktop (phases 25 to 29)

Stage G opens the production environment, completes the desktop's local-only mode, and adds the first developer agent.

### Phase 25: Production environment and canary releases

Releases reach production through a canary that rolls back on its own.

- [ ] Production account from the same Terraform modules: Multi-AZ RDS, Neo4j AuraDB Business Critical (2 GB), production sizing, WAF rate rules
- [ ] Release-owner approval through a protected GitHub environment; saved Terraform plan applied as reviewed
- [ ] ECS blue/green with CodeDeploy: 10% canary for 30 minutes, automatic rollback on burn-rate alarms
- [ ] Model, prompt and routing versions promoted as configuration through the same gates

**Done when:** a release reaches production through the canary, and a deliberately bad release rolls back without manual action.

### Phase 26: Desktop device runtime

The desktop app runs complete agent tasks with no cloud dependency.

- [ ] Bundled Python sidecar (python-build-standalone, uv) running LangGraph with AsyncSqliteSaver
- [ ] SQLite with sqlite-vec, FTS5 and the SQLite implementation of the graph store; BGE-M3 and the reranker as int8 ONNX models
- [ ] Ollama integration with the capability tests; local Mesh engine
- [ ] Run placement field; minimum-spec check that hides local-only mode below 16 GB RAM

**Done when:** with the network off, the desktop answers a cited question over local files and completes an approved local file edit.

### Phase 27: Local-only enforcement

Local-only content provably never leaves the device.

- [ ] Broker removes every network-capable tool from local-only runs; the sidecar may reach only Ollama on localhost
- [ ] OS controls: Seatbelt on macOS, Windows Filtering Platform rules, bubblewrap on Linux
- [ ] Device runs sync metadata only; cloud threads cached offline with revision-checked sync
- [ ] Privacy suite canary tests with an egress monitor

**Done when:** all 15 local-only canary cases show zero outbound calls and zero exported content.

### Phase 28: Desktop release pipeline

Signed desktop builds update safely through staged channels.

- [ ] Signing and notarization on macOS and Windows runners; Electron fuses, strict CSP and zod-validated IPC checked in CI
- [ ] electron-updater with canary, beta and stable channels at 10%, 50% and 100%
- [ ] X-Client-Version enforcement (current plus two minor versions for 90 days); local migrations with a backup copy

**Done when:** a signed build installs cleanly on both OSes, updates across channels, passes the desktop suite, and holds 99.5% crash-free sessions on canary.

### Phase 29: Pull-request Reviewer agent

The Developer persona reviews pull requests and never changes code.

- [ ] GitHub App with contents:read and pull\_requests:write; installation tokens minted per run
- [ ] Webhook-triggered and on-request reviews: defects, missing tests and security concerns tied to lines
- [ ] AGENTS.md read as review rules; never approves or merges
- [ ] The 40 PR-review and coding cases in the task suite

**Done when:** the agent posts correct reviews on a seeded set of pull requests, and its PR-review cases meet the beta gate.

## Stage H: Launch and v1.1 (phases 30 to 33)

Stage H closes the security review, launches on the production gates, and then adds the two v1.1 capabilities.

### Phase 30: Security readiness

An outside reviewer finds no open high-severity issue.

- [ ] Threat-model document reviewed against what was built
- [ ] Tool onboarding checklist enforced in CI; CSP nonces and CSRF tokens verified
- [ ] Staff access through IAM Identity Center; break-glass access logged and reviewed weekly
- [ ] Sub-processor list, data export and deletion requests; external penetration test with findings fixed

**Done when:** the penetration test closes with no open high or critical findings.

### Phase 31: Launch

One release candidate passes every production gate.

- [ ] Task quality 95% overall and 90% for the weakest workflow; Recall@5 0.90 and citation accuracy 0.95
- [ ] Safety containment, privacy, recovery and desktop suites at 100%; false blocks 2% or fewer
- [ ] A 30-day SLO baseline from beta, or a documented shorter pilot window
- [ ] Load test at expected peak; status page; support runbooks
- [ ] Measure the production numbers and record them in the project notes

**Done when:** the release owner signs off on a candidate that meets every gate above.

### Phase 32 (v1.1): Implementer agent

The Developer persona can propose code changes as draft pull requests.

- [ ] Triggered from an approved issue; edits in a networked E2B checkout limited to GitHub and package registries
- [ ] Pushes only to agent branches; opens a draft PR with the commands run and their results
- [ ] Cannot touch protected branches, CI or infrastructure files; ships behind a feature flag

**Done when:** the implementer cases pass their gate, and branch protection blocks every attempted merge.

### Phase 33 (v1.1): SCIM provisioning

Enterprise tenants manage members from their identity provider.

- [ ] SCIM 2.0 endpoints for users and groups, mapped to workspace memberships
- [ ] Deprovisioning revokes access and closes sockets within 5 seconds

**Done when:** provisioning and deprovisioning from a test identity provider pass end to end.

After launch, the mature gates (98% task quality, 0.95 / 0.98 retrieval, 1% false blocks) become the standing target for each release.

## Costs

At launch scale the finished system runs about USD 6,100 a month: USD 3,977 for production and the rest for staging, evals, CI and development. One-time costs come to about USD 12,000, mostly the penetration test, plus about USD 111 a year. The savings options below bring the monthly figure to about USD 4,300. The public demo is separate, at about €21–41 plus up to USD 30 of model spend a month.

### Assumptions

- On-demand list prices in us-east-1, checked November 2026; Fargate on ARM; 730 hours a month; USD unless marked €. Your own time is not counted.
- **Launch scale:** 100 active users × 15 turns a day × 22 working days = 33,000 turns a month. 40% are agent runs at about USD 0.041 each (Claude Sonnet 5.5 for planning and synthesis, Gemini 2.5 Flash-Lite for the economical tier); 60% are direct chat turns at about USD 0.013. The average is USD 0.024 a turn.
- **Evals:** one case costs about USD 0.054 (an agent run plus a judge call on Gemini Flash at the USD 1.50 / 7.50 rate that starts January 2027). A full run of all suites costs about USD 70; the 50-case smoke suite about USD 2.70.
- 60 pull requests and 60 merges a month. The staging GPU runs 10 hours a day on working days; the production GPU runs around the clock.
- **Neo4j:** AuraDB Professional at USD 65 per GB a month (1 GB minimum, no uptime SLA) for staging; AuraDB Business Critical at USD 146 per GB a month (2 GB minimum, 99.95% SLA) for production.

### Cost by phase

| Phase | What adds cost | One-time (USD) | Monthly added (USD) | Monthly total after phase (USD) |
| --- | --- | --- | --- | --- |
| 1 | Model APIs on the laptop: daily development plus 3 local eval runs (USD 0 with Ollama); Neo4j Community is free | 0 | 114 | 114 |
| 2 | CI minutes on a private repo; eval smoke on every pull request | 0 | 165 | 279 |
| 3–6 | Durable core, run on the laptop and in CI | 0 | 0 | 279 |
| 7 | Staging: Fargate 130, Neo4j AuraDB Professional 65, RDS 53, NAT 34, ALB 22, public IPv4 11, WAF 10, Valkey 9, S3, KMS, secrets, logs and ECR 22; a domain | 12 a year | 356 | 635 |
| 8 | Eval smoke on staging for every merge | 0 | 163 | 798 |
| 9 | Cognito (inside the free tier) and SES | 0 | 1 | 799 |
| 10–14 | Policies, approvals, Mesh egress, routing, containment | 0 | 0 | 799 |
| 15 | Network Firewall in staging (NAT hourly charge waived), browser tasks; E2B Hobby is free | 0 | 260 | 1,059 |
| 16 | Ingestion workers; malware scanning inside its free tier | 0 | 14 | 1,073 |
| 17 | Staging GPU (g6.xlarge, 220 hours) | 0 | 181 | 1,254 |
| 18–19 | Retrieval at scale, memory controls | 0 | 0 | 1,254 |
| 20 | Langfuse in staging (Fargate and ClickHouse), Collector, Ops console | 0 | 82 | 1,336 |
| 21 | Nightly drift runs (USD 10 a night), weekly full runs, release-candidate runs | 0 | 712 | 2,048 |
| 22 | Alarms, a synthetic canary, a PagerDuty seat (estimate) | 0 | 38 | 2,086 |
| 23 | KMS keys and the audit bucket | 0 | 4 | 2,090 |
| 24 | Cross-region copies and restore drills | 0 | 9 | 2,099 |
| 25 | Production environment (next table, without the reviewer) | 0 | 3,969 | 6,068 |
| 26–27 | Desktop runtime, which runs on users' machines | 0 | 0 | 6,068 |
| 28 | Windows signing (about USD 10, not verified), macOS and Windows CI minutes; Apple Developer Program | 99 a year | 19 | 6,087 |
| 29 | PR Reviewer model usage (100 reviews) | 0 | 8 | 6,095 |
| 30 | External penetration test (focused SaaS test; market range 5,000–30,000) | 12,000 | 0 | 6,095 |
| 31 | Peak load test in staging | 20 | 0 | 6,095 |
| 32 (v1.1) | Implementer sandboxes and model usage (estimate) | 0 | 30 | 6,125 |
| 33 (v1.1) | SCIM provisioning | 0 | 0 | 6,125 |

### Production environment, monthly

| Item | USD a month |
| --- | --- |
| Model API usage (33,000 turns) | 799 |
| GPU embed and rerank (g6.xlarge, 24/7) | 592 |
| Network Firewall (2 Availability Zones) | 583 |
| Fargate services (2 tasks each) | 576 |
| RDS PostgreSQL (m7g.large Multi-AZ, t4g.large read replica, storage) | 375 |
| Neo4j AuraDB Business Critical (2 GB) | 292 |
| E2B Pro plan plus usage | 154 |
| Interface VPC endpoints (7 services × 2 AZ) | 102 |
| Firecrawl Standard | 99 |
| Tavily search (pay as you go) | 87 |
| CloudWatch, X-Ray, synthetic canary | 84 |
| Langfuse ClickHouse (m7g.large plus disk) | 68 |
| Load balancers (public and internal) | 56 |
| ElastiCache for Valkey (primary and replica) | 30 |
| S3, KMS, Secrets Manager, ECR | 26 |
| Public IPv4 addresses | 18 |
| AWS WAF | 13 |
| Backups and disaster-recovery copies | 12 |
| PR Reviewer model usage | 8 |
| Malware scanning, SES, Cognito | 3 |
| **Total** | **3,977** |

Model usage grows with traffic at about USD 24 per 1,000 turns. Most of the remaining infrastructure is fixed and serves several hundred active users before it needs resizing.

### Total at launch, monthly

| Area | USD a month |
| --- | --- |
| Production environment | 3,977 |
| CI and eval model spend (PR smoke, staging smoke, scheduled suites, CI minutes) | 1,040 |
| Staging environment | 945 |
| Developer laptop model usage | 114 |
| Desktop signing and release runners | 19 |
| **Total** | **6,095** |

### Savings options

| Option | Saves (USD a month) | Trade-off |
| --- | --- | --- |
| Route 53 DNS Firewall plus an egress proxy instead of Network Firewall, in production and staging | about 770 | Domain-level egress control only, no deep inspection |
| Batch APIs for scheduled eval runs (half price) | about 355 | Results arrive within hours instead of minutes |
| One-year EC2 Instance Savings Plan for the production GPU | about 318 | One-year commitment |
| AuraDB Professional (2 GB) instead of Business Critical in production | about 162 | No uptime SLA, single zone, daily instead of hourly backups |
| One-year reserved RDS instances | about 97 | One-year commitment |
| Spot capacity for the staging GPU | about 97 | Runs can be interrupted |
| Public repository (free GitHub-hosted runners) | about 23 | Source code is public |

Taking all seven brings the launch total to about USD 4,300 a month.

### Sources

- [AWS Fargate ARM rates](https://www.vantage.sh/blog/fargate-pricing) · [AWS Network Firewall pricing](https://aws.amazon.com/network-firewall/pricing/) · [RDS instance prices](https://www.bytebase.com/dbcost/rds-pricing/) · [ElastiCache for Valkey prices](https://upstash.com/blog/aws-elasticache-pricing-explained-2026-full-cost-breakdown)
- [g6.xlarge prices and savings plans](https://calculator.holori.com/aws/ec2/g6.xlarge) · [NAT gateway pricing](https://aws.amazon.com/vpc/pricing/) · [ALB and PrivateLink rates](https://www.repost.aws/articles/AR9Tt9m6kKR6mF5Ohj5K-3Og/comparing-the-costs-of-common-network-architecture-patterns-with-amazon-vpc-lattice) · [AWS WAF pricing](https://aws.amazon.com/waf/pricing)
- [Amazon Cognito pricing](https://aws.amazon.com/cognito/pricing/) · [GuardDuty Malware Protection for S3 price change](https://aws.amazon.com/about-aws/whats-new/2025/02/amazon-guardduty-malware-protection-s3-price-reduction)
- [Neo4j AuraDB pricing](https://neo4j.com/cloud/aura/pricing/) · [AuraDB tiers and SLAs](https://neo4j.com/docs/aura/quotas-and-limits/) · [AuraDB Free pause policy](https://neo4j.com/?p=425405)
- [E2B pricing](https://e2b.dev/docs/pricing) · [E2B starter credits](https://www.e2b.dev/blog/announcing-billing-on-e2b) · [Tavily credits](https://docs.tavily.com/guides/api-credits) · [Firecrawl vs Tavily pricing](https://firecrawl.dev/alternatives/firecrawl-vs-tavily)
- [Claude Sonnet 5.5 pricing](https://apidog.com/blog/claude-sonnet-5-5-pricing/) · [Gemini 2.5 Flash-Lite pricing](https://www.developersdigest.tech/models/gemini-2-5-flash-lite) · [Gemini Flash rates through and after 2026](https://cloud.google.com/vertex-ai/generative-ai/pricing?hl=nl)
- [Hetzner June 2026 prices](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) · [Hetzner plan availability](https://www.bitdoze.com/md/de/hetzner-cloud-guenstige-tarife.md) · [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm) · [Oracle free tier cut](https://linuxiac.com/?p=214114)
- [GitHub Actions pricing](https://dev.to/kalemi/how-github-actions-pricing-works-m0o) · [Penetration test costs](https://www.synack.com/?p=27316) · [SaaS startup pentest range](https://codeant.ai/blogs/penetration-testing-cost)

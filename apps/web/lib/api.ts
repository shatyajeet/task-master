import { API_URL } from "./config";

// The only code in the web app that calls Fastify. Pages and components import from here.

export class ApiError extends Error {
  readonly status: number;
  readonly error: string;

  constructor(status: number, error: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.error = error;
  }
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export type DocumentStatus = "queued" | "processing" | "ready" | "failed";

export interface TaskDocument {
  id: string;
  workspace_id: string;
  filename: string;
  extension: string;
  size_bytes: number;
  sha256: string;
  status: DocumentStatus;
  error: string | null;
  page_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface Thread {
  id: string;
  workspace_id: string;
  title: string;
  created_at: string;
}

export interface Message {
  id: string;
  workspace_id: string;
  thread_id: string;
  run_id: string | null;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_name: string | null;
  created_at: string;
}

export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "done"
  | "failed"
  | "cancelled"
  | "expired";

export interface Run {
  id: string;
  workspace_id: string;
  thread_id: string;
  status: RunStatus;
  llm_calls: number;
  running_ms: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export interface ArtifactSummary {
  id: string;
  workspace_id: string;
  thread_id: string | null;
  run_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Artifact extends ArtifactSummary {
  content: string;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  filename: string;
  page: number;
  text: string;
  score: number;
}

export interface GraphEntity {
  id: string;
  name: string;
  kind: string;
}

export interface GraphRelation {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  document_id: string;
  filename: string;
  chunk_id: string;
  page: number;
  text: string;
}

export interface EvalRun {
  id: string;
  model: string;
  judge_model: string;
  git_sha: string;
  started_at: string;
  finished_at: string | null;
  // Pass counts per layer, for example { ocr: { passed: 3, total: 4 } }.
  layers: Record<string, { passed: number; total: number }>;
}

export interface EvalResult {
  id: string;
  eval_run_id: string;
  case_id: string;
  layer: "ocr" | "retrieval" | "graph" | "agent" | "answer";
  passed: boolean;
  score: number | null;
  details: Record<string, unknown>;
}

/** The URL of a run's event stream, for EventSource. `after` resumes after that event number. */
export function runEventsUrl(workspaceId: string, runId: string, after?: number): string {
  const query = after === undefined ? "" : `?after=${after}`;
  return `${API_URL}/workspaces/${workspaceId}/runs/${runId}/events${query}`;
}

/** The URL of an artifact's download, for a plain link. */
export function artifactDownloadUrl(workspaceId: string, artifactId: string): string {
  return `${API_URL}/workspaces/${workspaceId}/artifacts/${artifactId}/download`;
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") headers["X-TaskMaster"] = "1";

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, { method, headers, body: payload });

  if (!response.ok) {
    let error = "error";
    let message = response.statusText;
    try {
      const data = (await response.json()) as { error?: string; message?: string };
      error = data.error ?? error;
      message = data.message ?? message;
    } catch {
      // The body was not JSON; keep the defaults.
    }
    throw new ApiError(response.status, error, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const ws = (wid: string) => `/workspaces/${wid}`;
const q = (params: Record<string, string>) => `?${new URLSearchParams(params).toString()}`;

export const api = {
  health: () => request<{ ok: true }>("GET", "/health"),

  // Workspaces
  createWorkspace: (name: string) => request<Workspace>("POST", "/workspaces", { name }),
  listWorkspaces: () => request<Workspace[]>("GET", "/workspaces"),
  getWorkspace: (wid: string) => request<Workspace>("GET", ws(wid)),
  renameWorkspace: (wid: string, name: string) => request<Workspace>("PATCH", ws(wid), { name }),
  deleteWorkspace: (wid: string) => request<void>("DELETE", ws(wid)),

  // Documents
  uploadDocument: (wid: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<TaskDocument>("POST", `${ws(wid)}/documents`, form);
  },
  listDocuments: (wid: string) => request<TaskDocument[]>("GET", `${ws(wid)}/documents`),
  getDocument: (wid: string, id: string) => request<TaskDocument>("GET", `${ws(wid)}/documents/${id}`),
  deleteDocument: (wid: string, id: string) => request<void>("DELETE", `${ws(wid)}/documents/${id}`),

  // Threads and messages
  createThread: (wid: string, title?: string) =>
    request<Thread>("POST", `${ws(wid)}/threads`, title === undefined ? {} : { title }),
  listThreads: (wid: string) => request<Thread[]>("GET", `${ws(wid)}/threads`),
  renameThread: (wid: string, tid: string, title: string) =>
    request<Thread>("PATCH", `${ws(wid)}/threads/${tid}`, { title }),
  deleteThread: (wid: string, tid: string) => request<void>("DELETE", `${ws(wid)}/threads/${tid}`),
  listMessages: (wid: string, tid: string) =>
    request<Message[]>("GET", `${ws(wid)}/threads/${tid}/messages`),

  // Runs
  getActiveRun: (wid: string, tid: string) =>
    request<Run | null>("GET", `${ws(wid)}/threads/${tid}/runs/active`),
  createRun: (wid: string, tid: string, message: string) =>
    request<Run>("POST", `${ws(wid)}/threads/${tid}/runs`, { message }),
  getRun: (wid: string, rid: string) => request<Run>("GET", `${ws(wid)}/runs/${rid}`),
  cancelRun: (wid: string, rid: string) => request<Run>("POST", `${ws(wid)}/runs/${rid}/cancel`),
  decideApproval: (wid: string, rid: string, approve: boolean) =>
    request<Run>("POST", `${ws(wid)}/runs/${rid}/approval`, { approve }),

  // Artifacts
  listArtifacts: (wid: string) => request<ArtifactSummary[]>("GET", `${ws(wid)}/artifacts`),
  getArtifact: (wid: string, id: string) => request<Artifact>("GET", `${ws(wid)}/artifacts/${id}`),
  renameArtifact: (wid: string, id: string, title: string) =>
    request<Artifact>("PATCH", `${ws(wid)}/artifacts/${id}`, { title }),
  deleteArtifact: (wid: string, id: string) => request<void>("DELETE", `${ws(wid)}/artifacts/${id}`),

  // Search and graph
  search: (wid: string, query: string) =>
    request<{ results: SearchResult[] }>("GET", `${ws(wid)}/search${q({ q: query })}`),
  graph: (wid: string, entity: string) =>
    request<{ entities: GraphEntity[]; relations: GraphRelation[] }>(
      "GET",
      `${ws(wid)}/graph${q({ entity })}`,
    ),

  // Evals
  listEvalRuns: () => request<EvalRun[]>("GET", "/evals/runs"),
  listEvalResults: (id: string) => request<EvalResult[]>("GET", `/evals/runs/${id}/results`),
};

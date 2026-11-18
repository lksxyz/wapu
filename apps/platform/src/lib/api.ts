// Typed fetch wrapper — always include credentials so session cookies travel.

const BASE = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Projects ──────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  userId: string;
  name: string;
  slug: string;
  isDeployed: boolean;
  deployVersion: number;
  createdAt: string;
}

export interface MessageStep {
  stage: string;
  label: string;
  state: "active" | "done" | "error";
  detail?: string;
}

export interface Message {
  id: string;
  projectId: string;
  role: "user" | "assistant";
  content: string;
  steps?: MessageStep[];
  /** The server left a page on disk for this turn. */
  saved?: boolean;
  /** The turn itself failed; a rejected tool call is not this. */
  failed?: boolean;
  createdAt: string;
}

export interface AskedQuestion {
  question: string;
  options: string[];
}

export interface PendingQuestion {
  id: string;
  questions: AskedQuestion[];
}

export interface ProjectDetail extends Project {
  messages: Message[];
  previewUrl: string;
  deployUrl: string | null;
  phase: "intake" | "intake_asked" | "build";
  design: string | null;
  pendingQuestion: PendingQuestion | null;
}

interface DeployResult {
  slug: string;
  isDeployed: boolean;
  deployVersion: number;
  url: string | null;
}

export const api = {
  projects: {
    list: () => apiFetch<Project[]>("/api/projects"),
    create: (name: string) =>
      apiFetch<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    get: (id: string) => apiFetch<ProjectDetail>(`/api/projects/${id}`),
    delete: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
    deploy: (id: string) =>
      apiFetch<DeployResult>(`/api/projects/${id}/deploy`, { method: "POST" }),
    previewUrl: (id: string) => apiFetch<{ url: string }>(`/api/projects/${id}/preview-url`),
    stop: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/projects/${id}/stop`, {
        method: "POST",
      }),
  },
};

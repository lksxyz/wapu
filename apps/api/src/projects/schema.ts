export type ProjectPhase = "intake" | "intake_asked" | "build";

export interface AskedQuestion {
  question: string;
  options: string[];
}

/** The card the agent left open, stored so a reload still shows it. */
export interface PendingQuestion {
  id: string;
  questions: AskedQuestion[];
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  slug: string;
  /** fx session id; a capability, so it never leaves the server. */
  sessionId: string;
  isDeployed: boolean;
  deployVersion: number;
  createdAt: string;
  phase: ProjectPhase;
  /** design/ slug the page is generated from; null until the person picks one. */
  design: string | null;
  pendingQuestion: PendingQuestion | null;
}

export type PublicProject = Omit<Project, "sessionId" | "phase" | "design" | "pendingQuestion">;

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
  /** Assistant turns only: the turn left a page on disk. */
  saved?: boolean;
  createdAt: string;
}

export interface ProjectWithDetails extends PublicProject {
  messages: Message[];
  previewUrl: string;
  deployUrl: string | null;
  phase: ProjectPhase;
  design: string | null;
  pendingQuestion: PendingQuestion | null;
}

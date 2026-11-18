export type TraceState = "active" | "done" | "error";

export interface TraceStep {
  stage: string;
  label: string;
  state: TraceState;
  detail?: string;
  startedAt?: number;
  endedAt?: number;
}

export interface ChatTrace {
  steps: TraceStep[];
  startedAt?: number;
  endedAt?: number;
  chars?: number;
  reasoning?: string;
}

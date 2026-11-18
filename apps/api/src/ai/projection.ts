import { Effect } from "effect";
import type { FxStreamLine } from "libfx";
import { agent } from "./agent.js";
import { stripHtmlFence } from "./extract-html.js";
import { pageSaved } from "./turn-gate.js";
import { replaceMessages } from "../projects/storage.js";
import type { Message, MessageStep, Project } from "../projects/schema.js";

const IDLE_MS = 400;

interface TurnAccumulator {
  text: string;
  steps: MessageStep[];
  wroteFile: boolean;
  asked: boolean;
}

function inputPath(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input) || !("path" in input)) {
    return undefined;
  }
  return typeof input.path === "string" ? input.path : undefined;
}

function stepLabel(name: string, input: unknown): string {
  const path = inputPath(input);

  if (name === "write_file") return path ? `Writing ${path}` : "Writing file";
  if (name === "read_file") return path ? `Reading ${path}` : "Reading file";
  if (name === "list_files") return "Listing files";
  return name.replace(/_/g, " ");
}

function stepDetail(input: unknown): string | undefined {
  const path = inputPath(input);
  return path ? path.slice(0, 160) : undefined;
}

function applyLine(
  line: FxStreamLine,
  messages: Message[],
  active: Map<string, TurnAccumulator>,
  projectId: string,
  createdAt: string,
): void {
  if (line.type === "turn_start") {
    if (line.input) {
      messages.push({
        id: `u:${line.messageId}`,
        projectId,
        role: "user",
        content: line.input,
        createdAt,
      });
    }
    active.set(line.messageId, { text: "", steps: [], wroteFile: false, asked: false });
    return;
  }

  if (line.type === "turn_end") {
    const turn = active.get(line.messageId);
    if (!turn) return;
    const failed = line.stopReason === "error" || line.stopReason === "unknown";
    for (const step of turn.steps) {
      if (step.state === "active") step.state = failed ? "error" : "done";
    }
    if (turn.text.length > 0 || turn.steps.length > 0) {
      const content = turn.asked ? stripHtmlFence(turn.text) : turn.text;
      messages.push({
        id: `a:${line.messageId}`,
        projectId,
        role: "assistant",
        // The card is the reply; a whitespace-only stream leaves no prose.
        content: content.trim().length > 0 ? content : "",
        steps: turn.steps.length > 0 ? turn.steps : undefined,
        saved: pageSaved(line.stopReason, turn.wroteFile, turn.asked, turn.text),
        failed,
        createdAt,
      });
    }
    active.delete(line.messageId);
    return;
  }

  if (line.type !== "text_delta" && line.type !== "tool_start" && line.type !== "tool_end") {
    return;
  }

  const turn = active.get(line.messageId);
  if (!turn) return;

  if (line.type === "text_delta") {
    turn.text += line.delta;
    return;
  }

  if (line.type === "tool_start") {
    turn.steps.push({
      stage: `tool:${line.id}`,
      label: stepLabel(line.name, line.input),
      state: "active",
      detail: stepDetail(line.input),
    });
    return;
  }

  const step = turn.steps.find((candidate) => candidate.stage === `tool:${line.id}`);
  if (step) {
    step.state = line.isError ? "error" : "done";
  }
  if (line.name === "write_file" && !line.isError) {
    turn.wroteFile = true;
  }
  if (line.name === "ask_user" && !line.isError) {
    turn.asked = true;
  }
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  ms: number,
): Promise<{ done: boolean; value?: Uint8Array } | null> {
  const { promise: timeout, resolve } = Promise.withResolvers<null>();
  const timer = setTimeout(() => resolve(null), ms);
  try {
    return await Promise.race([reader.read(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// The fx session is canonical. This projection is disposable and rebuilt from
// the stored stream, so a crash or a wipe can never leave two writers.
export async function rebuildProjection(project: Project): Promise<void> {
  const reader = agent.session(project.sessionId).stream(0).getReader();
  const decoder = new TextDecoder();
  const messages: Message[] = [];
  const active = new Map<string, TurnAccumulator>();
  const createdAt = new Date().toISOString();
  let buffer = "";

  try {
    while (true) {
      const result = await readWithTimeout(reader, IDLE_MS);
      if (!result || result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const raw = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
        if (!raw) continue;
        try {
          applyLine(JSON.parse(raw) as FxStreamLine, messages, active, project.id, createdAt);
        } catch {
          // Ignore a malformed line; the next rebuild starts from the same log.
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  await Effect.runPromise(replaceMessages(project.id, messages));
}

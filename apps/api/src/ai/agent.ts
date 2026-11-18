import fs from "node:fs/promises";
import path from "node:path";
import { createFxAgent } from "libfx";
import { local } from "libfx/durable-local";
import { API_ROOT } from "../projects/workspace.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { fileTools } from "./tools.js";

export const SESSIONS_DIR = process.env.FX_SESSIONS_DIR ?? path.join(API_ROOT, ".fx", "sessions");

const model = process.env.OPENAI_MODEL ?? "gpt-4o";
const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const apiKey = process.env.OPENAI_API_KEY;

// Sumopod (and other OpenAI-compatible routers) send a usage-only chunk after
// the chunk that carries finish_reason. libfx 0.0.17 reads that trailing
// "choices" event as a second completion and fails the whole turn with
// InconsistentFinishReason. Drop chunks whose choices carry neither content
// nor a finish reason: they exist only to report usage.
const chatUrl = `${baseUrl}/chat/completions`;
const dropTrailingUsageChunks: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (String(input) !== chatUrl || !response.body) return response;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new Response(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer) controller.enqueue(encoder.encode(buffer));
            controller.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          let out = "";
          let sawData = false;
          for (const line of lines) {
            if (!line.startsWith("data: ") || line === "data: [DONE]") {
              out += line + "\n";
              continue;
            }
            sawData = true;
            if (isUsageOnlyChunk(line.slice(6))) continue;
            out += line + "\n";
          }
          if (sawData) out += "\n";
          if (out) {
            controller.enqueue(encoder.encode(out));
            return;
          }
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    }),
    { status: response.status, headers: response.headers },
  );
};

function isUsageOnlyChunk(payload: string): boolean {
  let chunk: unknown;
  try {
    chunk = JSON.parse(payload);
  } catch {
    return false;
  }
  if (typeof chunk !== "object" || chunk === null || !("choices" in chunk)) return false;
  const { choices } = chunk;
  if (!Array.isArray(choices) || choices.length === 0) return false;
  return choices.every(isEmptyChoice);
}

function isEmptyChoice(choice: unknown): boolean {
  if (typeof choice !== "object" || choice === null) return false;
  if ("finish_reason" in choice && choice.finish_reason != null) return false;
  if (!("delta" in choice)) return true;
  const { delta } = choice;
  if (typeof delta !== "object" || delta === null) return true;
  return !("content" in delta) && !("tool_calls" in delta) && !("reasoning_content" in delta);
}

export const agent = createFxAgent({
  name: "wapu",
  model,
  provider: {
    name: "wapu-openai",
    baseUrl,
    models: {
      [model]: {
        contextWindow: 200_000,
        maxOutputTokens: 32_000,
        supportsToolUse: true,
        request: { temperature: 0.2, top_p: 0.9 },
      },
    },
  },
  ...(apiKey ? { credentials: async () => ({ apiKey }) } : {}),
  fetch: dropTrailingUsageChunks,
  durability: local({ dir: SESSIONS_DIR }),
  instructions: SYSTEM_PROMPT,
  tools: fileTools,
});

// libfx has no session-delete API. Its local store is file-per-session, so
// cascade deletion removes the known session paths after cancelling it.
export async function deleteSessionData(sessionId: string): Promise<void> {
  if (!/^wrun_[A-Za-z0-9]+$/.test(sessionId)) return;

  const known = [
    path.join(SESSIONS_DIR, "events", sessionId),
    path.join(SESSIONS_DIR, "runs", `${sessionId}.json`),
    path.join(SESSIONS_DIR, "steps", sessionId),
    path.join(SESSIONS_DIR, "streams", "runs", `${sessionId}.json`),
    path.join(SESSIONS_DIR, ".locks", "runs", `${sessionId}.in-band`),
  ];

  const patterns: { dir: string; prefix: string }[] = [
    { dir: path.join(SESSIONS_DIR, ".locks", "steps"), prefix: `${sessionId}-` },
    { dir: path.join(SESSIONS_DIR, "streams", "chunks"), prefix: `strm_${sessionId}_` },
  ];

  await Promise.all(known.map((target) => fs.rm(target, { recursive: true, force: true })));
  for (const { dir, prefix } of patterns) {
    const entries = await fs.readdir(dir).catch(() => [] as string[]);
    await Promise.all(
      entries
        .filter((entry) => entry.startsWith(prefix))
        .map((entry) => fs.rm(path.join(dir, entry), { recursive: true, force: true })),
    );
  }
}

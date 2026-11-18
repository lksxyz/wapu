import { agent, deleteSessionData } from "./src/ai/agent.js";
import { designStyles } from "./src/ai/design.js";
import { buildPrompt } from "./src/ai/prompt.js";

const styles = await designStyles();
const web20 = styles.find((s) => s.slug === "web20-2004-2010")!;

const sessionId = await agent.newSessionId();
const session = agent.session(sessionId, {
  instructions: [buildPrompt(web20, "")],
  context: { projectId: "invalid", userId: "test", phase: "build" },
});

const started = Date.now();
const turn = session.prompt(
  'Build a personal portfolio with an intro, a project grid with hover previews, and a contact section. Use the "Web 2.0 (2004-2010)" design.',
);
await turn.accepted;

const reader = turn.readable.getReader();
const decoder = new TextDecoder();
let buffer = "";
let text = "";
let tools = 0;
let end = false;

const deadline = Date.now() + 180_000;
while (!end && Date.now() < deadline) {
  const result = await reader.read();
  if (result.done) break;
  buffer += decoder.decode(result.value, { stream: true });
  let newline = buffer.indexOf("\n");
  while (newline >= 0) {
    const raw = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    newline = buffer.indexOf("\n");
    if (!raw) continue;
    try {
      const event = JSON.parse(raw) as { type: string; delta?: string };
      if (event.type === "text_delta") text += event.delta ?? "";
      if (event.type === "tool_start") tools += 1;
      if (event.type === "turn_end") end = true;
    } catch {
      // partial line
    }
  }
  if (text.length > 700) {
    await session.cancel().catch(() => {});
    break;
  }
}

await reader.cancel().catch(() => {});
await turn.result.catch(() => null);
console.log("seconds:", ((Date.now() - started) / 1000).toFixed(1));
console.log("chars:", text.length, "tools:", tools);
console.log("start:", JSON.stringify(text.slice(0, 200)));
console.log("fence:", text.startsWith("```html"));
console.log("doctype:", /<!DOCTYPE html>/i.test(text));
await deleteSessionData(sessionId).catch(() => {});

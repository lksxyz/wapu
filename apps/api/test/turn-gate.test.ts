import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FxStreamLine } from "libfx";
import { stripHtmlFence } from "../src/ai/extract-html.js";
import {
  applyTurnLine,
  newTurnGate,
  pageSaved,
  shouldExtract,
  type TurnGate,
} from "../src/ai/turn-gate.js";

const fence = "```html\n<!DOCTYPE html><html><body>page</body></html>\n```";

// Shapes copied from recorded streams under .fx/sessions/streams/chunks.
const text = (delta: string): FxStreamLine =>
  ({ type: "text_delta", delta, messageId: "msg_test" }) as FxStreamLine;
const toolEnd = (isError: boolean): FxStreamLine =>
  ({
    type: "tool_end",
    id: "call_test",
    name: "write_file",
    content: isError ? "insufficient credits" : '{"ok":true}',
    isError,
    messageId: "msg_test",
  }) as FxStreamLine;
const toolAsk = (): FxStreamLine =>
  ({
    type: "tool_end",
    id: "call_ask",
    name: "ask_user",
    content: '{"asked":true}',
    isError: false,
    messageId: "msg_test",
  }) as FxStreamLine;
const turnEnd = (stopReason: string): FxStreamLine =>
  ({ type: "turn_end", messageId: "msg_test", stopReason }) as FxStreamLine;

function gateWith(...lines: FxStreamLine[]): TurnGate {
  const gate = newTurnGate();
  for (const line of lines) applyTurnLine(gate, line);
  return gate;
}

describe("shouldExtract", () => {
  it("refuses extraction when the turn ended in error after a closed fence", () => {
    const gate = gateWith(text(`Here it is:\n${fence}`), turnEnd("error"));
    assert.equal(shouldExtract(gate, false), false);
    assert.equal(gate.reply.includes("</html>"), true);
  });

  it("refuses extraction when the turn was cancelled after tool traffic", () => {
    const gate = gateWith(text("Let me look."), toolEnd(false), text(fence), turnEnd("cancelled"));
    assert.equal(shouldExtract(gate, false), false);
  });

  it("extracts on end_turn with a closed fence", () => {
    const gate = gateWith(text(fence), turnEnd("end_turn"));
    assert.equal(shouldExtract(gate, false), true);
  });

  it("refuses extraction when the stream never emitted turn_end", () => {
    const gate = gateWith(text(`Partial:\n${fence}`));
    assert.equal(gate.stopReason, undefined);
    assert.equal(shouldExtract(gate, false), false);
  });

  it("refuses extraction after a successful write_file", () => {
    const gate = gateWith(toolEnd(false), text(fence), turnEnd("end_turn"));
    assert.equal(gate.wroteFile, true);
    assert.equal(shouldExtract(gate, false), false);
  });

  it("refuses extraction when write_file succeeded and the turn then failed", () => {
    const gate = gateWith(toolEnd(false), text(fence), turnEnd("error"));
    assert.equal(shouldExtract(gate, false), false);
  });

  it("extracts when write_file failed, since the file was never written", () => {
    const gate = gateWith(toolEnd(true), text(fence), turnEnd("end_turn"));
    assert.equal(gate.wroteFile, false);
    assert.equal(shouldExtract(gate, false), true);
  });

  it("refuses extraction when the turn asked a question, even with a page attached", () => {
    const gate = gateWith(toolAsk(), text(fence), turnEnd("end_turn"));
    assert.equal(gate.asked, true);
    assert.equal(shouldExtract(gate, false), false);
  });

  it("never extracts on an intake turn", () => {
    const gate = gateWith(text(fence), turnEnd("end_turn"));
    assert.equal(shouldExtract(gate, true), false);
  });

  it("does not carry a previous turn's failure into the next gate", () => {
    const failed = gateWith(text(fence), turnEnd("error"));
    assert.equal(shouldExtract(failed, false), false);

    const next = gateWith(text(fence), turnEnd("end_turn"));
    assert.equal(shouldExtract(next, false), true);
  });
});

describe("pageSaved", () => {
  it("records no save when a cancelled turn carried a closed fence", () => {
    assert.equal(pageSaved("cancelled", false, false, fence), false);
  });

  it("records no save when the stream never ended", () => {
    assert.equal(pageSaved(undefined, false, false, `Partial:\n${fence}`), false);
  });

  it("records a save on end_turn with a page", () => {
    assert.equal(pageSaved("end_turn", false, false, `Here:\n${fence}`), true);
  });

  it("records a save after a successful write_file", () => {
    assert.equal(pageSaved("error", true, false, ""), true);
  });

  it("records no save for a turn that only asked", () => {
    assert.equal(pageSaved("end_turn", false, true, fence), false);
  });
});

describe("stripHtmlFence", () => {
  it("drops a page but keeps the sentence around it", () => {
    const text = `Pick one above.\n${fence}`;
    assert.equal(stripHtmlFence(text), "Pick one above.");
  });

  it("leaves ordinary prose untouched", () => {
    assert.equal(stripHtmlFence("Just words."), "Just words.");
  });
});

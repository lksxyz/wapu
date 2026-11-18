import type { FxStreamLine } from "libfx";
import { extractHtml } from "./extract-html.js";

// One turn's stream, reduced to the three facts the route needs after the
// stream ends. A fresh gate per turn: nothing is reset, so nothing can leak.
export interface TurnGate {
  reply: string;
  wroteFile: boolean;
  asked: boolean;
  stopReason?: string;
}

export function newTurnGate(): TurnGate {
  return { reply: "", wroteFile: false, asked: false, stopReason: undefined };
}

export function applyTurnLine(gate: TurnGate, line: FxStreamLine): void {
  if (line.type === "text_delta") {
    gate.reply += line.delta ?? "";
  } else if (line.type === "tool_end" && !line.isError) {
    if (line.name === "write_file") gate.wroteFile = true;
    if (line.name === "ask_user") gate.asked = true;
  } else if (line.type === "turn_end") {
    gate.stopReason = line.stopReason;
  }
}

// Fail closed: only a turn that said `end_turn` may publish the reply's html.
// A stream that stops without a `turn_end` line (dropped connection, killed
// process) leaves `stopReason` undefined and is not extractable. A turn that
// asked a question is an interview, not a build, even if the model also typed
// a page into the same reply.
export function shouldExtract(gate: TurnGate, intakeTurn: boolean): boolean {
  return !intakeTurn && !gate.wroteFile && !gate.asked && gate.stopReason === "end_turn";
}

// Whether this turn left a page in the workspace: a successful write_file, or
// a reply the extraction gate accepted. The projection stores it so the
// transcript never claims a save that did not happen.
export function pageSaved(
  stopReason: string | undefined,
  wroteFile: boolean,
  asked: boolean,
  reply: string,
): boolean {
  if (wroteFile) return true;
  if (asked) return false;
  return stopReason === "end_turn" && extractHtml(reply) !== null;
}

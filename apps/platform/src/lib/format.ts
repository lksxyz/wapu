function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderText(source: string): string {
  const escaped = escapeHtml(source)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");

  return escaped
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").filter((line) => line.trim().length > 0);
      if (lines.length === 0) return "";
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        const items = lines.map((line) => `<li>${line.replace(/^\s*[-*]\s+/, "")}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
        const items = lines
          .map((line) => `<li>${line.replace(/^\s*\d+[.)]\s+/, "")}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }
      return `<p>${block.trim().replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

// Renders assistant prose as safe markup: escapes first, then adds only the
// inline shapes the model actually uses. Generated HTML collapses to a pill —
// the real page lives in the preview pane, not in the transcript.
export function formatProse(source: string, saved = false): string {
  const fence = /```([a-zA-Z]*)\s*\n?([\s\S]*?)(?:```|$)/g;
  let out = "";
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(source))) {
    out += renderText(source.slice(last, match.index));

    const lang = match[1].toLowerCase();
    const body = match[2].trim();
    const looksLikeHtml = /^<(!doctype|html|head|body)/i.test(body);

    if (lang === "html" || (lang === "" && looksLikeHtml)) {
      // The page lives in the canvas. Claim a save only when the server says
      // one happened; a turn that only asked a question says nothing at all.
      if (saved) {
        out +=
          '<div class="artifact"><span class="artifact-mark">✓</span><div class="artifact-copy"><span class="artifact-title">Page saved</span><span class="artifact-note">Preview refreshed in the canvas</span></div></div>';
      }
    } else {
      out += `<pre class="code"><code>${escapeHtml(body)}</code></pre>`;
    }

    last = fence.lastIndex;
  }

  out += renderText(source.slice(last));
  return out;
}

export function titleFromPrompt(prompt: string): string {
  const line =
    prompt
      .replace(/```[\s\S]*?(?:```|$)/g, " ")
      .split("\n")
      .find((candidate) => candidate.trim().length > 0) ?? "";

  const clean = line
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "Untitled project";
  return clean.length > 56 ? `${clean.slice(0, 56).trimEnd()}…` : clean;
}

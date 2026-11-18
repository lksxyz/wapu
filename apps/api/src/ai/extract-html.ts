// The page the model returned: a fenced html block, or the first complete
// document in the reply. One reader, so the route and the projection agree on
// whether a turn produced a page.
export function extractHtml(text: string): string | null {
  const fenced = text.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  const body = fenced?.[1]?.trim();
  if (body && /^<!DOCTYPE html/i.test(body)) return body;

  const raw = text.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
  return raw?.[0] ?? null;
}

// A turn that asked a question is an interview: any page it scribbled into the
// reply must not reach the transcript, where it would read as a build.
export function stripHtmlFence(text: string): string {
  return text
    .replace(/```(?:html)?\s*\n?[\s\S]*?(?:```|$)/gi, (block) =>
      /<!DOCTYPE html/i.test(block) ? "" : block,
    )
    .trim();
}

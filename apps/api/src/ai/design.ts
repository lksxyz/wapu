import fs from "node:fs/promises";
import path from "node:path";
import { API_ROOT, projectDir } from "../projects/workspace.js";

export const DESIGN_DIR = path.resolve(API_ROOT, "../..", "design");

export interface DesignStyle {
  index: number;
  slug: string;
  title: string;
  summary: string;
  doc: string;
}

function trimAt(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > 40 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

function parseTitle(doc: string, file: string): string {
  const line = doc.match(/^#\s+DESIGN\.md:\s*(.+)$/m)?.[1]?.trim();
  if (line) return line;
  return file.replace(/^\d+-/, "").replace(/\.md$/, "").replace(/-/g, " ");
}

function parseSummary(doc: string): string {
  const purpose = doc.match(/^##\s+Purpose\s*\n+([^\n]+)/m)?.[1]?.trim();
  return purpose ? trimAt(purpose, 96) : "";
}

// The design folder is the whole menu. Nothing here invents a style.
export async function designStyles(): Promise<DesignStyle[]> {
  const files = (await fs.readdir(DESIGN_DIR)).filter((file) => file.endsWith(".md")).sort();

  const styles: DesignStyle[] = [];
  for (const file of files) {
    const doc = await fs.readFile(path.join(DESIGN_DIR, file), "utf-8");
    styles.push({
      index: styles.length + 1,
      slug: file.replace(/^\d+-/, "").replace(/\.md$/, ""),
      title: parseTitle(doc, file),
      summary: parseSummary(doc),
      doc,
    });
  }
  return styles;
}

// Only the binding parts of the document go into every request; the full file
// lives in the workspace as DESIGN.md. Markdown headings and bullets make small
// local models answer with markdown, so the brief is flattened to plain text.
export function styleBrief(style: DesignStyle): string {
  const sections = style.doc
    .split(/^## /m)
    .slice(1)
    .filter((section) => /^(Non-negotiable rules|Colors|Typography)\b/i.test(section));

  return sections
    .flatMap((section) => section.split("\n").slice(1))
    .map((line) =>
      line
        .replace(/^\s*[-*]\s+/, "")
        .replace(/`/g, "")
        .replace(/\*\*/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" ");
}

export async function installDesignDoc(projectId: string, doc: string): Promise<void> {
  const dir = projectDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "DESIGN.md"), doc, "utf-8");
}

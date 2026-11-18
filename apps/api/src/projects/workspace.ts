import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const API_ROOT = path.resolve(__dirname, "../..");
export const PROJECTS_DIR = path.join(API_ROOT, "projects");
export const DEPLOYS_DIR = path.join(API_ROOT, "deploys");
export const SCANS_DIR = path.join(API_ROOT, "scans");

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function projectDir(projectId: string): string {
  if (!ID_PATTERN.test(projectId)) throw new Error("Invalid project id");
  return path.join(PROJECTS_DIR, projectId);
}

// A crash or a full disk mid-write leaves a truncated index.html, which is the
// page the preview serves. Write beside the target and rename, so the visible
// file is always a complete one.
export async function writeFileAtomic(target: string, content: string): Promise<void> {
  const tmp = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  await fs.writeFile(tmp, content, "utf-8");
  try {
    await fs.rename(tmp, target);
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw error;
  }
}

export async function realProjectDir(projectId: string): Promise<string> {
  const base = await fs.realpath(PROJECTS_DIR);
  const root = await fs.realpath(projectDir(projectId));
  if (root !== base && !root.startsWith(base + path.sep)) {
    throw new Error("Project root escapes the projects directory");
  }
  return root;
}

export function deployRoot(projectId: string): string {
  if (!ID_PATTERN.test(projectId)) throw new Error("Invalid project id");
  return path.join(DEPLOYS_DIR, projectId);
}

export function snapshotDir(projectId: string, version: number): string {
  if (!Number.isInteger(version) || version < 1) throw new Error("Invalid deploy version");
  return path.join(deployRoot(projectId), String(version));
}

export async function copyWorkspace(projectId: string, version: number): Promise<void> {
  const target = snapshotDir(projectId, version);
  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(projectDir(projectId), target, { recursive: true, force: true });
}

export async function pruneSnapshots(projectId: string, keep = 5): Promise<void> {
  const root = deployRoot(projectId);
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const versions = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .sort((a, b) => b - a);

  await Promise.all(
    versions
      .slice(keep)
      .map((version) => fs.rm(path.join(root, String(version)), { recursive: true, force: true })),
  );
}

export async function deleteDeployments(projectId: string): Promise<void> {
  await fs.rm(deployRoot(projectId), { recursive: true, force: true });
}

// One-time cleanup when the v6 schema replaces the chat-based projects.
export async function resetLegacyWorkspaces(): Promise<void> {
  await fs.rm(PROJECTS_DIR, { recursive: true, force: true });
  await fs.rm(DEPLOYS_DIR, { recursive: true, force: true });
  await fs.rm(SCANS_DIR, { recursive: true, force: true });
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
}

export function scanImagePath(projectId: string): string {
  if (!ID_PATTERN.test(projectId)) throw new Error("Invalid project id");
  return path.join(SCANS_DIR, `${projectId}.png`);
}

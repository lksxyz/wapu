import type { Project } from "#lib/api";

export interface ProjectGroup {
  label: string;
  items: Project[];
}

const DAY = 86_400_000;

// ChatGPT-style history buckets. Order is fixed; empty buckets are dropped.
export function groupProjects(projects: Project[]): ProjectGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const buckets: ProjectGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Previous 30 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const project of [...projects].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )) {
    const age = Math.floor((todayStart - Date.parse(project.createdAt)) / DAY);
    if (age <= 0) buckets[0].items.push(project);
    else if (age === 1) buckets[1].items.push(project);
    else if (age <= 7) buckets[2].items.push(project);
    else if (age <= 30) buckets[3].items.push(project);
    else buckets[4].items.push(project);
  }

  return buckets.filter((bucket) => bucket.items.length > 0);
}

import type { AiSettings, LibrarySnapshot, ProjectSource, ResearchDocument } from "./types";

const normalize = (path: string) => path.replaceAll("\\", "/").replace(/\/+$/, "");
const cleanPart = (part: string) => part.trim().replace(/[<>:"|?*]/g, "_") || "Imported folder";

function sourceRootName(source: ProjectSource): string {
  return cleanPart(normalize(source.path).split("/").at(-1) || source.label);
}

export function organizeImportedDirectories(snapshot: LibrarySnapshot, projectId: string): AiSettings {
  const settings = snapshot.settings;
  const sources = snapshot.projectSources
    .filter((source) => source.projectId === projectId && source.kind === "folder")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  const roots = { ...(settings.librarySourceRoots?.[projectId] ?? {}) };
  const used = new Set(Object.values(roots).map((root) => root.toLocaleLowerCase()));
  for (const source of sources) {
    if (Object.hasOwn(roots, source.id)) continue;
    const base = sourceRootName(source);
    let candidate = base;
    for (let suffix = 2; used.has(candidate.toLocaleLowerCase()); suffix += 1) candidate = `${base} (${suffix})`;
    roots[source.id] = candidate;
    used.add(candidate.toLocaleLowerCase());
  }
  const rebuild = (settings.libraryDirectoryLayoutVersion?.[projectId] ?? 0) < 1;
  const groups = { ...(settings.libraryGroups?.[projectId] ?? {}) };
  const directories = new Set(settings.libraryDirectories?.[projectId] ?? []);
  const oldAssignedDirectories = new Set<string>();
  const byLength = [...sources].sort((left, right) => right.path.length - left.path.length);
  for (const document of snapshot.documents.filter((item) => item.projectId === projectId)) {
    if (!rebuild && Object.hasOwn(groups, document.id)) continue;
    const path = normalize(document.path);
    const source = byLength.find((item) => path.toLocaleLowerCase().startsWith(`${normalize(item.path).toLocaleLowerCase()}/`));
    if (!source) continue;
    if (rebuild && groups[document.id]) {
      const oldParts = groups[document.id].split("/");
      oldParts.forEach((_, index) => oldAssignedDirectories.add(oldParts.slice(0, index + 1).join("/")));
    }
    const relative = path.slice(normalize(source.path).length + 1).split("/").slice(0, -1).map(cleanPart);
    const parts = [roots[source.id], ...relative].filter(Boolean);
    groups[document.id] = parts.join("/");
    parts.forEach((_, index) => directories.add(parts.slice(0, index + 1).join("/")));
  }
  if (rebuild) {
    for (const oldDirectory of oldAssignedDirectories) {
      if (!Object.values(groups).some((group) => group === oldDirectory || group.startsWith(`${oldDirectory}/`))) directories.delete(oldDirectory);
    }
  }
  return {
    ...settings,
    librarySourceRoots: { ...(settings.librarySourceRoots ?? {}), [projectId]: roots },
    libraryDirectoryLayoutVersion: { ...(settings.libraryDirectoryLayoutVersion ?? {}), [projectId]: 1 },
    libraryGroups: { ...(settings.libraryGroups ?? {}), [projectId]: groups },
    libraryDirectories: { ...(settings.libraryDirectories ?? {}), [projectId]: [...directories].sort((a, b) => a.localeCompare(b)) },
  };
}

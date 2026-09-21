import { freshDemoSnapshot } from "./demoData";
import type {
  DocumentPayload,
  ExportFormat,
  ExportOptions,
  LibrarySnapshot,
  ResearchDocument,
} from "./types";
import { normalizeErgonomics } from "./ergonomics";

const STORAGE_KEY = "thematic.browser.library.v1";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri = () => typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

export function loadBrowserSnapshot(): LibrarySnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeBrowserSnapshot(JSON.parse(raw) as LibrarySnapshot);
  } catch {
    // A locked-down browser may deny storage; the in-memory demo remains usable.
  }
  return normalizeBrowserSnapshot(freshDemoSnapshot());
}

function normalizeBrowserSnapshot(snapshot: LibrarySnapshot): LibrarySnapshot {
  const fallbackProjectId = snapshot.projects[0]?.id ?? "";
  const inferredSources = snapshot.projects.flatMap((project) => {
    const documents = snapshot.documents.filter((document) => document.projectId === project.id);
    const candidate = project.folderPath?.replaceAll("\\", "/").replace(/\/$/, "");
    const candidateWorks = candidate && documents.some((document) => {
      const path = document.path.replaceAll("\\", "/").toLocaleLowerCase();
      return path === candidate.toLocaleLowerCase() || path.startsWith(`${candidate.toLocaleLowerCase()}/`);
    });
    const roots = candidateWorks ? [candidate] : [...new Set(documents.map((document) => document.path.replaceAll("\\", "/").split("/")[0]).filter(Boolean))];
    return roots.map((path, index) => ({
      id: `source-${project.id}-${index}`,
      projectId: project.id,
      kind: "folder" as const,
      path,
      label: path.split("/").at(-1) ?? project.title,
      createdAt: project.createdAt,
    }));
  });
  const normalizedThemes = snapshot.themes.map((theme) => ({ ...theme, projectId: theme.projectId ?? fallbackProjectId }));
  const normalizedExcerpts = snapshot.excerpts.map((excerpt) => ({ ...excerpt, annotationFormat: excerpt.annotationFormat ?? "plain" as const }));
  const inferredRelationships = [
    ...normalizedThemes.filter((theme) => theme.parentId).map((theme) => ({
      id: `theme-parent:${theme.id}`,
      projectId: theme.projectId,
      kind: "theme-parent" as const,
      sourceId: theme.parentId!,
      targetId: theme.id,
      label: theme.parentLabel ?? "",
      createdAt: theme.createdAt,
    })),
    ...normalizedExcerpts.flatMap((excerpt) => {
      const document = snapshot.documents.find((item) => item.id === excerpt.documentId);
      return excerpt.themeIds.map((themeId) => ({
        id: `excerpt-theme:${excerpt.id}:${themeId}`,
        projectId: document?.projectId ?? fallbackProjectId,
        kind: "excerpt-theme" as const,
        sourceId: excerpt.id,
        targetId: themeId,
        label: "",
        createdAt: excerpt.createdAt,
      }));
    }),
  ];
  return {
    ...snapshot,
    projectSources: snapshot.projectSources ?? inferredSources,
    themes: normalizedThemes,
    excerpts: normalizedExcerpts,
    relationships: snapshot.relationships?.length ? snapshot.relationships : inferredRelationships,
    settings: {
      ...snapshot.settings,
      provider: snapshot.settings.provider === "llama_cpp" ? "llama_cpp" : "ollama",
      defaultNoteFormat: snapshot.settings.defaultNoteFormat ?? "plain",
      graphLabelMode: snapshot.settings.graphLabelMode ?? "hover",
      graphZoom: snapshot.settings.graphZoom ?? 100,
      graphNodeScale: snapshot.settings.graphNodeScale ?? 55,
      defaultReaderZoom: snapshot.settings.defaultReaderZoom ?? 100,
      defaultExcerptColor: snapshot.settings.defaultExcerptColor ?? "#efd982",
      defaultNoteColor: snapshot.settings.defaultNoteColor ?? "#edb807",
      defaultThemeShape: snapshot.settings.defaultThemeShape ?? "square",
      defaultExcerptShape: snapshot.settings.defaultExcerptShape ?? "circle",
      defaultGraphLayout: snapshot.settings.defaultGraphLayout ?? "stress",
      uiFontScale: snapshot.settings.uiFontScale ?? 100,
      ergonomics: normalizeErgonomics(snapshot.settings),
      onlineCitationLookup: snapshot.settings.onlineCitationLookup ?? false,
      citationContactEmail: snapshot.settings.citationContactEmail ?? "",
      llamaExecutable: snapshot.settings.llamaExecutable ?? "llama-server",
      llamaModelPath: snapshot.settings.llamaModelPath ?? "",
      llamaMmprojPath: snapshot.settings.llamaMmprojPath ?? "",
      llamaServerArguments: snapshot.settings.llamaServerArguments ?? "--ctx-size 4096 --n-gpu-layers 99",
      llamaEnableVision: snapshot.settings.llamaEnableVision ?? false,
      graphNodePositions: snapshot.settings.graphNodePositions ?? {},
      graphPinnedLabels: snapshot.settings.graphPinnedLabels ?? [],
      graphWorkspaces: snapshot.settings.graphWorkspaces ?? {},
      synthesisWorkspaces: snapshot.settings.synthesisWorkspaces ?? {},
    },
  };
}

export function saveBrowserSnapshot(snapshot: LibrarySnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Avoid turning a storage quota issue into an unusable reader.
  }
}

export function resetBrowserSnapshot(): LibrarySnapshot {
  const snapshot = normalizeBrowserSnapshot(freshDemoSnapshot());
  saveBrowserSnapshot(snapshot);
  return snapshot;
}

export async function invokeBackend<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function loadInitialSnapshot(): Promise<LibrarySnapshot> {
  if (!isTauri()) return loadBrowserSnapshot();
  return invokeBackend<LibrarySnapshot>("get_library");
}

export async function readDocumentPayload(document: ResearchDocument): Promise<DocumentPayload> {
  if (!isTauri()) {
    return { kind: document.kind, content: document.content };
  }
  return invokeBackend<DocumentPayload>("read_document", { documentId: document.id });
}

function csvCell(value: unknown): string {
  const stringValue = value == null ? "" : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function downloadBrowserCsv(snapshot: LibrarySnapshot, projectId?: string): void {
  const documentIds = new Set(snapshot.documents.filter((item) => !projectId || item.projectId === projectId).map((item) => item.id));
  const header = [
    "excerpt_id",
    "document_title",
    "file_name",
    "authors",
    "publication_date",
    "doi",
    "document_type",
    "citation_key",
    "page_or_locator",
    "excerpt",
    "annotation",
    "excerpt_type",
    "highlight_color",
    "annotation_format",
    "themes",
    "created_at",
  ];
  const rows = snapshot.excerpts.filter((excerpt) => documentIds.has(excerpt.documentId)).map((excerpt) => {
    const document = snapshot.documents.find((item) => item.id === excerpt.documentId);
    const themes = excerpt.themeIds
      .map((id) => snapshot.themes.find((theme) => theme.id === id)?.name)
      .filter(Boolean)
      .join("; ");
    return [
      excerpt.id,
      document?.title,
      document?.fileName,
      document?.authors,
      document?.publicationDate,
      document?.doi,
      document?.documentType,
      document?.citationKey,
      excerpt.page ? `p. ${excerpt.page}` : excerpt.locator,
      excerpt.text,
      excerpt.annotation,
      excerpt.kind ?? "text",
      excerpt.color ?? "#efd982",
      excerpt.annotationFormat ?? "plain",
      themes,
      excerpt.createdAt,
    ].map(csvCell);
  });
  const csv = `\uFEFF${[header.map(csvCell), ...rows].map((row) => row.join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  const project = snapshot.projects.find((item) => item.id === projectId);
  const projectName = (project?.title ?? "thematic-library").trim().replace(/[^\p{L}\p{N}_ -]+/gu, "-").replace(/\s+/g, "-");
  anchor.download = `${projectName || "thematic-library"}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportLibrary(format: ExportFormat, projectId?: string, options?: ExportOptions): Promise<{ path?: string }> {
  if (isTauri()) {
    return invokeBackend<{ path?: string }>("export_library", { format, projectId, options });
  }
  if (format !== "csv") {
    throw new Error(`${format.toUpperCase()} export is available in the desktop build. CSV works in this browser demo.`);
  }
  return {};
}

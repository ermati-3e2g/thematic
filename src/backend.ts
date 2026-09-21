import type {
  AiSettings,
  DocumentPayload,
  Excerpt,
  ExportFormat,
  ExportOptions,
  GraphRelationship,
  LibrarySnapshot,
  RelinkCandidate,
  ResearchDocument,
  Theme,
} from "./types";
import { invokeBackend, isTauri, loadBrowserSnapshot, saveBrowserSnapshot } from "./storage";

type NewTheme = Pick<Theme, "name" | "description" | "color" | "parentId" | "parentLabel" | "projectId">;

export interface BundlePreview {
  path: string; title: string; manifestHash: string; documents: number; bundledDocuments: number; excerpts: number; themes: number;
  graphPositions: number; pinnedLabels: number; graphNotes: number; screeningRecords: number; extractionRecords: number;
  claims: number; draftSections: number; recoveryCheckpoints: number; warnings: string[];
}
export interface RepairMatch { kind: string; sourceId: string; label: string; suggestedId?: string; candidates: Array<{ id: string; label: string }> }
export interface RepairPreview { bundle: BundlePreview; projectId: string; matches: RepairMatch[] }

export const backend = {
  desktop: isTauri(),

  async getLibrary(): Promise<LibrarySnapshot> {
    return isTauri() ? invokeBackend<LibrarySnapshot>("get_library") : loadBrowserSnapshot();
  },

  async createProject(title: string): Promise<LibrarySnapshot> {
    return invokeBackend<LibrarySnapshot>("create_project", { title });
  },

  async renameProject(projectId: string, title: string): Promise<LibrarySnapshot> {
    return invokeBackend<LibrarySnapshot>("rename_project", { projectId, title });
  },

  async deleteProject(projectId: string): Promise<LibrarySnapshot> {
    return invokeBackend<LibrarySnapshot>("delete_project", { projectId });
  },

  async saveProjectState(projectId: string): Promise<string> {
    return invokeBackend<string>("save_project_state", { projectId });
  },

  async chooseAndScanFolder(projectId?: string): Promise<LibrarySnapshot> {
    return invokeBackend<LibrarySnapshot>("choose_and_scan_folder", { projectId });
  },

  async chooseAndScanFiles(projectId: string): Promise<LibrarySnapshot> {
    return invokeBackend<LibrarySnapshot>("choose_and_scan_files", { projectId });
  },

  async rescanProject(projectId: string): Promise<LibrarySnapshot> {
    return invokeBackend<LibrarySnapshot>("rescan_project", { projectId });
  },

  async readDocument(documentId: string, fallback?: ResearchDocument): Promise<DocumentPayload> {
    if (!isTauri()) return { kind: fallback?.kind ?? "markdown", content: fallback?.content };
    return invokeBackend<DocumentPayload>("read_document", { documentId });
  },

  async chooseRelinkCandidate(documentId: string): Promise<RelinkCandidate | null> {
    return invokeBackend<RelinkCandidate | null>("choose_relink_candidate", { documentId });
  },

  async relinkDocument(documentId: string, candidatePath: string, allowHashMismatch: boolean): Promise<LibrarySnapshot> {
    return invokeBackend<LibrarySnapshot>("relink_document", { documentId, candidatePath, allowHashMismatch });
  },

  async createExcerpt(excerpt: Excerpt): Promise<Excerpt> {
    return invokeBackend<Excerpt>("create_excerpt", { excerpt });
  },

  async updateExcerpt(excerpt: Excerpt): Promise<Excerpt> {
    return invokeBackend<Excerpt>("update_excerpt", { excerpt });
  },

  async deleteExcerpt(excerptId: string): Promise<void> {
    await invokeBackend("delete_excerpt", { excerptId });
  },

  async updateDocument(document: ResearchDocument): Promise<ResearchDocument> {
    return invokeBackend<ResearchDocument>("update_document", { document });
  },

  async lookupCitationMetadata(document: ResearchDocument): Promise<ResearchDocument> {
    return invokeBackend<ResearchDocument>("lookup_citation_metadata", { document });
  },

  async createTheme(theme: NewTheme): Promise<Theme> {
    return invokeBackend<Theme>("create_theme", { theme });
  },

  async updateTheme(theme: Theme): Promise<Theme> {
    return invokeBackend<Theme>("update_theme", { theme });
  },

  async deleteTheme(themeId: string): Promise<void> {
    await invokeBackend("delete_theme", { themeId });
  },

  async upsertRelationship(relationship: GraphRelationship): Promise<GraphRelationship> {
    return invokeBackend<GraphRelationship>("upsert_relationship", { relationship });
  },

  async deleteRelationship(relationship: GraphRelationship): Promise<void> {
    await invokeBackend("delete_relationship", { relationship });
  },

  async importProjectBundle(): Promise<LibrarySnapshot | null> {
    return invokeBackend<LibrarySnapshot | null>("import_project_bundle");
  },

  async previewProjectBundle(path?: string): Promise<BundlePreview | null> {
    return invokeBackend<BundlePreview | null>("preview_project_bundle", { path });
  },

  async startupProjectFile(): Promise<string | null> {
    return invokeBackend<string | null>("startup_project_file");
  },

  async importProjectBundleFromPath(path: string, manifestHash: string): Promise<LibrarySnapshot> {
    return invokeBackend<LibrarySnapshot>("import_project_bundle_from_path", { path, manifestHash });
  },

  async previewProjectRepair(projectId: string): Promise<RepairPreview | null> {
    return invokeBackend<RepairPreview | null>("preview_project_repair", { projectId });
  },

  async applyProjectRepair(projectId: string, path: string, manifestHash: string, resolutions: Record<string, string>): Promise<{ snapshot: LibrarySnapshot; backupPath: string }> {
    return invokeBackend("apply_project_repair", { projectId, path, manifestHash, resolutions });
  },

  async exportLibrary(format: ExportFormat, projectId?: string, options?: ExportOptions): Promise<{ path?: string }> {
    return invokeBackend<{ path?: string }>("export_library", { format, projectId, options });
  },

  async getSettings(): Promise<AiSettings> {
    return invokeBackend<AiSettings>("get_settings");
  },

  async saveSettings(settings: AiSettings): Promise<AiSettings> {
    return invokeBackend<AiSettings>("save_settings", { settings });
  },

  async chooseLocalModelFile(kind: "executable" | "model" | "mmproj"): Promise<string | null> {
    return invokeBackend<string | null>("choose_local_model_file", { kind });
  },

  async suggestThemes(excerptIds?: string[]): Promise<Array<{ excerptId: string; themeIds: string[]; rationale?: string }>> {
    return invokeBackend("suggest_themes", { excerptIds });
  },

  persistBrowser(snapshot: LibrarySnapshot): void {
    if (!isTauri()) saveBrowserSnapshot(snapshot);
  },
};

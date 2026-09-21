import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type InputHTMLAttributes } from "react";
import {
  BookMarked,
  BookOpenText,
  Coffee,
  Command,
  Download,
  FilePlus2,
  FlaskConical,
  FolderOpen,
  Highlighter,
  Library,
  LoaderCircle,
  Menu,
  Network,
  PanelLeft,
  Save,
  Settings,
  Upload,
} from "lucide-react";
import { backend, type BundlePreview, type RepairPreview } from "./backend";
import DocumentViewer from "./components/DocumentViewer";
import SynthesisWorkspace from "./components/SynthesisWorkspace";
import ThemesWorkspace from "./components/ThemesWorkspace";
import ErgonomicsHub, { CommandPalette, ResumeBanner, SaveStateIndicator, type AttentionItem, type CommandAction } from "./components/ErgonomicsHub";
import {
  AnnotationPanel,
  CitationModal,
  DocumentHeader,
  EmptyNotesPanel,
  ExportModal,
  FatalState,
  LibraryPanel,
  LoadingApp,
  MetadataModal,
  ProjectModal,
  ProjectBundleModal,
  SettingsModal,
  ToastRegion,
  truncate,
} from "./components/WorkbenchUi";
import { downloadBrowserCsv, resetBrowserSnapshot } from "./storage";
import { detectPdfDoi } from "./lib/pdfMetadata";
import { defaultErgonomicsProject, normalizeErgonomics, projectErgonomics } from "./ergonomics";
import { organizeImportedDirectories } from "./libraryDirectories";
import type {
  AiSettings,
  DocumentPayload,
  Excerpt,
  ExportFormat,
  ExportOptions,
  GraphRelationship,
  GraphWorkspaceState,
  ErgonomicsProjectState,
  FocusItem,
  LibrarySnapshot,
  PendingExcerptDraft,
  RecoveryCheckpoint,
  ResearchDocument,
  SelectionDraft,
  SynthesisWorkspaceState,
  Theme,
  ToastMessage,
  WorkspaceView,
  SessionCheckpoint,
} from "./types";

function defaultGraphWorkspace(settings: AiSettings): GraphWorkspaceState {
  return {
    labelMode: settings.graphLabelMode ?? "hover",
    zoom: settings.graphZoom ?? 100,
    nodeScale: settings.graphNodeScale ?? 55,
    nodePositions: {},
    pinnedLabels: [],
    annotations: [],
    showAnnotations: true,
    relationshipStyles: {},
    themeShape: settings.defaultThemeShape ?? "square",
    excerptShape: settings.defaultExcerptShape ?? "circle",
    layoutSettings: { algorithm: settings.defaultGraphLayout ?? "stress", direction: "RIGHT", nodeSpacing: 80, componentSpacing: 120, layerSpacing: 140, aspectRatio: 1.6, iterations: 400, forceRepulsion: 5, desiredEdgeLength: 320, radialRadius: 320, compactTree: true },
  };
}

function defaultSynthesisWorkspace(): SynthesisWorkspaceState {
  return { researchQuestion: "", scope: "", inclusionCriteria: "", exclusionCriteria: "", reviews: [], extractionFields: [], extractionRecords: [], claims: [], sections: [], savedViews: [] };
}

function migrateGraphWorkspaces(library: LibrarySnapshot): LibrarySnapshot {
  if (library.settings.graphWorkspaces && Object.keys(library.settings.graphWorkspaces).length) return { ...library, settings: { ...library.settings, synthesisWorkspaces: library.settings.synthesisWorkspaces ?? {} } };
  const firstProjectId = library.projects[0]?.id;
  const migrated = {
    ...defaultGraphWorkspace(library.settings),
    nodePositions: library.settings.graphNodePositions ?? {},
    pinnedLabels: library.settings.graphPinnedLabels ?? [],
  };
  return {
    ...library,
    settings: {
      ...library.settings,
      graphWorkspaces: firstProjectId ? { [firstProjectId]: migrated } : {},
      synthesisWorkspaces: library.settings.synthesisWorkspaces ?? {},
    },
  };
}

function makeId(prefix: string): string {
  return `${prefix}-${typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

function toTitleCaseFile(fileName: string): string {
  return fileName
    .replace(/\.(pdf|md|markdown)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function App() {
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>();
  const [fatalError, setFatalError] = useState<string>();
  const [view, setView] = useState<WorkspaceView>("reader");
  const [activeProjectId, setActiveProjectId] = useState<string>();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const [selectedExcerptId, setSelectedExcerptId] = useState<string>();
  const [locatedExcerptId, setLocatedExcerptId] = useState<string>();
  const [locateRequest, setLocateRequest] = useState(0);
  const [draft, setDraft] = useState<SelectionDraft>();
  const draftRef = useRef<SelectionDraft | undefined>(undefined);
  const draftProjectRef = useRef<string | undefined>(undefined);
  const [redefiningExcerptId, setRedefiningExcerptId] = useState<string>();
  const [libraryQuery, setLibraryQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "pdf" | "markdown">("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [payloads, setPayloads] = useState<Record<string, DocumentPayload>>({});
  const [payloadLoading, setPayloadLoading] = useState(false);
  const [payloadError, setPayloadError] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const [savingExcerpt, setSavingExcerpt] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [citationOpen, setCitationOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [bundlePreview, setBundlePreview] = useState<BundlePreview>();
  const [repairPreview, setRepairPreview] = useState<RepairPreview>();
  const [projectSaving, setProjectSaving] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [saveStatusDetail, setSaveStatusDetail] = useState<string>();
  const [resumeCheckpoint, setResumeCheckpoint] = useState<SessionCheckpoint>();
  const [attentionTarget, setAttentionTarget] = useState<{ kind: "screening" | "claim"; id: string; request: number }>();
  const [sessionClock, setSessionClock] = useState(Date.now());
  const [readerAsideCollapsed, setReaderAsideCollapsed] = useState(false);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"library" | "document" | "notes">("document");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  const settingsRef = useRef<AiSettings | undefined>(undefined);
  const settingsWriteQueue = useRef<Promise<unknown>>(Promise.resolve());
  const graphSaveTimer = useRef<number | undefined>(undefined);
  const graphSaveErrorShown = useRef(false);
  const checkpointSaveTimer = useRef<number | undefined>(undefined);
  const draftSaveTimer = useRef<number | undefined>(undefined);
  const suggestionCache = useRef(new Map<string, { themeIds: string[]; rationale?: string }>());

  const notify = useCallback((tone: ToastMessage["tone"], title: string, message?: string) => {
    const toast = { id: makeId("toast"), tone, title, message };
    setToasts((current) => [...current, toast].slice(-4));
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 5200);
  }, []);

  const load = useCallback(async () => {
    setFatalError(undefined);
    try {
      const migrated = migrateGraphWorkspaces(await backend.getLibrary());
      const ergonomics = normalizeErgonomics(migrated.settings);
      let library: LibrarySnapshot = { ...migrated, settings: { ...migrated.settings, ergonomics } };
      const needsDirectoryMigration = library.projects.some((project) => (library.settings.libraryDirectoryLayoutVersion?.[project.id] ?? 0) < 1);
      if (needsDirectoryMigration) {
        for (const project of library.projects) library = { ...library, settings: organizeImportedDirectories(library, project.id) };
        if (backend.desktop) await backend.saveSettings(library.settings);
        else backend.persistBrowser(library);
      }
      const latestCheckpoint = Object.values(ergonomics.projects)
        .map((state) => state.checkpoint)
        .filter((item): item is SessionCheckpoint => Boolean(item && library.projects.some((project) => project.id === item.projectId)))
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
      setSnapshot(library);
      setActiveProjectId((current) => current && library.projects.some((project) => project.id === current) ? current : latestCheckpoint?.projectId ?? library.projects[0]?.id);
      setSelectedDocumentId((current) => current && library.documents.some((doc) => doc.id === current) ? current : latestCheckpoint?.documentId ?? library.documents[0]?.id);
      if (ergonomics.showResumePrompt && latestCheckpoint) setResumeCheckpoint(latestCheckpoint);
      setSaveStatus("saved");
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "An unknown error occurred while opening the library.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!backend.desktop) return;
    void backend.startupProjectFile().then((path) => path ? backend.previewProjectBundle(path) : null).then((preview) => { if (preview) setBundlePreview(preview); }).catch((error) => notify("error", "Could not inspect project file", error instanceof Error ? error.message : undefined));
  }, [notify]);
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  useEffect(() => { settingsRef.current = snapshot?.settings; }, [snapshot?.settings]);
  useEffect(() => {
    let active = true;
    async function setFullscreen(next: boolean) {
      if (backend.desktop) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().setFullscreen(next);
      } else if (next) {
        await document.documentElement.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      if (active) setIsFullscreen(next);
    }
    async function syncDesktopFullscreen() {
      if (!backend.desktop) return;
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      if (active) setIsFullscreen(await getCurrentWindow().isFullscreen());
    }
    function keyDown(event: KeyboardEvent) {
      if (event.key === "F11") {
        event.preventDefault();
        void setFullscreen(!isFullscreen);
      } else if (event.key === "Escape" && isFullscreen) {
        event.preventDefault();
        void setFullscreen(false);
      }
    }
    function browserFullscreenChanged() { if (!backend.desktop) setIsFullscreen(Boolean(document.fullscreenElement)); }
    void syncDesktopFullscreen();
    window.addEventListener("keydown", keyDown);
    document.addEventListener("fullscreenchange", browserFullscreenChanged);
    return () => {
      active = false;
      window.removeEventListener("keydown", keyDown);
      document.removeEventListener("fullscreenchange", browserFullscreenChanged);
    };
  }, [isFullscreen]);

  const updateSnapshot = useCallback((updater: (current: LibrarySnapshot) => LibrarySnapshot) => {
    setSnapshot((current) => {
      if (!current) return current;
      const next = updater(current);
      backend.persistBrowser(next);
      setSaveStatus("unsaved");
      setSaveStatusDetail("Changes are kept locally and will be included in the next project checkpoint.");
      return next;
    });
  }, []);

  const persistGraphWorkspace = useCallback((workspaceId: string, patch: Partial<GraphWorkspaceState>) => {
    const current = settingsRef.current;
    if (!current) return;
    const existing = current.graphWorkspaces?.[workspaceId] ?? defaultGraphWorkspace(current);
    const next = {
      ...current,
      graphWorkspaces: {
        ...(current.graphWorkspaces ?? {}),
        [workspaceId]: { ...existing, ...patch },
      },
    };
    settingsRef.current = next;
    updateSnapshot((snapshot) => ({ ...snapshot, settings: next }));
    if (backend.desktop) {
      if (graphSaveTimer.current) window.clearTimeout(graphSaveTimer.current);
      graphSaveTimer.current = window.setTimeout(() => {
        const latest = settingsRef.current;
        if (!latest) return;
        setSaveStatus("saving");
        settingsWriteQueue.current = settingsWriteQueue.current
          .catch(() => undefined)
          .then(() => backend.saveSettings(latest))
          .then(() => { graphSaveErrorShown.current = false; setSaveStatus("saved"); setSaveStatusDetail("Graph workspace saved locally."); })
          .catch((error) => {
            setSaveStatus("error");
            setSaveStatusDetail(error instanceof Error ? error.message : "Graph workspace could not be saved.");
            if (!graphSaveErrorShown.current) notify("error", "Could not save graph arrangement", error instanceof Error ? error.message : undefined);
            graphSaveErrorShown.current = true;
          });
      }, 350);
    }
  }, [notify, updateSnapshot]);

  const persistSynthesisWorkspace = useCallback((projectId: string, patch: Partial<SynthesisWorkspaceState>) => {
    const current = settingsRef.current;
    if (!current) return;
    const existing = current.synthesisWorkspaces?.[projectId] ?? defaultSynthesisWorkspace();
    const next = {
      ...current,
      synthesisWorkspaces: {
        ...(current.synthesisWorkspaces ?? {}),
        [projectId]: { ...existing, ...patch },
      },
    };
    settingsRef.current = next;
    updateSnapshot((snapshot) => ({ ...snapshot, settings: next }));
    if (backend.desktop) {
      if (graphSaveTimer.current) window.clearTimeout(graphSaveTimer.current);
      graphSaveTimer.current = window.setTimeout(() => {
        const latest = settingsRef.current;
        if (!latest) return;
        setSaveStatus("saving");
        settingsWriteQueue.current = settingsWriteQueue.current
          .catch(() => undefined)
          .then(() => backend.saveSettings(latest))
          .then(() => { graphSaveErrorShown.current = false; setSaveStatus("saved"); setSaveStatusDetail("Synthesis workspace saved locally."); })
          .catch((error) => {
            setSaveStatus("error");
            setSaveStatusDetail(error instanceof Error ? error.message : "Synthesis workspace could not be saved.");
            if (!graphSaveErrorShown.current) notify("error", "Could not save synthesis workspace", error instanceof Error ? error.message : undefined);
            graphSaveErrorShown.current = true;
          });
      }, 350);
    }
  }, [notify, updateSnapshot]);

  const selectedDocument = snapshot?.documents.find((doc) => doc.id === selectedDocumentId);
  const activeProject = snapshot?.projects.find((project) => project.id === activeProjectId);
  const projectDocuments = useMemo(
    () => snapshot?.documents.filter((document) => document.projectId === activeProjectId) ?? [],
    [snapshot?.documents, activeProjectId],
  );
  const projectThemes = useMemo(
    () => snapshot?.themes.filter((theme) => theme.projectId === activeProjectId) ?? [],
    [snapshot?.themes, activeProjectId],
  );
  const projectExcerpts = useMemo(() => {
    const ids = new Set(projectDocuments.map((document) => document.id));
    return snapshot?.excerpts.filter((excerpt) => ids.has(excerpt.documentId)) ?? [];
  }, [snapshot?.excerpts, projectDocuments]);
  const ergonomicsSettings = snapshot ? normalizeErgonomics(snapshot.settings) : undefined;
  const activeErgonomics = snapshot && activeProjectId ? projectErgonomics(snapshot.settings, activeProjectId) : defaultErgonomicsProject();

  useEffect(() => {
    const timer = window.setInterval(() => setSessionClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ergonomicsSettings?.breakReminders || !activeErgonomics.sessionStartedAt || !activeProjectId) return;
    const anchor = new Date(activeErgonomics.lastBreakAt ?? activeErgonomics.sessionStartedAt).valueOf();
    if (sessionClock - anchor < ergonomicsSettings.breakIntervalMinutes * 60_000) return;
    notify("info", "A quiet pause may help", `You have been working for about ${ergonomicsSettings.breakIntervalMinutes} minutes. Dismiss this and continue, or record a break in the Research Support Center.`);
    updateProjectErgonomics({ lastBreakAt: new Date().toISOString() }, activeProjectId);
  }, [activeErgonomics.lastBreakAt, activeErgonomics.sessionStartedAt, activeProjectId, ergonomicsSettings?.breakIntervalMinutes, ergonomicsSettings?.breakReminders, notify, sessionClock]);

  useEffect(() => {
    if (!activeProjectId || !snapshot) return;
    if (checkpointSaveTimer.current) window.clearTimeout(checkpointSaveTimer.current);
    checkpointSaveTimer.current = window.setTimeout(() => {
      const current = settingsRef.current;
      if (!current) return;
      const existing = projectErgonomics(current, activeProjectId).checkpoint;
      const synthesisTab = current.synthesisTabs?.[activeProjectId];
      const unchanged = existing && existing.view === view && existing.documentId === selectedDocumentId && existing.excerptId === selectedExcerptId && existing.synthesisTab === synthesisTab && existing.folderFilter === folderFilter && existing.readerAsideCollapsed === readerAsideCollapsed;
      if (unchanged) return;
      updateProjectErgonomics({ checkpoint: { projectId: activeProjectId, view, documentId: selectedDocumentId, excerptId: selectedExcerptId, synthesisTab, folderFilter, readerAsideCollapsed, savedAt: new Date().toISOString() } }, activeProjectId);
    }, 900);
    return () => { if (checkpointSaveTimer.current) window.clearTimeout(checkpointSaveTimer.current); };
  }, [activeProjectId, folderFilter, readerAsideCollapsed, selectedDocumentId, selectedExcerptId, snapshot?.settings.synthesisTabs, view]);

  useEffect(() => {
    if (!snapshot || !activeProjectId) return;
    if (!selectedDocumentId || !snapshot.documents.some((document) => document.id === selectedDocumentId && document.projectId === activeProjectId)) {
      setSelectedDocumentId(snapshot.documents.find((document) => document.projectId === activeProjectId)?.id);
      setSelectedExcerptId(undefined);
      setDraft(undefined);
      setPayloadError(undefined);
    }
  }, [activeProjectId, snapshot, selectedDocumentId]);
  const documentExcerpts = useMemo(
    () => snapshot?.excerpts
      .filter((excerpt) => excerpt.documentId === selectedDocumentId)
      .sort((a, b) => (a.page ?? 0) - (b.page ?? 0) || a.createdAt.localeCompare(b.createdAt)) ?? [],
    [snapshot?.excerpts, selectedDocumentId],
  );

  useEffect(() => {
    if (!selectedDocument) {
      setPayloadLoading(false);
      setPayloadError(undefined);
      return;
    }
    if (payloads[selectedDocument.id]) {
      setPayloadLoading(false);
      setPayloadError(undefined);
      return;
    }
    let cancelled = false;
    setPayloadLoading(true);
    setPayloadError(undefined);
    backend.readDocument(selectedDocument.id, selectedDocument)
      .then((payload) => { if (!cancelled) setPayloads((current) => ({ ...current, [selectedDocument.id]: payload })); })
      .catch((error: unknown) => { if (!cancelled) setPayloadError(error instanceof Error ? error.message : "The source file could not be read."); })
      .finally(() => { if (!cancelled) setPayloadLoading(false); });
    return () => { cancelled = true; };
  }, [selectedDocument, payloads]);

  const filteredDocuments = useMemo(() => {
    if (!snapshot) return [];
    const query = libraryQuery.trim().toLocaleLowerCase();
    const groupName = folderFilter.startsWith("group::") ? folderFilter.slice(7) : undefined;
    const groupMap = snapshot.settings.libraryGroups?.[activeProjectId ?? ""] ?? {};
    const [sourceId, encodedPrefix] = folderFilter === "all" ? [] : folderFilter.split("::", 2);
    const source = snapshot.projectSources.find((item) => item.id === sourceId);
    const prefix = (encodedPrefix ? decodeURIComponent(encodedPrefix) : source?.path ?? "").replaceAll("\\", "/").toLocaleLowerCase();
    return snapshot.documents.filter((document) => {
      const normalizedPath = document.path.replaceAll("\\", "/").toLocaleLowerCase();
      const inSource = !source || (source.kind === "file" ? normalizedPath === prefix : normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
      const inGroup = !groupName || groupMap[document.id] === groupName || groupMap[document.id]?.startsWith(`${groupName}/`);
      return document.projectId === activeProjectId && inSource && inGroup &&
        (kindFilter === "all" || document.kind === kindFilter) &&
        (!query || `${document.title} ${document.authors} ${document.doi} ${document.fileName}`.toLocaleLowerCase().includes(query));
    });
  }, [snapshot, libraryQuery, kindFilter, folderFilter, activeProjectId]);

  const selectDocument = useCallback((documentId: string) => {
    setSelectedDocumentId(documentId);
    setDraft(undefined);
    setSelectedExcerptId(undefined);
    setLocatedExcerptId(undefined);
    setPayloadError(undefined);
    setMobilePane("document");
  }, []);

  const locateExcerpt = useCallback((excerptId: string) => {
    setDraft(undefined);
    setSelectedExcerptId(undefined);
    setLocatedExcerptId(excerptId);
    setLocateRequest((value) => value + 1);
    setMobilePane("document");
  }, []);

  const selectExcerpt = useCallback((excerptId?: string) => {
    setSelectedExcerptId(excerptId);
    setDraft(undefined);
    setRedefiningExcerptId(undefined);
    if (excerptId) setMobilePane("notes");
  }, []);

  const redefineExcerpt = useCallback((excerptId: string) => {
    setSelectedExcerptId(excerptId);
    setRedefiningExcerptId(excerptId);
    setDraft(undefined);
    setMobilePane("document");
    notify("info", "Redefine excerpt", "Choose the text highlighter or image tool, then select a replacement area. Press Esc to cancel.");
  }, [notify]);

  const captureSelection = useCallback((selection: SelectionDraft) => {
    flushPendingDraft();
    const recent = activeProjectId && settingsRef.current ? projectErgonomics(settingsRef.current, activeProjectId) : undefined;
    // Redefining swaps only the selection area, so the note, its format, themes and colour carry over.
    const redefined = redefiningExcerptId ? snapshot?.excerpts.find((excerpt) => excerpt.id === redefiningExcerptId) : undefined;
    const nextDraft: SelectionDraft = {
      ...selection,
      id: selection.id ?? makeId("draft"),
      documentId: selectedDocumentId,
      excerptId: redefiningExcerptId,
      annotation: selection.annotation ?? redefined?.annotation ?? "",
      annotationFormat: selection.annotationFormat ?? redefined?.annotationFormat ?? settingsRef.current?.defaultNoteFormat ?? "plain",
      themeIds: selection.themeIds ?? redefined?.themeIds ?? recent?.lastThemeIds ?? [],
      color: selection.color ?? redefined?.color ?? recent?.lastExcerptColor ?? settingsRef.current?.defaultExcerptColor,
      updatedAt: new Date().toISOString(),
    };
    draftRef.current = nextDraft;
    draftProjectRef.current = activeProjectId;
    setDraft(nextDraft);
    if (!redefiningExcerptId) setSelectedExcerptId(undefined);
    setMobilePane("notes");
    notify("info", redefiningExcerptId ? "Excerpt area replaced" : selection.kind === "image" ? "Image region captured" : "Passage captured", redefiningExcerptId ? "Review the new area, then save the changes." : "Add a note or themes, then save the excerpt.");
  }, [activeProjectId, notify, redefiningExcerptId, selectedDocumentId, snapshot]);

  const updateOpenDraft = useCallback((patch: Pick<SelectionDraft, "annotation" | "annotationFormat" | "themeIds" | "color">) => {
    if (!draftRef.current) return;
    draftRef.current = { ...draftRef.current, ...patch, updatedAt: new Date().toISOString() };
    if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = window.setTimeout(() => flushPendingDraft(), 750);
  }, []);

  function flushPendingDraft() {
    if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = undefined;
    const pending = draftRef.current;
    const projectId = draftProjectRef.current;
    if (!pending || !projectId || !pending.documentId) return;
    const current = settingsRef.current;
    if (!current) return;
    const state = projectErgonomics(current, projectId);
    const savedDraft = pending as PendingExcerptDraft;
    updateProjectErgonomics({ drafts: [...state.drafts.filter((item) => item.id !== savedDraft.id), savedDraft].slice(-12) }, projectId);
  }

  useEffect(() => {
    if (!draft?.id || !activeProjectId || !selectedDocumentId) return;
    draftRef.current = draftRef.current?.id === draft.id ? draftRef.current : draft;
    draftProjectRef.current = activeProjectId;
    if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = window.setTimeout(() => flushPendingDraft(), 750);
    return () => {
      if (draftRef.current?.id === draft.id) {
        flushPendingDraft();
        draftRef.current = undefined;
      }
    };
  }, [activeProjectId, draft?.id, selectedDocumentId]);

  function removePersistedDraft(draftId?: string) {
    if (!activeProjectId || !draftId) return;
    const current = settingsRef.current;
    if (!current) return;
    const state = projectErgonomics(current, activeProjectId);
    updateProjectErgonomics({ drafts: state.drafts.filter((item) => item.id !== draftId) }, activeProjectId);
  }

  async function saveExcerpt(data: { annotation: string; annotationFormat: "plain" | "markdown"; themeIds: string[]; color: string }) {
    if (!snapshot || !selectedDocument) return;
    setSavingExcerpt(true);
    try {
      const existing = snapshot.excerpts.find((excerpt) => excerpt.id === selectedExcerptId);
      if (existing) {
        const replacement = draft && redefiningExcerptId === existing.id ? { text: draft.text, page: draft.page, locator: draft.locator, kind: draft.kind ?? "text", imageData: draft.imageData } : {};
        const updated: Excerpt = { ...existing, ...replacement, ...data, updatedAt: new Date().toISOString() };
        const saved = backend.desktop ? await backend.updateExcerpt(updated) : updated;
        updateSnapshot((current) => {
          const retained = current.relationships.filter((relationship) => relationship.kind !== "excerpt-theme" || relationship.sourceId !== saved.id || saved.themeIds.includes(relationship.targetId));
          const linked = new Set(retained.filter((relationship) => relationship.kind === "excerpt-theme" && relationship.sourceId === saved.id).map((relationship) => relationship.targetId));
          const additions: GraphRelationship[] = saved.themeIds.filter((themeId) => !linked.has(themeId)).map((themeId) => ({ id: `excerpt-theme:${saved.id}:${themeId}`, projectId: selectedDocument.projectId, kind: "excerpt-theme", sourceId: saved.id, targetId: themeId, label: "", createdAt: saved.createdAt }));
          return { ...current, excerpts: current.excerpts.map((item) => item.id === saved.id ? saved : item), relationships: [...retained, ...additions] };
        });
        setSelectedExcerptId(undefined);
        updateProjectErgonomics({ lastExcerptColor: data.color, lastThemeIds: data.themeIds });
        removePersistedDraft(draft?.id);
        draftRef.current = undefined;
        setDraft(undefined);
        setRedefiningExcerptId(undefined);
        notify("success", "Excerpt updated");
      } else if (draft) {
        const now = new Date().toISOString();
        const created: Excerpt = {
          id: makeId("excerpt"), documentId: selectedDocument.id, text: draft.text,
          annotation: data.annotation, annotationFormat: data.annotationFormat, page: draft.page, locator: draft.locator,
          themeIds: data.themeIds, createdAt: now, updatedAt: now,
          kind: draft.kind ?? "text", color: data.color, imageData: draft.imageData,
        };
        const saved = backend.desktop ? await backend.createExcerpt(created) : created;
        updateSnapshot((current) => ({
          ...current,
          excerpts: [...current.excerpts, saved],
          relationships: [...current.relationships, ...saved.themeIds.map((themeId) => ({ id: `excerpt-theme:${saved.id}:${themeId}`, projectId: selectedDocument.projectId, kind: "excerpt-theme" as const, sourceId: saved.id, targetId: themeId, label: "", createdAt: saved.createdAt }))],
        }));
        updateProjectErgonomics({ lastExcerptColor: data.color, lastThemeIds: data.themeIds });
        removePersistedDraft(draft.id);
        draftRef.current = undefined;
        setDraft(undefined);
        notify("success", "Excerpt filed", data.themeIds.length ? "The passage and its themes are now in the catalogue." : "The passage is now in the catalogue.");
      }
    } catch (error) {
      notify("error", "Could not save excerpt", error instanceof Error ? error.message : undefined);
    } finally { setSavingExcerpt(false); }
  }

  async function deleteExcerpt(excerptId: string) {
    try {
      if (backend.desktop) await backend.deleteExcerpt(excerptId);
      updateSnapshot((current) => ({ ...current, excerpts: current.excerpts.filter((item) => item.id !== excerptId), relationships: current.relationships.filter((item) => item.sourceId !== excerptId && item.targetId !== excerptId) }));
      setSelectedExcerptId(undefined);
      notify("success", "Excerpt removed");
    } catch (error) { notify("error", "Could not remove excerpt", error instanceof Error ? error.message : undefined); }
  }

  async function saveDocument(document: ResearchDocument) {
    try {
      const saved = backend.desktop ? await backend.updateDocument(document) : document;
      updateSnapshot((current) => ({ ...current, documents: current.documents.map((item) => item.id === saved.id ? saved : item) }));
      notify("success", "Document record updated");
    } catch (error) {
      notify("error", "Could not update the record", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  async function enrichImportedCitationMetadata(documents: ResearchDocument[]) {
    if (!backend.desktop || !documents.length) return;
    const enriched: ResearchDocument[] = [];
    const corrected: string[] = [];
    for (const document of documents) {
      try {
        let detectedDoi: string | undefined;
        if (document.kind === "pdf") {
          const payload = await backend.readDocument(document.id, document);
          detectedDoi = await detectPdfDoi(payload);
        }
        const doi = detectedDoi ?? document.doi.trim();
        if (!doi) continue;
        if (detectedDoi && detectedDoi.toLocaleLowerCase() !== document.doi.trim().toLocaleLowerCase()) corrected.push(document.title);
        const metadata = await backend.lookupCitationMetadata({ ...document, doi });
        enriched.push(await backend.updateDocument(metadata));
      } catch {
        // Import remains successful when a registry is offline or has no record.
      }
    }
    if (!enriched.length) return;
    const byId = new Map(enriched.map((document) => [document.id, document]));
    updateSnapshot((current) => ({ ...current, documents: current.documents.map((document) => byId.get(document.id) ?? document) }));
    notify("info", `Citation metadata verified for ${enriched.length} ${enriched.length === 1 ? "source" : "sources"}`, corrected.length ? `${corrected.length} incorrect or missing DOI ${corrected.length === 1 ? "was" : "were"} replaced from an explicit DOI printed in the PDF.` : "Registry results were matched by an explicit DOI. Open Document record to review or change them.");
  }

  async function detectAndLookupCitation(document: ResearchDocument) {
    if (!backend.desktop || document.kind !== "pdf") throw new Error("DOI detection is available for PDF documents in the desktop app.");
    const doi = await detectPdfDoi(await backend.readDocument(document.id, document));
    if (!doi) throw new Error("No DOI label or doi.org URL was found in the PDF metadata or first two pages. Nothing was changed.");
    return backend.lookupCitationMetadata({ ...document, doi });
  }

  function finishSourceScan(next: LibrarySnapshot, projectId: string, successTitle: string) {
    const previousDocumentIds = new Set(snapshot?.documents.map((document) => document.id) ?? []);
    const addedDocuments = next.documents.filter((document) => document.projectId === projectId && !previousDocumentIds.has(document.id));
    // A rescan reads the catalogue from SQLite while interface preferences may
    // still be in their debounced save queue. Keep the in-memory directory moves.
    const settings = organizeImportedDirectories({ ...next, settings: settingsRef.current ?? next.settings }, projectId);
    const previousDocuments = new Map(snapshot?.documents.map((document) => [document.id, document]) ?? []);
    const documents = next.documents.map((document) => {
      const old = previousDocuments.get(document.id);
      return old && Object.keys(document).every((key) => (old as unknown as Record<string, unknown>)[key] === (document as unknown as Record<string, unknown>)[key]) ? old : document;
    });
    const documentById = new Map(documents.map((document) => [document.id, document]));
    const sameIds = <T extends { id: string }>(oldItems: T[] | undefined, newItems: T[]) => oldItems?.length === newItems.length && oldItems.every((item, index) => item.id === newItems[index].id);
    const enriched = { ...next, documents, excerpts: sameIds(snapshot?.excerpts, next.excerpts) ? snapshot!.excerpts : next.excerpts, themes: sameIds(snapshot?.themes, next.themes) ? snapshot!.themes : next.themes, relationships: sameIds(snapshot?.relationships, next.relationships) ? snapshot!.relationships : next.relationships, settings };
    const restored = next.documents.filter((document) => {
      const previous = previousDocuments.get(document.id);
      return Boolean(previous && document.fileAvailable !== false && (previous.fileAvailable === false || previous.path !== document.path));
    });
    const missing = next.documents.filter((document) => {
      const previous = previousDocuments.get(document.id);
      return previous?.fileAvailable !== false && document.fileAvailable === false;
    });
    settingsRef.current = enriched.settings;
    setSnapshot(enriched);
    if (backend.desktop) settingsWriteQueue.current = settingsWriteQueue.current.catch(() => undefined).then(() => backend.saveSettings(enriched.settings));
    setActiveProjectId(projectId);
    setPayloads((current) => Object.fromEntries(Object.entries(current).filter(([id]) => {
      const old = previousDocuments.get(id);
      const updated = documentById.get(id);
      return old && updated && old.path === updated.path && old.fileHash === updated.fileHash && updated.fileAvailable !== false;
    })));
    setPayloadError(undefined);
    if (restored.length) {
      const moved = restored.filter((document) => previousDocuments.get(document.id)?.path !== document.path).length;
      notify("info", `${restored.length} source ${restored.length === 1 ? "link" : "links"} restored`, moved ? `${moved} ${moved === 1 ? "document was" : "documents were"} recognized by SHA-256 fingerprint and relinked.` : "The original file location is available again.");
    } else if (missing.length) {
      notify("info", `${missing.length} source ${missing.length === 1 ? "file is" : "files are"} unavailable`, "The document records and excerpts were kept. Use Relink or restore a matching file and rescan.");
    } else {
      notify("success", successTitle);
    }
    if (enriched.settings.onlineCitationLookup) {
      if (addedDocuments.length) void enrichImportedCitationMetadata(addedDocuments);
    }
  }

  async function chooseFolder() {
    if (!backend.desktop) { folderInputRef.current?.click(); return; }
    setScanning(true);
    try {
      const knownProjects = new Set(snapshot?.projects.map((item) => item.id) ?? []);
      const knownSources = new Set(snapshot?.projectSources.map((item) => item.id) ?? []);
      const next = await backend.chooseAndScanFolder(activeProjectId);
      const addedProject = next.projects.find((item) => !knownProjects.has(item.id));
      const targetProject = next.projects.find((item) => item.id === activeProjectId) ?? addedProject ?? next.projects.at(-1);
      if (!targetProject) return;
      const firstDocument = next.documents.find((item) => item.projectId === targetProject.id) ?? next.documents[0];
      setSelectedDocumentId(firstDocument?.id);
      const addedSource = next.projectSources.find((item) => item.projectId === targetProject.id && !knownSources.has(item.id));
      setFolderFilter(addedSource?.id ?? "all");
      setDraft(undefined);
      setSelectedExcerptId(undefined);
      finishSourceScan(next, targetProject.id, "Research folder indexed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The folder could not be scanned.";
      if (!message.toLocaleLowerCase().includes("cancel")) notify("error", "Import interrupted", message);
    } finally { setScanning(false); }
  }

  async function chooseFiles() {
    if (!activeProjectId) {
      setProjectOpen(true);
      notify("info", "Create a project first", "Individual files need a research project to belong to.");
      return;
    }
    if (!backend.desktop) { filesInputRef.current?.click(); return; }
    setScanning(true);
    try {
      const next = await backend.chooseAndScanFiles(activeProjectId);
      finishSourceScan(next, activeProjectId, "Research files indexed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The files could not be scanned.";
      if (!message.toLocaleLowerCase().includes("cancel")) notify("error", "Import interrupted", message);
    } finally { setScanning(false); }
  }

  async function importBrowserFiles(event: ChangeEvent<HTMLInputElement>, sourceKind: "folder" | "file") {
    const files = Array.from(event.target.files ?? []).filter((file) => /\.(pdf|md|markdown)$/i.test(file.name));
    event.target.value = "";
    if (!files.length) {
      notify("info", "No supported documents found", "Choose a folder containing PDF, MD, or Markdown files.");
      return;
    }
    setScanning(true);
    try {
      const rootName = ((files[0] as File & { webkitRelativePath?: string }).webkitRelativePath || "").split("/")[0] || "Imported folder";
      const projectId = activeProjectId ?? makeId("project");
      const existingSourcePaths = new Set(snapshot?.projectSources.filter((source) => source.projectId === projectId).map((source) => source.path.toLocaleLowerCase()) ?? []);
      let browserRoot = rootName;
      for (let suffix = 2; sourceKind === "folder" && existingSourcePaths.has(browserRoot.toLocaleLowerCase()); suffix += 1) browserRoot = `${rootName} (${suffix})`;
      const importedProject = snapshot?.projects.find((project) => project.id === projectId) ?? { id: projectId, title: rootName, folderPath: rootName, createdAt: new Date().toISOString() };
      const imported: ResearchDocument[] = [];
      const newPayloads: Record<string, DocumentPayload> = {};
      for (const file of files) {
        const id = makeId("document");
        const kind = file.name.toLocaleLowerCase().endsWith(".pdf") ? "pdf" : "markdown";
        const selectedRelative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const relative = sourceKind === "folder" ? `${browserRoot}/${selectedRelative.split("/").slice(1).join("/") || file.name}` : selectedRelative;
        const document: ResearchDocument = {
          id, projectId, title: toTitleCaseFile(file.name), fileName: file.name, path: relative,
          kind, authors: "", publicationDate: "", doi: "", addedAt: new Date().toISOString(), fileAvailable: true,
        };
        if (kind === "markdown") {
          document.content = await file.text();
          newPayloads[id] = { kind, content: document.content };
        } else {
          const url = URL.createObjectURL(file);
          objectUrls.current.push(url);
          newPayloads[id] = { kind, url, mimeType: file.type };
        }
        imported.push(document);
      }
      setPayloads((current) => ({ ...current, ...newPayloads }));
      updateSnapshot((current) => { const next: LibrarySnapshot = {
        ...current,
        projects: current.projects.some((project) => project.id === projectId) ? current.projects : [...current.projects, importedProject],
        projectSources: [
          ...current.projectSources,
          ...imported.map((document, index) => ({
            id: makeId("source"), projectId, kind: sourceKind,
            path: sourceKind === "folder" ? browserRoot : document.path,
            label: sourceKind === "folder" ? browserRoot : document.fileName,
            createdAt: new Date().toISOString(),
          })).filter((source, index, values) => (sourceKind === "file" || index === 0) && !current.projectSources.some((existing) => existing.projectId === projectId && existing.path === source.path) && values.findIndex((item) => item.path === source.path) === index),
        ],
        documents: [...imported, ...current.documents.filter((existing) => existing.projectId !== projectId || !imported.some((item) => item.path === existing.path))],
      }; return { ...next, settings: organizeImportedDirectories(next, projectId) }; });
      setActiveProjectId(projectId);
      setFolderFilter("all");
      setSelectedDocumentId(imported[0].id);
      setDraft(undefined);
      setSelectedExcerptId(undefined);
      setPayloadError(undefined);
      notify("success", `${imported.length} ${imported.length === 1 ? "document" : "documents"} added`, "Browser imports stay local. PDF file access lasts for this session.");
    } finally { setScanning(false); }
  }

  async function createProject(title: string) {
    try {
      if (backend.desktop) {
        const known = new Set(snapshot?.projects.map((project) => project.id) ?? []);
        const next = await backend.createProject(title);
        const created = next.projects.find((project) => !known.has(project.id));
        setSnapshot(next);
        setActiveProjectId(created?.id ?? next.projects.at(-1)?.id);
      } else {
        const created = { id: makeId("project"), title, createdAt: new Date().toISOString() };
        updateSnapshot((current) => ({ ...current, projects: [...current.projects, created] }));
        setActiveProjectId(created.id);
      }
      setSelectedDocumentId(undefined);
      setFolderFilter("all");
      setProjectOpen(false);
      notify("success", `Project “${title}” created`, "Add one or more folders or individual files to begin.");
    } catch (error) {
      notify("error", "Could not create project", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  async function renameProject(projectId: string, title: string) {
    try {
      if (backend.desktop) setSnapshot(await backend.renameProject(projectId, title));
      else updateSnapshot((current) => ({ ...current, projects: current.projects.map((project) => project.id === projectId ? { ...project, title } : project) }));
      notify("success", "Project renamed");
    } catch (error) {
      notify("error", "Could not rename project", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  async function deleteProject(projectId: string) {
    const target = snapshot?.projects.find((project) => project.id === projectId);
    if (!target || !window.confirm(`Remove “${target.title}” and its catalogue data from Thematic? Original source files will not be deleted. Export a .thematic copy first if you may need it later.`)) return;
    try {
      let next: LibrarySnapshot;
      if (backend.desktop) next = await backend.deleteProject(projectId);
      else {
        const documentIds = new Set(snapshot!.documents.filter((document) => document.projectId === projectId).map((document) => document.id));
        next = { ...snapshot!, projects: snapshot!.projects.filter((project) => project.id !== projectId), projectSources: snapshot!.projectSources.filter((source) => source.projectId !== projectId), documents: snapshot!.documents.filter((document) => document.projectId !== projectId), excerpts: snapshot!.excerpts.filter((excerpt) => !documentIds.has(excerpt.documentId)), themes: snapshot!.themes.filter((theme) => theme.projectId !== projectId), relationships: snapshot!.relationships.filter((relationship) => relationship.projectId !== projectId) };
        backend.persistBrowser(next);
      }
      setSnapshot(next);
      const replacement = next.projects[0];
      setActiveProjectId(replacement?.id);
      setSelectedDocumentId(next.documents.find((document) => document.projectId === replacement?.id)?.id);
      notify("success", "Project removed", "Original PDF and Markdown files were left untouched.");
    } catch (error) { notify("error", "Could not remove project", error instanceof Error ? error.message : undefined); }
  }

  async function rescan() {
    if (!snapshot) return;
    if (!backend.desktop) { await chooseFolder(); return; }
    const projectId = activeProjectId;
    if (!projectId) { await chooseFolder(); return; }
    setScanning(true);
    try {
      const next = await backend.rescanProject(projectId);
      finishSourceScan(next, projectId, "Project sources refreshed");
    } catch (error) { notify("error", "Could not rescan folder", error instanceof Error ? error.message : undefined); }
    finally { setScanning(false); }
  }

  async function createTheme(theme: Pick<Theme, "name" | "description" | "color" | "parentId" | "parentLabel" | "projectId">) {
    try {
      const local: Theme = { ...theme, id: makeId("theme"), createdAt: new Date().toISOString() };
      const created = backend.desktop ? await backend.createTheme(theme) : local;
      updateSnapshot((current) => ({
        ...current,
        themes: [...current.themes, created],
        relationships: created.parentId ? [...current.relationships, { id: `theme-parent:${created.id}`, projectId: created.projectId, kind: "theme-parent", sourceId: created.parentId, targetId: created.id, label: created.parentLabel ?? "", createdAt: created.createdAt }] : current.relationships,
      }));
      notify("success", `Theme “${created.name}” added`);
    } catch (error) { notify("error", "Could not add theme", error instanceof Error ? error.message : undefined); }
  }

  async function updateTheme(theme: Theme) {
    try {
      const saved = backend.desktop ? await backend.updateTheme(theme) : theme;
      updateSnapshot((current) => ({
        ...current,
        themes: current.themes.map((item) => item.id === saved.id ? saved : item),
        relationships: [
          ...current.relationships.filter((item) => item.kind !== "theme-parent" || item.targetId !== saved.id),
          ...(saved.parentId ? [{ id: `theme-parent:${saved.id}`, projectId: saved.projectId, kind: "theme-parent" as const, sourceId: saved.parentId, targetId: saved.id, label: saved.parentLabel ?? "", createdAt: saved.createdAt }] : []),
        ],
      }));
      notify("success", `Theme “${saved.name}” updated`);
    } catch (error) {
      notify("error", "Could not update theme", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  async function moveTheme(themeId: string, parentId?: string) {
    const theme = snapshot?.themes.find((item) => item.id === themeId);
    if (!theme || theme.parentId === parentId) return;
    try {
      await updateTheme({ ...theme, parentId });
    } catch {
      // updateTheme already reports the backend validation error to the user.
    }
  }

  async function deleteTheme(themeId: string) {
    if (!snapshot) return;
    const theme = snapshot.themes.find((item) => item.id === themeId);
    const useCount = snapshot.excerpts.filter((excerpt) => excerpt.themeIds.includes(themeId)).length;
    if (useCount && !window.confirm(`Remove “${theme?.name}” from ${useCount} excerpts and delete the theme? The excerpts themselves will remain.`)) return;
    try {
      if (backend.desktop) await backend.deleteTheme(themeId);
      updateSnapshot((current) => ({
        ...current,
        themes: current.themes
          .filter((item) => item.id !== themeId)
          .map((item) => item.parentId === themeId ? { ...item, parentId: undefined } : item),
        excerpts: current.excerpts.map((excerpt) => ({ ...excerpt, themeIds: excerpt.themeIds.filter((id) => id !== themeId) })),
        relationships: current.relationships.filter((relationship) => relationship.sourceId !== themeId && relationship.targetId !== themeId),
      }));
      notify("success", "Theme removed", "Its excerpts remain in the catalogue.");
    } catch (error) { notify("error", "Could not remove theme", error instanceof Error ? error.message : undefined); }
  }

  async function upsertRelationship(relationship: GraphRelationship, previous?: GraphRelationship) {
    try {
      const saved = backend.desktop ? await backend.upsertRelationship(relationship) : { ...relationship, id: relationship.id || makeId("relationship") };
      const sameIdentity = !previous || (previous.kind === saved.kind && previous.sourceId === saved.sourceId && previous.targetId === saved.targetId);
      if (previous && !sameIdentity) {
        const parentReplacedInPlace = previous.kind === "theme-parent" && saved.kind === "theme-parent" && previous.targetId === saved.targetId;
        if (!parentReplacedInPlace && backend.desktop) await backend.deleteRelationship(previous);
      }
      if (backend.desktop) {
        setSnapshot(await backend.getLibrary());
        notify("success", saved.label ? `Relationship saved: ${saved.label}` : "Relationship saved");
        return;
      }
      updateSnapshot((current) => {
        let relationships = current.relationships.filter((item) => item.id !== saved.id && (!previous || item.id !== previous.id));
        if (saved.kind === "theme-parent") relationships = relationships.filter((item) => item.kind !== "theme-parent" || item.targetId !== saved.targetId);
        relationships.push(saved);
        let excerpts = current.excerpts;
        let themes = current.themes;
        if (previous && !sameIdentity) {
          if (previous.kind === "excerpt-theme") excerpts = excerpts.map((excerpt) => excerpt.id === previous.sourceId ? { ...excerpt, themeIds: excerpt.themeIds.filter((id) => id !== previous.targetId) } : excerpt);
          if (previous.kind === "theme-parent") themes = themes.map((theme) => theme.id === previous.targetId ? { ...theme, parentId: undefined, parentLabel: undefined } : theme);
        }
        return {
          ...current,
          relationships,
          excerpts: saved.kind === "excerpt-theme" ? excerpts.map((excerpt) => excerpt.id === saved.sourceId ? { ...excerpt, themeIds: [...new Set([...excerpt.themeIds, saved.targetId])] } : excerpt) : excerpts,
          themes: saved.kind === "theme-parent" ? themes.map((theme) => theme.id === saved.targetId ? { ...theme, parentId: saved.sourceId, parentLabel: saved.label } : theme) : themes,
        };
      });
      notify("success", saved.label ? `Relationship saved: ${saved.label}` : "Relationship saved");
    } catch (error) {
      notify("error", "Could not save relationship", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  async function deleteRelationship(relationship: GraphRelationship) {
    try {
      if (backend.desktop) await backend.deleteRelationship(relationship);
      updateSnapshot((current) => ({
        ...current,
        relationships: current.relationships.filter((item) => item.id !== relationship.id),
        excerpts: relationship.kind === "excerpt-theme" ? current.excerpts.map((excerpt) => excerpt.id === relationship.sourceId ? { ...excerpt, themeIds: excerpt.themeIds.filter((id) => id !== relationship.targetId) } : excerpt) : current.excerpts,
        themes: relationship.kind === "theme-parent" ? current.themes.map((theme) => theme.id === relationship.targetId ? { ...theme, parentId: undefined, parentLabel: undefined } : theme) : current.themes,
      }));
      notify("success", "Relationship removed");
    } catch (error) {
      notify("error", "Could not remove relationship", error instanceof Error ? error.message : undefined);
    }
  }

  async function importProjectBundle() {
    if (!backend.desktop || !snapshot) return;
    try {
      const preview = await backend.previewProjectBundle();
      if (preview) { setProjectOpen(false); setBundlePreview(preview); }
    } catch (error) {
      notify("error", "Could not inspect project bundle", error instanceof Error ? error.message : undefined);
    }
  }

  async function applyBundleImport(preview: BundlePreview) {
    if (!snapshot) return;
    if (graphSaveTimer.current) window.clearTimeout(graphSaveTimer.current);
    graphSaveTimer.current = undefined;
    await settingsWriteQueue.current;
    if (settingsRef.current) await backend.saveSettings(settingsRef.current);
    const known = new Set(snapshot.projects.map((project) => project.id));
    const next = await backend.importProjectBundleFromPath(preview.path, preview.manifestHash);
    const imported = next.projects.find((project) => !known.has(project.id));
    setSnapshot(next);
    settingsRef.current = next.settings;
    setActiveProjectId(imported?.id);
    setSelectedDocumentId(next.documents.find((document) => document.projectId === imported?.id)?.id);
    setFolderFilter("all");
    setBundlePreview(undefined);
    notify("success", "Portable project imported", "Graph, synthesis, and recovery state were restored with its documents.");
  }

  async function inspectProjectRepair(projectId: string) {
    try {
      const preview = await backend.previewProjectRepair(projectId);
      if (preview) { setProjectOpen(false); setRepairPreview(preview); }
    } catch (error) { notify("error", "Could not inspect repair bundle", error instanceof Error ? error.message : undefined); }
  }

  async function applyRepair(preview: RepairPreview, resolutions: Record<string, string>) {
    if (graphSaveTimer.current) window.clearTimeout(graphSaveTimer.current);
    graphSaveTimer.current = undefined;
    await settingsWriteQueue.current;
    if (settingsRef.current) await backend.saveSettings(settingsRef.current);
    const result = await backend.applyProjectRepair(preview.projectId, preview.bundle.path, preview.bundle.manifestHash, resolutions);
    setSnapshot(result.snapshot);
    settingsRef.current = result.snapshot.settings;
    setActiveProjectId(preview.projectId);
    setFolderFilter("all");
    setRepairPreview(undefined);
    notify("success", "Project repaired", `Current edits were preserved. Database backup: ${result.backupPath}`);
  }

  async function suggestThemes(text: string): Promise<{ themeIds: string[]; rationale?: string }> {
    if (!snapshot) return { themeIds: [] };
    const cacheKey = `${activeProjectId}:${selectedExcerptId ?? text}:${projectThemes.map((theme) => `${theme.id}:${theme.name}:${theme.description ?? ""}`).join("|")}`;
    const cached = suggestionCache.current.get(cacheKey);
    if (cached) return { ...cached, rationale: cached.rationale ? `${cached.rationale} (cached locally)` : "Loaded from the local suggestion cache." };
    if (backend.desktop) {
      if (!selectedExcerptId) {
        notify("info", "Save this excerpt first", "The local model suggests themes for passages already in the catalogue.");
        return { themeIds: [], rationale: "Save the excerpt before requesting a local-model suggestion." };
      }
      const suggestions = await backend.suggestThemes([selectedExcerptId]);
      const result = { themeIds: suggestions.flatMap((item) => item.themeIds), rationale: suggestions.map((item) => item.rationale).filter(Boolean).join(" ") || "Suggested from the excerpt and the names and descriptions of existing themes." };
      suggestionCache.current.set(cacheKey, result);
      return result;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    const lower = text.toLocaleLowerCase();
    const terms: Array<[string[], string[]]> = [
      [["access", "search", "discover", "retrieve", "barrier"], ["theme-access", "theme-description"]],
      [["participant", "community", "voice", "account", "collabor"], ["theme-voice"]],
      [["uncertain", "ambigu", "parallel", "interpret"], ["theme-uncertainty", "theme-reflexivity"]],
      [["researcher", "fieldnote", "method", "review"], ["theme-reflexivity"]],
      [["catalog", "descript", "metadata", "terminology"], ["theme-description"]],
    ];
    const result = { themeIds: [...new Set(terms.filter(([keywords]) => keywords.some((word) => lower.includes(word))).flatMap(([, ids]) => ids))]
      .filter((id) => snapshot.themes.some((theme) => theme.id === id)), rationale: "Matched passage terms against the names and descriptions of themes in this demonstration project." };
    suggestionCache.current.set(cacheKey, result);
    return result;
  }

  async function saveSettings(settings: AiSettings) {
    try {
      setSaveStatus("saving");
      const normalized = { ...settings, ergonomics: normalizeErgonomics(settings) };
      const saved = backend.desktop ? await backend.saveSettings(normalized) : normalized;
      updateSnapshot((current) => ({ ...current, settings: saved }));
      settingsRef.current = saved;
      setSaveStatus("saved");
      setSaveStatusDetail("Settings saved locally.");
      notify("success", "Settings saved", saved.enabled ? `Theme suggestions will use ${saved.provider === "llama_cpp" ? "llama.cpp" : saved.model} locally.` : "Local theme suggestions are off.");
    } catch (error) {
      setSaveStatus("error");
      setSaveStatusDetail(error instanceof Error ? error.message : "Settings could not be saved.");
      notify("error", "Could not save settings", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  function saveInterfaceSetting(patch: Partial<AiSettings>) {
    const current = settingsRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    settingsRef.current = next;
    updateSnapshot((library) => ({ ...library, settings: next }));
    if (backend.desktop) {
      if (graphSaveTimer.current) window.clearTimeout(graphSaveTimer.current);
      graphSaveTimer.current = window.setTimeout(() => {
        const latest = settingsRef.current;
        if (latest) {
          setSaveStatus("saving");
          settingsWriteQueue.current = settingsWriteQueue.current.catch(() => undefined).then(() => backend.saveSettings(latest)).then(() => { setSaveStatus("saved"); setSaveStatusDetail("Workspace preferences saved locally."); }).catch((error) => { setSaveStatus("error"); setSaveStatusDetail(error instanceof Error ? error.message : "Workspace preferences could not be saved."); });
        }
      }, 350);
    }
  }

  function updateProjectErgonomics(patch: Partial<ErgonomicsProjectState>, projectId = activeProjectId) {
    const current = settingsRef.current;
    if (!current || !projectId) return;
    const ergonomics = normalizeErgonomics(current);
    const existing = ergonomics.projects[projectId] ?? defaultErgonomicsProject();
    saveInterfaceSetting({ ergonomics: { ...ergonomics, projects: { ...ergonomics.projects, [projectId]: { ...existing, ...patch } } } });
  }

  function currentSessionCheckpoint(projectId = activeProjectId): SessionCheckpoint | undefined {
    if (!projectId) return undefined;
    return {
      projectId,
      view,
      documentId: selectedDocumentId,
      excerptId: selectedExcerptId,
      synthesisTab: snapshot?.settings.synthesisTabs?.[projectId],
      folderFilter,
      readerAsideCollapsed,
      savedAt: new Date().toISOString(),
    };
  }

  function createRecoveryCheckpoint(label: string, projectId = activeProjectId) {
    if (!snapshot || !projectId) return;
    const projectState = projectErgonomics(snapshot.settings, projectId);
    const checkpoint: RecoveryCheckpoint = {
      id: makeId("checkpoint"),
      projectId,
      label,
      savedAt: new Date().toISOString(),
      session: currentSessionCheckpoint(projectId),
      graphWorkspace: structuredClone(snapshot.settings.graphWorkspaces?.[projectId] ?? defaultGraphWorkspace(snapshot.settings)),
      synthesisWorkspace: structuredClone(snapshot.settings.synthesisWorkspaces?.[projectId] ?? defaultSynthesisWorkspace()),
    };
    updateProjectErgonomics({ recoveryCheckpoints: [checkpoint, ...projectState.recoveryCheckpoints].slice(0, 5), checkpoint: checkpoint.session }, projectId);
  }

  async function restoreRecoveryCheckpoint(checkpointId: string) {
    if (!snapshot || !activeProjectId) return;
    const checkpoint = projectErgonomics(snapshot.settings, activeProjectId).recoveryCheckpoints.find((item) => item.id === checkpointId);
    if (!checkpoint) return;
    const nextSettings: AiSettings = {
      ...snapshot.settings,
      graphWorkspaces: checkpoint.graphWorkspace ? { ...(snapshot.settings.graphWorkspaces ?? {}), [activeProjectId]: checkpoint.graphWorkspace } : snapshot.settings.graphWorkspaces,
      synthesisWorkspaces: checkpoint.synthesisWorkspace ? { ...(snapshot.settings.synthesisWorkspaces ?? {}), [activeProjectId]: checkpoint.synthesisWorkspace } : snapshot.settings.synthesisWorkspaces,
    };
    settingsRef.current = nextSettings;
    updateSnapshot((library) => ({ ...library, settings: nextSettings }));
    try {
      if (graphSaveTimer.current) window.clearTimeout(graphSaveTimer.current);
      await settingsWriteQueue.current.catch(() => undefined);
      if (backend.desktop) await backend.saveSettings(nextSettings);
      if (checkpoint.session) resumeFromCheckpoint(checkpoint.session);
      notify("success", "Workspace checkpoint restored", "Graph and synthesis state were saved. Catalogue records were not rolled back.");
    } catch (error) { notify("error", "Could not persist recovery checkpoint", error instanceof Error ? error.message : undefined); }
  }

  function resumeFromCheckpoint(checkpoint: SessionCheckpoint) {
    if (!snapshot) return;
    const targetProjectId = snapshot.projects.some((project) => project.id === checkpoint.projectId) ? checkpoint.projectId : snapshot.projects.some((project) => project.id === activeProjectId) ? activeProjectId! : snapshot.projects[0]?.id;
    if (!targetProjectId) { setResumeCheckpoint(undefined); notify("info", "No project is available to resume"); return; }
    const targetDocuments = snapshot.documents.filter((document) => document.projectId === targetProjectId);
    const targetDocumentId = targetDocuments.some((document) => document.id === checkpoint.documentId) ? checkpoint.documentId : targetDocuments[0]?.id;
    const targetExcerptId = snapshot.excerpts.some((excerpt) => excerpt.id === checkpoint.excerptId && excerpt.documentId === targetDocumentId) ? checkpoint.excerptId : undefined;
    const groups = snapshot.settings.libraryGroups?.[targetProjectId] ?? {};
    const [sourceId, encodedPath] = checkpoint.folderFilter?.split("::", 2) ?? [];
    const source = snapshot.projectSources.find((item) => item.projectId === targetProjectId && item.id === sourceId && item.label !== "Imported project bundle" && item.label !== "Restored project bundle");
    const sourcePrefix = source && encodedPath ? decodeURIComponent(encodedPath).replaceAll("\\", "/").toLocaleLowerCase() : source?.path.replaceAll("\\", "/").toLocaleLowerCase();
    const group = checkpoint.folderFilter?.startsWith("group::") ? checkpoint.folderFilter.slice(7) : undefined;
    const validFolder = !checkpoint.folderFilter || checkpoint.folderFilter === "all" || (group ? targetDocuments.some((document) => groups[document.id] === group || groups[document.id]?.startsWith(`${group}/`)) : Boolean(source && sourcePrefix && targetDocuments.some((document) => document.path.replaceAll("\\", "/").toLocaleLowerCase().startsWith(sourcePrefix))));
    const safeFolder = validFolder ? checkpoint.folderFilter ?? "all" : "all";
    setActiveProjectId(targetProjectId);
    setView((["reader", "themes", "synthesis"] as const).includes(checkpoint.view) ? checkpoint.view : "reader");
    setSelectedDocumentId(targetDocumentId);
    setSelectedExcerptId(targetExcerptId);
    setFolderFilter(safeFolder);
    setReaderAsideCollapsed(checkpoint.readerAsideCollapsed ?? false);
    if (checkpoint.synthesisTab) saveInterfaceSetting({ synthesisTabs: { ...(settingsRef.current?.synthesisTabs ?? {}), [targetProjectId]: checkpoint.synthesisTab } });
    setResumeCheckpoint(undefined);
    if (targetProjectId !== checkpoint.projectId || targetDocumentId !== checkpoint.documentId || safeFolder !== (checkpoint.folderFilter ?? "all")) notify("info", "Resume target was updated", "An old project, document, or folder was unavailable. The library was opened at a safe location.");
  }

  async function doExport(format: ExportFormat, projectId = activeProjectId, options?: ExportOptions) {
    if (!snapshot) return;
    try {
      if (!backend.desktop && format === "csv") downloadBrowserCsv(snapshot, projectId);
      else {
        if (backend.desktop) {
          if (graphSaveTimer.current) window.clearTimeout(graphSaveTimer.current);
          graphSaveTimer.current = undefined;
          await settingsWriteQueue.current;
          if (settingsRef.current) await backend.saveSettings(settingsRef.current);
        }
        const synthesis = projectId ? snapshot.settings.synthesisWorkspaces?.[projectId] : undefined;
        const usedExcerptIds = new Set(synthesis?.sections.flatMap((section) => section.excerptIds) ?? []);
        const usedDocumentIds = snapshot.excerpts.filter((excerpt) => usedExcerptIds.has(excerpt.id)).map((excerpt) => excerpt.documentId);
        const result = await backend.exportLibrary(format, projectId, options ? { ...options, usedDocumentIds } : undefined);
        notify("success", `${format.toUpperCase()} export complete`, result.path ? `Saved to ${result.path}` : undefined);
        return;
      }
      notify("success", "CSV export prepared", "Your browser should begin the download now.");
    } catch (error) {
      notify("error", "Export failed", error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  async function saveProjectNow(checkpointLabel = "Manual save") {
    if (!snapshot || !activeProjectId) return;
    setProjectSaving(true);
    setSaveStatus("saving");
    try {
      createRecoveryCheckpoint(checkpointLabel, activeProjectId);
      if (graphSaveTimer.current) {
        window.clearTimeout(graphSaveTimer.current);
        graphSaveTimer.current = undefined;
      }
      if (backend.desktop) {
        await settingsWriteQueue.current.catch(() => undefined);
        if (settingsRef.current) await backend.saveSettings(settingsRef.current);
        await backend.saveProjectState(activeProjectId);
      } else {
        backend.persistBrowser(snapshot);
      }
      graphSaveErrorShown.current = false;
      setSaveStatus("saved");
      setSaveStatusDetail(`Project “${activeProject?.title ?? "Untitled"}” saved with a recovery checkpoint.`);
      notify("success", `Project “${activeProject?.title ?? "Untitled"}” saved`, "Catalogue records, synthesis work, graph arrangement, and label settings are safely stored.");
    } catch (error) {
      setSaveStatus("error");
      setSaveStatusDetail(error instanceof Error ? error.message : "The project could not be saved.");
      notify("error", "Could not save project", error instanceof Error ? error.message : undefined);
    } finally {
      setProjectSaving(false);
    }
  }

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLocaleLowerCase() === "k") { event.preventDefault(); setCommandPaletteOpen(true); }
      else if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); cycleFocus(-1); }
      else if (event.altKey && event.key === "ArrowRight") { event.preventDefault(); cycleFocus(1); }
      else if (event.key === "1") { event.preventDefault(); setView("reader"); }
      else if (event.key === "2") { event.preventDefault(); setView("themes"); }
      else if (event.key === "3") { event.preventDefault(); setView("synthesis"); }
      else if (event.key.toLocaleLowerCase() === "s") { event.preventDefault(); void saveProjectNow(); }
      else if (event.key === ",") { event.preventDefault(); setSettingsOpen(true); }
      else if (event.shiftKey && event.key.toLocaleLowerCase() === "e") { event.preventDefault(); setExportOpen(true); }
      else if (event.shiftKey && event.key.toLocaleLowerCase() === "r") { event.preventDefault(); setView("themes"); requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("thematic:graph-recenter"))); }
      else if (event.shiftKey && event.key.toLocaleLowerCase() === "z") { event.preventDefault(); setView("themes"); requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("thematic:graph-zen"))); }
      else if (event.shiftKey && event.key.toLocaleLowerCase() === "l") { event.preventDefault(); setView("themes"); requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("thematic:graph-autolayout"))); }
      else if (event.shiftKey && event.key.toLocaleLowerCase() === "n") { event.preventDefault(); setView("themes"); requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("thematic:graph-note"))); }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [snapshot, activeProjectId, activeProject?.title, activeErgonomics.focusItems, selectedDocumentId, selectedExcerptId]);

  function openExcerptInReader(excerptId: string) {
    const excerpt = snapshot?.excerpts.find((item) => item.id === excerptId);
    if (!excerpt) return;
    const document = snapshot?.documents.find((item) => item.id === excerpt.documentId);
    if (document) setActiveProjectId(document.projectId);
    setSelectedDocumentId(excerpt.documentId);
    setSelectedExcerptId(excerpt.id);
    setDraft(undefined);
    setView("reader");
    setMobilePane("document");
  }

  function openDocumentInReader(documentId: string) {
    const document = snapshot?.documents.find((item) => item.id === documentId);
    if (!document) return;
    setActiveProjectId(document.projectId);
    setSelectedDocumentId(document.id);
    setSelectedExcerptId(undefined);
    setDraft(undefined);
    setView("reader");
    setMobilePane("document");
  }

  function openPendingDraft(pending: PendingExcerptDraft) {
    const document = snapshot?.documents.find((item) => item.id === pending.documentId);
    if (!document) return;
    setActiveProjectId(document.projectId);
    setSelectedDocumentId(document.id);
    setSelectedExcerptId(pending.excerptId);
    setRedefiningExcerptId(pending.excerptId);
    setDraft({ ...pending });
    setView("reader");
    setMobilePane("notes");
    setSupportOpen(false);
  }

  function openFocusItem(item: FocusItem) {
    if (item.kind === "document") openDocumentInReader(item.targetId);
    else if (item.kind === "excerpt") openExcerptInReader(item.targetId);
    else {
      setView("synthesis");
      if (activeProjectId) saveInterfaceSetting({ synthesisTabs: { ...(settingsRef.current?.synthesisTabs ?? {}), [activeProjectId]: item.kind === "claim" ? "claims" : "draft" } });
    }
    setSupportOpen(false);
  }

  function cycleFocus(direction: -1 | 1) {
    const items = activeErgonomics.focusItems.filter((item) => !item.completed);
    if (!items.length) { setSupportOpen(true); return; }
    const currentTarget = selectedExcerptId ?? selectedDocumentId;
    const index = items.findIndex((item) => item.targetId === currentTarget);
    const next = items[(index < 0 ? (direction > 0 ? 0 : items.length - 1) : (index + direction + items.length) % items.length)];
    openFocusItem(next);
  }

  function openAttentionItem(item: AttentionItem) {
    if (item.kind === "save") {
      setSupportOpen(false);
      void saveProjectNow("Retry after save failure");
      return;
    }
    if (!item.targetId) return;
    if (item.kind === "draft") {
      const pending = activeErgonomics.drafts.find((draft) => draft.id === item.targetId);
      if (pending) openPendingDraft(pending);
    } else if (item.kind === "claim") {
      setView("synthesis");
      setAttentionTarget({ kind: "claim", id: item.targetId, request: Date.now() });
      if (activeProjectId) saveInterfaceSetting({ synthesisTabs: { ...(settingsRef.current?.synthesisTabs ?? {}), [activeProjectId]: "claims" } });
      setSupportOpen(false);
    } else if (item.kind === "screening") {
      setView("synthesis");
      setAttentionTarget({ kind: "screening", id: item.targetId, request: Date.now() });
      if (activeProjectId) saveInterfaceSetting({ synthesisTabs: { ...(settingsRef.current?.synthesisTabs ?? {}), [activeProjectId]: "screening" } });
      setSupportOpen(false);
    } else if (item.kind === "excerpt") openExcerptInReader(item.targetId);
    else if (item.kind === "orphan") {
      setSupportOpen(false);
      void relinkDocument(item.targetId);
    } else if (item.kind === "citation") {
      openDocumentInReader(item.targetId);
      window.setTimeout(() => setMetadataOpen(true), 0);
    } else openDocumentInReader(item.targetId);
  }

  function endResearchSession(note: string, nextFocusItemId?: string) {
    updateProjectErgonomics({ sessionStartedAt: undefined, endSessionNote: note, nextFocusItemId, checkpoint: currentSessionCheckpoint() });
    void saveProjectNow("End-session handoff");
    notify("success", "Session handoff saved", nextFocusItemId ? "Your next focus item is ready for the next session." : "Your note and workspace checkpoint are ready for the next session.");
  }

  function dismissAttentionItem(item: AttentionItem) {
    updateProjectErgonomics({ dismissedAttention: { ...(activeErgonomics.dismissedAttention ?? {}), [item.id]: `${item.title}\n${item.detail}` } });
  }

  function deleteRecoveryCheckpoint(id?: string) {
    if (!activeProjectId) return;
    const count = id ? 1 : activeErgonomics.recoveryCheckpoints.length;
    if (!count || !window.confirm(`Delete ${count} recovery checkpoint${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
    updateProjectErgonomics({ recoveryCheckpoints: id ? activeErgonomics.recoveryCheckpoints.filter((item) => item.id !== id) : [] });
  }

  function resetDemo() {
    const restored = resetBrowserSnapshot();
    setSnapshot(restored);
    setActiveProjectId(restored.projects[0]?.id);
    setSelectedDocumentId(restored.documents[0]?.id);
    setDraft(undefined);
    setSelectedExcerptId(undefined);
    setPayloads({});
    setSettingsOpen(false);
    notify("success", "Sample catalogue restored");
  }

  async function relinkDocument(documentId: string) {
    if (!backend.desktop || !activeProjectId) return;
    try {
      const candidate = await backend.chooseRelinkCandidate(documentId);
      if (!candidate) return;
      let allowHashMismatch = false;
      if (!candidate.hashMatches) {
        allowHashMismatch = window.confirm(`“${candidate.fileName}” does not match the original file fingerprint. Link it anyway? Existing excerpts will remain attached to this document record.`);
        if (!allowHashMismatch) {
          notify("info", "Relink cancelled", "Choose the original file or an exact copy to preserve fingerprint verification.");
          return;
        }
      }
      const next = await backend.relinkDocument(documentId, candidate.path, allowHashMismatch);
      finishSourceScan(next, activeProjectId, candidate.hashMatches ? "Document relinked by matching fingerprint" : "Document relinked");
      setSelectedDocumentId(documentId);
    } catch (error) {
      notify("error", "Could not relink document", error instanceof Error ? error.message : undefined);
    }
  }

  const synthesisWorkspace = snapshot?.settings.synthesisWorkspaces?.[activeProjectId ?? ""] ?? defaultSynthesisWorkspace();
  const rawAttentionItems: AttentionItem[] = [
    ...projectDocuments.filter((document) => document.fileAvailable === false).map((document) => ({ id: `orphan:${document.id}`, kind: "orphan" as const, title: `Relink ${document.title}`, detail: "The source file is missing, but its catalogue record and excerpts remain available.", targetId: document.id })),
    ...projectDocuments.filter((document) => (synthesisWorkspace.reviews.find((review) => review.documentId === document.id)?.status ?? "inbox") === "inbox").map((document) => ({ id: `screen:${document.id}`, kind: "screening" as const, title: `Screen ${document.title}`, detail: "No inclusion or exclusion decision has been recorded.", targetId: document.id })),
    ...synthesisWorkspace.claims.filter((claim) => !claim.evidence.length).map((claim) => ({ id: `claim:${claim.id}`, kind: "claim" as const, title: `Add evidence to “${truncate(claim.text, 70)}”`, detail: "This claim currently has no supporting, qualifying, or contradicting excerpt.", targetId: claim.id })),
    ...projectDocuments.filter((document) => !document.doi || !document.publicationDate).map((document) => ({ id: `citation:${document.id}`, kind: "citation" as const, title: `Complete citation for ${document.title}`, detail: !document.doi && !document.publicationDate ? "DOI and publication date are missing." : !document.doi ? "DOI is missing or not applicable; review the record." : "Publication date is missing.", targetId: document.id })),
    ...projectExcerpts.filter((excerpt) => !excerpt.themeIds.length).map((excerpt) => ({ id: `excerpt:${excerpt.id}`, kind: "excerpt" as const, title: `Theme “${truncate(excerpt.text || "Image excerpt", 64)}”`, detail: "This excerpt is not connected to a theme.", targetId: excerpt.id })),
    ...activeErgonomics.drafts.map((pending) => ({ id: `draft:${pending.id}`, kind: "draft" as const, title: `Resume excerpt draft`, detail: `${truncate(pending.text || "Image excerpt", 82)} · updated ${new Date(pending.updatedAt).toLocaleString()}`, targetId: pending.id })),
    ...(saveStatus === "error" ? [{ id: "save:error", kind: "save" as const, title: "Retry saving the current project", detail: saveStatusDetail ?? "The last background save failed." }] : []),
  ];
  const liveAttentionIds = rawAttentionItems.map((item) => item.id).join("|");
  useEffect(() => {
    if (!activeProjectId || !snapshot) return;
    const dismissed = activeErgonomics.dismissedAttention ?? {};
    const live = new Set(liveAttentionIds.split("|").filter(Boolean));
    if (!Object.keys(dismissed).some((id) => !live.has(id))) return;
    updateProjectErgonomics({ dismissedAttention: Object.fromEntries(Object.entries(dismissed).filter(([id]) => live.has(id))) }, activeProjectId);
  }, [activeProjectId, liveAttentionIds, snapshot, activeErgonomics.dismissedAttention]);
  const attentionItems = rawAttentionItems.filter((item) => activeErgonomics.dismissedAttention?.[item.id] !== `${item.title}\n${item.detail}`);
  if (fatalError) return <FatalState message={fatalError} onRetry={() => void load()} />;
  if (!snapshot) return <LoadingApp />;

  const project = activeProject ?? snapshot.projects[0];
  const sessionElapsedMinutes = activeErgonomics.sessionStartedAt ? Math.max(0, Math.floor((sessionClock - new Date(activeErgonomics.sessionStartedAt).valueOf()) / 60_000)) : 0;
  const commandActions: CommandAction[] = [
    { id: "reader", label: "Open Reader", detail: "Read documents and capture excerpts", shortcut: "Ctrl 1", run: () => setView("reader") },
    { id: "themes", label: "Open Theme atlas", detail: "Inspect themes, notes, and relationships", shortcut: "Ctrl 2", run: () => setView("themes") },
    { id: "synthesis", label: "Open Research synthesis", detail: "Screen sources, test claims, and draft", shortcut: "Ctrl 3", run: () => setView("synthesis") },
    { id: "support", label: "Open Research Support Center", detail: "Focus lane, attention inbox, sessions, and recovery", run: () => setSupportOpen(true) },
    { id: "focus-mode", label: focusMode ? "Exit focus mode" : "Enter focus mode", detail: focusMode ? "Restore project and workspace navigation" : "Hide unrelated navigation while keeping Save and research support available", run: () => setFocusMode((current) => !current) },
    { id: "next", label: "Next focus item", detail: "Open the next incomplete item in the focus lane", shortcut: "Ctrl Alt →", run: () => cycleFocus(1) },
    { id: "previous", label: "Previous focus item", detail: "Open the previous incomplete item in the focus lane", shortcut: "Ctrl Alt ←", run: () => cycleFocus(-1) },
    { id: "save", label: "Save project checkpoint", detail: "Flush local changes and create a recovery point", shortcut: "Ctrl S", run: () => void saveProjectNow() },
    { id: "export", label: "Export project", detail: "Open data and portable-project export", shortcut: "Ctrl Shift E", run: () => setExportOpen(true) },
    { id: "settings", label: "Open Settings", detail: "Appearance, comfort, shortcuts, and local model", shortcut: "Ctrl ,", run: () => setSettingsOpen(true) },
  ];
  return (
    <div className={`app-shell ${backend.desktop ? "desktop-shell" : ""} ${isFullscreen ? "is-fullscreen" : ""} ${focusMode ? "focus-mode" : ""} theme-${snapshot.settings.appTheme ?? "archive"} fonts-${snapshot.settings.fontSet ?? "classic"} density-${ergonomicsSettings?.density ?? "comfortable"}`} style={{ "--ui-font-scale": (snapshot.settings.uiFontScale ?? 100) / 100 } as CSSProperties}>
      <header className="app-header">
        <button aria-label="Open navigation" className="mobile-menu-button" type="button"><Menu size={19} /></button>
        <div className="brand"><span className="brand-mark"><BookMarked size={21} /></span><span><strong>Thematic</strong><small>Research workbench</small></span></div>
        <div className="collection-title project-selector"><span>Current project</span><div><select aria-label="Current research project" onChange={(event) => { setActiveProjectId(event.target.value); setFolderFilter("all"); }} value={project?.id ?? ""}>{snapshot.projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button aria-label="Manage projects" className="icon-button subtle" onClick={() => setProjectOpen(true)} title="Manage projects" type="button"><FolderOpen size={15} /></button></div>{!backend.desktop && <em className="demo-mode"><i /> Browser demo</em>}</div>
        <nav className="main-nav" aria-label="Workspace">
          <button aria-current={view === "reader" ? "page" : undefined} onClick={() => setView("reader")} type="button"><BookOpenText size={17} /> Reader</button>
          <button aria-current={view === "themes" ? "page" : undefined} onClick={() => setView("themes")} type="button"><Network size={17} /> Themes <span>{snapshot.themes.length}</span></button>
          <button aria-current={view === "synthesis" ? "page" : undefined} onClick={() => setView("synthesis")} type="button"><FlaskConical size={17} /> Synthesis</button>
        </nav>
        <div className="header-actions">
          {focusMode && <button className="button header-button focus-mode-exit" onClick={() => setFocusMode(false)} title="Restore the full navigation" type="button"><Coffee size={16} /> <span>Exit focus</span></button>}
          <button aria-label="Open command palette" className="icon-button header-icon" onClick={() => setCommandPaletteOpen(true)} title="Command palette (Ctrl+K)" type="button"><Command size={17} /></button>
          <button aria-label="Open Research Support Center" className="icon-button header-icon support-center-button" onClick={() => setSupportOpen(true)} title="Research Support Center" type="button"><Coffee size={17} />{attentionItems.length > 0 && <span>{Math.min(99, attentionItems.length)}</span>}</button>
          <div className="source-menu"><button className="button header-button import-button" disabled={scanning} onClick={() => setSourceMenuOpen((open) => !open)} type="button">{scanning ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />} <span>Add sources</span></button>{sourceMenuOpen && <div className="source-menu-popover"><button onClick={() => { setSourceMenuOpen(false); void chooseFolder(); }} type="button"><FolderOpen size={15} /><span><strong>Folder</strong><small>Index every supported file inside it</small></span></button><button onClick={() => { setSourceMenuOpen(false); void chooseFiles(); }} type="button"><FilePlus2 size={15} /><span><strong>One or more files</strong><small>PDF, Markdown, or a mixed selection</small></span></button></div>}</div>
          <button aria-label="Save current project" className="button header-button project-save-button" disabled={projectSaving || !project} onClick={() => void saveProjectNow()} title="Save current project now" type="button">{projectSaving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} <span>Save</span></button>
          <SaveStateIndicator detail={saveStatusDetail} state={saveStatus} />
          <button aria-label="Export library" className="icon-button header-icon" onClick={() => setExportOpen(true)} title="Export library" type="button"><Download size={18} /></button>
          <button aria-label="Settings" className="icon-button header-icon" onClick={() => setSettingsOpen(true)} title="Settings" type="button"><Settings size={18} /></button>
        </div>
      </header>
      {resumeCheckpoint && <ResumeBanner onDismiss={() => setResumeCheckpoint(undefined)} onResume={() => resumeFromCheckpoint(resumeCheckpoint)} savedAt={resumeCheckpoint.savedAt} title={snapshot.projects.find((item) => item.id === resumeCheckpoint.projectId)?.title ?? "Research project"} />}

      {view === "reader" ? (
        <main className={`reader-workspace mobile-${mobilePane} ${readerAsideCollapsed ? "notes-collapsed" : ""}`}>
          <div className="mobile-pane-tabs" role="tablist" aria-label="Reader panels">
            <button aria-selected={mobilePane === "library"} onClick={() => setMobilePane("library")} role="tab" type="button"><Library size={15} /> Library</button>
            <button aria-selected={mobilePane === "document"} onClick={() => setMobilePane("document")} role="tab" type="button"><BookOpenText size={15} /> Document</button>
            <button aria-selected={mobilePane === "notes"} onClick={() => setMobilePane("notes")} role="tab" type="button"><Highlighter size={15} /> Excerpts</button>
          </div>
          <LibraryPanel
            allDocuments={projectDocuments}
            documents={filteredDocuments}
            excerpts={projectExcerpts}
            folderFilter={folderFilter}
            directories={snapshot.settings.libraryDirectories?.[activeProjectId ?? ""] ?? []}
            treeHeight={snapshot.settings.libraryTreeHeights?.[activeProjectId ?? ""] ?? 178}
            onTreeHeightChange={(height) => { if (activeProjectId) saveInterfaceSetting({ libraryTreeHeights: { ...(settingsRef.current?.libraryTreeHeights ?? {}), [activeProjectId]: height } }); }}
            groups={snapshot.settings.libraryGroups?.[activeProjectId ?? ""] ?? {}}
            kindFilter={kindFilter}
            onImport={() => void chooseFolder()}
            onImportFiles={() => void chooseFiles()}
            onCreateDirectory={(path) => { if (!activeProjectId) return; const clean = path.replaceAll("\\", "/").split("/").map((part) => part.trim()).filter(Boolean).join("/"); if (!clean) return; const current = settingsRef.current?.libraryDirectories?.[activeProjectId] ?? []; saveInterfaceSetting({ libraryDirectories: { ...(settingsRef.current?.libraryDirectories ?? {}), [activeProjectId]: [...new Set([...current, clean])].sort((a, b) => a.localeCompare(b)) } }); }}
            onDeleteDirectory={(path) => { if (!activeProjectId) return; const directories = (settingsRef.current?.libraryDirectories?.[activeProjectId] ?? []).filter((item) => item !== path && !item.startsWith(`${path}/`)); const groups = Object.fromEntries(Object.entries(settingsRef.current?.libraryGroups?.[activeProjectId] ?? {}).map(([documentId, group]) => [documentId, group === path || group.startsWith(`${path}/`) ? "" : group])); saveInterfaceSetting({ libraryDirectories: { ...(settingsRef.current?.libraryDirectories ?? {}), [activeProjectId]: directories }, libraryGroups: { ...(settingsRef.current?.libraryGroups ?? {}), [activeProjectId]: groups } }); if (folderFilter === `group::${path}` || folderFilter.startsWith(`group::${path}/`)) setFolderFilter("all"); }}
            onMoveDocument={(documentId, group) => activeProjectId && saveInterfaceSetting({ libraryGroups: { ...(settingsRef.current?.libraryGroups ?? {}), [activeProjectId]: { ...(settingsRef.current?.libraryGroups?.[activeProjectId] ?? {}), [documentId]: group } } })}
            onRenameDirectory={(path, nextPath) => { if (!activeProjectId) return; const clean = nextPath.replaceAll("\\", "/").split("/").map((part) => part.trim()).filter(Boolean).join("/"); if (!clean) return; const directories = [...new Set((settingsRef.current?.libraryDirectories?.[activeProjectId] ?? []).map((item) => item === path || item.startsWith(`${path}/`) ? `${clean}${item.slice(path.length)}` : item))].sort((a, b) => a.localeCompare(b)); const groups = Object.fromEntries(Object.entries(settingsRef.current?.libraryGroups?.[activeProjectId] ?? {}).map(([documentId, group]) => [documentId, group === path || group.startsWith(`${path}/`) ? `${clean}${group.slice(path.length)}` : group])); saveInterfaceSetting({ libraryDirectories: { ...(settingsRef.current?.libraryDirectories ?? {}), [activeProjectId]: directories }, libraryGroups: { ...(settingsRef.current?.libraryGroups ?? {}), [activeProjectId]: groups } }); if (folderFilter === `group::${path}` || folderFilter.startsWith(`group::${path}/`)) setFolderFilter(`group::${clean}${folderFilter.slice(`group::${path}`.length)}`); }}
            onRelink={(id) => void relinkDocument(id)}
            onRescan={() => void rescan()}
            onSelect={selectDocument}
            query={libraryQuery}
            project={project}
            sources={snapshot.projectSources.filter((source) => source.projectId === activeProjectId)}
            scanning={scanning}
            selectedDocumentId={selectedDocumentId}
            setKindFilter={setKindFilter}
            setFolderFilter={setFolderFilter}
            setQuery={setLibraryQuery}
          />
          <section className="reader-center reader-pane" aria-label="Document reader">
            {selectedDocument ? (
              <>
                <div className="pane-heading reader-pane-label"><div><span className="pane-index">II</span><h2>Document</h2></div><button aria-label={readerAsideCollapsed ? "Show excerpt sidebar" : "Hide excerpt sidebar"} className="button ghost compact" onClick={() => setReaderAsideCollapsed((value) => !value)} type="button">{readerAsideCollapsed ? "Show excerpts" : "Hide excerpts"}</button></div>
                <DocumentHeader document={selectedDocument} excerptCount={documentExcerpts.length} onCite={() => setCitationOpen(true)} onEdit={() => setMetadataOpen(true)} />
                <DocumentViewer defaultExcerptColor={snapshot.settings.defaultExcerptColor} initialZoom={(snapshot.settings.defaultReaderZoom ?? 100) / 100} document={selectedDocument} error={payloadError} excerpts={redefiningExcerptId ? documentExcerpts.filter((excerpt) => excerpt.id !== redefiningExcerptId) : documentExcerpts} loading={payloadLoading} onCancelSelection={() => { setDraft(undefined); setRedefiningExcerptId(undefined); }} onOpenExcerpt={selectExcerpt} onSelection={captureSelection} payload={payloads[selectedDocument.id]} pendingSelection={draft} revealRequest={`${selectedExcerptId ?? locatedExcerptId ?? ""}:${mobilePane}:${locateRequest}`} targetExcerptId={selectedExcerptId ?? locatedExcerptId} />
              </>
            ) : (
              <div className="empty-state reader-empty"><FolderOpen /><h2>Choose a document to begin</h2><p>Open a PDF or Markdown file from the library, or add a research folder.</p><button className="button primary" onClick={() => void chooseFolder()} type="button"><FolderOpen size={16} /> Add research folder</button></div>
            )}
          </section>
          {selectedDocument ? (
            <AnnotationPanel document={selectedDocument} draft={draft} excerpts={documentExcerpts} onCloseDraft={() => { setDraft(undefined); setRedefiningExcerptId(undefined); }} onDelete={(id) => void deleteExcerpt(id)} onDraftChange={updateOpenDraft} onLocateExcerpt={locateExcerpt} onOpenSettings={() => setSettingsOpen(true)} onRedefine={redefineExcerpt} onSave={(data) => void saveExcerpt(data)} onSelectExcerpt={selectExcerpt} onSuggest={suggestThemes} recentThemeIds={activeErgonomics.lastThemeIds ?? []} redefining={Boolean(redefiningExcerptId)} saving={savingExcerpt} selectedExcerptId={selectedExcerptId} settings={snapshot.settings} themes={projectThemes} />
          ) : <EmptyNotesPanel />}
        </main>
      ) : view === "themes" ? (
        <ThemesWorkspace documents={snapshot.documents} excerpts={snapshot.excerpts} initialExcerptId={selectedExcerptId} initialProjectId={activeProjectId} onCreateTheme={(theme) => void createTheme(theme)} onDeleteRelationship={(relationship) => void deleteRelationship(relationship)} onDeleteTheme={(id) => void deleteTheme(id)} onOpenInReader={openExcerptInReader} onPersistGraphWorkspace={persistGraphWorkspace} onUpdateRelationship={upsertRelationship} onUpdateTheme={updateTheme} projects={snapshot.projects} relationships={snapshot.relationships} settings={snapshot.settings} themes={snapshot.themes} />
      ) : (
        <SynthesisWorkspace attentionTarget={attentionTarget} documents={projectDocuments} excerpts={projectExcerpts} initialTab={snapshot.settings.synthesisTabs?.[project?.id ?? ""] ?? "protocol"} onChange={(patch) => project && persistSynthesisWorkspace(project.id, patch)} onOpenDocument={openDocumentInReader} onOpenExcerpt={openExcerptInReader} onTabChange={(tab) => project && saveInterfaceSetting({ synthesisTabs: { ...(settingsRef.current?.synthesisTabs ?? {}), [project.id]: tab } })} project={project} themes={projectThemes} workspace={synthesisWorkspace} />
      )}

      <input
        {...({ directory: "", webkitdirectory: "" } as InputHTMLAttributes<HTMLInputElement>)}
        accept=".pdf,.md,.markdown,application/pdf,text/markdown"
        className="visually-hidden-input"
        multiple
        onChange={(event) => void importBrowserFiles(event, "folder")}
        ref={folderInputRef}
        type="file"
      />
      <input accept=".pdf,.md,.markdown,application/pdf,text/markdown" className="visually-hidden-input" multiple onChange={(event) => void importBrowserFiles(event, "file")} ref={filesInputRef} type="file" />
      {metadataOpen && selectedDocument && <MetadataModal document={selectedDocument} onClose={() => setMetadataOpen(false)} onDetectDoi={backend.desktop && selectedDocument.kind === "pdf" ? detectAndLookupCitation : undefined} onLookup={backend.desktop ? (document) => backend.lookupCitationMetadata(document) : undefined} onSave={saveDocument} />}
      {citationOpen && selectedDocument && <CitationModal document={selectedDocument} onClose={() => setCitationOpen(false)} onNotify={notify} />}
      {settingsOpen && <SettingsModal browserMode={!backend.desktop} onChooseLocalModel={backend.desktop ? backend.chooseLocalModelFile : undefined} onClose={() => setSettingsOpen(false)} onResetDemo={resetDemo} onSave={saveSettings} settings={snapshot.settings} />}
      {commandPaletteOpen && <CommandPalette actions={commandActions} onClose={() => setCommandPaletteOpen(false)} />}
      {supportOpen && <ErgonomicsHub attention={attentionItems} claims={synthesisWorkspace.claims} documents={projectDocuments} excerpts={projectExcerpts} onClose={() => setSupportOpen(false)} onCreateCheckpoint={createRecoveryCheckpoint} onDeleteCheckpoint={deleteRecoveryCheckpoint} onDiscardDraft={(id) => removePersistedDraft(id)} onDismissAttentionItem={dismissAttentionItem} onEndSession={endResearchSession} onOpenAttentionItem={openAttentionItem} onOpenDraft={openPendingDraft} onOpenFocusItem={openFocusItem} onRestoreCheckpoint={(id) => { void restoreRecoveryCheckpoint(id); }} onRestoreDismissedAttention={() => updateProjectErgonomics({ dismissedAttention: {} })} onUpdateProject={(patch) => updateProjectErgonomics(patch)} projectState={activeErgonomics} sections={synthesisWorkspace.sections} sessionElapsedMinutes={sessionElapsedMinutes} settings={ergonomicsSettings!} />}
      {projectOpen && <ProjectModal activeProjectId={activeProjectId} counts={Object.fromEntries(snapshot.projects.map((item) => { const documentIds = new Set(snapshot.documents.filter((document) => document.projectId === item.id).map((document) => document.id)); return [item.id, { documents: documentIds.size, excerpts: snapshot.excerpts.filter((excerpt) => documentIds.has(excerpt.documentId)).length, themes: snapshot.themes.filter((theme) => theme.projectId === item.id).length, sources: snapshot.projectSources.filter((source) => source.projectId === item.id).length }]; }))} desktopMode={backend.desktop} onClose={() => setProjectOpen(false)} onCreate={createProject} onDelete={deleteProject} onExport={(id) => doExport("thematic", id)} onImport={importProjectBundle} onRepair={inspectProjectRepair} onOpen={(id) => { setActiveProjectId(id); setFolderFilter("all"); }} onRename={renameProject} projects={snapshot.projects} />}
      {bundlePreview && <ProjectBundleModal key={bundlePreview.manifestHash} onClose={() => setBundlePreview(undefined)} onConfirm={() => applyBundleImport(bundlePreview)} preview={bundlePreview} />}
      {repairPreview && <ProjectBundleModal key={`${repairPreview.projectId}:${repairPreview.bundle.manifestHash}`} onClose={() => setRepairPreview(undefined)} onConfirm={(resolutions) => applyRepair(repairPreview, resolutions)} preview={repairPreview.bundle} repair={repairPreview} />}
      {exportOpen && <ExportModal browserMode={!backend.desktop} counts={{ documents: projectDocuments.length, excerpts: projectExcerpts.length, themes: projectThemes.length }} onClose={() => setExportOpen(false)} onExport={(format, options) => doExport(format, activeProjectId, options)} projectTitle={project?.title} />}
      <ToastRegion dismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} toasts={toasts} />
    </div>
  );
}

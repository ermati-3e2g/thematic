import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  BookMarked,
  BookOpenText,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  Database,
  Download,
  FileDown,
  FileText,
  Files,
  FolderOpen,
  FolderTree,
  Highlighter,
  Info,
  LayoutList,
  Link2,
  Library,
  LoaderCircle,
  LocateFixed,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type {
  AiSettings,
  Excerpt,
  ExportFormat,
  ExportOptions,
  ResearchDocument,
  ResearchProject,
  ProjectSource,
  SelectionDraft,
  Theme,
  ToastMessage,
} from "../types";
import MarkdownNote from "./MarkdownNote";
import ImageExcerptDialog from "./ImageExcerptDialog";
import type { BundlePreview, RepairPreview } from "../backend";
import { normalizeErgonomics } from "../ergonomics";

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trim()}…`;
}

export function formatDate(value?: string): string {
  if (!value) return "Undated";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : dateFormatter.format(date);
}

export function Modal({
  title,
  description,
  icon,
  onClose,
  children,
  size = "medium",
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: "small" | "medium" | "large";
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-describedby={description ? "modal-description" : undefined} aria-modal="true" className={`modal ${size}`} role="dialog">
        <header className="modal-header">
          <div className="modal-title-icon">{icon}</div>
          <div>
            <h2>{title}</h2>
            {description && <p id="modal-description">{description}</p>}
          </div>
          <button aria-label="Close dialog" className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function ToastRegion({ toasts, dismiss }: { toasts: ToastMessage[]; dismiss: (id: string) => void }) {
  return (
    <div aria-atomic="true" aria-live="polite" className="toast-region">
      {toasts.map((toast) => (
        <div className={`toast ${toast.tone}`} key={toast.id} role={toast.tone === "error" ? "alert" : "status"}>
          <span className="toast-icon">{toast.tone === "success" ? <Check /> : toast.tone === "error" ? <AlertCircle /> : <Info />}</span>
          <div><strong>{toast.title}</strong>{toast.message && <p>{toast.message}</p>}</div>
          <button aria-label="Dismiss notification" onClick={() => dismiss(toast.id)} type="button"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}

export function LoadingApp() {
  return (
    <main className="app-loading">
      <div className="loading-mark"><BookMarked /><span /></div>
      <div className="eyebrow">Thematic research workbench</div>
      <h1>Opening the catalogue…</h1>
      <div className="catalogue-loader" aria-label="Loading"><i /><i /><i /><i /></div>
    </main>
  );
}

export function FatalState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="fatal-state">
      <div className="fatal-card">
        <AlertCircle size={36} />
        <div className="eyebrow">The catalogue could not be opened</div>
        <h1>Something interrupted the library.</h1>
        <p>{message}</p>
        <button className="button primary" onClick={onRetry} type="button"><RefreshCw size={16} /> Try again</button>
      </div>
    </main>
  );
}

export function DocumentIcon({ kind }: { kind: ResearchDocument["kind"] }) {
  return <span className={`document-kind ${kind}`}>{kind === "pdf" ? "PDF" : "MD"}</span>;
}

export function LibraryPanel({
  documents,
  allDocuments,
  excerpts,
  selectedDocumentId,
  query,
  setQuery,
  kindFilter,
  setKindFilter,
  onSelect,
  onImport,
  onRescan,
  scanning,
  project,
  sources,
  folderFilter,
  setFolderFilter,
  onImportFiles,
  onRelink,
  groups,
  directories,
  treeHeight,
  onTreeHeightChange,
  onMoveDocument,
  onCreateDirectory,
  onRenameDirectory,
  onDeleteDirectory,
}: {
  documents: ResearchDocument[];
  allDocuments: ResearchDocument[];
  excerpts: Excerpt[];
  selectedDocumentId?: string;
  query: string;
  setQuery: (query: string) => void;
  kindFilter: "all" | "pdf" | "markdown";
  setKindFilter: (filter: "all" | "pdf" | "markdown") => void;
  onSelect: (documentId: string) => void;
  onImport: () => void;
  onImportFiles: () => void;
  onRelink: (documentId: string) => void;
  groups: Record<string, string>;
  directories: string[];
  treeHeight: number;
  onTreeHeightChange: (height: number) => void;
  onMoveDocument: (documentId: string, group: string) => void;
  onCreateDirectory: (path: string) => void;
  onRenameDirectory: (path: string, nextPath: string) => void;
  onDeleteDirectory: (path: string) => void;
  onRescan: () => void;
  scanning: boolean;
  project?: ResearchProject;
  sources: ProjectSource[];
  folderFilter: string;
  setFolderFilter: (folder: string) => void;
}) {
  const [expanded, setExpanded] = useState(() => new Set(sources.map((source) => source.id)));
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [directoryManagerOpen, setDirectoryManagerOpen] = useState(false);
  const resizeStart = useRef<{ y: number; height: number } | undefined>(undefined);
  const clampTreeHeight = (value: number) => Math.max(96, Math.min(540, Math.round(value)));
  const groupNames = [...new Set([...directories, ...Object.values(groups).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
  const folderRows = sources.filter((source) => source.label !== "Imported project bundle" && source.label !== "Restored project bundle").flatMap((source) => {
    const root = source.path.replaceAll("\\", "/").replace(/\/$/, "");
    const sourceDocuments = allDocuments.filter((item) => {
      const path = item.path.replaceAll("\\", "/");
      return source.kind === "file" ? path.toLocaleLowerCase() === root.toLocaleLowerCase() : path.toLocaleLowerCase().startsWith(`${root.toLocaleLowerCase()}/`) || path.toLocaleLowerCase() === root.toLocaleLowerCase();
    });
    const prefixes = new Map<string, { label: string; depth: number; count: number }>();
    if (source.kind === "folder") sourceDocuments.forEach((document) => {
      let relative = document.path.replaceAll("\\", "/");
      if (relative.toLocaleLowerCase().startsWith(`${root.toLocaleLowerCase()}/`)) relative = relative.slice(root.length + 1);
      const parts = relative.split("/").slice(0, -1);
      parts.forEach((part, index) => {
        const prefix = root ? `${root}/${parts.slice(0, index + 1).join("/")}` : parts.slice(0, index + 1).join("/");
        const current = prefixes.get(prefix);
        prefixes.set(prefix, { label: part, depth: index + 1, count: (current?.count ?? 0) + 1 });
      });
    });
    const rootKey = source.id;
    return [
      { key: rootKey, sourceId: source.id, label: source.label, depth: 0, count: sourceDocuments.length, root: true, kind: source.kind },
      ...[...prefixes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([prefix, item]) => ({ key: `${source.id}::${encodeURIComponent(prefix)}`, sourceId: source.id, ...item, root: false, kind: source.kind })),
    ];
  });
  return (
    <aside className="library-panel reader-pane" aria-label="Document library">
      <div className="pane-heading">
        <div><span className="pane-index">I</span><h2>Library</h2></div>
        <button aria-label="Rescan collection" className="icon-button subtle" disabled={scanning} onClick={onRescan} title="Rescan collection" type="button">
          <RefreshCw className={scanning ? "spin" : ""} size={15} />
        </button>
      </div>
      <div className="library-controls">
        <div className="folder-tree" role="tree" aria-label="Research folders" style={{ height: clampTreeHeight(treeHeight) }}>
          <button aria-current={folderFilter === "all" ? "true" : undefined} className="folder-tree-all" onClick={() => setFolderFilter("all")} role="treeitem" type="button"><FolderTree size={15} /><span>All sources</span><em>{allDocuments.length}</em></button>
          {groupNames.map((group) => { const parts = group.split("/").filter(Boolean); return <button aria-current={folderFilter === `group::${group}` ? "true" : undefined} className="folder-root virtual-folder" key={group} onClick={() => setFolderFilter(`group::${group}`)} role="treeitem" style={{ "--folder-depth": Math.max(0, parts.length - 1) } as CSSProperties} title={group} type="button"><span className="folder-branch" /><FolderOpen size={14} /><span>{parts.at(-1) ?? group}</span><em>{allDocuments.filter((document) => groups[document.id] === group || groups[document.id]?.startsWith(`${group}/`)).length}</em></button>; })}
          {folderRows.map((folder) => {
            if (!folder.root && !expanded.has(folder.sourceId)) return null;
            return (
              <button aria-current={folderFilter === folder.key ? "true" : undefined} className={folder.root ? "folder-root" : "folder-child"} key={folder.key} onClick={() => setFolderFilter(folder.key)} role="treeitem" style={{ "--folder-depth": folder.depth } as CSSProperties} type="button">
                {folder.root && folder.kind === "folder" ? <span className="folder-disclosure" onClick={(event) => { event.stopPropagation(); setExpanded((current) => { const next = new Set(current); next.has(folder.sourceId) ? next.delete(folder.sourceId) : next.add(folder.sourceId); return next; }); }}>{expanded.has(folder.sourceId) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span> : <span className="folder-branch" />}
                {folder.kind === "file" ? <FileText size={14} /> : <FolderOpen size={14} />}<span title={folder.label}>{folder.label}</span><em>{folder.count}</em>
              </button>
            );
          })}
        </div>
        <div aria-label="Resize folder list" aria-valuemin={96} aria-valuemax={540} aria-valuenow={clampTreeHeight(treeHeight)} className="library-tree-resizer" onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); onTreeHeightChange(clampTreeHeight(treeHeight + (event.key === "ArrowDown" ? 24 : -24))); } else if (event.key === "Home") { event.preventDefault(); onTreeHeightChange(96); } else if (event.key === "End") { event.preventDefault(); onTreeHeightChange(540); } }} onPointerDown={(event) => { resizeStart.current = { y: event.clientY, height: treeHeight }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (resizeStart.current) onTreeHeightChange(clampTreeHeight(resizeStart.current.height + event.clientY - resizeStart.current.y)); }} onPointerUp={() => { resizeStart.current = undefined; }} role="separator" tabIndex={0} title="Drag to resize the folder list; arrow keys also work" />
        <button aria-expanded={directoryManagerOpen} className="button compact library-directory-toggle" onClick={() => setDirectoryManagerOpen((open) => !open)} type="button"><FolderTree size={14} /> Manage directories</button>
        {directoryManagerOpen && <div className="library-directory-manager"><header><div><strong>Library directories</strong><small>Use / to create nested paths.</small></div><button className="button compact" onClick={() => { const path = window.prompt("New library directory (for example Methods/Surveys)"); if (path?.trim()) onCreateDirectory(path.trim()); }} type="button"><Plus size={13} /> New</button></header>{groupNames.length ? <div>{groupNames.map((group) => <div key={group}><span title={group}>{group}</span><button aria-label={`Rename ${group}`} onClick={() => { const next = window.prompt("Rename library directory", group); if (next?.trim() && next.trim() !== group) onRenameDirectory(group, next.trim()); }} type="button"><Pencil size={12} /></button><button aria-label={`Delete ${group}`} onClick={() => { if (window.confirm(`Remove the library directory “${group}”? Documents inside it will become unfiled.`)) onDeleteDirectory(group); }} type="button"><Trash2 size={12} /></button></div>)}</div> : <p className="muted-inline">No internal directories yet.</p>}</div>}
        <label className="search-field"><Search size={15} /><span className="sr-only">Search library</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Title, author, DOI…" value={query} /></label>
        <div aria-label="File type filter" className="file-filters" role="group">
          {(["all", "pdf", "markdown"] as const).map((kind) => (
            <button aria-pressed={kindFilter === kind} key={kind} onClick={() => setKindFilter(kind)} type="button">
              {kind === "all" ? "All" : kind === "pdf" ? "PDF" : "Markdown"}
              <span>{kind === "all" ? allDocuments.length : allDocuments.filter((doc) => doc.kind === kind).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="document-list" role="list">
        {documents.length === 0 ? (
          <div className="empty-state library-empty">
            {allDocuments.length ? <Search /> : <Archive />}
            <h3>{allDocuments.length ? "No matching documents" : "No documents found"}</h3>
            <p>{allDocuments.length ? "Try a different title, author, DOI, or file filter." : "Choose a folder containing PDF or Markdown files."}</p>
            {!allDocuments.length && <button className="button" onClick={onImport} type="button"><FolderOpen size={15} /> Choose folder</button>}
          </div>
        ) : documents.map((document) => {
          const count = excerpts.filter((excerpt) => excerpt.documentId === document.id).length;
          return (
            <div
              aria-current={selectedDocumentId === document.id ? "true" : undefined}
              className={`document-card ${selectedDocumentId === document.id ? "selected" : ""} ${document.fileAvailable === false ? "orphaned" : ""}`}
              key={document.id}
              role="listitem"
            >
              <button className="document-card-main" onClick={() => onSelect(document.id)} type="button">
              <div className="document-card-top"><DocumentIcon kind={document.kind} /><span>{document.publicationDate?.slice(0, 4) || "n.d."}</span></div>
              <strong>{document.title}</strong>
              <span className="document-author">{document.authors || "Unknown author"}</span>
              <div className="document-card-footer"><span>{count} {count === 1 ? "excerpt" : "excerpts"}</span>{document.doi && <span title={document.doi}>DOI</span>}</div>
              </button>
              <div className="library-organize-row"><span>Library directory</span><select aria-label={`Library directory for ${document.title}`} onChange={(event) => { if (event.target.value === "__new__") { const name = window.prompt("New library directory (use / for nested folders)"); if (name?.trim()) { onCreateDirectory(name.trim()); onMoveDocument(document.id, name.trim()); } } else onMoveDocument(document.id, event.target.value); }} value={groups[document.id] ?? ""}><option value="">Unfiled</option>{groupNames.map((group) => <option key={group} value={group}>{group}</option>)}<option value="__new__">+ New directory…</option></select></div>
              {document.fileAvailable === false && <div className="orphan-actions"><span><AlertCircle size={13} /> Source missing</span><button className="button ghost compact" onClick={() => onRelink(document.id)} type="button"><Link2 size={13} /> Relink</button></div>}
            </div>
          );
        })}
      </div>
      <footer className="library-footer source-actions"><span>{project?.title ?? "No project selected"}</span><div className="source-menu"><button className="button" onClick={() => setAddMenuOpen((open) => !open)} type="button"><FolderOpen size={16} /> Add sources</button>{addMenuOpen && <div className="source-menu-popover align-right"><button onClick={() => { setAddMenuOpen(false); onImport(); }} type="button"><FolderOpen size={15} /><span><strong>Folder</strong><small>Index its supported files</small></span></button><button onClick={() => { setAddMenuOpen(false); onImportFiles(); }} type="button"><FileText size={15} /><span><strong>One or more files</strong><small>PDF and Markdown</small></span></button></div>}</div></footer>
    </aside>
  );
}

export function DocumentHeader({
  document,
  excerptCount,
  onEdit,
  onCite,
}: {
  document: ResearchDocument;
  excerptCount: number;
  onEdit: () => void;
  onCite: () => void;
}) {
  return (
    <header className="document-header">
      <div className="document-heading-main">
        <DocumentIcon kind={document.kind} />
        <div><h1>{document.title}</h1><p>{document.authors || "Unknown author"} <span>·</span> {formatDate(document.publicationDate)}</p></div>
      </div>
      <div className="document-heading-actions">
        <span className="excerpt-tally"><Highlighter size={14} /> {excerptCount}</span>
        <button className="button compact" onClick={onCite} type="button"><Clipboard size={14} /> Cite</button>
        <button className="button compact" onClick={onEdit} type="button"><Pencil size={14} /> Record</button>
      </div>
    </header>
  );
}

function ThemePicker({ themes, selected, onChange }: { themes: Theme[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="theme-picker">
      <button aria-expanded={open} className="theme-picker-trigger" onClick={() => setOpen(!open)} type="button">
        <span><Tag size={15} /> {selected.length ? `${selected.length} ${selected.length === 1 ? "theme" : "themes"}` : "Assign themes"}</span><ChevronDown size={15} />
      </button>
      {open && (
        <div className="theme-picker-menu">
          {themes.length === 0 ? <p>No themes yet. Add one in the Theme atlas.</p> : themes.map((theme) => {
            const checked = selected.includes(theme.id);
            return (
              <label key={theme.id}>
                <input checked={checked} onChange={() => onChange(checked ? selected.filter((id) => id !== theme.id) : [...selected, theme.id])} type="checkbox" />
                <i style={{ background: theme.color }} /><span>{theme.name}</span>{checked && <Check size={14} />}
              </label>
            );
          })}
        </div>
      )}
      {selected.length > 0 && (
        <div className="tag-row editor-tags">
          {selected.map((id) => {
            const theme = themes.find((item) => item.id === id);
            return theme ? <button key={id} onClick={() => onChange(selected.filter((item) => item !== id))} style={{ "--tag-color": theme.color } as CSSProperties} type="button"><i />{theme.name}<X size={12} /></button> : null;
          })}
        </div>
      )}
    </div>
  );
}

const excerptPalettes: Record<NonNullable<AiSettings["appTheme"]>, string[]> = {
  archive: ["#efd982", "#efad8f", "#9fd1b7", "#9fc4df", "#c6b3df", "#efb9ce", "#f3c77b", "#b8d889", "#8fd4cf", "#aeb7e8", "#d7a9e3", "#d5c5a1"],
  oxford: ["#d8d681", "#e3ab91", "#96c9c7", "#91bad6", "#b4b9df", "#d8b0c9", "#d4bf77", "#a8ca92", "#86c7d3", "#9aaed5", "#c5a9d2", "#c9c1a5"],
  forest: ["#d7d17b", "#d9a37e", "#9bc79d", "#91bfc0", "#b8acd0", "#d1a8b1", "#d9bb72", "#a8c47c", "#82c1ae", "#a6b5cb", "#c1a0c5", "#c5bd94"],
  clay: ["#e6c56d", "#e69a78", "#9ec8a5", "#92b9cc", "#c0aad3", "#e0a7b7", "#e4b96a", "#b6cb79", "#83c4ba", "#9fadd4", "#caa0ca", "#ceb995"],
  midnight: ["#d5c96d", "#dc9c83", "#8fc4ae", "#8fb4d0", "#aaa9d7", "#d3a6ba", "#cfb867", "#9cc27a", "#7dbdb7", "#93a8ce", "#bea0cd", "#bbb59b"],
  burgundy: ["#e4c975", "#df9c88", "#96c4a6", "#8eb8cf", "#bea7d0", "#dea4b5", "#dfb96a", "#abc57c", "#83c1b7", "#9eacd0", "#c8a0c7", "#c8b799"],
  slate: ["#d3ce79", "#d9a28b", "#91c2b1", "#8fb6cd", "#adaed3", "#d2a8bc", "#d1b76d", "#9fc17f", "#7bbcb6", "#96a8ca", "#bda1c8", "#bbb39a"],
};

export function AnnotationPanel({
  document,
  excerpts,
  themes,
  draft,
  selectedExcerptId,
  settings,
  saving,
  onCloseDraft,
  onSelectExcerpt,
  onLocateExcerpt,
  onSave,
  onDelete,
  onRedefine,
  redefining,
  onSuggest,
  onOpenSettings,
  onDraftChange,
  recentThemeIds,
}: {
  document: ResearchDocument;
  excerpts: Excerpt[];
  themes: Theme[];
  draft?: SelectionDraft;
  selectedExcerptId?: string;
  settings: AiSettings;
  saving: boolean;
  onCloseDraft: () => void;
  onSelectExcerpt: (id?: string) => void;
  onLocateExcerpt: (id: string) => void;
  onSave: (data: { annotation: string; annotationFormat: "plain" | "markdown"; themeIds: string[]; color: string }) => void;
  onDelete: (id: string) => void;
  onRedefine: (id: string) => void;
  redefining?: boolean;
  onSuggest: (text: string) => Promise<{ themeIds: string[]; rationale?: string }>;
  onOpenSettings: () => void;
  onDraftChange?: (patch: Pick<SelectionDraft, "annotation" | "annotationFormat" | "themeIds" | "color">) => void;
  recentThemeIds?: string[];
}) {
  const excerptPalette = excerptPalettes[settings.appTheme ?? "archive"];
  const selectedExcerpt = excerpts.find((excerpt) => excerpt.id === selectedExcerptId);
  const active = draft ?? selectedExcerpt;
  const [annotation, setAnnotation] = useState("");
  const [annotationFormat, setAnnotationFormat] = useState<"plain" | "markdown">("plain");
  const [showPreview, setShowPreview] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [themeIds, setThemeIds] = useState<string[]>([]);
  const [color, setColor] = useState(settings.defaultExcerptColor ?? excerptPalette[0]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedIds, setSuggestedIds] = useState<string[]>([]);
  const [suggestionNote, setSuggestionNote] = useState<string>();
  const [initializedDraftId, setInitializedDraftId] = useState<string>();
  const suggestionRequest = useRef(0);
  const imageSuggestionAvailable = settings.provider === "llama_cpp" && Boolean(settings.llamaEnableVision && settings.llamaMmprojPath);

  useEffect(() => {
    setAnnotation(draft?.annotation ?? selectedExcerpt?.annotation ?? "");
    setAnnotationFormat(draft?.annotationFormat ?? selectedExcerpt?.annotationFormat ?? settings.defaultNoteFormat ?? "plain");
    setShowPreview(false);
    setThemeIds(draft?.themeIds ?? selectedExcerpt?.themeIds ?? []);
    setColor(draft?.color ?? selectedExcerpt?.color ?? settings.defaultExcerptColor ?? excerptPalette[0]);
    setSuggestedIds([]);
    setSuggestionNote(undefined);
    setInitializedDraftId(draft?.id);
  }, [draft?.id, selectedExcerpt?.id, settings.defaultNoteFormat]);

  useEffect(() => {
    if (draft && initializedDraftId === draft.id) onDraftChange?.({ annotation, annotationFormat, themeIds, color });
  }, [annotation, annotationFormat, color, draft?.id, initializedDraftId, onDraftChange, themeIds]);

  useEffect(() => {
    if (!active || !settings.ergonomics?.quickCapture) return;
    const quickSave = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        onSave({ annotation: annotation.trim(), annotationFormat, themeIds, color });
      }
    };
    window.addEventListener("keydown", quickSave);
    return () => window.removeEventListener("keydown", quickSave);
  }, [active, annotation, annotationFormat, color, onSave, settings.ergonomics?.quickCapture, themeIds]);

  async function suggest() {
    if (active?.kind === "image" && !imageSuggestionAvailable) return;
    if (!settings.enabled) { onOpenSettings(); return; }
    const request = ++suggestionRequest.current;
    setSuggesting(true);
    try {
      const result = await onSuggest(active?.text ?? "");
      if (request !== suggestionRequest.current) return;
      const suggestions = result.themeIds.filter((id) => !themeIds.includes(id));
      setSuggestedIds(suggestions);
      setSuggestionNote(suggestions.length ? result.rationale || "Review these suggestions before adding them." : result.rationale || "No confident theme match was found.");
    } finally { if (request === suggestionRequest.current) setSuggesting(false); }
  }

  if (!active) {
    return (
      <aside className="notes-panel reader-pane" aria-label="Extracted passages">
        <div className="pane-heading"><div><span className="pane-index">III</span><h2>Excerpts</h2></div><span className="count-badge">{excerpts.length}</span></div>
        <div className="notes-intro"><Highlighter size={19} /><p>Select a passage in the document. It will arrive here ready for a note and one or more themes.</p></div>
        <div className="excerpt-list">
          {excerpts.length === 0 ? (
            <div className="empty-state notes-empty"><FileText /><h3>No excerpts yet</h3><p>Your highlighted passages will be kept here with their source details.</p></div>
          ) : excerpts.map((excerpt) => (
            <article className="excerpt-card" key={excerpt.id} style={{ "--excerpt-color": excerpt.color ?? excerptPalette[0] } as CSSProperties}>
              <button className="excerpt-card-main" onClick={() => onSelectExcerpt(excerpt.id)} title="Open excerpt editor" type="button">
                {excerpt.kind === "image" && excerpt.imageData ? <img alt="Captured document region" className="excerpt-thumbnail" src={excerpt.imageData} /> : <><span className="quotation-mark">“</span><p>{truncate(excerpt.text, 172)}</p></>}
              </button>
              <div className="excerpt-card-footer"><span>{excerpt.page ? `p. ${excerpt.page}` : excerpt.locator}</span><span>{formatDate(excerpt.createdAt)}</span></div>
              {excerpt.themeIds.length > 0 && <div className="mini-theme-row">{excerpt.themeIds.slice(0, 3).map((id) => { const theme = themes.find((item) => item.id === id); return theme ? <i key={id} style={{ background: theme.color }} title={theme.name} /> : null; })}</div>}
              <button aria-label={`Find excerpt in ${document.fileName}`} className="excerpt-locate" onClick={() => onLocateExcerpt(excerpt.id)} title="Find and scroll to this excerpt in the document" type="button"><LocateFixed size={14} /><span>Find in document</span></button>
            </article>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="notes-panel reader-pane editor-open" aria-label={redefining ? "Redefine excerpt" : draft ? "New excerpt" : "Edit excerpt"}>
      <div className="pane-heading">
        <button aria-label="Back to excerpts" className="icon-button subtle" onClick={() => draft ? onCloseDraft() : onSelectExcerpt(undefined)} type="button"><ArrowLeft size={17} /></button>
        <div><span className="pane-index">III</span><h2>{redefining ? "Redefine excerpt" : draft ? "New excerpt" : "Edit excerpt"}</h2></div><span className="count-badge">{redefining ? "New area" : draft ? "Draft" : "Saved"}</span>
      </div>
      <div className="annotation-editor">
        <div className="source-ribbon"><span>{document.fileName}</span><strong>{active.page ? `Page ${active.page}` : active.locator || "Markdown"}</strong></div>
        {active.kind === "image" && active.imageData ? <figure className="image-excerpt-preview"><img alt="Selected document region" src={active.imageData} /><figcaption>{active.text}</figcaption><button className="button compact" onClick={() => setImagePreviewOpen(true)} type="button">View image</button></figure> : <blockquote>“{active.text}”</blockquote>}
        <div className="note-format-row"><span>Research note</span><div className="segmented-control compact" role="group" aria-label="Research note format"><button aria-pressed={annotationFormat === "plain"} onClick={() => { setAnnotationFormat("plain"); setShowPreview(false); }} type="button">Text</button><button aria-pressed={annotationFormat === "markdown"} onClick={() => setAnnotationFormat("markdown")} type="button">Markdown + KaTeX</button>{annotationFormat === "markdown" && <button aria-pressed={showPreview} onClick={() => setShowPreview(!showPreview)} type="button">{showPreview ? "Edit" : "Preview"}</button>}</div></div>
        {annotationFormat === "markdown" && showPreview ? <div className="note-preview">{annotation.trim() ? <MarkdownNote>{annotation}</MarkdownNote> : <p className="muted-inline">Nothing to preview yet.</p>}</div> : <label className="field"><span className="sr-only">Research note</span><textarea autoFocus={Boolean(draft)} onChange={(event) => setAnnotation(event.target.value)} placeholder={annotationFormat === "markdown" ? "Markdown is supported. Use $…$ or $$…$$ for KaTeX equations." : "Why does this passage matter? Record a connection, question, or interpretation…"} rows={7} value={annotation} /></label>}
        <fieldset className="excerpt-color-field"><legend>Highlight colour</legend><div>{excerptPalette.map((value) => <button aria-label={`Use highlight colour ${value}`} aria-pressed={color === value} key={value} onClick={() => setColor(value)} style={{ background: value }} type="button" />)}<label className="custom-color-circle" style={{ background: color }} title="Choose a custom highlight colour"><input aria-label="Choose a custom highlight colour" onChange={(event) => setColor(event.target.value)} type="color" value={color} /><span>+</span></label></div></fieldset>
        <div className="field"><span>Themes</span>
          {recentThemeIds && recentThemeIds.length > 0 && <div className="recent-themes" aria-label="Recently used themes"><small>Recent</small>{recentThemeIds.map((id, index) => { const theme = themes.find((item) => item.id === id); return theme ? <button aria-pressed={themeIds.includes(id)} key={id} onClick={() => setThemeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} style={{ "--tag-color": theme.color } as CSSProperties} title={`Toggle ${theme.name} (${index + 1})`} type="button"><i />{theme.name}</button> : null; })}</div>}
          <ThemePicker onChange={setThemeIds} selected={themeIds} themes={themes} />
        </div>
        {settings.enabled && <button className="suggest-button" disabled={!suggesting && active.kind === "image" && !imageSuggestionAvailable} onClick={() => suggesting ? (suggestionRequest.current += 1, setSuggesting(false), setSuggestionNote("Suggestion run stopped. Its result will be ignored.")) : void suggest()} title={active.kind === "image" && !imageSuggestionAvailable ? "Enable llama.cpp image suggestions and choose the matching multimodal projector in Settings." : undefined} type="button">
          {suggesting ? <X size={16} /> : <Sparkles size={16} />}
          <span><strong>{suggesting ? "Stop waiting" : "Theme suggestion"}</strong><small>{active.kind === "image" && !imageSuggestionAvailable ? "Set up a visual local model first" : suggesting ? "The local request may finish in the background" : `${settings.provider === "llama_cpp" ? "llama.cpp" : settings.model}${active.kind === "image" ? " + vision" : ""} · runs locally`}</small></span>
        </button>}
        {suggestionNote && <p className="suggestion-note"><Info size={13} /> {suggestionNote}</p>}
        {suggestedIds.length > 0 && (
          <div className="suggestion-review">
            <span>Suggested themes</span>
            <div>{suggestedIds.map((id) => { const theme = themes.find((item) => item.id === id); return theme ? <span className="suggested-theme" key={id} style={{ "--tag-color": theme.color } as CSSProperties}><i />{theme.name}</span> : null; })}</div>
            <footer><button className="button ghost compact" onClick={() => { setSuggestedIds([]); setSuggestionNote(undefined); }} type="button">Dismiss</button><button className="button compact" onClick={() => { setThemeIds((current) => [...new Set([...current, ...suggestedIds])]); setSuggestedIds([]); setSuggestionNote("Suggestions accepted. Save the excerpt to keep them."); }} type="button"><Check size={14} /> Accept suggestions</button></footer>
          </div>
        )}
        <dl className="creation-details"><div><dt>Document</dt><dd>{document.title}</dd></div><div><dt>Created</dt><dd>{draft ? "When saved" : formatDate(selectedExcerpt?.createdAt)}</dd></div>{document.doi && <div><dt>DOI</dt><dd>{document.doi}</dd></div>}</dl>
        <div className="editor-actions">
          {!draft && selectedExcerpt && <><button aria-label="Delete excerpt" className="button danger" onClick={() => onDelete(selectedExcerpt.id)} type="button"><Trash2 size={15} /></button><button className="button" onClick={() => onRedefine(selectedExcerpt.id)} type="button"><Highlighter size={15} /> Redefine Selection</button></>}
          <button className="button ghost" onClick={() => draft ? onCloseDraft() : onSelectExcerpt(undefined)} type="button">Cancel</button>
          <button className="button primary grow" disabled={saving} onClick={() => onSave({ annotation: annotation.trim(), annotationFormat, themeIds, color })} type="button">{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} {draft ? "Save excerpt" : "Save changes"}</button>
        </div>
      </div>
      <ImageExcerptDialog excerpt={imagePreviewOpen ? active : undefined} onClose={() => setImagePreviewOpen(false)} sourceTitle={document.title} />
    </aside>
  );
}

export function EmptyNotesPanel() {
  return <aside className="notes-panel reader-pane"><div className="pane-heading"><div><span className="pane-index">III</span><h2>Excerpts</h2></div></div><div className="empty-state notes-empty"><Files /><p>Open a document to view its excerpts.</p></div></aside>;
}

function parseBibRecord(source: string): Partial<ResearchDocument> {
  const header = source.match(/@(\w+)\s*\{\s*([^,]+),/i);
  if (!header) throw new Error("No BibTeX or BibLaTeX entry header was found.");
  const rawType = header[1].toLocaleLowerCase();
  const documentType: ResearchDocument["documentType"] = rawType.includes("book")
    ? (rawType === "inbook" || rawType === "incollection" ? "chapter" : "book")
    : rawType.includes("thesis") ? "thesis"
      : rawType === "report" || rawType === "techreport" ? "report"
        : rawType === "online" || rawType === "misc" ? "web"
          : rawType === "article" ? "article" : "other";
  const fields: Record<string, string> = {};
  const fieldPattern = /(\w+)\s*=\s*(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)")\s*,?/g;
  for (const match of source.matchAll(fieldPattern)) fields[match[1].toLocaleLowerCase()] = (match[2] ?? match[3] ?? "").replace(/[{}]/g, "").trim();
  return {
    documentType,
    citationKey: header[2].trim(),
    title: fields.title,
    authors: fields.author?.replace(/\s+and\s+/gi, "; "),
    publicationDate: fields.date ?? fields.year,
    doi: fields.doi,
    journal: fields.journaltitle ?? fields.journal ?? fields.booktitle,
    publisher: fields.publisher ?? fields.institution ?? fields.school,
    volume: fields.volume,
    issue: fields.number ?? fields.issue,
    pages: fields.pages,
    url: fields.url,
    abstract: fields.abstract,
    bibEntry: source.trim(),
  };
}

function citationKey(document: ResearchDocument): string {
  if (document.citationKey?.trim()) return document.citationKey.trim();
  const firstAuthor = document.authors.split(/[;,]/)[0]?.trim().split(/\s+/).at(-1) || "source";
  return `${firstAuthor.replace(/\W/g, "")}${document.publicationDate?.slice(0, 4) || "nd"}`;
}

function citationFormats(document: ResearchDocument) {
  const year = document.publicationDate?.slice(0, 4) || "n.d.";
  const authors = document.authors || "Unknown author";
  const first = authors.split(";")[0].trim().split(/\s+/).at(-1) || authors;
  const many = authors.includes(";");
  const bibliography = `${authors}. (${year}). ${document.title}.${document.journal ? ` ${document.journal}${document.volume ? `, ${document.volume}` : ""}${document.issue ? `(${document.issue})` : ""}${document.pages ? `, ${document.pages}` : ""}.` : ""}${document.publisher ? ` ${document.publisher}.` : ""}${document.doi ? ` https://doi.org/${document.doi}` : document.url ? ` ${document.url}` : ""}`;
  const fields = [
    `  author = {${authors.replaceAll(";", " and")}}`,
    `  title = {${document.title}}`,
    document.publicationDate ? `  date = {${document.publicationDate}}` : `  year = {${year}}`,
    document.journal ? `  journaltitle = {${document.journal}}` : "",
    document.publisher ? `  publisher = {${document.publisher}}` : "",
    document.volume ? `  volume = {${document.volume}}` : "",
    document.issue ? `  number = {${document.issue}}` : "",
    document.pages ? `  pages = {${document.pages}}` : "",
    document.doi ? `  doi = {${document.doi}}` : "",
    document.url ? `  url = {${document.url}}` : "",
  ].filter(Boolean);
  const biblatexType = ({ article: "article", book: "book", chapter: "incollection", thesis: "thesis", report: "report", web: "online", other: "misc" } as const)[document.documentType ?? "article"];
  const biblatex = `@${biblatexType}{${citationKey(document)},\n${fields.join(",\n")}\n}`;
  const bibtex = biblatex
    .replace(/^@online/, "@misc")
    .replace(/^@report/, "@techreport")
    .replace(/  date = \{([^}-]{4})[^}]*\}/, "  year = {$1}")
    .replace("journaltitle =", "journal =");
  return {
    "In-text citation": `(${first}${many ? " et al." : ""}, ${year})`,
    Bibliography: bibliography,
    "BibLaTeX / Biber": biblatex,
    BibTeX: bibtex,
  };
}

export function MetadataModal({ document, onClose, onSave, onLookup, onDetectDoi }: { document: ResearchDocument; onClose: () => void; onSave: (document: ResearchDocument) => Promise<void>; onLookup?: (document: ResearchDocument) => Promise<ResearchDocument>; onDetectDoi?: (document: ResearchDocument) => Promise<ResearchDocument> }) {
  const [record, setRecord] = useState(document);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [detectingDoi, setDetectingDoi] = useState(false);
  const [bibInput, setBibInput] = useState("");
  const [parseError, setParseError] = useState<string>();
  const [lookupError, setLookupError] = useState<string>();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try { await onSave(record); onClose(); } finally { setSaving(false); }
  }
  return (
    <Modal description="Correct the bibliographic record kept alongside every excerpt, or import a .bib entry." icon={<BookOpenText />} onClose={onClose} size="large" title="Edit document record">
      <form className="modal-form" onSubmit={submit}>
        <div className="metadata-lookup full"><div><strong>Verified citation metadata</strong><small>{record.doi ? "Use this exact DOI with the registry. You can also re-detect the DOI printed in the PDF." : "Detect an explicit DOI in the PDF. Title-only search is accepted only when Crossref returns a very close match."}</small></div><div className="metadata-lookup-actions">{onDetectDoi && <button className="button" disabled={detectingDoi || lookingUp} onClick={async () => { setDetectingDoi(true); setLookupError(undefined); try { setRecord(await onDetectDoi(record)); } catch (error) { setLookupError(error instanceof Error ? error.message : "No explicit DOI was found in this PDF."); } finally { setDetectingDoi(false); } }} type="button">{detectingDoi ? <LoaderCircle className="spin" size={15} /> : <LocateFixed size={15} />} Detect from PDF</button>}<button className="button" disabled={!onLookup || lookingUp || detectingDoi || (!record.doi.trim() && !record.title.trim())} onClick={async () => { if (!onLookup) return; setLookingUp(true); setLookupError(undefined); try { setRecord(await onLookup(record)); } catch (error) { setLookupError(error instanceof Error ? error.message : "No citation metadata was found."); } finally { setLookingUp(false); } }} type="button">{lookingUp ? <LoaderCircle className="spin" size={15} /> : <Search size={15} />} Find metadata</button></div></div>
        {lookupError && <p className="metadata-lookup-error full"><AlertCircle size={14} /> {lookupError}</p>}
        <label className="field"><span>Document type</span><select onChange={(e) => setRecord({ ...record, documentType: e.target.value as ResearchDocument["documentType"] })} value={record.documentType ?? "article"}><option value="article">Journal article</option><option value="book">Book</option><option value="chapter">Book chapter</option><option value="thesis">Thesis / dissertation</option><option value="report">Report</option><option value="web">Web source</option><option value="other">Other</option></select></label>
        <label className="field"><span>Citation key</span><input onChange={(e) => setRecord({ ...record, citationKey: e.target.value })} placeholder={citationKey(record)} value={record.citationKey ?? ""} /></label>
        <label className="field full"><span>Research title</span><input onChange={(e) => setRecord({ ...record, title: e.target.value })} required value={record.title} /></label>
        <label className="field full"><span>Authors</span><input onChange={(e) => setRecord({ ...record, authors: e.target.value })} placeholder="Separate multiple authors with semicolons" value={record.authors} /></label>
        <label className="field"><span>Publication date</span><input onChange={(e) => setRecord({ ...record, publicationDate: e.target.value })} placeholder="YYYY or YYYY-MM-DD" value={record.publicationDate} /></label>
        <label className="field"><span>DOI</span><input onChange={(e) => setRecord({ ...record, doi: e.target.value })} placeholder="10.xxxx/…" value={record.doi} /></label>
        {(record.documentType === "article" || record.documentType === "chapter" || !record.documentType) && <label className="field full"><span>{record.documentType === "chapter" ? "Book title" : "Journal / source"}</span><input onChange={(e) => setRecord({ ...record, journal: e.target.value })} value={record.journal ?? ""} /></label>}
        {record.documentType !== "web" && <label className="field full"><span>{record.documentType === "thesis" ? "Institution" : record.documentType === "report" ? "Institution / publisher" : "Publisher"}</span><input onChange={(e) => setRecord({ ...record, publisher: e.target.value })} value={record.publisher ?? ""} /></label>}
        {record.documentType === "article" && <><label className="field"><span>Volume</span><input onChange={(e) => setRecord({ ...record, volume: e.target.value })} value={record.volume ?? ""} /></label><label className="field"><span>Issue</span><input onChange={(e) => setRecord({ ...record, issue: e.target.value })} value={record.issue ?? ""} /></label></>}
        {(record.documentType === "article" || record.documentType === "chapter") && <label className="field"><span>Pages</span><input onChange={(e) => setRecord({ ...record, pages: e.target.value })} placeholder="12–34" value={record.pages ?? ""} /></label>}
        {(record.documentType === "web" || record.url) && <label className="field full"><span>URL</span><input onChange={(e) => setRecord({ ...record, url: e.target.value })} placeholder="https://…" type="url" value={record.url ?? ""} /></label>}
        <label className="field full"><span>Abstract or summary</span><textarea onChange={(e) => setRecord({ ...record, abstract: e.target.value })} rows={4} value={record.abstract ?? ""} /></label>
        <div className="bib-import full"><label className="field"><span>Paste BibTeX or BibLaTeX</span><textarea onChange={(e) => { setBibInput(e.target.value); setParseError(undefined); }} placeholder="@article{key, …}" rows={5} value={bibInput} /></label><button className="button" disabled={!bibInput.trim()} onClick={() => { try { const parsed = parseBibRecord(bibInput); setRecord((current) => ({ ...current, ...Object.fromEntries(Object.entries(parsed).filter(([, value]) => value != null && value !== "")) })); setParseError(undefined); } catch (error) { setParseError(error instanceof Error ? error.message : "Could not parse the entry."); } }} type="button">Parse entry</button>{parseError && <p className="field-error">{parseError}</p>}</div>
        <div className="read-only-record"><span>Local file</span><strong>{record.path}</strong><small>Thematic never changes the original document.</small></div>
        <footer className="modal-actions"><button className="button ghost" onClick={onClose} type="button">Cancel</button><button className="button primary" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save record</button></footer>
      </form>
    </Modal>
  );
}

export function CitationModal({ document, onClose, onNotify }: { document: ResearchDocument; onClose: () => void; onNotify: (tone: ToastMessage["tone"], title: string, message?: string) => void }) {
  const formats = citationFormats(document);
  const [selected, setSelected] = useState<keyof typeof formats>("In-text citation");
  const value = formats[selected];
  async function copy() {
    try { await navigator.clipboard.writeText(value); onNotify("success", `${selected} copied`); }
    catch { onNotify("error", "Clipboard unavailable", value); }
  }
  return (
    <Modal description="Copy a quick citation or a reusable bibliography entry." icon={<Clipboard />} onClose={onClose} size="large" title="Cite document">
      <div className="citation-tabs" role="tablist">{(Object.keys(formats) as Array<keyof typeof formats>).map((format) => <button aria-selected={selected === format} key={format} onClick={() => setSelected(format)} role="tab" type="button">{format}</button>)}</div>
      <pre className="citation-output">{value}</pre>
      <footer className="modal-actions"><button className="button ghost" onClick={onClose} type="button">Close</button><button className="button primary" onClick={() => void copy()} type="button"><Copy size={15} /> Copy {selected}</button></footer>
    </Modal>
  );
}

export function SettingsModal({ settings, browserMode, onClose, onSave, onResetDemo, onChooseLocalModel }: { settings: AiSettings; browserMode: boolean; onClose: () => void; onSave: (settings: AiSettings) => Promise<void>; onResetDemo: () => void; onChooseLocalModel?: (kind: "executable" | "model" | "mmproj") => Promise<string | null> }) {
  const [draft, setDraft] = useState<AiSettings>({ ...settings, provider: settings.provider === "llama_cpp" ? "llama_cpp" : "ollama", llamaExecutable: settings.llamaExecutable ?? "llama-server", llamaModelPath: settings.llamaModelPath ?? "", llamaMmprojPath: settings.llamaMmprojPath ?? "", llamaServerArguments: settings.llamaServerArguments ?? "--ctx-size 4096 --n-gpu-layers 99", llamaEnableVision: settings.llamaEnableVision ?? false, appTheme: settings.appTheme ?? "archive", fontSet: settings.fontSet ?? "classic", uiFontScale: settings.uiFontScale ?? 100, ergonomics: normalizeErgonomics(settings), defaultReaderZoom: settings.defaultReaderZoom ?? 100, defaultExcerptColor: settings.defaultExcerptColor ?? excerptPalettes[settings.appTheme ?? "archive"][0], defaultNoteColor: settings.defaultNoteColor ?? "#edb807", defaultThemeShape: settings.defaultThemeShape ?? "square", defaultExcerptShape: settings.defaultExcerptShape ?? "circle", defaultGraphLayout: settings.defaultGraphLayout ?? "stress" });
  const [saving, setSaving] = useState(false);
  function changeProvider(provider: AiSettings["provider"]) {
    const endpoint = provider === "llama_cpp" && draft.endpoint === "http://127.0.0.1:11434"
      ? "http://127.0.0.1:8080"
      : provider === "ollama" && draft.endpoint === "http://127.0.0.1:8080"
        ? "http://127.0.0.1:11434"
        : draft.endpoint;
    setDraft({ ...draft, provider, endpoint });
  }
  async function chooseModelFile(kind: "executable" | "model" | "mmproj") {
    if (!onChooseLocalModel) return;
    const path = await onChooseLocalModel(kind);
    if (path) setDraft((current) => kind === "executable" ? { ...current, llamaExecutable: path } : kind === "model" ? { ...current, llamaModelPath: path } : { ...current, llamaMmprojPath: path });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try { await onSave(draft); onClose(); } finally { setSaving(false); }
  }
  return (
    <Modal description="Set reading, graph, citation, and local-assistance defaults for new workspaces." icon={<Settings />} onClose={onClose} size="large" title="Workbench settings">
      <form className="settings-layout" onSubmit={submit}>
        <section>
          <div className="settings-section-title"><Settings /><div><h3>Workspace defaults</h3><p>Choose how new reading and atlas workspaces first appear.</p></div></div>
          <div className="settings-fields">
            <label className="field"><span>New note format</span><select onChange={(e) => setDraft({ ...draft, defaultNoteFormat: e.target.value as AiSettings["defaultNoteFormat"] })} value={draft.defaultNoteFormat}><option value="plain">Plain text</option><option value="markdown">Markdown + KaTeX</option></select></label>
            <label className="field"><span>Initial reader zoom — {draft.defaultReaderZoom}%</span><input max="200" min="50" onChange={(e) => setDraft({ ...draft, defaultReaderZoom: Number(e.target.value) })} step="5" type="range" value={draft.defaultReaderZoom} /></label>
            <label className="field settings-color-default"><span>Default excerpt colour</span><span><input aria-label="Default excerpt colour" onChange={(event) => setDraft({ ...draft, defaultExcerptColor: event.target.value })} type="color" value={draft.defaultExcerptColor} /><code>{draft.defaultExcerptColor}</code></span></label>
            <label className="field settings-color-default"><span>Default graph-note colour</span><span><input aria-label="Default graph-note colour" onChange={(event) => setDraft({ ...draft, defaultNoteColor: event.target.value })} type="color" value={draft.defaultNoteColor} /><code>{draft.defaultNoteColor}</code></span></label>
            <label className="field"><span>Graph labels</span><select onChange={(e) => setDraft({ ...draft, graphLabelMode: e.target.value as AiSettings["graphLabelMode"] })} value={draft.graphLabelMode}><option value="hover">Show on hover</option><option value="relationships">Relationships only</option><option value="excerpts">Excerpts only</option><option value="themes">Themes only</option><option value="all">All labels</option><option value="none">No labels</option><option value="custom">Custom pinned labels</option></select></label>
            <label className="field"><span>Default graph layout</span><select onChange={(e) => setDraft({ ...draft, defaultGraphLayout: e.target.value as AiSettings["defaultGraphLayout"] })} value={draft.defaultGraphLayout}><option value="stress">Relationship map</option><option value="force">Organic clusters</option><option value="layered">Hierarchy</option><option value="radial">Radial focus</option><option value="mrtree">Compact tree</option></select></label>
            <label className="field"><span>Default theme shape</span><select onChange={(e) => setDraft({ ...draft, defaultThemeShape: e.target.value as AiSettings["defaultThemeShape"] })} value={draft.defaultThemeShape}><option value="square">Square</option><option value="circle">Circle</option><option value="diamond">Diamond</option><option value="hexagon">Hexagon</option></select></label>
            <label className="field"><span>Default excerpt shape</span><select onChange={(e) => setDraft({ ...draft, defaultExcerptShape: e.target.value as AiSettings["defaultExcerptShape"] })} value={draft.defaultExcerptShape}><option value="circle">Circle</option><option value="square">Square</option><option value="diamond">Diamond</option><option value="hexagon">Hexagon</option></select></label>
            <label className="check-field full"><input checked={draft.onlineCitationLookup ?? false} onChange={(event) => setDraft({ ...draft, onlineCitationLookup: event.target.checked })} type="checkbox" /><span>Look up citation metadata after import<small>Detect an explicit DOI in each PDF, verify it through doi.org, and fill the bibliographic record. Documents without a verified DOI remain unchanged.</small></span></label>
            <label className="field full"><span>Crossref contact email (optional)</span><input disabled={!draft.onlineCitationLookup} onChange={(event) => setDraft({ ...draft, citationContactEmail: event.target.value })} placeholder="researcher@example.org" type="email" value={draft.citationContactEmail ?? ""} /><small>Crossref recommends an email for its free polite pool. It is sent only with metadata requests.</small></label>
            <label className="field"><span>Initial graph zoom — {draft.graphZoom}%</span><input max="225" min="55" onChange={(e) => setDraft({ ...draft, graphZoom: Number(e.target.value) })} step="5" type="range" value={draft.graphZoom} /></label>
            <label className="field"><span>Theme node scaling — {draft.graphNodeScale}%</span><input max="100" min="0" onChange={(e) => setDraft({ ...draft, graphNodeScale: Number(e.target.value) })} type="range" value={draft.graphNodeScale} /></label>
            <label className="field"><span>Academic colour scheme</span><select onChange={(event) => setDraft({ ...draft, appTheme: event.target.value as AiSettings["appTheme"] })} value={draft.appTheme}><option value="archive">Archive paper</option><option value="oxford">Oxford blue</option><option value="forest">Field journal</option><option value="clay">Terracotta study</option><option value="midnight">Midnight library</option><option value="burgundy">Burgundy folio</option><option value="slate">Slate catalogue</option></select><small>Changes the complete workbench skin and default palette, never colours already assigned to excerpts or themes.</small></label>
            <label className="field"><span>Font set</span><select onChange={(event) => setDraft({ ...draft, fontSet: event.target.value as AiSettings["fontSet"] })} value={draft.fontSet}><option value="classic">Classic archive</option><option value="scholarly">Scholarly journal</option><option value="humanist">Humanist reading</option></select><small>Each set coordinates headings, reading text, controls, and metadata.</small></label>
            <label className="field full"><span>Interface text size — {draft.uiFontScale ?? 100}%</span><input max="140" min="85" onChange={(event) => setDraft({ ...draft, uiFontScale: Number(event.target.value) })} step="5" type="range" value={draft.uiFontScale ?? 100} /><small>Scales workbench labels, controls, panels, and metadata. PDF pages, graph objects, and exported reports keep their original typography.</small></label>
            <label className="field"><span>Workspace density</span><select onChange={(event) => setDraft({ ...draft, ergonomics: { ...normalizeErgonomics(draft), density: event.target.value as NonNullable<AiSettings["ergonomics"]>["density"] } })} value={normalizeErgonomics(draft).density}><option value="comfortable">Comfortable reading</option><option value="compact">Compact review</option><option value="presentation">Presentation</option></select><small>Coordinates spacing, control height, and reading rhythm across the interface.</small></label>
            <label className="check-field"><input checked={normalizeErgonomics(draft).showResumePrompt} onChange={(event) => setDraft({ ...draft, ergonomics: { ...normalizeErgonomics(draft), showResumePrompt: event.target.checked } })} type="checkbox" /><span>Offer to resume the last checkpoint<small>Restores the last workspace, document, excerpt, and synthesis tab.</small></span></label>
            <label className="check-field"><input checked={normalizeErgonomics(draft).quickCapture} onChange={(event) => setDraft({ ...draft, ergonomics: { ...normalizeErgonomics(draft), quickCapture: event.target.checked } })} type="checkbox" /><span>Quick excerpt capture<small>Ctrl + Enter saves the open excerpt using the current note, themes, and colour.</small></span></label>
            <label className="check-field"><input checked={normalizeErgonomics(draft).breakReminders} onChange={(event) => setDraft({ ...draft, ergonomics: { ...normalizeErgonomics(draft), breakReminders: event.target.checked } })} type="checkbox" /><span>Quiet break reminders<small>Optional and local. No streaks, scoring, or penalties.</small></span></label>
            <label className="field"><span>Break interval — {normalizeErgonomics(draft).breakIntervalMinutes} minutes</span><input disabled={!normalizeErgonomics(draft).breakReminders} max="180" min="15" onChange={(event) => setDraft({ ...draft, ergonomics: { ...normalizeErgonomics(draft), breakIntervalMinutes: Number(event.target.value) } })} step="5" type="range" value={normalizeErgonomics(draft).breakIntervalMinutes} /></label>
            <label className="field"><span>Optional session target</span><select onChange={(event) => setDraft({ ...draft, ergonomics: { ...normalizeErgonomics(draft), sessionTargetKind: event.target.value as NonNullable<AiSettings["ergonomics"]>["sessionTargetKind"] } })} value={normalizeErgonomics(draft).sessionTargetKind}><option value="none">No target</option><option value="minutes">Minutes</option><option value="items">Focus items</option></select></label>
            <label className="field"><span>Target amount</span><input disabled={normalizeErgonomics(draft).sessionTargetKind === "none"} max="100" min="1" onChange={(event) => setDraft({ ...draft, ergonomics: { ...normalizeErgonomics(draft), sessionTargetValue: Number(event.target.value) } })} type="number" value={normalizeErgonomics(draft).sessionTargetValue} /></label>
          </div>
          <div className="settings-section-title settings-workspace-title"><Settings /><div><h3>Keyboard shortcuts</h3><p>Move between research stages without reaching for the mouse.</p></div></div>
          <dl className="shortcut-list"><div><dt>Ctrl + K</dt><dd>Open command palette</dd></div><div><dt>Ctrl + 1 / 2 / 3</dt><dd>Reader / Themes / Synthesis</dd></div><div><dt>Ctrl + S</dt><dd>Save and create recovery checkpoint</dd></div><div><dt>Ctrl + Alt + ← / →</dt><dd>Previous / next focus item</dd></div><div><dt>Ctrl + Enter</dt><dd>Quick-save the open excerpt</dd></div><div><dt>Ctrl + Shift + E</dt><dd>Open export</dd></div><div><dt>Ctrl + Shift + R</dt><dd>Re-center graph</dd></div><div><dt>Ctrl + Shift + L</dt><dd>Auto-layout graph</dd></div><div><dt>Ctrl + Shift + Z</dt><dd>Toggle graph Zen mode</dd></div><div><dt>Ctrl + Shift + N</dt><dd>Add a graph note</dd></div><div><dt>Ctrl + ,</dt><dd>Open settings</dd></div><div><dt>F11 / Esc</dt><dd>Enter / leave fullscreen</dd></div><div><dt>Esc</dt><dd>Cancel an active excerpt selection</dd></div></dl>
          <div className="settings-section-title settings-workspace-title"><Bot /><div><h3>Local theme suggestions</h3><p>Optional assistance; suggestions are never saved without review.</p></div><label className="switch"><input checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} type="checkbox" /><span /></label></div>
          <div className={`settings-fields ${!draft.enabled ? "disabled" : ""}`}>
            <label className="field"><span>Local service</span><select disabled={!draft.enabled} onChange={(e) => changeProvider(e.target.value as AiSettings["provider"])} value={draft.provider}><option value="ollama">Ollama</option><option value="llama_cpp">llama.cpp (GGUF)</option></select></label>
            <label className="field"><span>Endpoint</span><input disabled={!draft.enabled} onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })} value={draft.endpoint} /><small>Localhost only. The default is {draft.provider === "llama_cpp" ? "port 8080" : "port 11434"}.</small></label>
            {draft.provider === "ollama" ? <label className="field full"><span>Model</span><input disabled={!draft.enabled} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="gemma3:4b" value={draft.model} /><small>Gemma 3 4B is a modest default for local use.</small></label> : <>
              <label className="field full"><span>Main GGUF model</span><span className="field-with-action"><input disabled={!draft.enabled} onChange={(e) => setDraft({ ...draft, llamaModelPath: e.target.value })} placeholder="C:\\models\\gemma-4-E2B_q4_0-it.gguf" value={draft.llamaModelPath ?? ""} /><button className="button compact" disabled={!draft.enabled || !onChooseLocalModel} onClick={() => void chooseModelFile("model")} type="button"><FolderOpen size={14} /> Browse</button></span></label>
              <label className="field"><span>llama-server executable</span><span className="field-with-action"><input disabled={!draft.enabled} onChange={(e) => setDraft({ ...draft, llamaExecutable: e.target.value })} placeholder="llama-server" value={draft.llamaExecutable ?? ""} /><button className="button compact" disabled={!draft.enabled || !onChooseLocalModel} onClick={() => void chooseModelFile("executable")} type="button"><FolderOpen size={14} /> Browse</button></span><small>Use the command name or choose llama-server.exe directly.</small></label>
              <label className="field"><span>Additional server arguments</span><input disabled={!draft.enabled} onChange={(e) => setDraft({ ...draft, llamaServerArguments: e.target.value })} placeholder="--ctx-size 4096 --n-gpu-layers 99" value={draft.llamaServerArguments ?? ""} /><small>Defaults: context 4096 and GPU offload. Model, projector, host, and port use the dedicated fields.</small></label>
              <label className="check-field full"><input checked={draft.llamaEnableVision ?? false} disabled={!draft.enabled} onChange={(event) => setDraft({ ...draft, llamaEnableVision: event.target.checked })} type="checkbox" /><span>Include image excerpts in theme suggestions<small>Requires the matching multimodal projector. Images remain on this computer and are limited per request.</small></span></label>
              {draft.llamaEnableVision && <label className="field full"><span>Multimodal projector GGUF</span><span className="field-with-action"><input disabled={!draft.enabled} onChange={(e) => setDraft({ ...draft, llamaMmprojPath: e.target.value })} placeholder="C:\\models\\gemma-4-E2B-it-mmproj.gguf" value={draft.llamaMmprojPath ?? ""} /><button className="button compact" disabled={!draft.enabled || !onChooseLocalModel} onClick={() => void chooseModelFile("mmproj")} type="button"><FolderOpen size={14} /> Browse</button></span></label>}
              <p className="field-help full">Thematic starts and stops a hidden llama-server process as needed. If a compatible server is already running at the endpoint, it is reused.</p>
            </>}
          </div>
          <div className="privacy-note"><Database size={18} /><p><strong>Local by design.</strong> The desktop app stores its catalogue in SQLite beside its application data. Documents remain in their original folder; only extracted text and annotations enter the catalogue.</p></div>
        </section>
        <aside className="demo-settings about-settings">
          <div className="eyebrow">About</div><h3>Thematic 0.10.2</h3><p>A local-first research workbench for traceable excerpts, annotations, themes, evidence synthesis, and relationships.</p>
          <dl><div><dt>Storage</dt><dd>Local SQLite catalogue</dd></div><div><dt>Documents</dt><dd>PDF and Markdown</dd></div><div><dt>Fullscreen</dt><dd>F11 · Esc to exit</dd></div></dl>
          {browserMode && <><div className="eyebrow demo-eyebrow">Browser demonstration</div><p>Changes are saved in this browser. PDF access lasts until this tab closes.</p><button className="button danger-outline" onClick={onResetDemo} type="button"><RefreshCw size={15} /> Restore sample data</button></>}
        </aside>
        <footer className="modal-actions full-width"><button className="button ghost" onClick={onClose} type="button">Cancel</button><button className="button primary" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save settings</button></footer>
      </form>
    </Modal>
  );
}

export function ProjectModal({ desktopMode, projects, activeProjectId, counts, onClose, onCreate, onImport, onRepair, onOpen, onRename, onDelete, onExport }: { desktopMode: boolean; projects: ResearchProject[]; activeProjectId?: string; counts: Record<string, { documents: number; excerpts: number; themes: number; sources: number }>; onClose: () => void; onCreate: (title: string) => Promise<void>; onImport: () => Promise<void>; onRepair: (id: string) => Promise<void>; onOpen: (id: string) => void; onRename: (id: string, title: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onExport: (id: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState("");
  return (
    <Modal description="Open, rename, export, or remove projects. Source files outside a portable bundle are never modified." icon={<BookMarked />} onClose={onClose} size="large" title="Project manager">
      <div className="project-manager-list">
        {projects.map((project) => {
          const projectCounts = counts[project.id] ?? { documents: 0, excerpts: 0, themes: 0, sources: 0 };
          return <article className={project.id === activeProjectId ? "active" : ""} key={project.id}>
            <div className="project-manager-title">{editingId === project.id ? <input aria-label={`Rename ${project.title}`} autoFocus onChange={(event) => setEditingTitle(event.target.value)} value={editingTitle} /> : <><strong>{project.title}</strong>{project.id === activeProjectId && <span>Current</span>}</>}</div>
            <small>{projectCounts.documents} documents · {projectCounts.excerpts} excerpts · {projectCounts.themes} themes · {projectCounts.sources} sources</small>
            <div className="project-manager-actions">
              {editingId === project.id ? <><button className="button compact primary" disabled={!editingTitle.trim()} onClick={async () => { await onRename(project.id, editingTitle.trim()); setEditingId(undefined); }} type="button"><Save size={13} /> Save</button><button className="button compact ghost" onClick={() => setEditingId(undefined)} type="button">Cancel</button></> : <>
                <button className="button compact" onClick={() => onOpen(project.id)} type="button"><FolderOpen size={13} /> Open</button>
                <button className="button compact" onClick={() => { setEditingId(project.id); setEditingTitle(project.title); }} type="button"><Pencil size={13} /> Rename</button>
                <button className="button compact" disabled={!desktopMode} onClick={() => void onExport(project.id)} type="button"><Archive size={13} /> Export .thematic</button>
                <button className="button compact" disabled={!desktopMode} onClick={() => void onRepair(project.id)} type="button"><RefreshCw size={13} /> Repair from .thematic</button>
                <button className="button compact danger-outline" onClick={() => void onDelete(project.id)} type="button"><Trash2 size={13} /> Remove</button>
              </>}
            </div>
          </article>;
        })}
      </div>
      <form className="modal-body project-form" onSubmit={async (event) => { event.preventDefault(); if (!title.trim()) return; setSaving(true); try { await onCreate(title.trim()); } finally { setSaving(false); } }}>
        <label className="field"><span>Create another project</span><input onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Coastal adaptation review" value={title} /></label>
        <p className="field-help">After creating it, add as many folders or individual PDF and Markdown files as needed.</p>
        <div className="project-import-divider"><span>or open a shared project</span></div>
        <button className="button wide" disabled={!desktopMode || saving} onClick={() => void onImport()} type="button"><Archive size={16} /> Import .thematic project</button>
        {!desktopMode && <p className="field-help">Portable project import is available in the desktop app.</p>}
        <footer className="modal-actions"><button className="button ghost" onClick={onClose} type="button">Close</button><button className="button primary" disabled={!title.trim() || saving} type="submit">{saving ? <LoaderCircle className="spin" size={15} /> : <BookMarked size={15} />} Create project</button></footer>
      </form>
    </Modal>
  );
}

export function ProjectBundleModal({ preview, repair, onClose, onConfirm }: { preview: BundlePreview; repair?: RepairPreview; onClose: () => void; onConfirm: (resolutions: Record<string, string>) => Promise<void> }) {
  const [resolutions, setResolutions] = useState<Record<string, string>>(() => Object.fromEntries((repair?.matches ?? []).filter((item) => item.suggestedId).map((item) => [`${item.kind}:${item.sourceId}`, item.suggestedId!]))) ;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const unresolved = repair?.matches.filter((item) => !resolutions[`${item.kind}:${item.sourceId}`]) ?? [];
  return <Modal description={repair ? "Repair adds missing bundle state without replacing current edits. A local database backup is made first." : "Inspect the portable project before adding it as a new project."} icon={<Archive />} onClose={onClose} size="large" title={repair ? "Repair project from bundle" : "Import portable project"}>
    <div className="modal-body project-bundle-preview">
      <strong>{preview.title}</strong><small title={preview.path}>{preview.path}</small>
      <div className="bundle-preview-grid"><span>{preview.documents} document records · {preview.bundledDocuments} files</span><span>{preview.excerpts} excerpts · {preview.themes} themes</span><span>{preview.graphPositions} node positions · {preview.pinnedLabels} pinned labels · {preview.graphNotes} graph notes</span><span>{preview.screeningRecords} screening records · {preview.extractionRecords} extractions</span><span>{preview.claims} claims · {preview.draftSections} draft sections</span><span>{preview.recoveryCheckpoints} recovery checkpoints</span></div>
      {preview.warnings.map((warning) => <p className="bundle-warning" key={warning}><AlertCircle size={14} /> {warning}</p>)}
      {repair && <><p className="field-help">{repair.matches.length - unresolved.length} records matched. Review unresolved matches below; the current project's edits win when records conflict.</p>{unresolved.length > 0 && <div className="bundle-match-list"><h3>{unresolved.length} matches need review</h3>{unresolved.map((item) => <label className="field" key={`${item.kind}:${item.sourceId}`}><span>{item.kind}: {item.label}</span><select onChange={(event) => setResolutions((current) => ({ ...current, [`${item.kind}:${item.sourceId}`]: event.target.value }))} value={resolutions[`${item.kind}:${item.sourceId}`] ?? ""}><option value="">Choose the matching current record…</option>{item.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label>)}</div>}<details className="bundle-matched-details"><summary>Review automatic matches</summary>{repair.matches.filter((item) => item.suggestedId).map((item) => <label className="field" key={`${item.kind}:${item.sourceId}`}><span>{item.kind}: {item.label}</span><select onChange={(event) => setResolutions((current) => ({ ...current, [`${item.kind}:${item.sourceId}`]: event.target.value }))} value={resolutions[`${item.kind}:${item.sourceId}`] ?? ""}><option value="">Choose…</option>{item.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label>)}</details></>}
      {error && <p className="bundle-warning" role="alert">{error}</p>}
      <footer className="modal-actions"><button className="button ghost" disabled={busy} onClick={onClose} type="button">Cancel</button><button className="button primary" disabled={busy || unresolved.length > 0} onClick={async () => { setBusy(true); setError(undefined); try { await onConfirm(resolutions); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setBusy(false); } }} type="button">{busy ? <LoaderCircle className="spin" size={15} /> : <Archive size={15} />}{repair ? "Repair selected project" : "Import as new project"}</button></footer>
    </div>
  </Modal>;
}

export function ExportModal({ counts, browserMode, onClose, onExport, projectTitle }: { counts: { documents: number; excerpts: number; themes: number }; browserMode: boolean; onClose: () => void; onExport: (format: ExportFormat, options?: ExportOptions) => Promise<void>; projectTitle?: string }) {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [sourceMode, setSourceMode] = useState<NonNullable<ExportOptions["sourceMode"]>>("none");
  const [exporting, setExporting] = useState(false);
  const formats: Array<{ id: ExportFormat; icon: ReactNode; title: string; extension: string; detail: string }> = [
    { id: "xlsx", icon: <LayoutList />, title: "Excel workbook", extension: ".xlsx", detail: "Separate sheets for documents, excerpts, themes, and relationships." },
    { id: "csv", icon: <FileText />, title: "CSV table", extension: ".csv", detail: "A portable, flat table with one row per annotated excerpt." },
    { id: "sqlite", icon: <Database />, title: "SQLite database", extension: ".sqlite3", detail: "A relational copy suitable for queries, scripts, and archival transfer." },
    { id: "zip", icon: <Archive />, title: "Library data archive", extension: ".zip", detail: "Catalogue JSON with optional copies of source files." },
    { id: "thematic", icon: <Archive />, title: "Portable project", extension: ".thematic", detail: "A self-contained bundle that another Thematic installation can open." },
  ];
  async function submit(event: FormEvent) {
    event.preventDefault();
    setExporting(true);
    try { await onExport(format, format === "zip" ? { sourceMode } : undefined); onClose(); } finally { setExporting(false); }
  }
  return (
    <Modal description={`Export a complete, traceable copy of ${projectTitle ? `“${projectTitle}”` : "the selected research project"}.`} icon={<FileDown />} onClose={onClose} title="Export project">
      <form onSubmit={submit}>
        <div className="export-summary"><span><strong>{counts.documents}</strong> documents</span><span><strong>{counts.excerpts}</strong> excerpts</span><span><strong>{counts.themes}</strong> themes</span></div>
        <fieldset className="export-formats"><legend>Choose a format</legend>
          {formats.map((item) => (
            <label className={format === item.id ? "selected" : ""} key={item.id}>
              <input checked={format === item.id} onChange={() => setFormat(item.id)} type="radio" value={item.id} />
              <span className="export-icon">{item.icon}</span><span><strong>{item.title}</strong><code>{item.extension}</code><small>{item.detail}</small>{browserMode && item.id !== "csv" && <em>Desktop build</em>}</span><Check className="selected-check" size={17} />
            </label>
          ))}
        </fieldset>
        {format === "zip" && <fieldset className="zip-source-options"><legend>Source files in archive</legend><label><input checked={sourceMode === "none"} onChange={() => setSourceMode("none")} type="radio" /> Data only</label><label><input checked={sourceMode === "used"} onChange={() => setSourceMode("used")} type="radio" /> Only files used in the synthesis outline</label><label><input checked={sourceMode === "all"} onChange={() => setSourceMode("all")} type="radio" /> All available files</label></fieldset>}
        <div className="export-note"><Info size={16} /><p>{format === "thematic" ? "Portable bundles include copies of available source PDFs and Markdown files so the project can be opened on another machine. Originals are never modified." : format === "zip" ? "The ZIP always contains the project catalogue as JSON. Choose whether source documents are also copied into the archive." : format === "xlsx" ? "Image excerpts are embedded as workbook images. CSV intentionally omits image binary data; SQLite keeps it." : "Data exports contain catalogue data. Original documents are never modified."}</p></div>
        <footer className="modal-actions"><button className="button ghost" onClick={onClose} type="button">Cancel</button><button className="button primary" disabled={exporting || (browserMode && format !== "csv")} type="submit">{exporting ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />} Export {format.toUpperCase()}</button></footer>
      </form>
    </Modal>
  );
}

export const mobilePaneIcons = {
  library: <Library size={15} />,
  document: <BookOpenText size={15} />,
  notes: <Highlighter size={15} />,
};

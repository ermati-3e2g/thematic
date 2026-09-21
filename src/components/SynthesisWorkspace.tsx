import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpenText,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Eye,
  FileDown,
  FileQuestion,
  Filter,
  FlaskConical,
  GripVertical,
  LayoutList,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type {
  ClaimStatus,
  DocumentReviewRecord,
  EvidenceRole,
  Excerpt,
  ExtractionCell,
  ExtractionFieldType,
  ResearchClaim,
  ResearchDocument,
  ResearchProject,
  ReviewStatus,
  SynthesisSection,
  SynthesisWorkspaceState,
  Theme,
} from "../types";
import MarkdownNote from "./MarkdownNote";

type Tab =
  | "protocol"
  | "screening"
  | "extraction"
  | "claims"
  | "draft"
  | "health";
type ReviewSort =
  | "title"
  | "status"
  | "included-first"
  | "excluded-first"
  | "priority"
  | "progress";
const statusLabels: Record<ReviewStatus, string> = {
  inbox: "Inbox",
  "to-read": "To read",
  reading: "Reading",
  included: "Included",
  excluded: "Excluded",
  completed: "Completed",
};
const claimLabels: Record<ClaimStatus, string> = {
  tentative: "Tentative",
  supported: "Supported",
  disputed: "Disputed",
  rejected: "Rejected",
};
const roles: EvidenceRole[] = [
  "supports",
  "contradicts",
  "qualifies",
  "defines",
  "method",
];
const roleLabels: Record<EvidenceRole, string> = {
  supports: "Supports",
  contradicts: "Contradicts",
  qualifies: "Qualifies",
  defines: "Defines",
  method: "Method",
};
const roleColors: Record<EvidenceRole, string> = {
  supports: "#55705a",
  contradicts: "#914b3e",
  qualifies: "#9a6a35",
  defines: "#5b647d",
  method: "#65736d",
};
const statusOrder: ReviewStatus[] = [
  "inbox",
  "to-read",
  "reading",
  "included",
  "completed",
  "excluded",
];
const id = (prefix: string) =>
  `${prefix}-${typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
const short = (value: string, max = 90) =>
  value.length <= max ? value : `${value.slice(0, max - 1).trim()}…`;

function emptyClaim(): ResearchClaim {
  const now = new Date().toISOString();
  return {
    id: id("claim"),
    text: "",
    status: "tentative",
    confidence: 50,
    notes: "",
    themeIds: [],
    evidence: [],
    createdAt: now,
    updatedAt: now,
  };
}

function ModeToggle({
  preview,
  onClick,
}: {
  preview: boolean;
  onClick: () => void;
}) {
  return (
    <button className="mode-toggle" onClick={onClick} type="button">
      {preview ? <Pencil size={12} /> : <Eye size={12} />}
      {preview ? "Edit" : "Preview"}
    </button>
  );
}

function ThemeChecks({
  selected,
  themes,
  onChange,
  compact = false,
}: {
  selected: string[];
  themes: Theme[];
  onChange: (ids: string[]) => void;
  compact?: boolean;
}) {
  if (!themes.length)
    return <p className="muted-inline">No themes in this project.</p>;
  return (
    <div className={`theme-checkbox-grid ${compact ? "compact" : ""}`}>
      {themes.map((theme) => {
        const checked = selected.includes(theme.id);
        return (
          <label className={checked ? "checked" : ""} key={theme.id}>
            <input
              checked={checked}
              onChange={() =>
                onChange(
                  checked
                    ? selected.filter((item) => item !== theme.id)
                    : [...selected, theme.id],
                )
              }
              type="checkbox"
            />
            <i style={{ background: theme.color }} />
            <span>{theme.name}</span>
          </label>
        );
      })}
    </div>
  );
}

function SourceCard({
  excerpt,
  document,
  actions,
  role,
  contextRoles = [],
}: {
  excerpt: Excerpt;
  document?: ResearchDocument;
  actions?: ReactNode;
  role?: EvidenceRole;
  contextRoles?: EvidenceRole[];
}) {
  return (
    <article
      className={`source-excerpt-card ${role ? `role-${role}` : ""}`}
      style={
        {
          "--excerpt-color": excerpt.color ?? "#efd982",
          "--role-color": role ? roleColors[role] : "#6d6049",
        } as CSSProperties
      }
    >
      {role && <div className="source-role-band">{roleLabels[role]}</div>}
      {!!contextRoles.length && <div className="source-role-list">{contextRoles.map((item) => <span className={`role-${item}`} key={item} style={{ "--role-color": roleColors[item] } as CSSProperties}>{roleLabels[item]}</span>)}</div>}
      <div className="source-excerpt-body">
        {excerpt.kind === "image" && excerpt.imageData ? (
          <img alt="Image excerpt" src={excerpt.imageData} />
        ) : (
          <MarkdownNote>{excerpt.text || "*Image excerpt*"}</MarkdownNote>
        )}
      </div>
      <footer>
        <span>
          {document?.fileName ?? "Missing source"}
          {excerpt.page ? ` · p. ${excerpt.page}` : ""}
        </span>
        {actions}
      </footer>
    </article>
  );
}

function ThemeBadges({ ids, themes }: { ids: string[]; themes: Theme[] }) {
  return (
    <span className="evidence-theme-badges">
      {ids.map((themeId) => {
        const theme = themes.find((item) => item.id === themeId);
        return (
          <span
            key={themeId}
            style={
              { "--theme-color": theme?.color ?? "#8b8068" } as CSSProperties
            }
          >
            <i />
            {theme?.name ?? "Missing theme"}
          </span>
        );
      })}
    </span>
  );
}

function EvidenceDisplay({
  excerpt,
  document,
  role,
  themes,
  detailed,
  onOpen,
  report = false,
}: {
  excerpt?: Excerpt;
  document?: ResearchDocument;
  role?: EvidenceRole;
  themes: Theme[];
  detailed: boolean;
  onOpen?: () => void;
  report?: boolean;
}) {
  const excerptColor = excerpt?.color ?? "#efd982";
  if (!excerpt)
    return (
      <article className="claim-evidence-detail missing">
        <strong>Missing excerpt</strong>
      </article>
    );
  if (!detailed)
    return (
      <button
        className={`claim-evidence-compact ${role ? `role-${role}` : ""}`}
        onClick={onOpen}
        style={
          {
            "--excerpt-color": excerptColor,
            "--role-color": role ? roleColors[role] : "#6d6049",
          } as CSSProperties
        }
        type="button"
      >
        <span className="claim-evidence-summary">
          <em>{role ? roleLabels[role] : "Source"}</em>
          <span className="claim-evidence-main">
            <span className="claim-evidence-preview">
              {excerpt.kind === "image" && excerpt.imageData ? (
                <img alt="Image excerpt thumbnail" src={excerpt.imageData} />
              ) : (
                <span>{short(excerpt.text || "Image excerpt", 150)}</span>
              )}
            </span>
            <small>
              {document?.fileName ?? "Missing source"}
              {excerpt.page
                ? ` · p. ${excerpt.page}`
                : excerpt.locator
                  ? ` · ${excerpt.locator}`
                  : ""}
            </small>
          </span>
          <ChevronRight aria-hidden="true" className="claim-evidence-open-icon" size={15} />
        </span>
        {excerpt.themeIds.length > 0 && (
          <span className="claim-evidence-theme-section">
            <span>Themes</span>
            <ThemeBadges ids={excerpt.themeIds} themes={themes} />
          </span>
        )}
      </button>
    );
  return (
    <article
      className={`claim-evidence-detail ${report ? "report-evidence-detail" : ""} ${role ? `role-${role}` : ""}`}
      style={
        {
          "--excerpt-color": excerptColor,
          "--role-color": role ? roleColors[role] : "#6d6049",
        } as CSSProperties
      }
    >
      <header>
        <em>{role ? roleLabels[role] : "Source excerpt"}</em>
      </header>
      <div className="claim-evidence-content">
        {excerpt.kind === "image" && excerpt.imageData ? (
          <img alt="Image excerpt" src={excerpt.imageData} />
        ) : (
          <MarkdownNote>{excerpt.text || "*Image excerpt*"}</MarkdownNote>
        )}
      </div>
      {excerpt.annotation && (
        <div className="claim-evidence-annotation">
          <span>Research note</span>
          {excerpt.annotationFormat === "markdown" ? (
            <MarkdownNote>{excerpt.annotation}</MarkdownNote>
          ) : (
            <p>{excerpt.annotation}</p>
          )}
        </div>
      )}
      <div className="claim-evidence-themes"><span>Themes</span><ThemeBadges ids={excerpt.themeIds} themes={themes} /></div>
      <dl>
        <div>
          <dt>Document</dt>
          <dd>{document?.title ?? "Missing source"}</dd>
        </div>
        <div>
          <dt>File</dt>
          <dd>{document?.fileName ?? "—"}</dd>
        </div>
        <div>
          <dt>Authors</dt>
          <dd>{document?.authors || "Unknown"}</dd>
        </div>
        <div>
          <dt>Publication</dt>
          <dd>{document?.publicationDate || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            {excerpt.page
              ? `Page ${excerpt.page}`
              : excerpt.locator || "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>DOI</dt>
          <dd>{document?.doi || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Excerpt created</dt>
          <dd>{new Date(excerpt.createdAt).toLocaleDateString()}</dd>
        </div>
      </dl>
      {onOpen && (
        <footer>
          <button className="button compact" onClick={onOpen} type="button">
            <BookOpenText size={13} /> Open excerpt
          </button>
        </footer>
      )}
    </article>
  );
}

export default function SynthesisWorkspace({
  project,
  documents,
  excerpts,
  themes,
  workspace,
  onChange,
  onOpenDocument,
  onOpenExcerpt,
  initialTab = "protocol",
  onTabChange,
  attentionTarget,
}: {
  project?: ResearchProject;
  documents: ResearchDocument[];
  excerpts: Excerpt[];
  themes: Theme[];
  workspace: SynthesisWorkspaceState;
  onChange: (patch: Partial<SynthesisWorkspaceState>) => void;
  onOpenDocument: (id: string) => void;
  onOpenExcerpt: (id: string) => void;
  initialTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  attentionTarget?: { kind: "screening" | "claim"; id: string; request: number };
}) {
  const [tab, setTabState] = useState<Tab>(initialTab);
  const setTab = (next: Tab) => { setTabState(next); onTabChange?.(next); };
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReviewStatus | "all">("all");
  const [sort, setSort] = useState<ReviewSort>("title");
  const [viewName, setViewName] = useState("");
  const [notePreviews, setNotePreviews] = useState<string[]>([]);
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<ExtractionFieldType>("text");
  const [fieldOptions, setFieldOptions] = useState("");
  const [extractionDocId, setExtractionDocId] = useState("");
  const [extractionThemes, setExtractionThemes] = useState<string[]>([]);
  const [cellPreviews, setCellPreviews] = useState<string[]>([]);
  const [claimDraft, setClaimDraft] = useState<ResearchClaim>();
  const [evidenceRole, setEvidenceRole] = useState<EvidenceRole>("supports");
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [claimEvidenceDetailed, setClaimEvidenceDetailed] = useState(false);
  const [detailedClaimId, setDetailedClaimId] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [activeSectionId, setActiveSectionId] = useState("");
  const [draggedSectionId, setDraggedSectionId] = useState<string>();
  const [sectionPreviews, setSectionPreviews] = useState<string[]>([]);
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceThemes, setSourceThemes] = useState<string[]>([]);
  const [sourceClaims, setSourceClaims] = useState<string[]>([]);
  const [sourceRoles, setSourceRoles] = useState<EvidenceRole[]>([]);
  const [limitSourcesToSectionClaims, setLimitSourcesToSectionClaims] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedScreeningIds, setSelectedScreeningIds] = useState<string[]>([]);
  const [reviewUndo, setReviewUndo] = useState<DocumentReviewRecord[]>();
  useEffect(() => { if (workspace.sections.length && !workspace.sections.some((section) => section.id === activeSectionId)) setActiveSectionId(workspace.sections[0].id); }, [activeSectionId, workspace.sections]);
  useEffect(() => { if (workspace.claims.length && !workspace.claims.some((claim) => claim.id === detailedClaimId)) setDetailedClaimId(workspace.claims[0].id); }, [detailedClaimId, workspace.claims]);
  useEffect(() => { setTabState(initialTab); }, [initialTab, project?.id]);
  useEffect(() => {
    if (!attentionTarget) return;
    setTabState(attentionTarget.kind === "claim" ? "claims" : "screening");
    if (attentionTarget.kind === "screening") { setQuery(""); setStatus("all"); }
    else { setClaimDraft(undefined); setDetailedClaimId(attentionTarget.id); }
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-attention-id="${CSS.escape(attentionTarget.id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      document.querySelector<HTMLElement>(`[data-attention-id="${CSS.escape(attentionTarget.id)}"]`)?.focus({ preventScroll: true });
    }));
    return () => cancelAnimationFrame(frame);
  }, [attentionTarget]);
  const update = (patch: Partial<SynthesisWorkspaceState>) => onChange(patch);
  const reviewFor = (documentId: string): DocumentReviewRecord =>
    workspace.reviews.find((item) => item.documentId === documentId) ?? {
      documentId,
      status: "inbox",
      exclusionReason: "",
      priority: "normal",
      progress: 0,
      notes: "",
      updatedAt: new Date().toISOString(),
    };
  const documentExcerpts = (documentId: string) =>
    excerpts.filter((item) => item.documentId === documentId);
  const sourceDoc = (excerpt: Excerpt) =>
    documents.find((item) => item.id === excerpt.documentId);
  const matchesThemes = (excerpt: Excerpt, ids: string[]) =>
    !ids.length || ids.some((themeId) => excerpt.themeIds.includes(themeId));

  function updateReview(
    documentId: string,
    patch: Partial<DocumentReviewRecord>,
  ) {
    const next = {
      ...reviewFor(documentId),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    update({
      reviews: [
        ...workspace.reviews.filter((item) => item.documentId !== documentId),
        next,
      ],
    });
  }

  function bulkUpdateReviews(patch: Partial<DocumentReviewRecord>) {
    if (!selectedScreeningIds.length) return;
    setReviewUndo(workspace.reviews);
    const selected = new Set(selectedScreeningIds);
    const untouched = workspace.reviews.filter((item) => !selected.has(item.documentId));
    const changed = selectedScreeningIds.map((documentId) => ({ ...reviewFor(documentId), ...patch, updatedAt: new Date().toISOString() }));
    update({ reviews: [...untouched, ...changed] });
  }

  useEffect(() => {
    if (tab !== "screening" || !selectedScreeningIds.length) return;
    const batchShortcuts = (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.altKey) || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const key = event.key.toLocaleLowerCase();
      if (key === "i") { event.preventDefault(); bulkUpdateReviews({ status: "included" }); }
      else if (key === "e") { event.preventDefault(); bulkUpdateReviews({ status: "excluded" }); }
      else if (key === "t") { event.preventDefault(); bulkUpdateReviews({ status: "to-read" }); }
    };
    window.addEventListener("keydown", batchShortcuts);
    return () => window.removeEventListener("keydown", batchShortcuts);
  }, [selectedScreeningIds, tab, workspace.reviews]);

  const screenedDocuments = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const priority = { high: 0, normal: 1, low: 2 };
    return documents
      .filter((document) => {
        const review = reviewFor(document.id);
        return (
          (status === "all" || review.status === status) &&
          (!needle ||
            `${document.title} ${document.fileName} ${document.authors} ${document.doi} ${review.notes}`
              .toLocaleLowerCase()
              .includes(needle))
        );
      })
      .sort((a, b) => {
        const first = reviewFor(a.id);
        const second = reviewFor(b.id);
        if (sort === "title") return a.title.localeCompare(b.title);
        if (sort === "status")
          return (
            statusOrder.indexOf(first.status) -
              statusOrder.indexOf(second.status) ||
            a.title.localeCompare(b.title)
          );
        if (sort === "priority")
          return (
            priority[first.priority] - priority[second.priority] ||
            a.title.localeCompare(b.title)
          );
        if (sort === "progress")
          return (
            second.progress - first.progress || a.title.localeCompare(b.title)
          );
        const isTarget = (value: ReviewStatus) =>
          sort === "included-first"
            ? value === "included" || value === "completed"
            : value === "excluded";
        return (
          Number(isTarget(second.status)) - Number(isTarget(first.status)) ||
          a.title.localeCompare(b.title)
        );
      });
  }, [documents, query, sort, status, workspace.reviews]);

  const extractionDocuments = documents.filter(
    (document) => reviewFor(document.id).status !== "excluded",
  );
  useEffect(() => {
    if (!extractionDocuments.some((item) => item.id === extractionDocId))
      setExtractionDocId(extractionDocuments[0]?.id ?? "");
  }, [extractionDocId, documents, workspace.reviews]);
  const extractionDocument = extractionDocuments.find(
    (item) => item.id === extractionDocId,
  );
  const extractionRecord = workspace.extractionRecords.find(
    (item) => item.documentId === extractionDocId,
  );
  const availableExtractionEvidence = extractionDocument
    ? documentExcerpts(extractionDocument.id).filter((item) =>
        matchesThemes(item, extractionThemes),
      )
    : [];
  const cellFor = (fieldId: string): ExtractionCell => {
    const cell = extractionRecord?.cells[fieldId];
    return cell
      ? {
          ...cell,
          excerptIds:
            cell.excerptIds ?? (cell.excerptId ? [cell.excerptId] : []),
        }
      : { value: "", excerptIds: [] };
  };
  function updateCell(
    documentId: string,
    fieldId: string,
    patch: Partial<ExtractionCell>,
  ) {
    const record = workspace.extractionRecords.find(
      (item) => item.documentId === documentId,
    ) ?? { documentId, cells: {} };
    const old = record.cells[fieldId];
    const cell: ExtractionCell = old
      ? {
          ...old,
          excerptIds: old.excerptIds ?? (old.excerptId ? [old.excerptId] : []),
        }
      : { value: "", excerptIds: [] };
    const next = {
      ...record,
      cells: {
        ...record.cells,
        [fieldId]: { ...cell, ...patch, excerptId: undefined },
      },
    };
    update({
      extractionRecords: [
        ...workspace.extractionRecords.filter(
          (item) => item.documentId !== documentId,
        ),
        next,
      ],
    });
  }
  function addField(event: FormEvent) {
    event.preventDefault();
    if (!fieldName.trim()) return;
    update({
      extractionFields: [
        ...workspace.extractionFields,
        {
          id: id("field"),
          name: fieldName.trim(),
          type: fieldType,
          options: fieldOptions
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
      ],
    });
    setFieldName("");
    setFieldOptions("");
  }

  const claimEvidenceOptions = useMemo(() => {
    const needle = evidenceQuery.trim().toLocaleLowerCase();
    return excerpts.filter(
      (excerpt) =>
        matchesThemes(excerpt, claimDraft?.themeIds ?? []) &&
        (!needle ||
          `${excerpt.text} ${sourceDoc(excerpt)?.title} ${sourceDoc(excerpt)?.fileName}`
            .toLocaleLowerCase()
            .includes(needle)),
    );
  }, [claimDraft?.themeIds, documents, evidenceQuery, excerpts]);
  function saveClaim(event: FormEvent) {
    event.preventDefault();
    if (!claimDraft?.text.trim()) return;
    const exclusiveEvidence = [...new Map(claimDraft.evidence.map((item) => [item.excerptId, item])).values()];
    const next = {
      ...claimDraft,
      text: claimDraft.text.trim(),
      evidence: exclusiveEvidence,
      updatedAt: new Date().toISOString(),
    };
    update({
      claims: workspace.claims.some((item) => item.id === next.id)
        ? workspace.claims.map((item) => (item.id === next.id ? next : item))
        : [...workspace.claims, next],
    });
    setClaimDraft(undefined);
    setEvidenceQuery("");
  }

  const updateSection = (sectionId: string, patch: Partial<SynthesisSection>) =>
    update({
      sections: workspace.sections.map((item) =>
        item.id === sectionId ? { ...item, ...patch } : item,
      ),
    });
  const activeSection = workspace.sections.find((section) => section.id === activeSectionId);
  const effectiveSourceClaims = limitSourcesToSectionClaims ? (activeSection?.claimIds ?? []) : sourceClaims;
  const draftSources = useMemo(() => {
    const needle = sourceQuery.trim().toLocaleLowerCase();
    const claimEvidenceIds = effectiveSourceClaims.length
      ? new Set(
          workspace.claims
            .filter((claim) => effectiveSourceClaims.includes(claim.id))
            .flatMap((claim) =>
              claim.evidence
                .filter(
                  (evidence) =>
                    !sourceRoles.length || sourceRoles.includes(evidence.role),
                )
                .map((evidence) => evidence.excerptId),
            ),
        )
      : limitSourcesToSectionClaims ? new Set<string>() : undefined;
    return excerpts.filter(
      (excerpt) =>
        (!claimEvidenceIds || claimEvidenceIds.has(excerpt.id)) &&
        matchesThemes(excerpt, sourceThemes) &&
        (!needle ||
          `${excerpt.text} ${excerpt.annotation} ${sourceDoc(excerpt)?.title} ${sourceDoc(excerpt)?.fileName}`
            .toLocaleLowerCase()
            .includes(needle)),
    );
  }, [
    documents,
    excerpts,
    effectiveSourceClaims,
    limitSourcesToSectionClaims,
    sourceQuery,
    sourceRoles,
    sourceThemes,
    workspace.claims,
  ]);
  function addSource(sectionId: string, excerptId: string) {
    const section = workspace.sections.find((item) => item.id === sectionId);
    if (section && !section.excerptIds.includes(excerptId))
      updateSection(sectionId, {
        excerptIds: [...section.excerptIds, excerptId],
      });
  }
  function reorderSection(targetId: string, sourceId = draggedSectionId, finish = true) {
    if (!sourceId || sourceId === targetId) return;
    const next = [...workspace.sections];
    const from = next.findIndex((item) => item.id === sourceId);
    const to = next.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update({ sections: next });
    if (finish) setDraggedSectionId(undefined);
  }

  function pointerReorder(event: { clientX: number; clientY: number }, sourceId: string) {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-section-id]")?.dataset.sectionId;
    if (target && target !== sourceId) reorderSection(target, sourceId, false);
  }
  useEffect(() => {
    if (!draggedSectionId) return;
    const move = (event: PointerEvent) => pointerReorder(event, draggedSectionId);
    const finish = () => setDraggedSectionId(undefined);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", finish); };
  }, [draggedSectionId, workspace.sections]);

  function exportUsedCitations() {
    const usedExcerptIds = new Set(workspace.sections.flatMap((section) => section.excerptIds));
    const usedDocumentIds = new Set(excerpts.filter((excerpt) => usedExcerptIds.has(excerpt.id)).map((excerpt) => excerpt.documentId));
    const entries = documents.filter((document) => usedDocumentIds.has(document.id)).map((document, index) => {
      const key = document.citationKey?.trim() || `source${index + 1}`;
      const year = document.publicationDate?.slice(0, 4) || "n.d.";
      return `@${document.documentType || "article"}{${key},\n  title = {${document.title}},\n  author = {${document.authors || "Unknown"}},\n  year = {${year}}${document.doi ? `,\n  doi = {${document.doi}}` : ""}\n}`;
    }).join("\n\n");
    const url = URL.createObjectURL(new Blob([entries || "% No utilized source excerpts have citations yet.\n"], { type: "application/x-bibtex" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(project?.title || "thematic-synthesis").replace(/[^a-z0-9_-]+/gi, "-")}-used-sources.bib`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function copyDraft() {
    const text = workspace.sections
      .map(
        (section) =>
          `## ${section.title}\n\n${section.content}\n\n${section.excerptIds
            .map((excerptId) => {
              const excerpt = excerpts.find((item) => item.id === excerptId);
              const document = excerpt && sourceDoc(excerpt);
              return excerpt
                ? `> ${excerpt.kind === "image" ? "[Image excerpt]" : `“${excerpt.text}”`} — ${document?.authors || document?.title || "Unknown source"}${excerpt.page ? `, p. ${excerpt.page}` : ""}`
                : "";
            })
            .filter(Boolean)
            .join("\n\n")}`,
      )
      .join("\n\n");
    void navigator.clipboard.writeText(
      `# ${project?.title ?? "Research synthesis"}\n\n${text}`,
    );
  }

  const health = useMemo(() => {
    const ids = new Set(documents.map((item) => item.id));
    return [
      {
        label: "Documents not screened",
        count: documents.filter((item) => reviewFor(item.id).status === "inbox")
          .length,
      },
      {
        label: "Included documents without excerpts",
        count: documents.filter(
          (item) =>
            ["included", "completed"].includes(reviewFor(item.id).status) &&
            !documentExcerpts(item.id).length,
        ).length,
      },
      {
        label: "Documents missing DOI",
        count: documents.filter((item) => !item.doi).length,
      },
      {
        label: "Documents missing publication date",
        count: documents.filter((item) => !item.publicationDate).length,
      },
      {
        label: "Excerpts without themes",
        count: excerpts.filter((item) => !item.themeIds.length).length,
      },
      {
        label: "Claims without evidence",
        count: workspace.claims.filter((item) => !item.evidence.length).length,
      },
      {
        label: "Orphaned excerpts",
        count: excerpts.filter((item) => !ids.has(item.documentId)).length,
      },
    ];
  }, [documents, excerpts, workspace.claims, workspace.reviews]);
  const issueTotal = health.reduce((sum, item) => sum + item.count, 0);

  return (
    <main className="synthesis-workspace">
      <header className="workspace-title-row synthesis-title-row">
        <div>
          <div className="eyebrow">Evidence workspace</div>
          <h1>Research synthesis</h1>
          <p>
            Screen sources, extract structured evidence, test claims, and
            assemble a traceable draft.
          </p>
        </div>
        <div className="synthesis-title-actions">
          <button
            className="button"
            onClick={() => setReportOpen(true)}
            type="button"
          >
            <FileDown size={15} /> Synthesis report
          </button>
          <div className="synthesis-summary">
            <span>
              <strong>{documents.length}</strong> sources
            </span>
            <span>
              <strong>{workspace.claims.length}</strong> claims
            </span>
            <span>
              <strong>{issueTotal}</strong> flags
            </span>
          </div>
        </div>
      </header>
      <nav className="synthesis-tabs">
        {(
          [
            "protocol",
            "screening",
            "extraction",
            "claims",
            "draft",
            "health",
          ] as Tab[]
        ).map((item) => (
          <button
            aria-current={tab === item ? "page" : undefined}
            key={item}
            onClick={() => setTab(item)}
            type="button"
          >
            {item === "protocol" ? (
              <ShieldCheck size={15} />
            ) : item === "screening" ? (
              <Filter size={15} />
            ) : item === "extraction" ? (
              <FlaskConical size={15} />
            ) : item === "claims" ? (
              <CheckCircle2 size={15} />
            ) : item === "draft" ? (
              <LayoutList size={15} />
            ) : (
              <AlertTriangle size={15} />
            )}
            {item}
          </button>
        ))}
      </nav>
      <section className="synthesis-stage">
        {tab === "protocol" && (
          <Protocol workspace={workspace} update={update} />
        )}
        {tab === "screening" && (
          <>
            <div className="synthesis-filterbar">
              <label className="search-field">
                <Search size={15} />
                <input
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, author, DOI, or note…"
                  value={query}
                />
              </label>
              <label className="compact-control">
                <span>Status</span>
                <select
                  onChange={(event) =>
                    setStatus(event.target.value as ReviewStatus | "all")
                  }
                  value={status}
                >
                  <option value="all">All statuses</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="compact-control">
                <span>Sort</span>
                <select
                  onChange={(event) =>
                    setSort(event.target.value as ReviewSort)
                  }
                  value={sort}
                >
                  <option value="title">Title A–Z</option>
                  <option value="status">Workflow status</option>
                  <option value="included-first">Included first</option>
                  <option value="excluded-first">Excluded first</option>
                  <option value="priority">Priority</option>
                  <option value="progress">Progress</option>
                </select>
              </label>
              <label className="compact-control saved-filter-name">
                <span>Save current filter</span>
                <input
                  onChange={(event) => setViewName(event.target.value)}
                  placeholder="Filter name"
                  value={viewName}
                />
              </label>
              <button
                className="button compact"
                disabled={!viewName.trim()}
                onClick={() => {
                  update({
                    savedViews: [
                      ...workspace.savedViews,
                      {
                        id: id("view"),
                        name: viewName.trim(),
                        query,
                        status,
                        sort,
                      },
                    ],
                  });
                  setViewName("");
                }}
                type="button"
              >
                <Save size={14} /> Save filter
              </button>
            </div>
            <p className="filter-explanation">
              <strong>Saved filters</strong> restore the current search, status,
              and sort. They do not modify documents.
            </p>
            <div className="screening-batch-bar">
              <label><input checked={screenedDocuments.length > 0 && screenedDocuments.every((document) => selectedScreeningIds.includes(document.id))} onChange={(event) => setSelectedScreeningIds(event.target.checked ? screenedDocuments.map((document) => document.id) : [])} type="checkbox" /><span>{selectedScreeningIds.length ? `${selectedScreeningIds.length} selected` : "Select visible records"}</span></label>
              <div><button className="button compact" disabled={!selectedScreeningIds.length} onClick={() => bulkUpdateReviews({ status: "included" })} title="Ctrl + Alt + I" type="button">Include</button><button className="button compact" disabled={!selectedScreeningIds.length} onClick={() => bulkUpdateReviews({ status: "excluded" })} title="Ctrl + Alt + E" type="button">Exclude</button><button className="button compact" disabled={!selectedScreeningIds.length} onClick={() => bulkUpdateReviews({ status: "to-read" })} title="Ctrl + Alt + T" type="button">To read</button><button className="button compact" disabled={!selectedScreeningIds.length} onClick={() => bulkUpdateReviews({ priority: "high" })} type="button">High priority</button>{reviewUndo && <button className="button compact ghost" onClick={() => { update({ reviews: reviewUndo }); setReviewUndo(undefined); }} type="button"><ArrowUp size={12} /> Undo batch</button>}</div>
            </div>
            {!!workspace.savedViews.length && (
              <div className="saved-view-row">
                {workspace.savedViews.map((view) => (
                  <span key={view.id}>
                    <button
                      onClick={() => {
                        setQuery(view.query);
                        setStatus(view.status);
                        setSort(view.sort ?? "title");
                      }}
                      type="button"
                    >
                      {view.name}
                      <small>
                        {view.status} · {view.sort ?? "title"}
                      </small>
                    </button>
                    <button
                      aria-label={`Delete ${view.name}`}
                      onClick={() =>
                        update({
                          savedViews: workspace.savedViews.filter(
                            (item) => item.id !== view.id,
                          ),
                        })
                      }
                      type="button"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="screening-list">
              {screenedDocuments.map((document) => {
                const review = reviewFor(document.id);
                const preview = notePreviews.includes(document.id);
                return (
                  <article
                    className={`screening-record status-${review.status}`}
                    data-attention-id={document.id}
                    key={document.id}
                    tabIndex={-1}
                  >
                    <div className="screening-record-top">
                      <label className="screening-record-select"><input aria-label={`Select ${document.title}`} checked={selectedScreeningIds.includes(document.id)} onChange={(event) => setSelectedScreeningIds(event.target.checked ? [...selectedScreeningIds, document.id] : selectedScreeningIds.filter((id) => id !== document.id))} type="checkbox" /></label>
                      <button
                        className="screening-document"
                        onClick={() => onOpenDocument(document.id)}
                        type="button"
                      >
                        <BookOpenText size={16} />
                        <span>
                          <strong>{document.title}</strong>
                          <small>
                            {document.authors || "Unknown author"} ·{" "}
                            {document.publicationDate || "No date"}
                          </small>
                        </span>
                      </button>
                      <label className="compact-control">
                        <span>Decision</span>
                        <select
                          onChange={(event) =>
                            updateReview(document.id, {
                              status: event.target.value as ReviewStatus,
                            })
                          }
                          value={review.status}
                        >
                          {Object.entries(statusLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label className="compact-control">
                        <span>Priority</span>
                        <select
                          onChange={(event) =>
                            updateReview(document.id, {
                              priority: event.target
                                .value as DocumentReviewRecord["priority"],
                            })
                          }
                          value={review.priority}
                        >
                          <option value="low">Low</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                        </select>
                      </label>
                      <label className="screening-progress">
                        <span>
                          Reading progress <strong>{review.progress}%</strong>
                        </span>
                        <input
                          max="100"
                          min="0"
                          onChange={(event) =>
                            updateReview(document.id, {
                              progress: Number(event.target.value),
                            })
                          }
                          step="10"
                          type="range"
                          value={review.progress}
                        />
                      </label>
                    </div>
                    {review.status === "excluded" && (
                      <label className="field exclusion-reason">
                        <span>Reason for exclusion</span>
                        <input
                          onChange={(event) =>
                            updateReview(document.id, {
                              exclusionReason: event.target.value,
                            })
                          }
                          value={review.exclusionReason}
                        />
                      </label>
                    )}
                    <div className="screening-note-heading">
                      <span>Screening note · Markdown and KaTeX</span>
                      <ModeToggle
                        onClick={() =>
                          setNotePreviews(
                            preview
                              ? notePreviews.filter(
                                  (item) => item !== document.id,
                                )
                              : [...notePreviews, document.id],
                          )
                        }
                        preview={preview}
                      />
                    </div>
                    {preview ? (
                      <div className="markdown-entry-preview">
                        <MarkdownNote>
                          {review.notes || "*No screening note yet.*"}
                        </MarkdownNote>
                      </div>
                    ) : (
                      <textarea
                        onChange={(event) =>
                          updateReview(document.id, {
                            notes: event.target.value,
                          })
                        }
                        placeholder="Methods, relevance, limitations, or rationale. Use $...$ for equations."
                        rows={4}
                        value={review.notes}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
        {tab === "extraction" && (
          <>
            <form className="extraction-schema-form" onSubmit={addField}>
              <label className="field grow">
                <span>New extraction field</span>
                <input
                  onChange={(event) => setFieldName(event.target.value)}
                  placeholder="e.g. Sample size or Core finding"
                  value={fieldName}
                />
              </label>
              <label className="field">
                <span>Entry type</span>
                <select
                  onChange={(event) =>
                    setFieldType(event.target.value as ExtractionFieldType)
                  }
                  value={fieldType}
                >
                  <option value="text">Long text / Markdown</option>
                  <option value="number">Number</option>
                  <option value="boolean">Yes / no</option>
                  <option value="date">Date</option>
                  <option value="category">Category</option>
                </select>
              </label>
              {fieldType === "category" && (
                <label className="field grow">
                  <span>Choices, comma separated</span>
                  <input
                    onChange={(event) => setFieldOptions(event.target.value)}
                    value={fieldOptions}
                  />
                </label>
              )}
              <button
                className="button primary compact"
                disabled={!fieldName.trim()}
                type="submit"
              >
                <Plus size={14} /> Add field
              </button>
            </form>
            {!workspace.extractionFields.length ? (
              <Empty
                icon={<FlaskConical />}
                title="Define an extraction schema"
                text="Add fields that every included source should answer."
              />
            ) : (
              <div className="extraction-workbench">
                <aside className="extraction-document-list">
                  <header>
                    <strong>Sources</strong>
                    <span>{extractionDocuments.length}</span>
                  </header>
                  {extractionDocuments.map((document) => {
                    const record = workspace.extractionRecords.find(
                      (item) => item.documentId === document.id,
                    );
                    const complete = workspace.extractionFields.filter(
                      (field) => record?.cells[field.id]?.value?.trim(),
                    ).length;
                    return (
                      <button
                        className={
                          document.id === extractionDocId ? "active" : ""
                        }
                        key={document.id}
                        onClick={() => setExtractionDocId(document.id)}
                        type="button"
                      >
                        <strong>{document.title}</strong>
                        <small>
                          {complete}/{workspace.extractionFields.length} fields
                          · {documentExcerpts(document.id).length} excerpts
                        </small>
                      </button>
                    );
                  })}
                </aside>
                <section className="extraction-sheet">
                  {extractionDocument ? (
                    <>
                      <header className="extraction-sheet-header">
                        <div>
                          <span className="eyebrow">Extracting from</span>
                          <h2>{extractionDocument.title}</h2>
                          <p>
                            {extractionDocument.authors || "Unknown author"} ·{" "}
                            {extractionDocument.publicationDate || "No date"}
                          </p>
                        </div>
                        <button
                          className="button compact"
                          onClick={() => onOpenDocument(extractionDocument.id)}
                          type="button"
                        >
                          <BookOpenText size={14} /> Open source
                        </button>
                      </header>
                      <details className="evidence-filter" open>
                        <summary>
                          Filter available evidence by theme{" "}
                          <span>
                            {extractionThemes.length
                              ? `${extractionThemes.length} selected`
                              : "showing all"}
                          </span>
                        </summary>
                        <ThemeChecks
                          compact
                          onChange={setExtractionThemes}
                          selected={extractionThemes}
                          themes={themes}
                        />
                      </details>
                      <div className="extraction-field-grid">
                        {workspace.extractionFields.map((field) => {
                          const cell = cellFor(field.id);
                          const key = `${extractionDocument.id}:${field.id}`;
                          const preview = cellPreviews.includes(key);
                          return (
                            <article
                              className="extraction-field-card"
                              key={field.id}
                            >
                              <header>
                                <div>
                                  <h3>{field.name}</h3>
                                  <span>
                                    {field.type === "text"
                                      ? "Markdown + KaTeX"
                                      : field.type}
                                  </span>
                                </div>
                                <div>
                                  {field.type === "text" && (
                                    <ModeToggle
                                      onClick={() =>
                                        setCellPreviews(
                                          preview
                                            ? cellPreviews.filter(
                                                (item) => item !== key,
                                              )
                                            : [...cellPreviews, key],
                                        )
                                      }
                                      preview={preview}
                                    />
                                  )}
                                  <button
                                    className="icon-button subtle danger-on-hover"
                                    onClick={() =>
                                      update({
                                        extractionFields:
                                          workspace.extractionFields.filter(
                                            (item) => item.id !== field.id,
                                          ),
                                        extractionRecords:
                                          workspace.extractionRecords.map(
                                            (record) => ({
                                              ...record,
                                              cells: Object.fromEntries(
                                                Object.entries(
                                                  record.cells,
                                                ).filter(
                                                  ([fieldId]) =>
                                                    fieldId !== field.id,
                                                ),
                                              ),
                                            }),
                                          ),
                                      })
                                    }
                                    type="button"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </header>
                              {field.type === "text" ? (
                                preview ? (
                                  <div className="markdown-entry-preview extraction-value-preview">
                                    <MarkdownNote>
                                      {cell.value || "*No value entered.*"}
                                    </MarkdownNote>
                                  </div>
                                ) : (
                                  <textarea
                                    onChange={(event) =>
                                      updateCell(
                                        extractionDocument.id,
                                        field.id,
                                        { value: event.target.value },
                                      )
                                    }
                                    placeholder="Detailed response; Markdown and $...$ equations supported."
                                    rows={7}
                                    value={cell.value}
                                  />
                                )
                              ) : field.type === "category" ? (
                                <select
                                  onChange={(event) =>
                                    updateCell(
                                      extractionDocument.id,
                                      field.id,
                                      { value: event.target.value },
                                    )
                                  }
                                  value={cell.value}
                                >
                                  <option value="">— Select —</option>
                                  {field.options.map((option) => (
                                    <option key={option}>{option}</option>
                                  ))}
                                </select>
                              ) : field.type === "boolean" ? (
                                <select
                                  onChange={(event) =>
                                    updateCell(
                                      extractionDocument.id,
                                      field.id,
                                      { value: event.target.value },
                                    )
                                  }
                                  value={cell.value}
                                >
                                  <option value="">— Select —</option>
                                  <option value="yes">Yes</option>
                                  <option value="no">No</option>
                                  <option value="unclear">Unclear</option>
                                </select>
                              ) : (
                                <input
                                  onChange={(event) =>
                                    updateCell(
                                      extractionDocument.id,
                                      field.id,
                                      { value: event.target.value },
                                    )
                                  }
                                  type={field.type}
                                  value={cell.value}
                                />
                              )}
                              <details className="field-evidence-picker">
                                <summary>
                                  <BookOpenText size={13} /> Linked evidence{" "}
                                  <strong>{cell.excerptIds.length}</strong>
                                </summary>
                                <div className="evidence-checkbox-list">
                                  {availableExtractionEvidence.map(
                                    (excerpt) => {
                                      const checked = cell.excerptIds.includes(
                                        excerpt.id,
                                      );
                                      return (
                                        <label
                                          className={checked ? "checked" : ""}
                                          key={excerpt.id}
                                        >
                                          <input
                                            checked={checked}
                                            onChange={() =>
                                              updateCell(
                                                extractionDocument.id,
                                                field.id,
                                                {
                                                  excerptIds: checked
                                                    ? cell.excerptIds.filter(
                                                        (item) =>
                                                          item !== excerpt.id,
                                                      )
                                                    : [
                                                        ...cell.excerptIds,
                                                        excerpt.id,
                                                      ],
                                                },
                                              )
                                            }
                                            type="checkbox"
                                          />
                                          <span>
                                            <strong>
                                              {excerpt.page
                                                ? `Page ${excerpt.page}`
                                                : "Source excerpt"}
                                            </strong>
                                            {short(
                                              excerpt.text || "Image excerpt",
                                              130,
                                            )}
                                          </span>
                                          <button
                                            onClick={(event) => {
                                              event.preventDefault();
                                              onOpenExcerpt(excerpt.id);
                                            }}
                                            type="button"
                                          >
                                            View
                                          </button>
                                        </label>
                                      );
                                    },
                                  )}
                                  {!availableExtractionEvidence.length && (
                                    <p className="muted-inline">
                                      No excerpts match this theme filter.
                                    </p>
                                  )}
                                </div>
                              </details>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <Empty
                      icon={<FileQuestion />}
                      title="No eligible sources"
                      text="Excluded sources are omitted from extraction."
                    />
                  )}
                </section>
              </div>
            )}
          </>
        )}
        {tab === "claims" && (
          <div className={`claims-workbench ${claimEvidenceDetailed ? "evidence-detailed" : ""}`}>
            <header className="stage-section-heading">
              <div>
                <h2>Claims</h2>
                <p>
                  Test interpretations against supporting and challenging
                  evidence.
                </p>
              </div>
              <div className="stage-heading-actions">
                <div className="segmented-control compact" role="group" aria-label="Claim evidence display">
                  <button aria-pressed={!claimEvidenceDetailed} onClick={() => setClaimEvidenceDetailed(false)} type="button">Compact</button>
                  <button aria-pressed={claimEvidenceDetailed} onClick={() => setClaimEvidenceDetailed(true)} type="button">Detailed</button>
                </div>
                {claimEvidenceDetailed && workspace.claims.length > 0 && <label className="detailed-claim-picker"><span>Showing</span><select aria-label="Claim shown in detailed view" onChange={(event) => setDetailedClaimId(event.target.value)} value={detailedClaimId}>{workspace.claims.map((claim, index) => <option key={claim.id} value={claim.id}>Claim {index + 1}: {short(claim.text, 58)}</option>)}</select></label>}
                <button className="button primary" onClick={() => setClaimDraft(emptyClaim())} type="button"><Plus size={15} /> New claim</button>
              </div>
            </header>
            {claimDraft && (
              <form className="claim-editor" onSubmit={saveClaim}>
                <header>
                  <div>
                    <span className="eyebrow">Claim workspace</span>
                    <h2>
                      {workspace.claims.some(
                        (item) => item.id === claimDraft.id,
                      )
                        ? "Edit claim"
                        : "New claim"}
                    </h2>
                  </div>
                  <button
                    className="icon-button subtle"
                    onClick={() => setClaimDraft(undefined)}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </header>
                <div className="claim-editor-main">
                  <section>
                    <label className="field">
                      <span>Claim</span>
                      <textarea
                        autoFocus
                        onChange={(event) =>
                          setClaimDraft({
                            ...claimDraft,
                            text: event.target.value,
                          })
                        }
                        rows={5}
                        value={claimDraft.text}
                      />
                    </label>
                    <div className="claim-editor-row">
                      <label className="field">
                        <span>Status</span>
                        <select
                          onChange={(event) =>
                            setClaimDraft({
                              ...claimDraft,
                              status: event.target.value as ClaimStatus,
                            })
                          }
                          value={claimDraft.status}
                        >
                          {Object.entries(claimLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field grow">
                        <span>Confidence — {claimDraft.confidence}%</span>
                        <input
                          max="100"
                          min="0"
                          onChange={(event) =>
                            setClaimDraft({
                              ...claimDraft,
                              confidence: Number(event.target.value),
                            })
                          }
                          type="range"
                          value={claimDraft.confidence}
                        />
                      </label>
                    </div>
                    <label className="field">
                      <span>Interpretive note</span>
                      <textarea
                        onChange={(event) =>
                          setClaimDraft({
                            ...claimDraft,
                            notes: event.target.value,
                          })
                        }
                        rows={4}
                        value={claimDraft.notes}
                      />
                    </label>
                    <fieldset>
                      <legend>Themes · filters evidence immediately</legend>
                      <ThemeChecks
                        onChange={(themeIds) =>
                          setClaimDraft({ ...claimDraft, themeIds })
                        }
                        selected={claimDraft.themeIds}
                        themes={themes}
                      />
                    </fieldset>
                  </section>
                  <section className="claim-evidence-picker">
                    <header>
                      <div>
                        <h3>Evidence chooser</h3>
                        <p>
                          {claimDraft.themeIds.length
                            ? "Showing excerpts in checked themes."
                            : "Check themes to narrow the list."}
                        </p>
                      </div>
                      <label>
                        <span>Relationship</span>
                        <select
                          className={`evidence-role-select role-${evidenceRole}`}
                          onChange={(event) =>
                            setEvidenceRole(event.target.value as EvidenceRole)
                          }
                          value={evidenceRole}
                        >
                          {roles.map((role) => (
                            <option className={`role-${role}`} key={role} value={role}>{roleLabels[role]}</option>
                          ))}
                        </select>
                      </label>
                    </header>
                    <label className="search-field">
                      <Search size={14} />
                      <input
                        onChange={(event) =>
                          setEvidenceQuery(event.target.value)
                        }
                        placeholder="Search matching excerpts…"
                        value={evidenceQuery}
                      />
                    </label>
                    <div className="claim-evidence-options">
                      {claimEvidenceOptions.map((excerpt) => {
                        const existingEvidence = claimDraft.evidence.find((item) => item.excerptId === excerpt.id);
                        const linked = existingEvidence?.role === evidenceRole;
                        return (
                          <SourceCard
                            actions={
                              <>
                                <button
                                  onClick={() => onOpenExcerpt(excerpt.id)}
                                  type="button"
                                >
                                  Open
                                </button>
                                <button
                                  className={`evidence-link-action role-${evidenceRole}`}
                                  disabled={linked}
                                  onClick={() =>
                                    !linked &&
                                    setClaimDraft({
                                      ...claimDraft,
                                      evidence: [
                                        ...claimDraft.evidence.filter((item) => item.excerptId !== excerpt.id),
                                        {
                                          excerptId: excerpt.id,
                                          role: evidenceRole,
                                        },
                                      ],
                                    })
                                  }
                                  type="button"
                                >
                                  {linked ? (
                                    <>
                                      <Check size={11} /> Linked
                                    </>
                                  ) : (
                                    <>
                                       <Plus size={11} /> {existingEvidence ? `Change to ${roleLabels[evidenceRole]}` : roleLabels[evidenceRole]}
                                    </>
                                  )}
                                </button>
                              </>
                            }
                            document={sourceDoc(excerpt)}
                            excerpt={excerpt}
                            key={excerpt.id}
                            role={evidenceRole}
                          />
                        );
                      })}
                      {!claimEvidenceOptions.length && (
                        <p className="muted-inline">
                          No excerpts match the selected themes.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
                {!!claimDraft.evidence.length && (
                  <div className="linked-evidence-strip">
                    <strong>Linked evidence</strong>
                    {claimDraft.evidence.map((evidence, index) => (
                      <span
                        className={`draft-evidence-chip role-${evidence.role}`}
                        key={`${evidence.excerptId}:${index}`}
                        style={{ "--excerpt-color": excerpts.find((item) => item.id === evidence.excerptId)?.color ?? "#efd982", "--role-color": roleColors[evidence.role] } as CSSProperties}
                      >
                        <em>{roleLabels[evidence.role]}</em>
                        {short(
                          excerpts.find(
                            (item) => item.id === evidence.excerptId,
                          )?.text ?? "Missing excerpt",
                          64,
                        )}
                        <button
                          onClick={() =>
                            setClaimDraft({
                              ...claimDraft,
                              evidence: claimDraft.evidence.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            })
                          }
                          type="button"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <footer>
                  <button
                    className="button ghost"
                    onClick={() => setClaimDraft(undefined)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="button primary"
                    disabled={!claimDraft.text.trim()}
                    type="submit"
                  >
                    Save claim
                  </button>
                </footer>
              </form>
            )}
            <div className="claim-list">
              {!workspace.claims.length && (
                <p className="muted-inline">No claims yet.</p>
              )}
              {workspace.claims.filter((claim) => !claimEvidenceDetailed || claim.id === detailedClaimId).map((claim, claimIndex) => (
                <article
                  className={`claim-card status-${claim.status}`}
                  data-attention-id={claim.id}
                  tabIndex={-1}
                  key={claim.id}
                >
                  <header className="claim-card-header">
                    <div>
                      <span>{claimLabels[claim.status]}</span>
                      <small>Claim {claimIndex + 1}</small>
                    </div>
                    <div className="claim-confidence" title={`${claim.confidence}% confidence`}>
                      <strong>{claim.confidence}%</strong>
                      <i><b style={{ width: `${claim.confidence}%` }} /></i>
                      <small>confidence</small>
                    </div>
                  </header>
                  <div className="claim-card-body">
                    <p>{claim.text}</p>
                    {claim.notes && <small>{claim.notes}</small>}
                    {claim.themeIds.length > 0 && (
                      <div className="claim-card-themes">
                        <span>Claim themes</span>
                        <ThemeBadges ids={claim.themeIds} themes={themes} />
                      </div>
                    )}
                  </div>
                  <section className="claim-card-evidence">
                    <header>
                      <strong>Evidence</strong>
                      <span>{claim.evidence.length} {claim.evidence.length === 1 ? "excerpt" : "excerpts"}</span>
                    </header>
                    <div className="claim-evidence-list">
                      {claim.evidence.map((evidence, index) => { const excerpt = excerpts.find((item) => item.id === evidence.excerptId); return <EvidenceDisplay detailed={claimEvidenceDetailed} document={documents.find((item) => item.id === excerpt?.documentId)} excerpt={excerpt} key={`${evidence.excerptId}:${index}`} onOpen={() => onOpenExcerpt(evidence.excerptId)} role={evidence.role} themes={themes} />; })}
                      {!claim.evidence.length && <p className="claim-no-evidence">No evidence linked yet.</p>}
                    </div>
                  </section>
                  <footer>
                    <button
                      className="button ghost compact"
                      onClick={() =>
                        setClaimDraft({
                          ...claim,
                          evidence: [...claim.evidence],
                          themeIds: [...claim.themeIds],
                        })
                      }
                      type="button"
                    >
                      <Pencil size={12} /> Edit claim
                    </button>
                    <button
                      aria-label={`Delete claim ${claimIndex + 1}`}
                      className="icon-button subtle danger-on-hover"
                      onClick={() =>
                        update({
                          claims: workspace.claims.filter(
                            (item) => item.id !== claim.id,
                          ),
                          sections: workspace.sections.map((section) => ({
                            ...section,
                            claimIds: section.claimIds.filter(
                              (item) => item !== claim.id,
                            ),
                          })),
                        })
                      }
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          </div>
        )}
        {tab === "draft" && (
          <>
            <header className="stage-section-heading">
              <div>
                <h2>Synthesis outline</h2>
                <p>Write with source excerpts visible beside the draft.</p>
              </div>
              <div className="stage-heading-actions">
                {!!workspace.sections.length && <><button className="button compact" onClick={() => update({ sections: workspace.sections.map((section) => ({ ...section, collapsed: false })) })} type="button">Expand all</button><button className="button compact" onClick={() => update({ sections: workspace.sections.map((section) => ({ ...section, collapsed: true })) })} type="button">Collapse all</button></>}
                <button className="button" disabled={!workspace.sections.some((section) => section.excerptIds.length)} onClick={exportUsedCitations} type="button"><FileDown size={14} /> Export used citations</button>
                <button className="button" disabled={!workspace.sections.length} onClick={copyDraft} type="button"><Clipboard size={14} /> Copy Markdown</button>
              </div>
            </header>
            <form
              className="new-section-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!sectionTitle.trim()) return;
                const sectionId = id("section");
                update({
                  sections: [
                    ...workspace.sections,
                    {
                      id: sectionId,
                      title: sectionTitle.trim(),
                      content: "",
                      claimIds: [],
                      excerptIds: [],
                      collapsed: false,
                    },
                  ],
                });
                setActiveSectionId(sectionId);
                setSectionTitle("");
              }}
            >
              <input
                onChange={(event) => setSectionTitle(event.target.value)}
                placeholder="New section title"
                value={sectionTitle}
              />
              <button
                className="button primary compact"
                disabled={!sectionTitle.trim()}
                type="submit"
              >
                <Plus size={14} /> Add section
              </button>
            </form>
            <div className="draft-workbench">
              <div className="synthesis-outline">
                {workspace.sections.map((section, index) => (
                  <article
                    className={`${activeSectionId === section.id ? "active" : ""} ${section.collapsed ? "collapsed" : ""} ${draggedSectionId === section.id ? "dragging" : ""}`}
                    key={section.id}
                    data-section-id={section.id}
                    onClick={() => setActiveSectionId(section.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => { event.preventDefault(); reorderSection(section.id, event.dataTransfer.getData("text/plain") || draggedSectionId); }}
                  >
                    <header>
                      <span aria-label={`Drag to reorder ${section.title}`} className="section-drag-handle" draggable onClick={(event) => event.stopPropagation()} onDragEnd={() => setDraggedSectionId(undefined)} onDragStart={(event: ReactDragEvent<HTMLSpanElement>) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", section.id); setDraggedSectionId(section.id); }} onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); setDraggedSectionId(section.id); }} role="button" tabIndex={0} title="Drag to reorder"><GripVertical size={15} /></span>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <input
                        onChange={(event) =>
                          updateSection(section.id, {
                            title: event.target.value,
                          })
                        }
                        value={section.title}
                      />
                      <div className="section-order-buttons"><button aria-label={`Move ${section.title} up`} disabled={index === 0} onClick={(event) => { event.stopPropagation(); const next = [...workspace.sections]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; update({ sections: next }); }} type="button"><ArrowUp size={13} /></button><button aria-label={`Move ${section.title} down`} disabled={index === workspace.sections.length - 1} onClick={(event) => { event.stopPropagation(); const next = [...workspace.sections]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; update({ sections: next }); }} type="button"><ArrowDown size={13} /></button></div>
                      <button
                        aria-label={section.collapsed ? `Expand ${section.title}` : `Collapse ${section.title}`}
                        className="icon-button subtle"
                        onClick={(event) => { event.stopPropagation(); updateSection(section.id, { collapsed: !section.collapsed }); }}
                        type="button"
                      >
                        {section.collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      </button>
                      <button
                        className="icon-button subtle danger-on-hover"
                        onClick={(event) => { event.stopPropagation();
                          update({
                            sections: workspace.sections.filter(
                              (item) => item.id !== section.id,
                            ),
                          })
                        }}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </header>
                    {!section.collapsed && <>
                    <div className="outline-writing-toolbar"><span>Draft text · Markdown + KaTeX</span><ModeToggle onClick={() => setSectionPreviews(sectionPreviews.includes(section.id) ? sectionPreviews.filter((item) => item !== section.id) : [...sectionPreviews, section.id])} preview={sectionPreviews.includes(section.id)} /></div>
                    {sectionPreviews.includes(section.id) ? <div className="outline-preview">{section.content ? <MarkdownNote>{section.content}</MarkdownNote> : <p className="muted-inline">Nothing written yet.</p>}</div> : <textarea className="outline-editor" onChange={(event) => updateSection(section.id, { content: event.target.value })} placeholder="Write this section without leaving the evidence shelf. Use Markdown and $…$ for equations." rows={11} value={section.content} />}
                    <div className="outline-links">
                      <details className="outline-claim-picker">
                        <summary>Claims <span>{section.claimIds.length} linked</span></summary><div>
                        {workspace.claims.map((claim) => (
                          <label className="outline-checkbox" key={claim.id}>
                            <input
                              checked={section.claimIds.includes(claim.id)}
                              onChange={() =>
                                updateSection(section.id, {
                                  claimIds: section.claimIds.includes(claim.id)
                                    ? section.claimIds.filter(
                                        (item) => item !== claim.id,
                                      )
                                    : [...section.claimIds, claim.id],
                                })
                              }
                              type="checkbox"
                            />
                            {short(claim.text, 95)}
                          </label>
                        ))}
                        </div>
                      </details>
                      <fieldset>
                        <legend>Source excerpts</legend>
                        {section.excerptIds.map((excerptId) => (
                          <span className="section-source-chip" key={excerptId}>
                            <button
                              onClick={() => onOpenExcerpt(excerptId)}
                              type="button"
                            >
                              {short(
                                excerpts.find((item) => item.id === excerptId)
                                  ?.text || (excerpts.find((item) => item.id === excerptId)?.kind === "image" ? "Image excerpt" : "Missing excerpt"),
                                80,
                              )}
                            </button>
                            <button
                              onClick={() =>
                                updateSection(section.id, {
                                  excerptIds: section.excerptIds.filter(
                                    (item) => item !== excerptId,
                                  ),
                                })
                              }
                              type="button"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                        {!section.excerptIds.length && (
                          <p className="muted-inline">
                            Use the source shelf to add excerpts.
                          </p>
                        )}
                      </fieldset>
                    </div>
                    </>}
                  </article>
                ))}
                {!workspace.sections.length && (
                  <Empty
                    icon={<LayoutList />}
                    title="Start the outline"
                    text="Add a section, then attach claims and source excerpts."
                  />
                )}
              </div>
              <aside className="draft-source-shelf">
                <header>
                  <div>
                    <strong>Source excerpts</strong>
                    <span>
                      {activeSectionId
                        ? "Add to the selected section"
                        : "Select a section first"}
                    </span>
                  </div>
                  <span>{draftSources.length}</span>
                </header>
                <label className="search-field">
                  <Search size={14} />
                  <input
                    onChange={(event) => setSourceQuery(event.target.value)}
                    placeholder="Search excerpt or source…"
                    value={sourceQuery}
                  />
                </label>
                <details className="draft-source-filters">
                  <summary><span><Filter size={13} /> Source filters</span><em>{limitSourcesToSectionClaims ? `${effectiveSourceClaims.length} section claims` : sourceClaims.length + sourceRoles.length + sourceThemes.length ? `${sourceClaims.length + sourceRoles.length + sourceThemes.length} active` : "All excerpts"}</em></summary>
                  <div className="draft-filter-body">
                    <header><p>Filters combine: claims first, then relationship and theme.</p>{!!(sourceClaims.length || sourceRoles.length || sourceThemes.length) && <button onClick={() => { setSourceClaims([]); setSourceRoles([]); setSourceThemes([]); }} type="button">Clear filters</button>}</header>
                    <label className="section-claim-scope"><input checked={limitSourcesToSectionClaims} onChange={(event) => setLimitSourcesToSectionClaims(event.target.checked)} type="checkbox" /><span><strong>Only evidence linked to this section's claims</strong><small>Recommended. The shelf follows the claims checked in the selected section.</small></span></label>
                    {!limitSourcesToSectionClaims && <fieldset><legend>Claims <span>{sourceClaims.length ? `${sourceClaims.length} selected` : "All excerpts"}</span></legend><div className="claim-filter-list">{workspace.claims.map((claim, index) => { const checked = sourceClaims.includes(claim.id); return <label className={checked ? "checked" : ""} key={claim.id}><input checked={checked} onChange={() => { const next = checked ? sourceClaims.filter((item) => item !== claim.id) : [...sourceClaims, claim.id]; setSourceClaims(next); if (!next.length) setSourceRoles([]); }} type="checkbox" /><span><strong>Claim {index + 1}</strong>{short(claim.text, 85)}</span></label>; })}{!workspace.claims.length && <p className="muted-inline">No claims available.</p>}</div></fieldset>}
                    <fieldset className={!effectiveSourceClaims.length ? "disabled-filter" : ""}><legend>Relationship <span>{sourceRoles.length ? `${sourceRoles.length} selected` : "All under selected claims"}</span></legend><div className="role-filter-row">{roles.map((role) => { const checked = sourceRoles.includes(role); return <label className={`role-${role} ${checked ? "checked" : ""}`} key={role} style={{ "--role-color": roleColors[role] } as CSSProperties}><input checked={checked} disabled={!effectiveSourceClaims.length} onChange={() => setSourceRoles(checked ? sourceRoles.filter((item) => item !== role) : [...sourceRoles, role])} type="checkbox" />{roleLabels[role]}</label>; })}</div>{!effectiveSourceClaims.length && <small>{limitSourcesToSectionClaims ? "Link at least one claim to this section." : "Choose at least one claim to filter by evidence relationship."}</small>}</fieldset>
                    <fieldset><legend>Themes <span>{sourceThemes.length ? `${sourceThemes.length} selected` : "All themes"}</span></legend><ThemeChecks compact onChange={setSourceThemes} selected={sourceThemes} themes={themes} /></fieldset>
                  </div>
                </details>
                <div className="draft-source-list">
                  {draftSources.map((excerpt) => {
                    const linked = workspace.sections
                      .find((item) => item.id === activeSectionId)
                      ?.excerptIds.includes(excerpt.id);
                    const contextRoles = effectiveSourceClaims.length ? Array.from(new Set(workspace.claims.filter((claim) => effectiveSourceClaims.includes(claim.id)).flatMap((claim) => claim.evidence.filter((evidence) => evidence.excerptId === excerpt.id && (!sourceRoles.length || sourceRoles.includes(evidence.role))).map((evidence) => evidence.role)))) : [];
                    return (
                      <SourceCard
                        actions={
                          <>
                            <button
                              onClick={() => onOpenExcerpt(excerpt.id)}
                              type="button"
                            >
                              Open
                            </button>
                            <button
                              disabled={!activeSectionId || linked}
                              onClick={() =>
                                activeSectionId &&
                                addSource(activeSectionId, excerpt.id)
                              }
                              type="button"
                            >
                              {linked ? (
                                <>
                                  <Check size={11} /> Added
                                </>
                              ) : (
                                <>
                                  <Plus size={11} /> Add
                                </>
                              )}
                            </button>
                          </>
                        }
                        document={sourceDoc(excerpt)}
                        excerpt={excerpt}
                        key={excerpt.id}
                        contextRoles={contextRoles}
                      />
                    );
                  })}
                </div>
              </aside>
            </div>
          </>
        )}
        {tab === "health" && (
          <div className="health-dashboard">
            <header>
              <div
                className={
                  issueTotal ? "health-score has-issues" : "health-score"
                }
              >
                <strong>{issueTotal}</strong>
                <span>open flags</span>
              </div>
              <div>
                <h2>Project health</h2>
                <p>
                  These checks identify incomplete provenance and catalogue
                  records.
                </p>
              </div>
            </header>
            <div>
              {health.map((item) => (
                <article
                  className={item.count ? "has-issues" : "is-clear"}
                  key={item.label}
                >
                  {item.count ? (
                    <AlertTriangle size={19} />
                  ) : (
                    <CheckCircle2 size={19} />
                  )}
                  <span>
                    <strong>{item.count}</strong>
                    {item.label}
                  </span>
                </article>
              ))}
            </div>
            {!documents.length && (
              <Empty
                icon={<FileQuestion />}
                title="No documents in this project"
              />
            )}
          </div>
        )}
      </section>
      {reportOpen && (
        <Report
          documents={documents}
          excerpts={excerpts}
          onClose={() => setReportOpen(false)}
          project={project}
          themes={themes}
          workspace={workspace}
        />
      )}
    </main>
  );
}

function Protocol({
  workspace,
  update,
}: {
  workspace: SynthesisWorkspaceState;
  update: (patch: Partial<SynthesisWorkspaceState>) => void;
}) {
  return (
    <div className="protocol-grid">
      <label className="field full">
        <span>Research question</span>
        <textarea
          onChange={(event) => update({ researchQuestion: event.target.value })}
          rows={3}
          value={workspace.researchQuestion}
        />
      </label>
      <label className="field full">
        <span>Scope and context</span>
        <textarea
          onChange={(event) => update({ scope: event.target.value })}
          rows={4}
          value={workspace.scope}
        />
      </label>
      <label className="field">
        <span>Inclusion criteria</span>
        <textarea
          onChange={(event) =>
            update({ inclusionCriteria: event.target.value })
          }
          rows={9}
          value={workspace.inclusionCriteria}
        />
      </label>
      <label className="field">
        <span>Exclusion criteria</span>
        <textarea
          onChange={(event) =>
            update({ exclusionCriteria: event.target.value })
          }
          rows={9}
          value={workspace.exclusionCriteria}
        />
      </label>
      <aside className="protocol-hint">
        <ShieldCheck size={22} />
        <div>
          <strong>Keep the protocol explicit</strong>
          <p>
            These criteria remain beside screening decisions so the review can
            be audited.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Empty({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text?: string;
}) {
  return (
    <div className="empty-state compact-empty">
      {icon}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

function Report({
  project,
  documents,
  excerpts,
  themes,
  workspace,
  onClose,
}: {
  project?: ResearchProject;
  documents: ResearchDocument[];
  excerpts: Excerpt[];
  themes: Theme[];
  workspace: SynthesisWorkspaceState;
  onClose: () => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false; let firstFrame = 0; let secondFrame = 0;
    const images = excerpts.filter((excerpt) => excerpt.kind === "image" && excerpt.imageData).map((excerpt) => new Promise<void>((resolve) => { const image = new Image(); image.onload = () => resolve(); image.onerror = () => resolve(); image.src = excerpt.imageData!; }));
    void Promise.all(images).then(() => { if (cancelled) return; firstFrame = window.requestAnimationFrame(() => { secondFrame = window.requestAnimationFrame(() => { if (!cancelled) setReady(true); }); }); });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [excerpts]);
  const review = (documentId: string) =>
    workspace.reviews.find((item) => item.documentId === documentId);
  const count = (status: ReviewStatus) =>
    documents.filter(
      (document) => (review(document.id)?.status ?? "inbox") === status,
    ).length;
  const documentIds = new Set(documents.map((item) => item.id));
  const health = [
    {
      label: "Not screened",
      count: documents.filter(
        (item) =>
          review(item.id)?.status === undefined ||
          review(item.id)?.status === "inbox",
      ).length,
    },
    {
      label: "Included without excerpts",
      count: documents.filter(
        (item) =>
          ["included", "completed"].includes(review(item.id)?.status ?? "") &&
          !excerpts.some((excerpt) => excerpt.documentId === item.id),
      ).length,
    },
    {
      label: "Missing DOI",
      count: documents.filter((item) => !item.doi).length,
    },
    {
      label: "Missing publication date",
      count: documents.filter((item) => !item.publicationDate).length,
    },
    {
      label: "Unthemed excerpts",
      count: excerpts.filter((item) => !item.themeIds.length).length,
    },
    {
      label: "Claims without evidence",
      count: workspace.claims.filter((item) => !item.evidence.length).length,
    },
    {
      label: "Orphaned excerpts",
      count: excerpts.filter((item) => !documentIds.has(item.documentId))
        .length,
    },
  ];
  const healthTotal = health.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="report-backdrop">
      <section className="synthesis-report-modal">
        <div className="report-toolbar">
          <div>
            <strong>Synthesis report preview</strong>
            <span>
              {ready
                ? "All sections are ready. Choose Save as PDF in the system dialog."
                : "Preparing detailed evidence sections..."}
            </span>
          </div>
          <button
            className="button primary"
            disabled={!ready}
            onClick={() => window.print()}
            type="button"
          >
            <FileDown size={14} /> {ready ? "Print / save PDF" : "Preparing..."}
          </button>
          <button
            className="icon-button subtle"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <article className="synthesis-report">
          <header className="report-cover">
            <div className="eyebrow">Thematic evidence synthesis</div>
            <h1>{project?.title ?? "Research synthesis"}</h1>
            <MarkdownNote>
              {workspace.researchQuestion || "*No research question recorded.*"}
            </MarkdownNote>
            <div className="report-health">
              <header>
                <div>
                  <span>Review health</span>
                  <strong>{healthTotal}</strong>
                </div>
                <p>
                  {healthTotal
                    ? "Open quality and completeness flags to address before finalizing the review."
                    : "No open quality or completeness flags were detected."}
                </p>
              </header>
              <div>
                {health.map((item) => (
                  <span
                    className={item.count ? "has-issues" : "is-clear"}
                    key={item.label}
                  >
                    <strong>{item.count}</strong>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <footer>
              Generated {new Date().toLocaleDateString()} · {documents.length}{" "}
              sources · {excerpts.length} excerpts · {workspace.claims.length}{" "}
              claims
            </footer>
          </header>
          {ready ? (
            <>
              <section>
                <h2>Review protocol</h2>
                <h3>Scope and context</h3>
                <MarkdownNote>
                  {workspace.scope || "*Not recorded.*"}
                </MarkdownNote>
                <div className="report-two-column">
                  <div>
                    <h3>Inclusion criteria</h3>
                    <MarkdownNote>
                      {workspace.inclusionCriteria || "*Not recorded.*"}
                    </MarkdownNote>
                  </div>
                  <div>
                    <h3>Exclusion criteria</h3>
                    <MarkdownNote>
                      {workspace.exclusionCriteria || "*Not recorded.*"}
                    </MarkdownNote>
                  </div>
                </div>
              </section>
              <section>
                <h2>Screening summary</h2>
                <div className="report-stat-grid">
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <div key={value}>
                      <strong>{count(value as ReviewStatus)}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Decision</th>
                      <th>Progress</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => (
                      <tr key={document.id}>
                        <td>
                          <strong>{document.title}</strong>
                          <small>{document.authors || "Unknown author"}</small>
                        </td>
                        <td>
                          {statusLabels[review(document.id)?.status ?? "inbox"]}
                          <small>{review(document.id)?.exclusionReason}</small>
                        </td>
                        <td>{review(document.id)?.progress ?? 0}%</td>
                        <td>
                          <MarkdownNote>
                            {review(document.id)?.notes || "—"}
                          </MarkdownNote>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              {!!workspace.extractionFields.length && (
                <section>
                  <h2>Structured extraction</h2>
                  {documents
                    .filter(
                      (document) => review(document.id)?.status !== "excluded",
                    )
                    .map((document) => {
                      const record = workspace.extractionRecords.find(
                        (item) => item.documentId === document.id,
                      );
                      return (
                        <article
                          className="report-extraction"
                          key={document.id}
                        >
                          <h3>{document.title}</h3>
                          {workspace.extractionFields.map((field) => {
                            const cell = record?.cells[field.id];
                            const evidenceIds =
                              cell?.excerptIds ??
                              (cell?.excerptId ? [cell.excerptId] : []);
                            return (
                              <div key={field.id}>
                                <strong>{field.name}</strong>
                                <MarkdownNote>
                                  {cell?.value || "*Not recorded.*"}
                                </MarkdownNote>
                                {!!evidenceIds.length && (
                                  <small>
                                    {evidenceIds.length} linked evidence excerpt
                                    {evidenceIds.length === 1 ? "" : "s"}
                                  </small>
                                )}
                              </div>
                            );
                          })}
                        </article>
                      );
                    })}
                </section>
              )}
              <section>
                <h2>Claims and evidence</h2>
                {workspace.claims.map((claim, index) => (
                  <article className="report-claim" key={claim.id}>
                    <header>
                      <span>Claim {index + 1}</span>
                      <em>
                        {claimLabels[claim.status]} · {claim.confidence}%
                        confidence
                      </em>
                    </header>
                    <h3>{claim.text}</h3>
                    {claim.notes && <MarkdownNote>{claim.notes}</MarkdownNote>}
                    <div className="report-theme-list"><strong>Themes</strong><ThemeBadges ids={claim.themeIds} themes={themes} />{!claim.themeIds.length && <span>None</span>}</div>
                    {claim.evidence.map((evidence, evidenceIndex) => {
                      const excerpt = excerpts.find(
                        (item) => item.id === evidence.excerptId,
                      );
                      const document = documents.find(
                        (item) => item.id === excerpt?.documentId,
                      );
                      return <EvidenceDisplay detailed document={document} excerpt={excerpt} key={`${evidence.excerptId}:${evidenceIndex}`} report role={evidence.role} themes={themes} />;
                    })}
                  </article>
                ))}
              </section>
              <section>
                <h2>Synthesis narrative</h2>
                {workspace.sections.map((section) => (
                  <article className="report-section" key={section.id}>
                    <h3>{section.title}</h3>
                    <MarkdownNote>
                      {section.content || "*No draft text.*"}
                    </MarkdownNote>
                    {!!section.excerptIds.length && (
                      <div className="report-sources">
                        <h4>Linked source excerpts</h4>
                        {section.excerptIds.map((excerptId) => {
                          const excerpt = excerpts.find(
                            (item) => item.id === excerptId,
                          );
                          const document = documents.find(
                            (item) => item.id === excerpt?.documentId,
                          );
                          return <EvidenceDisplay detailed document={document} excerpt={excerpt} key={excerptId} report themes={themes} />;
                        })}
                      </div>
                    )}
                  </article>
                ))}
              </section>
            </>
          ) : (
            <div className="report-loading">
              <span />
              <strong>Preparing the full report</strong>
              <p>The cover and review-health summary are ready.</p>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

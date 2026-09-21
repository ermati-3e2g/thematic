import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpenText,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Coffee,
  FileText,
  Flag,
  FolderOpen,
  History,
  ListChecks,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  ErgonomicsProjectState,
  ErgonomicsSettings,
  Excerpt,
  FocusItem,
  FocusItemKind,
  PendingExcerptDraft,
  ResearchClaim,
  ResearchDocument,
  SynthesisSection,
} from "../types";
import { Modal, formatDate, truncate } from "./WorkbenchUi";

export interface AttentionItem {
  id: string;
  kind: "orphan" | "screening" | "claim" | "citation" | "excerpt" | "draft" | "save";
  title: string;
  detail: string;
  targetId?: string;
}

export interface CommandAction {
  id: string;
  label: string;
  detail: string;
  shortcut?: string;
  run: () => void;
}

function itemIcon(kind: FocusItemKind) {
  return kind === "document" ? <BookOpenText size={14} /> : kind === "excerpt" ? <FileText size={14} /> : kind === "claim" ? <Flag size={14} /> : <ClipboardList size={14} />;
}

export function CommandPalette({ actions, onClose }: { actions: CommandAction[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const shown = actions.filter((action) => `${action.label} ${action.detail}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return (
    <Modal description="Search workbench commands and keyboard-accessible actions." icon={<Search />} onClose={onClose} size="medium" title="Command palette">
      <div className="command-palette">
        <label className="search-field"><Search size={15} /><input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Type a command…" value={query} /></label>
        <div className="command-list">
          {shown.map((action) => <button key={action.id} onClick={() => { action.run(); onClose(); }} type="button"><span><strong>{action.label}</strong><small>{action.detail}</small></span>{action.shortcut && <kbd>{action.shortcut}</kbd>}</button>)}
          {!shown.length && <p className="muted-inline">No command matches “{query}”.</p>}
        </div>
      </div>
    </Modal>
  );
}

export function ResumeBanner({ title, savedAt, onResume, onDismiss }: { title: string; savedAt: string; onResume: () => void; onDismiss: () => void }) {
  return <aside className="resume-banner"><History size={17} /><div><strong>Continue where you stopped?</strong><span>{title} · checkpoint {formatDate(savedAt)}</span></div><button className="button compact primary" onClick={onResume} type="button">Resume</button><button className="button compact ghost" onClick={onDismiss} type="button">Start elsewhere</button></aside>;
}

export function SaveStateIndicator({ state, detail }: { state: "saved" | "saving" | "unsaved" | "error"; detail?: string }) {
  return <span className={`save-state state-${state}`} title={detail}><i />{state === "saved" ? "Saved" : state === "saving" ? "Saving" : state === "unsaved" ? "Unsaved changes" : "Save failed"}</span>;
}

export default function ErgonomicsHub({
  settings,
  projectState,
  documents,
  excerpts,
  claims,
  sections,
  attention,
  sessionElapsedMinutes,
  onClose,
  onUpdateProject,
  onOpenFocusItem,
  onOpenAttentionItem,
  onDismissAttentionItem,
  onRestoreDismissedAttention,
  onCreateCheckpoint,
  onRestoreCheckpoint,
  onDeleteCheckpoint,
  onOpenDraft,
  onDiscardDraft,
  onEndSession,
}: {
  settings: ErgonomicsSettings;
  projectState: ErgonomicsProjectState;
  documents: ResearchDocument[];
  excerpts: Excerpt[];
  claims: ResearchClaim[];
  sections: SynthesisSection[];
  attention: AttentionItem[];
  sessionElapsedMinutes: number;
  onClose: () => void;
  onUpdateProject: (patch: Partial<ErgonomicsProjectState>) => void;
  onOpenFocusItem: (item: FocusItem) => void;
  onOpenAttentionItem: (item: AttentionItem) => void;
  onDismissAttentionItem: (item: AttentionItem) => void;
  onRestoreDismissedAttention: () => void;
  onCreateCheckpoint: (label: string) => void;
  onRestoreCheckpoint: (id: string) => void;
  onDeleteCheckpoint: (id?: string) => void;
  onOpenDraft: (draft: PendingExcerptDraft) => void;
  onDiscardDraft: (id: string) => void;
  onEndSession: (note: string, nextFocusItemId?: string) => void;
}) {
  const [tab, setTab] = useState<"focus" | "attention" | "session" | "recovery">("focus");
  const [candidateKind, setCandidateKind] = useState<FocusItemKind>("document");
  const [candidateId, setCandidateId] = useState("");
  const [checkpointLabel, setCheckpointLabel] = useState("");
  const [endNote, setEndNote] = useState(projectState.endSessionNote ?? "");
  const [nextItem, setNextItem] = useState(projectState.nextFocusItemId ?? "");
  const candidates = useMemo(() => candidateKind === "document"
    ? documents.map((item) => ({ id: item.id, label: item.title, detail: item.authors || item.fileName }))
    : candidateKind === "excerpt"
      ? excerpts.map((item) => ({ id: item.id, label: truncate(item.text || "Image excerpt", 80), detail: documents.find((doc) => doc.id === item.documentId)?.fileName ?? "Excerpt" }))
      : candidateKind === "claim"
        ? claims.map((item) => ({ id: item.id, label: truncate(item.text, 90), detail: `${item.status} · ${item.evidence.length} evidence links` }))
        : sections.map((item) => ({ id: item.id, label: item.title, detail: `${item.claimIds.length} claims · ${item.excerptIds.length} excerpts` })), [candidateKind, claims, documents, excerpts, sections]);
  const selectedCandidate = candidates.find((item) => item.id === candidateId);
  const completed = projectState.focusItems.filter((item) => item.completed).length;
  const targetProgress = settings.sessionTargetKind === "minutes" ? sessionElapsedMinutes : settings.sessionTargetKind === "items" ? completed : 0;
  const targetPercent = settings.sessionTargetKind === "none" ? 0 : Math.min(100, Math.round(targetProgress / settings.sessionTargetValue * 100));
  function addCandidate() {
    if (!selectedCandidate || projectState.focusItems.some((item) => item.kind === candidateKind && item.targetId === selectedCandidate.id)) return;
    onUpdateProject({ focusItems: [...projectState.focusItems, { id: `focus-${crypto.randomUUID()}`, kind: candidateKind, targetId: selectedCandidate.id, label: selectedCandidate.label, detail: selectedCandidate.detail, completed: false, addedAt: new Date().toISOString() }] });
    setCandidateId("");
  }
  function move(index: number, direction: -1 | 1) {
    const next = [...projectState.focusItems];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onUpdateProject({ focusItems: next });
  }
  return (
    <Modal description="Reduce context switching, keep a deliberate work queue, and finish sessions without losing your place." icon={<Coffee />} onClose={onClose} size="large" title="Research support center">
      <div className="ergonomics-hub">
        <nav className="ergonomics-tabs" aria-label="Research support"><button aria-pressed={tab === "focus"} onClick={() => setTab("focus")} type="button"><ListChecks size={15} /> Focus lane <span>{projectState.focusItems.length}</span></button><button aria-pressed={tab === "attention"} onClick={() => setTab("attention")} type="button"><AlertTriangle size={15} /> Attention <span>{attention.length}</span></button><button aria-pressed={tab === "session"} onClick={() => setTab("session")} type="button"><Clock3 size={15} /> Session</button><button aria-pressed={tab === "recovery"} onClick={() => setTab("recovery")} type="button"><History size={15} /> Recovery <span>{projectState.drafts.length + projectState.recoveryCheckpoints.length}</span></button></nav>
        {tab === "focus" && <section className="support-panel"><header><div><h3>Focus lane</h3><p>A temporary, reorderable path through the material you intend to handle next.</p></div><span>{completed}/{projectState.focusItems.length} complete</span></header><div className="focus-add-row"><select aria-label="Item type" onChange={(event) => { setCandidateKind(event.target.value as FocusItemKind); setCandidateId(""); }} value={candidateKind}><option value="document">Document</option><option value="excerpt">Excerpt</option><option value="claim">Claim</option><option value="section">Draft section</option></select><select aria-label="Item to add" onChange={(event) => setCandidateId(event.target.value)} value={candidateId}><option value="">Choose an item…</option>{candidates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button className="button compact" disabled={!selectedCandidate} onClick={addCandidate} type="button"><Plus size={13} /> Add</button></div><div className="focus-lane">{projectState.focusItems.map((item, index) => <article className={item.completed ? "completed" : ""} key={item.id}><button aria-label={item.completed ? "Mark incomplete" : "Mark complete"} className="focus-check" onClick={() => onUpdateProject({ focusItems: projectState.focusItems.map((entry) => entry.id === item.id ? { ...entry, completed: !entry.completed } : entry) })} type="button">{item.completed ? <Check size={14} /> : null}</button><button className="focus-open" onClick={() => onOpenFocusItem(item)} type="button">{itemIcon(item.kind)}<span><strong>{item.label}</strong><small>{item.kind} · {item.detail}</small></span></button><div className="focus-order"><button aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} type="button"><ArrowUp size={12} /></button><button aria-label="Move down" disabled={index === projectState.focusItems.length - 1} onClick={() => move(index, 1)} type="button"><ArrowDown size={12} /></button><button aria-label="Remove from focus lane" onClick={() => onUpdateProject({ focusItems: projectState.focusItems.filter((entry) => entry.id !== item.id) })} type="button"><Trash2 size={12} /></button></div></article>)}{!projectState.focusItems.length && <p className="support-empty">Your focus lane is empty. Add only what you intend to work on in this session.</p>}</div></section>}
        {tab === "attention" && <section className="support-panel"><header><div><h3>What needs attention</h3><p>Items clear when addressed. Dismissed items return if the underlying issue changes.</p></div><span>{attention.length} items</span></header>{Object.keys(projectState.dismissedAttention ?? {}).length > 0 && <button className="button compact" onClick={onRestoreDismissedAttention} type="button">Restore dismissed items</button>}<div className="attention-list">{attention.map((item) => <div className="attention-row" key={item.id}><button onClick={() => onOpenAttentionItem(item)} type="button"><AlertTriangle size={14} /><span><strong>{item.title}</strong><small>{item.detail}</small></span></button><button aria-label={`Dismiss ${item.title}`} className="icon-button subtle" onClick={() => onDismissAttentionItem(item)} title="Dismiss until this issue changes" type="button"><X size={14} /></button></div>)}{!attention.length && <p className="support-empty"><CheckCircle2 size={17} /> No current quality or continuity flags.</p>}</div></section>}
        {tab === "session" && <section className="support-panel session-support"><header><div><h3>Session support</h3><p>Targets and breaks are optional, private, and never used for streaks or scoring.</p></div><span>{sessionElapsedMinutes} min</span></header><div className="session-progress"><div><strong>{settings.sessionTargetKind === "none" ? "No target" : `${targetProgress} / ${settings.sessionTargetValue} ${settings.sessionTargetKind}`}</strong><span>{settings.sessionTargetKind === "none" ? "Choose a target in Settings if it helps." : `${targetPercent}% of this session's optional target`}</span></div><i><b style={{ width: `${targetPercent}%` }} /></i></div><div className="session-actions">{projectState.sessionStartedAt ? <button className="button" onClick={() => onUpdateProject({ sessionStartedAt: undefined })} type="button"><Pause size={14} /> Pause session</button> : <button className="button primary" onClick={() => onUpdateProject({ sessionStartedAt: new Date().toISOString(), sessionCompletedItems: 0, lastBreakAt: new Date().toISOString() })} type="button"><Play size={14} /> Start session</button>}<button className="button" onClick={() => onUpdateProject({ lastBreakAt: new Date().toISOString() })} type="button"><Coffee size={14} /> I took a break</button></div><div className="end-session-card"><label className="field"><span>Private handoff note</span><textarea onChange={(event) => setEndNote(event.target.value)} placeholder="What was decided, and what remains unresolved?" rows={4} value={endNote} /></label><label className="field"><span>Start here next time</span><select onChange={(event) => setNextItem(event.target.value)} value={nextItem}><option value="">No specific item</option>{projectState.focusItems.filter((item) => !item.completed).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button className="button primary" onClick={() => onEndSession(endNote, nextItem || undefined)} type="button"><Save size={14} /> End session and save handoff</button></div></section>}
        {tab === "recovery" && <section className="support-panel recovery-support"><header><div><h3>Drafts and checkpoints</h3><p>Recover unfinished excerpt work or restore graph and synthesis workspace state.</p></div>{projectState.recoveryCheckpoints.length > 0 && <button className="button compact" onClick={() => onDeleteCheckpoint()} type="button">Clear checkpoints</button>}</header><div className="checkpoint-create"><input onChange={(event) => setCheckpointLabel(event.target.value)} placeholder="Checkpoint label (optional)" value={checkpointLabel} /><button className="button compact" onClick={() => { onCreateCheckpoint(checkpointLabel.trim() || "Manual checkpoint"); setCheckpointLabel(""); }} type="button"><Save size={13} /> Create checkpoint</button></div>{projectState.drafts.length > 0 && <div className="support-group"><h4>Unfinished drafts</h4>{projectState.drafts.map((draft) => <article className="recovery-row" key={draft.id}><FileText size={14} /><span><strong>{truncate(draft.text || "Image excerpt", 90)}</strong><small>Updated {formatDate(draft.updatedAt)}</small></span><button className="button compact" onClick={() => onOpenDraft(draft)} type="button">Resume</button><button aria-label="Discard draft" className="icon-button subtle danger-on-hover" onClick={() => onDiscardDraft(draft.id)} type="button"><Trash2 size={13} /></button></article>)}</div>}<div className="support-group"><h4>Recovery checkpoints</h4>{projectState.recoveryCheckpoints.map((checkpoint) => <article className="recovery-row" key={checkpoint.id}><History size={14} /><span><strong>{checkpoint.label}</strong><small>{formatDate(checkpoint.savedAt)} · graph and synthesis state</small></span><button className="button compact" onClick={() => onRestoreCheckpoint(checkpoint.id)} type="button"><RotateCcw size={13} /> Restore</button><button aria-label={`Delete checkpoint ${checkpoint.label}`} className="icon-button subtle danger-on-hover" onClick={() => onDeleteCheckpoint(checkpoint.id)} type="button"><Trash2 size={13} /></button></article>)}{!projectState.recoveryCheckpoints.length && <p className="support-empty">No recovery checkpoints yet. Manual Save and end-session handoff create them automatically.</p>}</div></section>}
      </div>
    </Modal>
  );
}

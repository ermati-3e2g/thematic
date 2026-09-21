export type DocumentKind = "pdf" | "markdown";
export type DocumentType = "article" | "book" | "chapter" | "thesis" | "report" | "web" | "other";
export type ExcerptKind = "text" | "image";
export type ReaderTool = "highlight" | "image" | "select";

export interface ResearchProject {
  id: string;
  title: string;
  folderPath?: string;
  createdAt: string;
}

export interface ProjectSource {
  id: string;
  projectId: string;
  kind: "folder" | "file";
  path: string;
  label: string;
  createdAt: string;
}

export interface ResearchDocument {
  id: string;
  projectId: string;
  title: string;
  fileName: string;
  path: string;
  kind: DocumentKind;
  authors: string;
  publicationDate: string;
  doi: string;
  journal?: string;
  abstract?: string;
  documentType?: DocumentType;
  citationKey?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  bibEntry?: string;
  addedAt: string;
  pageCount?: number;
  content?: string;
  fileAvailable?: boolean;
  fileHash?: string;
}

export interface Theme {
  id: string;
  projectId: string;
  name: string;
  color: string;
  description?: string;
  parentId?: string;
  parentLabel?: string;
  createdAt: string;
}

export interface Excerpt {
  id: string;
  documentId: string;
  text: string;
  annotation: string;
  annotationFormat?: "plain" | "markdown";
  page?: number;
  locator?: string;
  createdAt: string;
  updatedAt: string;
  themeIds: string[];
  kind?: ExcerptKind;
  color?: string;
  imageData?: string;
}

export type RelationshipKind = "excerpt-theme" | "theme-parent" | "theme-peer" | "excerpt-excerpt";
export type RelationshipLineStyle = "solid" | "dashed" | "dotted" | "double";

export interface GraphRelationshipStyle {
  color: string;
  lineStyle: RelationshipLineStyle;
}

export interface GraphRelationship {
  id: string;
  projectId: string;
  kind: RelationshipKind;
  sourceId: string;
  targetId: string;
  label: string;
  createdAt: string;
}

export type GraphLabelMode = "hover" | "relationships" | "excerpts" | "themes" | "all" | "none" | "custom";
export type GraphObjectKind = "theme" | "excerpt" | "annotation";

export interface GraphAnnotationLink {
  id: string;
  targetKind: GraphObjectKind;
  targetId: string;
}

export interface GraphAnnotation {
  id: string;
  projectId: string;
  text: string;
  format: "plain" | "markdown";
  color: string;
  fontSize: number;
  width: number;
  height: number;
  x: number;
  y: number;
  collapsed: boolean;
  pinned: boolean;
  links: GraphAnnotationLink[];
  createdAt: string;
  updatedAt: string;
}

export interface GraphWorkspaceState {
  labelMode: GraphLabelMode;
  zoom: number;
  nodeScale: number;
  nodePositions: Record<string, { x: number; y: number }>;
  pinnedLabels: string[];
  annotations: GraphAnnotation[];
  showAnnotations: boolean;
  relationshipStyles?: Record<string, GraphRelationshipStyle>;
  themeShape?: GraphNodeShape;
  excerptShape?: GraphNodeShape;
  layoutSettings?: GraphLayoutSettings;
}

export type GraphNodeShape = "circle" | "square" | "diamond" | "hexagon";
export type GraphLayoutAlgorithm = "layered" | "stress" | "force" | "radial" | "mrtree";
export interface GraphLayoutSettings {
  algorithm: GraphLayoutAlgorithm;
  direction: "RIGHT" | "DOWN" | "LEFT" | "UP";
  nodeSpacing: number;
  componentSpacing: number;
  layerSpacing: number;
  aspectRatio: number;
  iterations: number;
  forceRepulsion: number;
  desiredEdgeLength: number;
  radialRadius: number;
  compactTree: boolean;
}

export type ReviewStatus = "inbox" | "to-read" | "reading" | "included" | "excluded" | "completed";
export type ClaimStatus = "tentative" | "supported" | "disputed" | "rejected";
export type EvidenceRole = "supports" | "contradicts" | "qualifies" | "defines" | "method";
export type ExtractionFieldType = "text" | "number" | "boolean" | "date" | "category";

export interface DocumentReviewRecord {
  documentId: string;
  status: ReviewStatus;
  exclusionReason: string;
  priority: "low" | "normal" | "high";
  progress: number;
  notes: string;
  updatedAt: string;
}

export interface ExtractionField {
  id: string;
  name: string;
  type: ExtractionFieldType;
  options: string[];
}

export interface ExtractionCell {
  value: string;
  excerptIds: string[];
  /** Kept for portable projects created before multi-evidence extraction. */
  excerptId?: string;
}

export interface ExtractionRecord {
  documentId: string;
  cells: Record<string, ExtractionCell>;
}

export interface ClaimEvidence {
  excerptId: string;
  role: EvidenceRole;
}

export interface ResearchClaim {
  id: string;
  text: string;
  status: ClaimStatus;
  confidence: number;
  notes: string;
  themeIds: string[];
  evidence: ClaimEvidence[];
  createdAt: string;
  updatedAt: string;
}

export interface SynthesisSection {
  id: string;
  title: string;
  content: string;
  claimIds: string[];
  excerptIds: string[];
  collapsed?: boolean;
}

export interface SavedResearchView {
  id: string;
  name: string;
  query: string;
  status: ReviewStatus | "all";
  sort?: "title" | "status" | "included-first" | "excluded-first" | "priority" | "progress";
}

export interface SynthesisWorkspaceState {
  researchQuestion: string;
  scope: string;
  inclusionCriteria: string;
  exclusionCriteria: string;
  reviews: DocumentReviewRecord[];
  extractionFields: ExtractionField[];
  extractionRecords: ExtractionRecord[];
  claims: ResearchClaim[];
  sections: SynthesisSection[];
  savedViews: SavedResearchView[];
}

export interface AiSettings {
  enabled: boolean;
  provider: "ollama" | "llama_cpp";
  model: string;
  endpoint: string;
  llamaExecutable?: string;
  llamaModelPath?: string;
  llamaMmprojPath?: string;
  llamaServerArguments?: string;
  llamaEnableVision?: boolean;
  autoSuggest: boolean;
  defaultNoteFormat: "plain" | "markdown";
  graphLabelMode: GraphLabelMode;
  graphZoom: number;
  graphNodeScale: number;
  defaultReaderZoom?: number;
  defaultExcerptColor?: string;
  defaultNoteColor?: string;
  defaultThemeShape?: GraphNodeShape;
  defaultExcerptShape?: GraphNodeShape;
  defaultGraphLayout?: GraphLayoutAlgorithm;
  onlineCitationLookup?: boolean;
  citationContactEmail?: string;
  graphNodePositions: Record<string, { x: number; y: number }>;
  graphPinnedLabels: string[];
  graphWorkspaces: Record<string, GraphWorkspaceState>;
  synthesisWorkspaces: Record<string, SynthesisWorkspaceState>;
  synthesisTabs?: Record<string, "protocol" | "screening" | "extraction" | "claims" | "draft" | "health">;
  appTheme?: "archive" | "oxford" | "forest" | "clay" | "midnight" | "burgundy" | "slate";
  fontSet?: "classic" | "scholarly" | "humanist";
  uiFontScale?: number;
  ergonomics?: ErgonomicsSettings;
  libraryGroups?: Record<string, Record<string, string>>;
  libraryDirectories?: Record<string, string[]>;
  librarySourceRoots?: Record<string, Record<string, string>>;
  libraryDirectoryLayoutVersion?: Record<string, number>;
  libraryTreeHeights?: Record<string, number>;
}

export type WorkspaceDensity = "comfortable" | "compact" | "presentation";
export type FocusItemKind = "document" | "excerpt" | "claim" | "section";
export type SessionTargetKind = "none" | "minutes" | "items";

export interface FocusItem {
  id: string;
  kind: FocusItemKind;
  targetId: string;
  label: string;
  detail?: string;
  completed: boolean;
  addedAt: string;
}

export interface SessionCheckpoint {
  projectId: string;
  view: WorkspaceView;
  documentId?: string;
  excerptId?: string;
  synthesisTab?: "protocol" | "screening" | "extraction" | "claims" | "draft" | "health";
  folderFilter?: string;
  readerAsideCollapsed?: boolean;
  savedAt: string;
}

export interface RecoveryCheckpoint {
  id: string;
  projectId: string;
  label: string;
  savedAt: string;
  session?: SessionCheckpoint;
  graphWorkspace?: GraphWorkspaceState;
  synthesisWorkspace?: SynthesisWorkspaceState;
}

export interface PendingExcerptDraft extends SelectionDraft {
  id: string;
  documentId: string;
  excerptId?: string;
  annotation?: string;
  annotationFormat?: "plain" | "markdown";
  themeIds?: string[];
  color?: string;
  updatedAt: string;
}

export interface ErgonomicsProjectState {
  focusItems: FocusItem[];
  checkpoint?: SessionCheckpoint;
  recoveryCheckpoints: RecoveryCheckpoint[];
  drafts: PendingExcerptDraft[];
  sessionStartedAt?: string;
  sessionCompletedItems: number;
  lastBreakAt?: string;
  endSessionNote?: string;
  nextFocusItemId?: string;
  lastExcerptColor?: string;
  lastThemeIds?: string[];
  dismissedAttention?: Record<string, string>;
}

export interface ErgonomicsSettings {
  density: WorkspaceDensity;
  showResumePrompt: boolean;
  breakReminders: boolean;
  breakIntervalMinutes: number;
  sessionTargetKind: SessionTargetKind;
  sessionTargetValue: number;
  quickCapture: boolean;
  projects: Record<string, ErgonomicsProjectState>;
}

export interface LibrarySnapshot {
  projects: ResearchProject[];
  projectSources: ProjectSource[];
  documents: ResearchDocument[];
  excerpts: Excerpt[];
  themes: Theme[];
  relationships: GraphRelationship[];
  settings: AiSettings;
}

export interface RelinkCandidate {
  path: string;
  fileName: string;
  hashMatches: boolean;
}

export interface DocumentPayload {
  kind: DocumentKind;
  content?: string;
  bytesBase64?: string;
  mimeType?: string;
  url?: string;
}

export interface SelectionDraft {
  id?: string;
  documentId?: string;
  excerptId?: string;
  text: string;
  page?: number;
  locator?: string;
  kind?: ExcerptKind;
  imageData?: string;
  annotation?: string;
  annotationFormat?: "plain" | "markdown";
  themeIds?: string[];
  color?: string;
  updatedAt?: string;
}

export interface ToastMessage {
  id: string;
  tone: "success" | "error" | "info";
  title: string;
  message?: string;
}

export type WorkspaceView = "reader" | "themes" | "synthesis";
export type ThemeView = "graph" | "list";
export type ExportFormat = "csv" | "xlsx" | "sqlite" | "zip" | "thematic";
export interface ExportOptions {
  sourceMode?: "none" | "used" | "all";
  usedDocumentIds?: string[];
}

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, FileQuestion, Highlighter, Image as ImageIcon, LoaderCircle, Minus, MousePointer2, Plus, RotateCcw } from "lucide-react";
import { GlobalWorkerOptions, TextLayer, getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { DocumentPayload, Excerpt, ReaderTool, ResearchDocument, SelectionDraft } from "../types";

GlobalWorkerOptions.workerSrc = pdfWorker;

interface DocumentViewerProps {
  document: ResearchDocument;
  payload?: DocumentPayload;
  excerpts: Excerpt[];
  loading: boolean;
  error?: string;
  onSelection: (draft: SelectionDraft) => void;
  onCancelSelection: () => void;
  pendingSelection?: SelectionDraft;
  onOpenExcerpt: (excerptId: string) => void;
  targetExcerptId?: string;
  revealRequest?: string;
  initialZoom?: number;
  defaultExcerptColor?: string;
}

function normalizeSelection(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function scrollTargetWithinReader(container: HTMLElement | null, target: HTMLElement | null, behavior: ScrollBehavior = "smooth") {
  if (!container || !target) return;
  const containerBounds = container.getBoundingClientRect();
  const targetBounds = target.getBoundingClientRect();
  const top = container.scrollTop + targetBounds.top - containerBounds.top - (container.clientHeight - targetBounds.height) / 2;
  const left = container.scrollLeft + targetBounds.left - containerBounds.left - (container.clientWidth - targetBounds.width) / 2;
  container.scrollTo({
    top: Math.max(0, top),
    left: Math.max(0, left),
    behavior,
  });
}

function useReaderPan() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ x: number; y: number; left: number; top: number } | undefined>(undefined);
  const [panning, setPanning] = useState(false);
  return {
    scrollRef,
    panning,
    startPan(event: ReactPointerEvent<HTMLDivElement>) {
      if (event.button !== 1) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panStart.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
      setPanning(true);
    },
    movePan(event: ReactPointerEvent<HTMLDivElement>) {
      const start = panStart.current;
      if (!start) return;
      event.currentTarget.scrollLeft = start.left - (event.clientX - start.x);
      event.currentTarget.scrollTop = start.top - (event.clientY - start.y);
    },
    endPan() { panStart.current = undefined; setPanning(false); },
  };
}

function ReaderZoomControls({ zoom, onChange, resetTo = 1 }: { zoom: number; onChange: (zoom: number) => void; resetTo?: number }) {
  return <div className="reader-zoom-controls"><button aria-label="Zoom out" onClick={() => onChange(Math.max(.5, zoom - .1))} type="button"><Minus size={14} /></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => onChange(Math.min(2, zoom + .1))} type="button"><Plus size={14} /></button><button aria-label="Reset reader zoom" onClick={() => onChange(resetTo)} title="Reset to workspace default" type="button"><RotateCcw size={13} /></button></div>;
}

function useReaderZoom(initialZoom: number, scrollRef: RefObject<HTMLDivElement | null>) {
  const [zoom, setZoom] = useState(initialZoom);
  const zoomRef = useRef(initialZoom);
  const applyZoom = (requested: number, clientX?: number, clientY?: number) => {
    const next = Math.max(.5, Math.min(2, Math.round(requested * 100) / 100));
    const container = scrollRef.current;
    const previous = zoomRef.current;
    if (!container || next === previous) return;
    const rect = container.getBoundingClientRect();
    const x = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const y = (clientY ?? rect.top + rect.height / 2) - rect.top;
    const contentX = (container.scrollLeft + x) / previous;
    const contentY = (container.scrollTop + y) / previous;
    zoomRef.current = next;
    setZoom(next);
    requestAnimationFrame(() => { container.scrollLeft = contentX * next - x; container.scrollTop = contentY * next - y; });
  };
  const applyZoomRef = useRef(applyZoom);
  applyZoomRef.current = applyZoom;
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      applyZoomRef.current(zoomRef.current + (event.deltaY < 0 ? .1 : -.1), event.clientX, event.clientY);
    };
    const keys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const next = event.key === "0" ? initialZoom : event.key === "+" || event.key === "=" ? zoomRef.current + .1 : event.key === "-" || event.key === "_" ? zoomRef.current - .1 : undefined;
      if (next === undefined) return;
      event.preventDefault();
      applyZoomRef.current(next);
    };
    container.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", keys);
    return () => { container.removeEventListener("wheel", wheel); window.removeEventListener("keydown", keys); };
  });
  return { zoom, setZoom: applyZoom };
}

function useSelectionCapture(
  rootRef: RefObject<HTMLDivElement | null>,
  onSelection: (draft: SelectionDraft) => void,
) {
  return (event?: ReactMouseEvent | ReactKeyboardEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const text = normalizeSelection(selection.toString());
    if (text.length < 3) return;
    const range = selection.getRangeAt(0);
    if (!rootRef.current?.contains(range.commonAncestorContainer)) return;

    const element =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement;
    const pageElement = element?.closest<HTMLElement>("[data-page-number]");
    const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
      ? (range.endContainer as Element)
      : range.endContainer.parentElement;
    const endPageElement = endElement?.closest<HTMLElement>("[data-page-number]");
    if (pageElement && endPageElement && pageElement !== endPageElement) return;
    const page = pageElement?.dataset.pageNumber ? Number(pageElement.dataset.pageNumber) : undefined;
    const scope = pageElement ?? element?.closest<HTMLElement>(".markdown-page") ?? rootRef.current;
    let characterRange = "";
    if (scope) {
      try {
        const before = document.createRange();
        before.selectNodeContents(scope);
        before.setEnd(range.startContainer, range.startOffset);
        const through = document.createRange();
        through.selectNodeContents(scope);
        through.setEnd(range.endContainer, range.endOffset);
        characterRange = `chars:${before.toString().length}-${through.toString().length}`;
      } catch {
        // Exact quote plus page/heading remains a durable fallback locator.
      }
    }
    let locator = page ? `page:${page}${characterRange ? `;${characterRange}` : ""}` : undefined;
    if (!page) {
      const target = element ?? (event?.target instanceof Element ? event.target : null);
      const section = target?.closest<HTMLElement>(".markdown-page");
      const headings = section ? Array.from(section.querySelectorAll("h1, h2, h3")) : [];
      const targetRect = target?.getBoundingClientRect();
      const heading = headings
        .filter((item) => !targetRect || item.getBoundingClientRect().top <= targetRect.top)
        .at(-1);
      const headingText = heading?.textContent?.trim() || "Markdown selection";
      locator = `${headingText}${characterRange ? ` · ${characterRange}` : ""}`;
    }
    onSelection({ text, page, locator });
  };
}

function markString(value: string, excerpts: Excerpt[], onOpenExcerpt: (id: string) => void): ReactNode {
  const matches = excerpts
    .map((excerpt) => ({ excerpt, index: value.indexOf(excerpt.text) }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index || b.excerpt.text.length - a.excerpt.text.length);
  if (!matches.length) return value;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.index < cursor) continue;
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));
    nodes.push(
      <mark
        className="saved-highlight"
        data-excerpt-id={match.excerpt.id}
        key={`${match.excerpt.id}-${match.index}`}
        title="Open saved excerpt"
        onClick={(event) => {
          event.stopPropagation();
          onOpenExcerpt(match.excerpt.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenExcerpt(match.excerpt.id);
          }
        }}
        role="button"
        style={{ "--highlight-color": match.excerpt.color ?? "#efd982" } as React.CSSProperties}
        tabIndex={0}
      >
        {match.excerpt.text}
      </mark>,
    );
    cursor = match.index + match.excerpt.text.length;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

function decorateChildren(
  children: ReactNode,
  excerpts: Excerpt[],
  onOpenExcerpt: (id: string) => void,
): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") return markString(child, excerpts, onOpenExcerpt);
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<{ children?: ReactNode }>;
    if (element.props.children == null) return child;
    return cloneElement(element, {
      children: decorateChildren(element.props.children, excerpts, onOpenExcerpt),
    });
  });
}

function MarkdownContent({
  content,
  excerpts,
  onOpenExcerpt,
  pageNumber,
}: {
  content: string;
  excerpts: Excerpt[];
  onOpenExcerpt: (id: string) => void;
  pageNumber?: number;
}) {
  const components = useMemo(
    () => ({
      p: ({ children }: { children?: ReactNode }) => (
        <p>{decorateChildren(children, excerpts, onOpenExcerpt)}</p>
      ),
      li: ({ children }: { children?: ReactNode }) => (
        <li>{decorateChildren(children, excerpts, onOpenExcerpt)}</li>
      ),
      blockquote: ({ children }: { children?: ReactNode }) => (
        <blockquote>{decorateChildren(children, excerpts, onOpenExcerpt)}</blockquote>
      ),
    }),
    [excerpts, onOpenExcerpt],
  );

  return (
    <article className="markdown-page" data-page-number={pageNumber}>
      {pageNumber && <span className="folio">{pageNumber}</span>}
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </article>
  );
}

function TextDocument({
  document,
  content,
  excerpts,
  onSelection,
  onOpenExcerpt,
  targetExcerptId,
  revealRequest,
  initialZoom = 1,
}: {
  document: ResearchDocument;
  content: string;
  excerpts: Excerpt[];
  onSelection: (draft: SelectionDraft) => void;
  onOpenExcerpt: (id: string) => void;
  targetExcerptId?: string;
  revealRequest?: string;
  initialZoom?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const capture = useSelectionCapture(rootRef, onSelection);
  const [tool, setTool] = useState<ReaderTool>("highlight");
  const pan = useReaderPan();
  const { zoom, setZoom } = useReaderZoom(initialZoom, pan.scrollRef);
  const pages = document.kind === "pdf" ? content.split(/\n---PAGE---\n/g) : [content];
  useEffect(() => {
    if (!targetExcerptId) return;
    const frame = requestAnimationFrame(() => {
      const target = rootRef.current?.querySelector<HTMLElement>(`[data-excerpt-id="${CSS.escape(targetExcerptId)}"]`) ?? null;
      scrollTargetWithinReader(pan.scrollRef.current, target);
    });
    return () => cancelAnimationFrame(frame);
  }, [targetExcerptId, revealRequest, excerpts]);

  return (
    <div className={`document-scroll ${document.kind === "pdf" ? "simulated-pdf" : "markdown-document"} ${pan.panning ? "panning" : ""}`} onAuxClick={(event) => event.preventDefault()} onPointerCancel={pan.endPan} onPointerDown={pan.startPan} onPointerMove={pan.movePan} onPointerUp={pan.endPan} ref={pan.scrollRef}>
      <div className="reader-toolbox" aria-label="Excerpt tool">
        <button aria-pressed={tool === "highlight"} onClick={() => setTool("highlight")} title="Highlight text" type="button"><Highlighter size={15} /><span>Text</span></button>
        <button disabled title="Image excerpts are available for PDF pages" type="button"><ImageIcon size={15} /><span>Image</span></button>
        <button aria-pressed={tool === "select"} onClick={() => setTool("select")} title="Select and copy without creating an excerpt" type="button"><MousePointer2 size={15} /><span>Select / Copy</span></button>
        <ReaderZoomControls onChange={setZoom} resetTo={initialZoom} zoom={zoom} />
        <small>{tool === "select" ? "Select text and press Ctrl + C to copy." : <>Select text, or press <kbd>Ctrl</kbd> + <kbd>Enter</kbd>.</>}</small>
      </div>
      <div
        ref={rootRef}
        className="document-pages"
        style={{ zoom }}
        onKeyDown={(event) => {
          if (tool === "highlight" && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            capture(event);
          }
        }}
        onMouseUp={(event) => { if (tool === "highlight") capture(event); }}
        tabIndex={0}
      >
        {pages.map((page, index) => (
          <MarkdownContent
            content={page}
            excerpts={excerpts.filter((excerpt) => !excerpt.page || excerpt.page === index + 1)}
            key={`${document.id}-page-${index}`}
            onOpenExcerpt={onOpenExcerpt}
            pageNumber={document.kind === "pdf" ? index + 1 : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function PdfPage({
  pdf,
  pageNumber,
  excerpts,
  onOpenExcerpt,
  tool,
  onImageSelection,
  cancelSignal,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  excerpts: Excerpt[];
  onOpenExcerpt: (id: string) => void;
  tool: ReaderTool;
  onImageSelection: (draft: SelectionDraft) => void;
  cancelSignal: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 760, height: 980 });
  const [pageError, setPageError] = useState<string>();
  const [drag, setDrag] = useState<{ startX: number; startY: number; x: number; y: number; width: number; height: number }>();

  useEffect(() => { setDrag(undefined); }, [cancelSignal]);

  function excerptRange(excerpt: Excerpt, spans: HTMLSpanElement[]) {
    const locator = excerpt.locator?.match(/chars:(\d+)-(\d+)/);
    if (locator) return { start: Number(locator[1]), end: Number(locator[2]) };
    const raw = spans.map((span) => span.textContent ?? "").join("");
    const normalized: string[] = [];
    const rawIndexes: number[] = [];
    let space = false;
    for (let index = 0; index < raw.length; index += 1) {
      if (/\s/.test(raw[index])) {
        if (!space && normalized.length) { normalized.push(" "); rawIndexes.push(index); }
        space = true;
      } else { normalized.push(raw[index]); rawIndexes.push(index); space = false; }
    }
    const needle = normalizeSelection(excerpt.text);
    const found = normalized.join("").indexOf(needle);
    if (found < 0) return undefined;
    return { start: rawIndexes[found], end: (rawIndexes[found + needle.length - 1] ?? raw.length - 1) + 1 };
  }

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined;
    let textLayer: TextLayer | undefined;
    async function renderPage() {
      try {
        setPageError(undefined);
        const page = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1.42, 760 / base.width);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const layer = textLayerRef.current;
        if (!canvas || !layer || cancelled) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setDimensions({ width: viewport.width, height: viewport.height });
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas rendering is unavailable.");
        renderTask = page.render({
          canvas,
          canvasContext: context,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
          viewport,
        });
        await renderTask.promise;

        layer.replaceChildren();
        layer.style.setProperty("--total-scale-factor", String(scale));
        const text = await page.getTextContent();
        textLayer = new TextLayer({ textContentSource: text, container: layer, viewport });
        await textLayer.render();
        const spans = textLayer.textDivs;
        const offsets: Array<{ start: number; end: number }> = [];
        let cursor = 0;
        spans.forEach((span) => { const start = cursor; cursor += span.textContent?.length ?? 0; offsets.push({ start, end: cursor }); });
        excerpts.filter((excerpt) => excerpt.page === pageNumber && excerpt.kind !== "image").forEach((excerpt) => {
          const range = excerptRange(excerpt, spans);
          if (!range) return;
          spans.forEach((span, index) => {
            if (offsets[index].end <= range.start || offsets[index].start >= range.end) return;
            span.classList.add("pdf-saved-highlight");
            span.dataset.excerptId = [span.dataset.excerptId, excerpt.id].filter(Boolean).join(" ");
            span.style.setProperty("--highlight-color", excerpt.color ?? "#efd982");
            span.tabIndex = 0;
            span.setAttribute("role", "button");
            span.setAttribute("aria-label", `Open saved excerpt: ${excerpt.text}`);
            span.title = excerpt.annotation || "Open saved excerpt";
            span.addEventListener("click", () => onOpenExcerpt(excerpt.id));
            span.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenExcerpt(excerpt.id); }
            });
          });
        });
      } catch (error) {
        if (!cancelled && (error as Error).name !== "RenderingCancelledException") {
          setPageError(error instanceof Error ? error.message : "Could not render page.");
        }
      }
    }
    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, pageNumber, excerpts, onOpenExcerpt]);

  function pointerPosition(event: ReactPointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)), y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)), bounds };
  }

  function finishImageSelection(event: ReactPointerEvent<HTMLElement>) {
    if (tool !== "image" || !drag) return;
    const { bounds } = pointerPosition(event);
    setDrag(undefined);
    if (drag.width < 12 || drag.height < 12) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratioX = canvas.width / bounds.width;
    const ratioY = canvas.height / bounds.height;
    const crop = document.createElement("canvas");
    crop.width = Math.max(1, Math.round(drag.width * ratioX));
    crop.height = Math.max(1, Math.round(drag.height * ratioY));
    crop.getContext("2d")?.drawImage(canvas, drag.x * ratioX, drag.y * ratioY, drag.width * ratioX, drag.height * ratioY, 0, 0, crop.width, crop.height);
    const x = drag.x / bounds.width * 100;
    const y = drag.y / bounds.height * 100;
    const width = drag.width / bounds.width * 100;
    const height = drag.height / bounds.height * 100;
    onImageSelection({ kind: "image", text: `Image excerpt from page ${pageNumber}`, page: pageNumber, locator: `page:${pageNumber};region:${x.toFixed(4)},${y.toFixed(4)},${width.toFixed(4)},${height.toFixed(4)}`, imageData: crop.toDataURL("image/png") });
  }

  return (
    <section
      className={`pdf-page ${tool === "image" ? "image-tool-active" : ""}`}
      data-page-number={pageNumber}
      style={{ width: dimensions.width, height: dimensions.height }}
      aria-label={`Page ${pageNumber}`}
      onPointerDown={(event) => { if (event.button !== 0 || tool !== "image" || (event.target as Element).closest(".saved-image-region")) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); const { x, y } = pointerPosition(event); setDrag({ startX: x, startY: y, x, y, width: 0, height: 0 }); }}
      onPointerMove={(event) => { if (tool !== "image" || !drag) return; const { x, y } = pointerPosition(event); setDrag({ ...drag, x: Math.min(drag.startX, x), y: Math.min(drag.startY, y), width: Math.abs(x - drag.startX), height: Math.abs(y - drag.startY) }); }}
      onPointerUp={finishImageSelection}
      onPointerCancel={() => setDrag(undefined)}
    >
      <canvas ref={canvasRef} />
      <div ref={textLayerRef} className="textLayer pdf-text-layer" />
      {excerpts.filter((excerpt) => excerpt.kind === "image" && excerpt.page === pageNumber && excerpt.locator?.includes("region:")).map((excerpt) => {
        const values = excerpt.locator!.split("region:")[1].split(",").map(Number);
        if (values.length !== 4 || values.some(Number.isNaN)) return null;
        return <button aria-label={`Open image excerpt from page ${pageNumber}`} className="saved-image-region" data-excerpt-id={excerpt.id} key={excerpt.id} onClick={(event) => { event.stopPropagation(); onOpenExcerpt(excerpt.id); }} style={{ left: `${values[0]}%`, top: `${values[1]}%`, width: `${values[2]}%`, height: `${values[3]}%`, "--highlight-color": excerpt.color ?? "#efd982" } as React.CSSProperties} title={excerpt.annotation || "Open saved image excerpt"} type="button" />;
      })}
      {drag && <span className="image-selection-rectangle" style={{ left: drag.x, top: drag.y, width: drag.width, height: drag.height }} />}
      <span className="folio">{pageNumber}</span>
      {pageError && <span className="page-render-error">Page {pageNumber}: {pageError}</span>}
    </section>
  );
}

function PdfDocument({
  source,
  excerpts,
  onSelection,
  onOpenExcerpt,
  targetExcerptId,
  revealRequest,
  onCancelSelection,
  initialZoom = 1,
}: {
  source: string | Uint8Array;
  excerpts: Excerpt[];
  onSelection: (draft: SelectionDraft) => void;
  onOpenExcerpt: (id: string) => void;
  targetExcerptId?: string;
  revealRequest?: string;
  onCancelSelection: () => void;
  initialZoom?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const capture = useSelectionCapture(rootRef, onSelection);
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [error, setError] = useState<string>();
  const [tool, setTool] = useState<ReaderTool>("highlight");
  const [cancelSignal, setCancelSignal] = useState(0);
  const pan = useReaderPan();
  const { zoom, setZoom } = useReaderZoom(initialZoom, pan.scrollRef);

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      window.getSelection()?.removeAllRanges();
      setCancelSignal((value) => value + 1);
      if (tool !== "select") onCancelSelection();
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [onCancelSelection, tool]);

  useEffect(() => {
    let cancelled = false;
    setPdf(undefined);
    setError(undefined);
    const task = getDocument(source instanceof Uint8Array ? { data: source } : source);
    task.promise
      .then((loaded) => {
        if (!cancelled) setPdf(loaded);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not open this PDF.");
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [source]);

  useEffect(() => {
    if (!targetExcerptId || !pdf) return;
    const excerpt = excerpts.find((item) => item.id === targetExcerptId);
    let attempts = 0;
    let timer = 0;
    const reveal = () => {
      attempts += 1;
      const exact = rootRef.current?.querySelector<HTMLElement>(`[data-excerpt-id~="${CSS.escape(targetExcerptId)}"]`);
      const fallback = excerpt?.page ? rootRef.current?.querySelector<HTMLElement>(`[data-page-number="${excerpt.page}"]`) : undefined;
      scrollTargetWithinReader(pan.scrollRef.current, exact ?? fallback ?? null, attempts === 1 ? "auto" : "smooth");
      if (exact || attempts >= 30) window.clearInterval(timer);
    };
    timer = window.setInterval(reveal, 150);
    reveal();
    return () => window.clearInterval(timer);
  }, [targetExcerptId, revealRequest, pdf, excerpts]);

  if (error) return <ViewerMessage icon={<AlertTriangle />} title="The PDF could not be rendered" detail={error} />;
  if (!pdf) return <ViewerLoading label="Opening PDF and preparing its text layer…" />;

  return (
    <div className={`document-scroll simulated-pdf ${pan.panning ? "panning" : ""}`} onAuxClick={(event) => event.preventDefault()} onPointerCancel={pan.endPan} onPointerDown={pan.startPan} onPointerMove={pan.movePan} onPointerUp={pan.endPan} ref={pan.scrollRef}>
      <div className="reader-toolbox" aria-label="Excerpt tool">
        <button aria-pressed={tool === "highlight"} onClick={() => setTool("highlight")} title="Highlight text" type="button"><Highlighter size={15} /><span>Text</span></button>
        <button aria-pressed={tool === "image"} onClick={() => setTool("image")} title="Capture a rectangular image region" type="button"><ImageIcon size={15} /><span>Image</span></button>
        <button aria-pressed={tool === "select"} onClick={() => setTool("select")} title="Select and copy without creating an excerpt" type="button"><MousePointer2 size={15} /><span>Select / Copy</span></button>
        <ReaderZoomControls onChange={setZoom} resetTo={initialZoom} zoom={zoom} />
        <small>{tool === "highlight" ? <>Select text, or press <kbd>Ctrl</kbd> + <kbd>Enter</kbd>.</> : tool === "image" ? "Drag a rectangle over one PDF page." : "Select text and press Ctrl + C to copy."}</small>
      </div>
      <div
        ref={rootRef}
        className="document-pages"
        style={{ zoom }}
        onKeyDown={(event) => {
          if (tool === "highlight" && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            capture(event);
          }
        }}
        onMouseUp={(event) => { if (tool === "highlight") capture(event); }}
        tabIndex={0}
      >
        {Array.from({ length: pdf.numPages }, (_, index) => (
          <PdfPage
            cancelSignal={cancelSignal}
            excerpts={excerpts}
            key={index + 1}
            onImageSelection={onSelection}
            onOpenExcerpt={onOpenExcerpt}
            pageNumber={index + 1}
            pdf={pdf}
            tool={tool}
          />
        ))}
      </div>
    </div>
  );
}

function ViewerLoading({ label }: { label: string }) {
  return (
    <div className="viewer-message" role="status">
      <LoaderCircle className="spin" />
      <strong>{label}</strong>
      <span>Large documents may take a moment.</span>
    </div>
  );
}

function ViewerMessage({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="viewer-message" role="alert">
      {icon}
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export default function DocumentViewer({
  document,
  payload,
  excerpts,
  loading,
  error,
  onSelection,
  onCancelSelection,
  pendingSelection,
  onOpenExcerpt,
  targetExcerptId,
  revealRequest,
  initialZoom = 1,
  defaultExcerptColor = "#efd982",
}: DocumentViewerProps) {
  const visibleExcerpts = useMemo(() => {
    if (!pendingSelection) return excerpts;
    const now = new Date().toISOString();
    return [...excerpts, {
      id: "pending-selection",
      documentId: document.id,
      text: pendingSelection.text,
      annotation: "Unsaved selection — Esc cancels",
      page: pendingSelection.page,
      locator: pendingSelection.locator,
      createdAt: now,
      updatedAt: now,
      themeIds: [],
      kind: pendingSelection.kind ?? "text",
      color: defaultExcerptColor,
      imageData: pendingSelection.imageData,
    } satisfies Excerpt];
  }, [defaultExcerptColor, document.id, excerpts, pendingSelection]);

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      window.getSelection()?.removeAllRanges();
      onCancelSelection();
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [onCancelSelection]);
  const pdfSource = useMemo(
    () => payload?.bytesBase64 ? decodeBase64(payload.bytesBase64) : payload?.url,
    [payload?.bytesBase64, payload?.url],
  );
  if (loading) return <ViewerLoading label="Opening document…" />;
  if (error) return <ViewerMessage icon={<AlertTriangle />} title="Document unavailable" detail={error} />;

  const content = payload?.content ?? document.content;
  if (pdfSource) {
    return (
      <PdfDocument
        excerpts={visibleExcerpts}
        key={document.id}
        onCancelSelection={onCancelSelection}
        onOpenExcerpt={onOpenExcerpt}
        onSelection={onSelection}
        initialZoom={initialZoom}
        source={pdfSource}
        targetExcerptId={targetExcerptId}
        revealRequest={revealRequest}
      />
    );
  }
  if (content) {
    return (
      <TextDocument
        content={content}
        document={document}
        excerpts={visibleExcerpts}
        onOpenExcerpt={onOpenExcerpt}
        onSelection={onSelection}
        initialZoom={initialZoom}
        targetExcerptId={targetExcerptId}
        revealRequest={revealRequest}
      />
    );
  }
  return (
    <ViewerMessage
      icon={<FileQuestion />}
      title="The source file is not available"
      detail="This browser remembers the catalogue record, but imported PDF bytes are kept only for the current session. Re-import its folder to continue reading."
    />
  );
}

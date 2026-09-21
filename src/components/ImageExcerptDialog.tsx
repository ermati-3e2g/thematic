import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Excerpt } from "../types";

export default function ImageExcerptDialog({ excerpt, sourceTitle, onClose }: { excerpt?: Pick<Excerpt, "imageData" | "page">; sourceTitle: string; onClose: () => void }) {
  useEffect(() => {
    if (!excerpt?.imageData) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [excerpt?.imageData, onClose]);
  if (!excerpt?.imageData) return null;
  return createPortal(<div className="image-preview-backdrop" onClick={onClose}><div aria-label="Image excerpt preview" aria-modal="true" className="image-preview-dialog" onClick={(event) => event.stopPropagation()} role="dialog"><header><div><strong>Image excerpt</strong><small>{sourceTitle}{excerpt.page ? ` · Page ${excerpt.page}` : ""}</small></div><button aria-label="Close image preview" autoFocus className="icon-button" onClick={onClose} type="button"><X size={18} /></button></header><img alt="Full-size captured document region" src={excerpt.imageData} /></div></div>, document.body);
}

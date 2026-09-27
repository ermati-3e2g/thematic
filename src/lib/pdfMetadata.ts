import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { DocumentPayload } from "../types";

GlobalWorkerOptions.workerSrc = pdfWorker;

const DOI_VALUE = /10\.\d{4,9}\/[-._;()/:a-z0-9]+/i;
const EXPLICIT_DOI = /(?:https?:\/\/(?:dx\.)?doi\.org\/|\bdoi\s*(?:[:=]|\s)\s*)(10\.\d{4,9}\/[-._;()/:a-z0-9]+)/gi;

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function cleanDoi(value: string): string {
  let doi = value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  doi = doi.replace(/[.,;:]+$/g, "");
  while (doi.endsWith(")") && (doi.match(/\(/g)?.length ?? 0) < (doi.match(/\)/g)?.length ?? 0)) doi = doi.slice(0, -1);
  while (doi.endsWith("]")) doi = doi.slice(0, -1);
  return doi;
}

function explicitDoiInText(value: string): string | undefined {
  EXPLICIT_DOI.lastIndex = 0;
  const match = EXPLICIT_DOI.exec(value);
  return match?.[1] ? cleanDoi(match[1]) : undefined;
}

function doiFromMetadata(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    if (!key.toLocaleLowerCase().includes("doi")) continue;
    const match = String(field ?? "").match(DOI_VALUE);
    if (match) return cleanDoi(match[0]);
  }
  return undefined;
}

/**
 * Detects only a DOI explicitly identified by PDF metadata, a DOI label, or a
 * doi.org URL. Bare DOI-looking strings are ignored because they are commonly
 * citations in the abstract or references rather than the current paper.
 */
export async function detectPdfDoi(payload: DocumentPayload): Promise<string | undefined> {
  if (payload.kind !== "pdf") return undefined;
  const source = payload.bytesBase64
    ? { data: decodeBase64(payload.bytesBase64) }
    : payload.url
      ? { url: payload.url }
      : undefined;
  if (!source) return undefined;

  const task = getDocument(source);
  const pdf = await task.promise;
  try {
    const metadata = await pdf.getMetadata();
    const infoDoi = doiFromMetadata(metadata.info);
    if (infoDoi) return infoDoi;
    const xmp = metadata.metadata as unknown as { getAll?: () => Record<string, unknown> } | null;
    const xmpFields = xmp?.getAll?.();
    const xmpDoi = doiFromMetadata(xmpFields) ?? explicitDoiInText(JSON.stringify(xmpFields ?? {}));
    if (xmpDoi) return xmpDoi;

    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(2, pdf.numPages); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const text = await page.getTextContent();
      pageTexts.push(text.items.map((item) => "str" in item ? item.str : "").join(" "));
    }
    const openingPages = pageTexts.join("\n");
    const introduction = openingPages.search(/\b(?:1\.?\s+)?introduction\b/i);
    const openingMaterial = openingPages.slice(0, introduction >= 0 ? introduction : 6_000);
    return explicitDoiInText(openingMaterial);
  } finally {
    await task.destroy();
  }
}

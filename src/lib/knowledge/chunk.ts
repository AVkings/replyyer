/**
 * Chunking Utility — splits long text into overlapping chunks
 * ~600 chars per chunk with 100-char overlap by default.
 * Why: prevents context-window overflow and improves cosine recall
 * (smaller chunks → tighter embedding similarity vs. one massive blob).
 */

export type ChunkOptions = {
  /** Target max characters per chunk (default 700) */
  chunkSize?: number;
  /** Overlap between consecutive chunks (default 100) */
  overlap?: number;
  /** Minimum chunk length to keep (default 80) */
  minChunkLength?: number;
};

const DEFAULTS: Required<ChunkOptions> = {
  chunkSize: 700,
  overlap: 100,
  minChunkLength: 80,
};

/**
 * Splits text on paragraph/sentence boundaries when possible.
 * Falls back to hard slice if a single paragraph exceeds chunkSize.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const { chunkSize, overlap, minChunkLength } = { ...DEFAULTS, ...opts };

  if (!text || typeof text !== "string") return [];
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Split on double newline (our scrape joins with \n\n) → paragraphs
  const paragraphs = normalized.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed.length >= minChunkLength) chunks.push(trimmed);
    current = "";
  };

  for (const para of paragraphs) {
    // If paragraph itself is huge, split it further on sentences
    const pieces: string[] =
      para.length > chunkSize ? splitLongParagraph(para, chunkSize) : [para];

    for (const piece of pieces) {
      const candidate = current ? `${current}\n\n${piece}` : piece;

      if (candidate.length <= chunkSize) {
        current = candidate;
      } else {
        // Flush current
        if (current) pushCurrent();
        // If piece alone is still too large (shouldn't happen due to splitLongParagraph), hard slice
        if (piece.length > chunkSize) {
          const hardSlices = hardSlice(piece, chunkSize, overlap);
          for (const s of hardSlices) chunks.push(s);
        } else {
          current = piece;
        }
      }
    }
  }

  if (current.trim().length >= minChunkLength) pushCurrent();

  // Add overlap: each chunk (except first) prepends tail of previous chunk
  if (overlap > 0 && chunks.length > 1) {
    const overlapped: string[] = [chunks[0]];
    for (let i = 1; i < chunks.length; i++) {
      const prevTail = chunks[i - 1].slice(-overlap);
      // Find a word boundary near the overlap start to avoid cutting words
      const boundaryIdx = prevTail.search(/\s/);
      const overlapText = boundaryIdx !== -1 ? prevTail.slice(boundaryIdx + 1) : prevTail;
      const withOverlap = overlapText ? `${overlapText} ${chunks[i]}` : chunks[i];
      // Prevent overlap from making chunk absurdly long
      overlapped.push(withOverlap.length > chunkSize + overlap ? chunks[i] : withOverlap);
    }
    return overlapped;
  }

  return chunks;
}

function splitLongParagraph(para: string, chunkSize: number): string[] {
  // Split on sentence boundaries: . ! ? followed by space
  const sentences = para.split(/(?<=[.!?])\s+/);
  if (sentences.length === 1) {
    // No sentence boundaries — hard slice
    return hardSlice(para, chunkSize, 0);
  }

  const pieces: string[] = [];
  let buf = "";
  for (const sent of sentences) {
    const cand = buf ? `${buf} ${sent}` : sent;
    if (cand.length <= chunkSize) {
      buf = cand;
    } else {
      if (buf) pieces.push(buf);
      // If single sentence > chunkSize, hard slice it
      if (sent.length > chunkSize) {
        pieces.push(...hardSlice(sent, chunkSize, 0));
        buf = "";
      } else {
        buf = sent;
      }
    }
  }
  if (buf) pieces.push(buf);
  return pieces;
}

function hardSlice(text: string, chunkSize: number, overlap: number): string[] {
  const slices: string[] = [];
  let start = 0;
  const step = Math.max(1, chunkSize - overlap);
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    const slice = text.slice(start, end).trim();
    if (slice.length >= 20) slices.push(slice);
    if (end >= text.length) break;
    start += step;
  }
  return slices;
}

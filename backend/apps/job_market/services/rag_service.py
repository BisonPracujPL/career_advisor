"""
RAG (Retrieval-Augmented Generation) service for the AI Career Advisor.

Stores Polish job-market PDF report chunks in PostgreSQL (pgvector) and
retrieves the most semantically relevant ones per user query.

Embedding model: paraphrase-multilingual-MiniLM-L12-v2
  - 384-dimensional dense vectors
  - Multilingual (50+ languages, including Polish)
  - Already present in the Docker image via sentence-transformers
  - CPU inference: ~30-80ms per batch of chunks

Usage — build the index once inside the running container:
    python manage.py build_rag_index --pdf-dir /app/rag_pdfs

Then chat.py calls retrieve_context() on every request.
"""

from __future__ import annotations

import logging
import re
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

# paraphrase-multilingual-MiniLM-L12-v2 — already in image, Polish-capable.
EMBEDDING_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
EMBEDDING_DIM = 384  # must match RagChunk.embedding dimensions

# Chunking parameters (in characters).
CHUNK_SIZE = 1200      # ~300-400 tokens per chunk
CHUNK_OVERLAP = 200    # character overlap between consecutive chunks

# How many chunks to retrieve per query.
DEFAULT_TOP_K = 6

# Minimum cosine similarity to include a chunk (0 = all, 1 = identical).
MIN_SIMILARITY = 0.25

# ── Lazy singletons ────────────────────────────────────────────────────────────
_encoder = None


def _get_encoder():
    """Return (and cache) the SentenceTransformer encoder."""
    global _encoder
    if _encoder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _encoder = SentenceTransformer(EMBEDDING_MODEL)
            logger.info("RAG: Loaded embedding model '%s'.", EMBEDDING_MODEL)
        except Exception as exc:
            logger.error("RAG: Could not load SentenceTransformer: %s", exc)
            _encoder = None
    return _encoder


def embed(texts: list[str]) -> list[list[float]] | None:
    """Embed a list of strings. Returns None on failure."""
    enc = _get_encoder()
    if enc is None:
        return None
    try:
        vecs = enc.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        return vecs.tolist()
    except Exception as exc:
        logger.warning("RAG: embed() failed: %s", exc)
        return None


# ── Text extraction ────────────────────────────────────────────────────────────

def _clean_text(raw: str) -> str:
    """Normalise whitespace and strip non-printable junk common in PDF extracts."""
    text = re.sub(r"\s+", " ", raw)
    # Keep Latin, extended Latin, Cyrillic, and common punctuation; drop the rest.
    text = re.sub(r"[^\x20-\x7E\u00C0-\u024F\u0100-\u017F\u0400-\u04FF\u2013\u2014\u2019\u201C\u201D]", " ", text)
    return text.strip()


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract all text from a PDF using pypdf (pure-Python, no system libs)."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(pdf_path))
        pages = []
        for page in reader.pages:
            raw = page.extract_text() or ""
            cleaned = _clean_text(raw)
            if cleaned:
                pages.append(cleaned)
        return "\n".join(pages)
    except Exception as exc:
        logger.warning("RAG: Failed to extract '%s': %s", pdf_path.name, exc)
        return ""


# ── Chunking ───────────────────────────────────────────────────────────────────

def chunk_text(
    text: str,
    source_name: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[dict]:
    """Split *text* into overlapping character-level chunks with metadata."""
    chunks = []
    start = 0
    idx = 0
    text_len = len(text)
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunk = text[start:end].strip()
        if len(chunk) > 60:  # skip tiny slivers
            chunks.append({"text": chunk, "source": source_name, "chunk_idx": idx})
            idx += 1
        start += chunk_size - overlap
    return chunks


# ── Index building ─────────────────────────────────────────────────────────────

def build_index(pdf_dir: str | Path, force: bool = False) -> int:
    """
    Index all PDFs in *pdf_dir* into the ``rag_chunks`` PostgreSQL table.

    Parameters
    ----------
    pdf_dir : path to the directory containing *.pdf files.
    force   : if True, delete all existing RagChunk rows and rebuild.

    Returns
    -------
    Number of chunks inserted.
    """
    from apps.job_market.models import RagChunk

    pdf_dir = Path(pdf_dir)
    if not pdf_dir.exists():
        raise FileNotFoundError(f"PDF directory not found: {pdf_dir}")

    pdf_files = sorted(pdf_dir.glob("*.pdf"))
    if not pdf_files:
        raise ValueError(f"No PDF files found in {pdf_dir}")

    encoder = _get_encoder()
    if encoder is None:
        raise RuntimeError(
            "Embedding model unavailable — is sentence-transformers installed?"
        )

    existing_count = RagChunk.objects.count()
    if existing_count > 0 and not force:
        logger.info(
            "RAG: %d chunks already indexed — skipping. Use force=True to rebuild.",
            existing_count,
        )
        return existing_count

    if force and existing_count > 0:
        logger.info("RAG: Deleting %d existing chunks (force rebuild).", existing_count)
        RagChunk.objects.all().delete()

    total_inserted = 0

    for i, pdf_path in enumerate(pdf_files, 1):
        t0 = time.perf_counter()
        logger.info("RAG: [%d/%d] Extracting '%s' …", i, len(pdf_files), pdf_path.name)

        text = extract_text_from_pdf(pdf_path)
        if not text:
            logger.warning("RAG:   → no text extracted, skipping.")
            continue

        source_name = pdf_path.stem
        chunks = chunk_text(text, source_name)
        if not chunks:
            logger.warning("RAG:   → no chunks produced, skipping.")
            continue

        # Embed in batches to avoid OOM on CPU.
        EMBED_BATCH = 64
        objects_to_create = []

        for batch_start in range(0, len(chunks), EMBED_BATCH):
            batch = chunks[batch_start : batch_start + EMBED_BATCH]
            texts = [c["text"] for c in batch]
            embeddings = embed(texts)
            if embeddings is None:
                logger.error("RAG:   → embedding failed for batch, skipping.")
                continue

            for chunk_meta, vec in zip(batch, embeddings):
                objects_to_create.append(
                    RagChunk(
                        source=chunk_meta["source"],
                        chunk_idx=chunk_meta["chunk_idx"],
                        text=chunk_meta["text"],
                        embedding=vec,
                    )
                )

        # Bulk insert — ignore conflicts so re-running on the same source is safe.
        created = RagChunk.objects.bulk_create(
            objects_to_create,
            ignore_conflicts=True,
        )
        elapsed = time.perf_counter() - t0
        logger.info(
            "RAG:   → %d chunks indexed in %.1fs.", len(created), elapsed
        )
        total_inserted += len(created)

    logger.info(
        "RAG: Index complete — %d chunks total across %d PDFs.",
        total_inserted,
        len(pdf_files),
    )
    return total_inserted


# ── Retrieval ──────────────────────────────────────────────────────────────────

def retrieve_context(query: str, k: int = DEFAULT_TOP_K) -> str:
    """
    Retrieve the *k* most relevant chunks for *query* using cosine similarity.

    Returns a formatted string ready to embed in the system prompt,
    or an empty string if the index is empty or unavailable.
    """
    if not query or not query.strip():
        return ""

    try:
        from apps.job_market.models import RagChunk
        from pgvector.django import CosineDistance

        total = RagChunk.objects.count()
        if total == 0:
            return ""

        query_vec = embed([query.strip()])
        if query_vec is None:
            return ""

        q_vec = query_vec[0]

        # Retrieve top-k by cosine distance (ascending = most similar first).
        rows = (
            RagChunk.objects
            .annotate(distance=CosineDistance("embedding", q_vec))
            .order_by("distance")
            [:k]
            .values("text", "source", "distance")
        )

        lines = ["## Dokumenty źródłowe (raporty rynku pracy)\n"]
        included = 0
        for row in rows:
            dist = float(row["distance"] or 1.0)
            similarity = round(1.0 - dist, 3)
            if similarity < MIN_SIMILARITY:
                continue
            source = row["source"]
            lines.append(f"### Źródło: {source} (trafność: {similarity:.2f})")
            lines.append(row["text"].strip())
            lines.append("")
            included += 1

        if included == 0:
            return ""

        lines.append(
            "---\n"
            "Powyższe fragmenty pochodzą z raportów rynku pracy (Hays, Goldman, Barometr Zawodów, ABSL i inne). "
            "Traktuj je jako wiarygodne źródło faktograficzne w odpowiedzi — cytuj konkretne dane gdy to możliwe."
        )
        return "\n".join(lines)

    except Exception as exc:
        logger.warning("RAG: retrieve_context() failed: %s", exc)
        return ""


def is_index_ready() -> bool:
    """Return True if the RAG index has at least one chunk in the database."""
    try:
        from apps.job_market.models import RagChunk
        return RagChunk.objects.exists()
    except Exception:
        return False

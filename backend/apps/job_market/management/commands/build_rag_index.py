"""
Management command: build_rag_index

Extracts text from all PDF reports in the given directory, chunks them,
embeds with sentence-transformers, and persists into ChromaDB.

Usage (inside the running container):
    python manage.py build_rag_index
    python manage.py build_rag_index --pdf-dir /app/rag_pdfs
    python manage.py build_rag_index --force     # rebuild even if index exists
"""

import logging
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.job_market.services.rag_service import build_index

logger = logging.getLogger(__name__)

DEFAULT_PDF_DIR = "/app/rag_pdfs"


class Command(BaseCommand):
    help = "Build the RAG vector index from PDF market reports."

    def add_arguments(self, parser):
        parser.add_argument(
            "--pdf-dir",
            type=str,
            default=DEFAULT_PDF_DIR,
            help=f"Directory containing *.pdf files (default: {DEFAULT_PDF_DIR})",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            default=False,
            help="Delete and rebuild the ChromaDB collection even if it already has data.",
        )

    def handle(self, *args, **options):
        pdf_dir = Path(options["pdf_dir"])
        force = options["force"]

        self.stdout.write(self.style.NOTICE(f"PDF directory : {pdf_dir}"))
        self.stdout.write(self.style.NOTICE(f"Vector store  : PostgreSQL (pgvector)"))
        self.stdout.write(self.style.NOTICE(f"Force rebuild : {force}"))
        self.stdout.write("")

        if not pdf_dir.exists():
            raise CommandError(
                f"PDF directory does not exist: {pdf_dir}\n"
                f"Make sure the volume is mounted correctly in docker-compose.yml "
                f"and the directory contains *.pdf files."
            )

        pdf_count = len(list(pdf_dir.glob("*.pdf")))
        if pdf_count == 0:
            raise CommandError(f"No *.pdf files found in {pdf_dir}")

        self.stdout.write(f"Found {pdf_count} PDF file(s). Building index…\n")
        self.stdout.write(
            "This may take 5–20 minutes on CPU. Check logs for progress.\n"
        )

        try:
            # Set up logging to stdout so Django's management layer shows it.
            logging.basicConfig(
                level=logging.INFO,
                format="%(asctime)s  %(message)s",
                datefmt="%H:%M:%S",
            )
            total = build_index(pdf_dir=pdf_dir, force=force)
        except Exception as exc:
            raise CommandError(f"Index build failed: {exc}") from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✓ Done — {total} chunks indexed from {pdf_count} PDFs.\n"
                f"  The chat will now use RAG on every query."
            )
        )

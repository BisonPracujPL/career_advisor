from django.core.management.base import BaseCommand
from apps.job_market.models import JobOffer
from sentence_transformers import SentenceTransformer


class Command(BaseCommand):
    help = "Generuje wektory (embeddings) dla pełnych tekstów ofert pracy."

    def handle(self, *args, **options):
        self.stdout.write("Ładowanie modelu językowego (to może chwilę potrwać)...")
        # Model dobrze radzący sobie z j. polskim i angielskim (zwraca wektor 384 wymiarów)
        model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

        offers = JobOffer.objects.filter(full_text_embedding__isnull=True)
        total = offers.count()
        self.stdout.write(f"Znaleziono {total} ofert do wektoryzacji.")

        batch_size = 100
        for i in range(0, total, batch_size):
            # ZAWSZE bierzemy pierwsze 100 sztuk ([:batch_size]), ponieważ
            # po zapisaniu wektorów przetworzone rekordy znikają z zapytania 'offers'!
            batch = list(offers[:batch_size])
            if not batch:
                break

            texts = []

            # Łączenie najważniejszych informacji w jeden spójny tekst
            for offer in batch:
                text = (
                    f"Stanowisko: {offer.job_title}. "
                    f"Technologie: {offer.technologies_expected}. "
                    f"Wymagania: {offer.requirements_expected}. "
                    f"Obowiązki: {offer.responsibilities}"
                ).replace("\n", " ")
                texts.append(text)

            # Generowanie wektorów dla całej paczki naraz (szybciej)
            embeddings = model.encode(texts)

            # Zapisywanie do bazy
            for offer, embedding in zip(batch, embeddings):
                offer.full_text_embedding = embedding.tolist()

            JobOffer.objects.bulk_update(batch, ["full_text_embedding"])
            self.stdout.write(
                f"Przetworzono {min(i+batch_size, total)} / {total} ofert."
            )

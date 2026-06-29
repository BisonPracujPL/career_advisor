import csv
import json
import sys
from flashtext import KeywordProcessor

# Zwiększamy limit wielkości pola w CSV (bo oferty potrafią mieć długie opisy)
csv.field_size_limit(2147483647)

print("KROK 1: Ładowanie słownika LightCast...")
keyword_processor = KeywordProcessor(case_sensitive=False)

# Wczytujemy słownik skilli
with open("lightcast_pl_data_formatted.csv", "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    skills_count = 0
    for row in reader:
        if row["type"] == "skill":
            skill_id = row["id"]
            skill_name = row["description"]
            # Dodajemy słowo kluczowe. Jeśli Flashtext znajdzie "skill_name", zwróci nam "skill_id"
            keyword_processor.add_keyword(skill_name, skill_id)
            skills_count += 1

print(f"Załadowano {skills_count} umiejętności do pamięci.")
print("KROK 2: Analiza ofert i generowanie kolumny mapped_skills (to może potrwać)...")

input_file = "data_en_processed.csv"
output_file = "data_all_ready.csv"  # To będzie nasz nowy, gotowy plik

with open(input_file, "r", encoding="utf-8") as fin, open(
    output_file, "w", encoding="utf-8", newline=""
) as fout:

    reader = csv.DictReader(fin)

    # Dodajemy 'mapped_skills' do nagłówków
    fieldnames = reader.fieldnames
    if "mapped_skills" not in fieldnames:
        fieldnames.append("mapped_skills")

    writer = csv.DictWriter(fout, fieldnames=fieldnames)
    writer.writeheader()

    processed = 0
    for row in reader:
        # 1. Kleimy cały tekst oferty w jeden duży ciąg (tytuł, wymagania, technologie)
        text_to_search = " ".join(
            [
                row.get("jobTitle", ""),
                row.get("requirements-expected", ""),
                row.get("requirements-optional", ""),
                row.get("technologies-expected", ""),
                row.get("responsibilities", ""),
            ]
        )

        # 2. Szukamy umiejętności w tekście (Flashtext robi to błyskawicznie)
        found_skill_ids = keyword_processor.extract_keywords(text_to_search)

        # 3. Usuwamy duplikaty (jeśli słowo "Python" padło 5 razy, chcemy je tylko raz)
        unique_skill_ids = list(set(found_skill_ids))

        # 4. Budujemy strukturę JSON jakiej oczekuje aplikacja (Django)
        mapped_skills = []
        for skill_id in unique_skill_ids:
            mapped_skills.append(
                {
                    "match_id": skill_id,
                    "match_score": 0.85,  # Ustawiamy stałe wysokie prawdopodobieństwo, skoro słowo padło w tekście
                    "match_type": "skill",
                }
            )

        # 5. Zapisujemy z powrotem do wiersza jako tekst JSON
        row["mapped_skills"] = json.dumps(mapped_skills)
        writer.writerow(row)

        processed += 1
        if processed % 10000 == 0:
            print(f"Przetworzono {processed} ofert...")

print(f"ZAKOŃCZONO SUKCESEM! Gotowy plik zapisano jako: {output_file}")

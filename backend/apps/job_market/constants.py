"""Filter groups aligned with position_levels values stored in job_offer_info."""

POSITION_LEVEL_GROUPS = [
    {
        "id": "intern",
        "label": "Staż · praktykant",
        "values": ["praktykant / praktykantka - stażysta / stażystka"],
    },
    {
        "id": "junior",
        "label": "Junior",
        "values": ["młodszy specjalista / młodsza specjalistka (junior)"],
    },
    {
        "id": "mid",
        "label": "Specjalista · Mid",
        "values": [
            "specjalista / specjalistka (mid / regular)",
            "specjalista (Mid / Regular)",
        ],
    },
    {
        "id": "senior",
        "label": "Senior",
        "values": ["starszy specjalista / starsza specjalistka (senior)"],
    },
    {
        "id": "expert",
        "label": "Ekspert",
        "values": ["ekspert / ekspertka"],
    },
    {
        "id": "lead",
        "label": "Kierownik · koordynator",
        "values": [
            "kierownik / kierowniczka - koordynator / koordynatorka",
        ],
    },
    {
        "id": "manager",
        "label": "Menedżer",
        "values": ["menedżer / menedżerka"],
    },
    {
        "id": "director",
        "label": "Dyrektor",
        "values": ["dyrektor / dyrektorka", "prezes / prezeska"],
    },
    {
        "id": "assistant",
        "label": "Asystent",
        "values": ["asystent / asystentka"],
    },
    {
        "id": "physical",
        "label": "Pracownik fizyczny",
        "values": [
            "pracownik fizyczny / pracowniczka fizyczna",
            "pracownik fizyczny",
        ],
    },
]

LEVEL_VALUES_BY_GROUP = {
    g["id"]: g["values"] for g in POSITION_LEVEL_GROUPS
}

# Top-level market areas aligned with pracuj.pl navigation (IT, Praca fizyczna, …).
# Offers keep original lead_main_category / lead_sub_category from import — pillars
# are a UX grouping + filter layer on top of those fields.
MARKET_PILLARS = [
    {
        "id": "it",
        "label": "IT",
        "description": "Programowanie, administracja, bazy danych, bezpieczeństwo",
    },
    {
        "id": "physical",
        "label": "Praca fizyczna",
        "description": "Magazyn, produkcja, budownictwo, gastronomia, ochrona",
        "lead_main_exact": ["Praca fizyczna"],
    },
    {
        "id": "sales",
        "label": "Sprzedaż",
        "description": "Sprzedaż B2B/B2C, key account, retail",
        "lead_main_exact": ["Sprzedaż"],
    },
    {
        "id": "engineering",
        "label": "Inżynieria",
        "description": "Elektronika, mechanika, automatyka, konstrukcja",
        "lead_main_exact": ["Inżynieria"],
    },
]

PILLAR_IDS = {p["id"] for p in MARKET_PILLARS}

"""Pillar label for lead_main_category (IT, Praca fizyczna, …)."""


def pillar_label_for_lead_main(lead_main: str) -> str:
    if not lead_main:
        return ""
    if lead_main.startswith("IT -"):
        return "IT"
    if lead_main == "Praca fizyczna":
        return "Praca fizyczna"
    if lead_main == "Sprzedaż":
        return "Sprzedaż"
    if lead_main == "Inżynieria":
        return "Inżynieria"
    if " - " in lead_main:
        return lead_main.split(" - ", 1)[0]
    return lead_main


def segment_display_label(lead_main: str, lead_sub: str) -> str:
    pillar = pillar_label_for_lead_main(lead_main)
    if lead_sub:
        return f"{pillar} › {lead_sub}"
    return pillar

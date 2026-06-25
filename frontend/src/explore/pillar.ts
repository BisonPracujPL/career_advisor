export function pillarLabelFromMain(leadMain: string): string {
  if (!leadMain) return "";
  if (leadMain.startsWith("IT -")) return "IT";
  if (leadMain === "Praca fizyczna") return "Praca fizyczna";
  if (leadMain === "Sprzedaż") return "Sprzedaż";
  if (leadMain === "Inżynieria") return "Inżynieria";
  const dash = leadMain.indexOf(" - ");
  return dash > 0 ? leadMain.slice(0, dash) : leadMain;
}

export function segmentDisplayLabel(leadMain: string, leadSub: string): string {
  const pillar = pillarLabelFromMain(leadMain);
  return leadSub ? `${pillar} › ${leadSub}` : pillar;
}

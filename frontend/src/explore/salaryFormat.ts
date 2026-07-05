/** Human-readable salary band for offer detail (original values, not normalized). */

export interface SalaryBlockLike {
  from: number | null;
  to: number | null;
  currency: string;
  duration: string;
  kind: string;
}

function salaryKindLabel(kind: string): string {
  const k = (kind || "").toLowerCase();
  if (k === "gross") return "brutto";
  if (k === "net-plus-vat") return "netto + VAT";
  if (!kind) return "";
  return kind;
}

function salaryDurationLabel(duration: string): string {
  const d = (duration || "").toLowerCase();
  if (d.includes("mies")) return "miesięcznie";
  if (d.includes("godz")) return "godzinowo";
  return duration || "";
}

export function formatOfferSalaryLine(
  contract: "UoP" | "B2B",
  block: SalaryBlockLike | null | undefined
): string | null {
  if (!block?.from && !block?.to) return null;
  const from = block.from?.toLocaleString("pl-PL");
  const to = block.to?.toLocaleString("pl-PL") ?? from;
  const currency = block.currency || "PLN";
  const parts = [`${contract}:`, `${from} – ${to}`, currency];
  const kind = salaryKindLabel(block.kind);
  const duration = salaryDurationLabel(block.duration);
  if (kind) parts.push(`· ${kind}`);
  if (duration) parts.push(`· ${duration}`);
  return parts.join(" ");
}

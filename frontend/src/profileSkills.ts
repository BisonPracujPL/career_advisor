import { Skill } from "./types";

export function matchableProfileSkills(skills: Skill[] | undefined | null): Skill[] {
  return (skills || []).filter((s) => s.id != null && String(s.id) !== "" && String(s.id) !== "undefined");
}

export function formatExperienceDuration(months: number): string {
  if (months <= 0) return "";
  if (months < 12) return `${months} mies.`;
  const fullYears = Math.floor(months / 12);
  const rem = months % 12;
  const yearWord = fullYears === 1 ? "rok" : fullYears >= 2 && fullYears <= 4 ? "lata" : "lat";
  if (rem === 0) return `${fullYears} ${yearWord}`;
  return `${fullYears} ${yearWord} ${rem} mies.`;
}

export const CAREER_LEVEL_THRESHOLDS_TEXT =
  "<2 lata Junior, 2–6 lat Mid, 6+ lat Senior";

import { ExperienceItem, SegmentInsight } from "../types";

export type CareerLevelId = "junior" | "mid" | "senior";

const LEVEL_ORDER: CareerLevelId[] = ["junior", "mid", "senior"];

export function inferCareerLevel(experience: ExperienceItem[]): CareerLevelId {
  const totalMonths = experience.reduce((s, e) => s + (e.duration_months || 0), 0);
  if (totalMonths < 24) return "junior";
  if (totalMonths < 72) return "mid";
  return "senior";
}

export function levelLabel(id: CareerLevelId) {
  return { junior: "Junior", mid: "Mid", senior: "Senior" }[id];
}

export function salaryAtLevel(insight: SegmentInsight | undefined, level: CareerLevelId) {
  return insight?.salary_by_level?.[level]?.median ?? null;
}

export function salaryGrowth(insight: SegmentInsight | undefined) {
  const junior = salaryAtLevel(insight, "junior");
  const senior = salaryAtLevel(insight, "senior");
  if (junior == null || senior == null || junior <= 0) return null;
  return {
    junior,
    senior,
    delta: senior - junior,
    pct: Math.round(((senior - junior) / junior) * 100),
  };
}

export function nextLevelTarget(current: CareerLevelId): CareerLevelId | null {
  const idx = LEVEL_ORDER.indexOf(current);
  return idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : null;
}

export function formatPln(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("pl-PL")} zł`;
}

export interface BranchSalaryOutlook {
  currentLevel: CareerLevelId;
  currentSalary: number | null;
  nextLevel: CareerLevelId | null;
  nextSalary: number | null;
  ceilingSalary: number | null;
  growthToSenior: ReturnType<typeof salaryGrowth>;
}

export function branchSalaryOutlook(
  insight: SegmentInsight | undefined,
  experience: ExperienceItem[]
): BranchSalaryOutlook {
  const currentLevel = inferCareerLevel(experience);
  const currentSalary = salaryAtLevel(insight, currentLevel);
  const nextLevel = nextLevelTarget(currentLevel);
  const nextSalary = nextLevel ? salaryAtLevel(insight, nextLevel) : null;
  const ceilingSalary = salaryAtLevel(insight, "senior");
  return {
    currentLevel,
    currentSalary,
    nextLevel,
    nextSalary,
    ceilingSalary,
    growthToSenior: salaryGrowth(insight),
  };
}

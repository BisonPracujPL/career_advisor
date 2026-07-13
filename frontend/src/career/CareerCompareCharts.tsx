import {
  BranchComparison,
  SegmentInsight,
  segmentInsightKey,
} from "../types";

function formatPln(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("pl-PL")} zł`;
}

function shortLabel(label: string, max = 22) {
  return label.length > max ? `${label.slice(0, max)}…` : label;
}

export function MatchComparisonChart({
  branches,
  selectedKey,
}: {
  branches: BranchComparison[];
  selectedKey?: string | null;
}) {
  if (!branches.length) return null;
  const maxAfter = Math.max(...branches.map((b) => b.match_after), 1);

  return (
    <div className="career-chart panel-inner">
      <h4 className="career-chart__title">Dopasowanie po skillu (TF-IDF)</h4>
      <p className="career-chart__sub">Porównanie segmentów — im dłuższy pasek, tym lepsze dopasowanie profilu.</p>
      <ul className="career-bar-chart">
        {branches.map((b) => {
          const key = segmentInsightKey(b.lead_main_category, b.lead_sub_category);
          const active = selectedKey === key;
          return (
            <li
              key={`${b.skill_name}|${key}`}
              className={`career-bar-chart__row ${active ? "career-bar-chart__row--active" : ""}`}
            >
              <div className="career-bar-chart__meta">
                <strong title={b.skill_name}>{b.skill_name}</strong>
                <span title={b.segment_label}>{shortLabel(b.segment_label)}</span>
              </div>
              <div className="career-bar-chart__track-wrap">
                <div className="career-bar-chart__track">
                  <div
                    className="career-bar-chart__fill career-bar-chart__fill--before"
                    style={{ width: `${(b.match_before / maxAfter) * 100}%` }}
                  />
                  <div
                    className="career-bar-chart__fill career-bar-chart__fill--after"
                    style={{
                      left: `${(b.match_before / maxAfter) * 100}%`,
                      width: `${((b.match_after - b.match_before) / maxAfter) * 100}%`,
                    }}
                  />
                </div>
                <span className="career-bar-chart__val">
                  {b.match_before}% → <strong>{b.match_after}%</strong>
                  <em>+{b.match_delta}%</em>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SalaryComparisonChart({
  branches,
  insights,
  loading,
}: {
  branches: BranchComparison[];
  insights: Record<string, SegmentInsight>;
  loading?: boolean;
}) {
  if (!branches.length) return null;

  const rows = branches.map((b) => {
    const key = segmentInsightKey(b.lead_main_category, b.lead_sub_category);
    const insight = insights[key];
    const junior = insight?.salary_by_level?.junior?.median ?? null;
    const senior = insight?.salary_by_level?.senior?.median ?? null;
    return { ...b, key, junior, senior };
  });

  const maxSal = Math.max(
    ...rows.flatMap((r) => [r.junior, r.senior].filter((v): v is number => v != null)),
    1
  );

  return (
    <div className="career-chart panel-inner">
      <h4 className="career-chart__title">Widełki Junior vs Senior</h4>
      <p className="career-chart__sub">Mediana UoP/mies. w segmencie — zobacz potencjał wzrostu wynagrodzenia.</p>
      {loading && <p className="muted career-chart__loading">Ładuję wynagrodzenia…</p>}
      <ul className="career-salary-chart">
        {rows.map((row) => (
          <li key={row.key} className="career-salary-chart__row">
            <span className="career-salary-chart__label" title={row.segment_label}>
              {shortLabel(row.segment_label, 18)}
            </span>
            <div className="career-salary-chart__bars">
              <div className="career-salary-chart__bar-group">
                <span className="career-salary-chart__tag">Jr</span>
                <div className="career-salary-chart__track">
                  <div
                    className="career-salary-chart__fill career-salary-chart__fill--junior"
                    style={{
                      width: row.junior ? `${(row.junior / maxSal) * 100}%` : "0%",
                    }}
                  />
                </div>
                <span className="career-salary-chart__amount">{formatPln(row.junior)}</span>
              </div>
              <div className="career-salary-chart__bar-group">
                <span className="career-salary-chart__tag">Sr</span>
                <div className="career-salary-chart__track">
                  <div
                    className="career-salary-chart__fill career-salary-chart__fill--senior"
                    style={{
                      width: row.senior ? `${(row.senior / maxSal) * 100}%` : "0%",
                    }}
                  />
                </div>
                <span className="career-salary-chart__amount">{formatPln(row.senior)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {rows.some((r) => r.junior && r.senior) && (
        <p className="career-chart__footnote">
          Różnica Senior − Junior pokazuje ekonomiczny sens rozwoju w danym segmencie.
        </p>
      )}
    </div>
  );
}

export function CareerTrajectorySummary({
  stepsCount,
  totalSkills,
  bestMatch,
  goalLabel,
}: {
  stepsCount: number;
  totalSkills: number;
  bestMatch: number;
  goalLabel?: string | null;
}) {
  return (
    <div className="career-trajectory">
      <div className="career-trajectory__stat">
        <span>Kroki</span>
        <strong>{stepsCount}</strong>
      </div>
      <div className="career-trajectory__stat">
        <span>Skille</span>
        <strong>{totalSkills}</strong>
      </div>
      <div className="career-trajectory__stat">
        <span>Dopasowanie</span>
        <strong>{bestMatch}%</strong>
      </div>
      {goalLabel && (
        <div className="career-trajectory__goal">
          <span>Cel</span>
          <strong title={goalLabel}>{goalLabel}</strong>
        </div>
      )}
    </div>
  );
}

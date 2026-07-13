import { useMemo } from "react";
import {
  BranchComparison,
  SegmentInsight,
  segmentInsightKey,
} from "../types";
import { formatPln } from "./careerSalaryUtils";

function shortLabel(label: string, max = 28) {
  return label.length > max ? `${label.slice(0, max)}…` : label;
}

function rowKey(b: BranchComparison) {
  return `${b.branch_type || "single"}|${b.skill_name}|${segmentInsightKey(
    b.lead_main_category,
    b.lead_sub_category
  )}`;
}

export function CareerOptionMatrix({
  branches,
  insights,
  loading,
  selectedNodeKey,
}: {
  branches: BranchComparison[];
  insights: Record<string, SegmentInsight>;
  loading?: boolean;
  selectedNodeKey?: string | null;
}) {
  const rows = useMemo(() => {
    return branches
      .map((b) => {
        const segKey = segmentInsightKey(b.lead_main_category, b.lead_sub_category);
        const insight = insights[segKey];
        const junior = insight?.salary_by_level?.junior?.median ?? null;
        const mid = insight?.salary_by_level?.mid?.median ?? null;
        const senior = insight?.salary_by_level?.senior?.median ?? null;
        const growth =
          junior != null && senior != null && junior > 0 ? senior - junior : null;
        return {
          ...b,
          segKey,
          key: rowKey(b),
          junior,
          mid,
          senior,
          growth,
        };
      })
      .sort((a, b) => b.match_delta - a.match_delta || b.match_after - a.match_after);
  }, [branches, insights]);

  if (!rows.length) return null;

  const maxSal = Math.max(
    ...rows.flatMap((r) => [r.junior, r.mid, r.senior].filter((v): v is number => v != null)),
    1
  );
  const maxDelta = Math.max(...rows.map((r) => r.match_delta), 1);
  const bestMatchKey = rows[0]?.key;
  const bestGrowthKey =
    rows.reduce(
      (best, r) =>
        (r.growth ?? 0) > (best.growth ?? 0) ? r : best,
      rows[0]
    )?.key ?? null;

  return (
    <section className="career-matrix panel">
      <header className="career-matrix__head">
        <h2>Porównanie opcji</h2>
        <p>
          Dopasowanie profilu i widełki Junior / Mid / Senior w segmencie.
          Szukaj opcji z wysokim skokiem dopasowania i sensownym wzrostem wynagrodzenia.
        </p>
      </header>

      {loading && (
        <p className="muted career-matrix__loading">Ładuję wynagrodzenia segmentów…</p>
      )}

      <div className="career-matrix__legend" aria-hidden>
        <span>
          <i className="career-matrix__dot career-matrix__dot--match" /> Dopasowanie
        </span>
        <span>
          <i className="career-matrix__dot career-matrix__dot--jr" /> Junior
        </span>
        <span>
          <i className="career-matrix__dot career-matrix__dot--mid" /> Mid
        </span>
        <span>
          <i className="career-matrix__dot career-matrix__dot--sr" /> Senior
        </span>
      </div>

      <div className="career-matrix__table" role="table">
        <div className="career-matrix__row career-matrix__row--head" role="row">
          <span role="columnheader">Opcja</span>
          <span role="columnheader">Dopasowanie</span>
          <span role="columnheader">Widełki UoP / mies.</span>
          <span role="columnheader">Wzrost Jr→Sr</span>
        </div>

        {rows.map((row) => {
          const active = selectedNodeKey === row.segKey;
          const isBestMatch = row.key === bestMatchKey;
          const isBestGrowth = row.key === bestGrowthKey && (row.growth ?? 0) > 0;
          const deltaVsBest = maxDelta - row.match_delta;

          return (
            <div
              key={row.key}
              role="row"
              className={`career-matrix__row ${active ? "career-matrix__row--active" : ""}`}
            >
              <div className="career-matrix__option" role="cell">
                <div className="career-matrix__option-head">
                  <strong title={row.skill_name}>{shortLabel(row.skill_name, 32)}</strong>
                  <span
                    className={`career-matrix__type ${
                      row.branch_type === "bundle" ? "career-matrix__type--bundle" : ""
                    }`}
                  >
                    {row.branch_type === "bundle" ? "Pakiet" : "Skill"}
                  </span>
                </div>
                <span className="career-matrix__segment" title={row.segment_label}>
                  {shortLabel(row.segment_label, 36)}
                </span>
                <div className="career-matrix__badges">
                  {isBestMatch && (
                    <em className="career-matrix__badge career-matrix__badge--match">
                      Najlepsze dopasowanie
                    </em>
                  )}
                  {isBestGrowth && (
                    <em className="career-matrix__badge career-matrix__badge--salary">
                      Najwyższy wzrost zarobków
                    </em>
                  )}
                </div>
              </div>

              <div className="career-matrix__match" role="cell">
                <div className="career-matrix__match-bar">
                  <div
                    className="career-matrix__match-before"
                    style={{ width: `${(row.match_before / 100) * 100}%` }}
                  />
                  <div
                    className="career-matrix__match-gain"
                    style={{
                      left: `${row.match_before}%`,
                      width: `${Math.min(row.match_delta, 100 - row.match_before)}%`,
                    }}
                  />
                </div>
                <div className="career-matrix__match-vals">
                  <span>
                    {row.match_before}% → <strong>{row.match_after}%</strong>
                  </span>
                  <em>+{row.match_delta}%</em>
                  {deltaVsBest > 0 && !isBestMatch && (
                    <span className="career-matrix__vs-best">−{deltaVsBest}% vs lider</span>
                  )}
                </div>
              </div>

              <div className="career-matrix__salary" role="cell">
                <div className="career-matrix__salary-ladder">
                  {(["junior", "mid", "senior"] as const).map((level) => {
                    const val = row[level];
                    const width = val ? `${(val / maxSal) * 100}%` : "0%";
                    return (
                      <div key={level} className={`career-matrix__salary-step career-matrix__salary-step--${level}`}>
                        <span className="career-matrix__salary-tag">
                          {level === "junior" ? "Jr" : level === "mid" ? "Mid" : "Sr"}
                        </span>
                        <div className="career-matrix__salary-track">
                          <div className="career-matrix__salary-fill" style={{ width }} />
                        </div>
                        <span className="career-matrix__salary-val">{formatPln(val)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="career-matrix__growth" role="cell">
                {row.growth != null && row.growth > 0 ? (
                  <>
                    <strong>{formatPln(row.growth)}</strong>
                    {row.junior != null && row.junior > 0 && (
                      <span>+{Math.round((row.growth / row.junior) * 100)}%</span>
                    )}
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="career-matrix__footnote muted">
        Wzrost Jr→Sr to mediana Senior minus mediana Junior w tym segmencie — pokazuje
        ekonomiczny potencjał ścieżki.
      </p>
    </section>
  );
}

interface SkillMetricsBarProps {
  matchLabel?: string;
  matchPct?: number | null;
  coveragePct?: number | null;
  extraMetrics?: { label: string; value: string }[];
}

export function SkillMetricsBar({
  matchLabel = "Dopasowanie",
  matchPct,
  coveragePct,
  extraMetrics = [],
}: SkillMetricsBarProps) {
  if (matchPct == null && coveragePct == null && !extraMetrics.length) {
    return null;
  }
  return (
    <div className="segment-metrics segment-metrics--inline">
      {matchPct != null && (
        <div className="metric-card">
          <span className="metric-num">{matchPct}%</span>
          <span className="metric-lbl">{matchLabel}</span>
        </div>
      )}
      {coveragePct != null && (
        <div className="metric-card">
          <span className="metric-num">{coveragePct}%</span>
          <span className="metric-lbl">pokrycie oferty</span>
        </div>
      )}
      {extraMetrics.map((m) => (
        <div key={m.label} className="metric-card">
          <span className="metric-num">{m.value}</span>
          <span className="metric-lbl">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

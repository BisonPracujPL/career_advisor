interface LevelRow {
  level: string;
  offer_count: number;
  median_salary: number | null;
  salary_n?: number;
  pct?: number;
}

interface SegmentLevelChartsProps {
  rows: LevelRow[];
}

export function SegmentLevelCharts({ rows }: SegmentLevelChartsProps) {
  const withCount = rows.filter((r) => r.offer_count > 0);
  const chartRows = [...withCount].sort((a, b) => {
    const am = a.median_salary ?? -1;
    const bm = b.median_salary ?? -1;
    return bm - am;
  });
  const withSalary = chartRows.filter((r) => r.median_salary != null && r.median_salary > 0);
  const maxMed = withSalary.length
    ? Math.max(...withSalary.map((r) => r.median_salary!))
    : 1;

  if (!withCount.length) {
    return <p className="muted">Brak danych o poziomach stanowisk dla wybranych filtrów.</p>;
  }

  return (
    <div className="segment-level-charts">
      <div className="segment-level-charts__panel">
        <h4>Mediana wynagrodzenia (PLN / mies.)</h4>
        <ul className="salary-bar-chart">
          {chartRows.map((row) => {
            if (row.median_salary == null || row.median_salary <= 0) {
              return (
                <li
                  key={row.level}
                  className="salary-bar-chart__row salary-bar-chart__row--empty"
                >
                  <span className="salary-bar-chart__label" title={row.level}>
                    {row.level}
                  </span>
                  <div className="salary-bar-chart__track salary-bar-chart__track--empty" />
                  <span className="salary-bar-chart__val muted">brak widełek</span>
                </li>
              );
            }
            const pct = Math.round((row.median_salary / maxMed) * 100);
            return (
              <li key={row.level} className="salary-bar-chart__row">
                <span className="salary-bar-chart__label" title={row.level}>
                  {row.level}
                </span>
                <div className="salary-bar-chart__track">
                  <div
                    className="salary-bar-chart__fill"
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                </div>
                <span className="salary-bar-chart__val">
                  {row.median_salary.toLocaleString("pl-PL")}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="segment-level-charts__panel">
        <h4>Liczba ofert wg stanowiska</h4>
        <table className="level-count-table">
          <thead>
            <tr>
              <th>Stanowisko</th>
              <th>Ofert</th>
              <th>Udział</th>
              <th>Mediana PLN / mies.</th>
            </tr>
          </thead>
          <tbody>
            {chartRows.map((row) => (
              <tr key={row.level}>
                <td title={row.level}>{row.level}</td>
                <td className="level-count-table__num">
                  {row.offer_count.toLocaleString("pl-PL")}
                </td>
                <td className="level-count-table__num">{row.pct ?? "—"}%</td>
                <td className="level-count-table__num">
                  {row.median_salary != null
                    ? row.median_salary.toLocaleString("pl-PL")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

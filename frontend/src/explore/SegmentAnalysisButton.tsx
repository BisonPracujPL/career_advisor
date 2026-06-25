function ChartBarsIcon() {
  return (
    <svg
      className="explore-segment-pill__chart"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="10" y="7" width="4" height="14" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" />
    </svg>
  );
}

interface SegmentAnalysisButtonProps {
  label: string;
  onClick: () => void;
}

export function SegmentAnalysisButton({ label, onClick }: SegmentAnalysisButtonProps) {
  return (
    <div className="explore-segment-cta">
      <button type="button" className="explore-segment-pill" onClick={onClick}>
        <span className="explore-segment-pill__icon">
          <ChartBarsIcon />
        </span>
        <span className="explore-segment-pill__text">{label}</span>
      </button>
    </div>
  );
}

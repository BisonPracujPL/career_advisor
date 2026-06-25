interface ExploreBackButtonProps {
  label?: string;
  onClick: () => void;
}

export function ExploreBackButton({
  label = "Wróć",
  onClick,
}: ExploreBackButtonProps) {
  return (
    <button type="button" className="explore-back-pill" onClick={onClick}>
      <span className="explore-back-pill__icon" aria-hidden>
        ←
      </span>
      {label}
    </button>
  );
}

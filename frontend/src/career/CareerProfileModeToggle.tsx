export type CareerProfileMode = "real" | "virtual";

interface CareerProfileModeToggleProps {
  mode: CareerProfileMode;
  onChange: (mode: CareerProfileMode) => void;
}

export function CareerProfileModeToggle({
  mode,
  onChange,
}: CareerProfileModeToggleProps) {
  return (
    <div className="career-profile-toggle" role="tablist" aria-label="Tryb profilu">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "real"}
        className={`career-profile-toggle__btn ${
          mode === "real" ? "career-profile-toggle__btn--active" : ""
        }`}
        onClick={() => onChange("real")}
      >
        Mój profil
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "virtual"}
        className={`career-profile-toggle__btn ${
          mode === "virtual" ? "career-profile-toggle__btn--active" : ""
        }`}
        onClick={() => onChange("virtual")}
      >
        Profil wirtualny
      </button>
    </div>
  );
}

export function CareerVirtualBanner({
  skillCount,
  onCopyFromReal,
  onResetVirtual,
}: {
  skillCount: number;
  onCopyFromReal: () => void;
  onResetVirtual: () => void;
}) {
  return (
    <div className="career-virtual-banner panel">
      <div>
        <strong>Tryb wirtualny</strong>
        <p>
          Eksperymentujesz bez zapisywania w profilu ({skillCount}{" "}
          {skillCount === 1 ? "skill" : "skilli"} w symulacji). Dodaj kompetencje poniżej,
          skopiuj profil albo wybierz gałąź „Uczę się” na mapie.
        </p>
      </div>
      <div className="career-virtual-banner__actions">
        <button type="button" className="btn-secondary" onClick={onCopyFromReal}>
          Skopiuj z mojego profilu
        </button>
        <button type="button" className="btn-secondary" onClick={onResetVirtual}>
          Reset wirtualny
        </button>
      </div>
    </div>
  );
}

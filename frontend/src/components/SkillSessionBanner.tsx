interface SkillSessionBannerProps {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void | Promise<void>;
  onReset: () => void;
}

export function SkillSessionBanner({
  dirty,
  saving,
  onSave,
  onReset,
}: SkillSessionBannerProps) {
  if (!dirty) {
    return (
      <p className="skill-session-hint muted">
        Lista kompetencji służy do symulacji dopasowania w tej sesji. Zapisany profil
        wykorzystują m.in. <strong>Ścieżka kariery</strong> i <strong>Doradca AI</strong>.
      </p>
    );
  }

  return (
    <div className="skill-session-banner" role="status">
      <p>
        Zmieniłeś kompetencje — to na razie <strong>symulacja</strong>, profil na serwerze
        jest inny.
      </p>
      <div className="skill-session-banner__actions">
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={() => void onSave()}
        >
          {saving ? "Zapisuję…" : "Zapisz w profilu"}
        </button>
        <button type="button" className="btn-secondary" onClick={onReset}>
          Przywróć z profilu
        </button>
      </div>
    </div>
  );
}

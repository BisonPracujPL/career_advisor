interface SkillToggle {
  id: string;
  name: string;
  meta?: string;
}

interface SkillToggleGridProps {
  title: string;
  hint?: string;
  skills: SkillToggle[];
  selectedIds: Set<string>;
  onToggle: (skill: SkillToggle, selected: boolean) => void;
  maxItems?: number;
}

export function SkillToggleGrid({
  title,
  hint,
  skills,
  selectedIds,
  onToggle,
  maxItems = 24,
}: SkillToggleGridProps) {
  const items = skills.slice(0, maxItems);
  if (!items.length) return null;

  const have = items.filter((s) => selectedIds.has(String(s.id)));
  const missing = items.filter((s) => !selectedIds.has(String(s.id)));

  return (
    <section className="explore-block skill-toggle-block">
      {title ? <h3>{title}</h3> : null}
      {hint && <p className="muted explore-hint">{hint}</p>}
      {have.length > 0 && (
        <>
          <h4 className="explore-subhead">Masz w profilu</h4>
          <div className="suggestion-chips">
            {have.map((s) => (
              <button
                key={s.id}
                type="button"
                className="suggestion-chip suggestion-chip--ok"
                onClick={() => onToggle(s, false)}
              >
                ✗ {s.name}
              </button>
            ))}
          </div>
        </>
      )}
      {missing.length > 0 && (
        <>
          <h4 className="explore-subhead">Dodaj z tej listy</h4>
          <div className="suggestion-chips">
            {missing.map((s) => (
              <button
                key={s.id}
                type="button"
                className="suggestion-chip"
                onClick={() => onToggle(s, true)}
              >
                + {s.name}
                {s.meta && <span className="suggestion-chip__n">{s.meta}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function toSkillToggle(skill: { id: string | number; name: string }, meta?: string): SkillToggle {
  return { id: String(skill.id), name: skill.name, meta };
}

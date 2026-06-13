import React, { useState, useEffect, ReactNode } from "react";
import { api } from "./api";
import { UserProfile, ExperienceItem as ExpType, EducationItem as EduType, Skill, LanguageItem as LangType, IndustryItem } from "./types";

const STEPS = [
  { name: "Doświadczenie", desc: "Historia zatrudnienia" },
  { name: "Wykształcenie", desc: "Ukończone szkoły" },
  { name: "Kompetencje", desc: "Twoje umiejętności" },
  { name: "Języki", desc: "Znajomość języków" },
  { name: "Branże", desc: "Obszary rynku" }
];

interface WizardLayoutProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onNext: () => void;
  onPrev: () => void;
  onSave: () => void;
  saving: boolean;
  disableNext?: boolean;
  onCancel?: () => void;
  setStep?: (step: number) => void;
}

function WizardLayout({ step, totalSteps, title, children, onNext, onPrev, onSave, saving, disableNext, onCancel, setStep }: WizardLayoutProps) {
  return (
    <div className="wizard-page" style={{ position: "relative" }}>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          style={{ position: "absolute", top: "2rem", right: "2rem", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--muted)" }}
        >
          ✕
        </button>
      )}
      <div className="wizard-layout">
        <div className="wizard-progress-bar">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`wizard-progress-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
              onClick={() => { if (setStep) setStep(i); }}
            >
              {s.name}
            </div>
          ))}
        </div>

        <div className="wizard-header">
          <h2>{title}</h2>
        </div>

        <div className="wizard-step-card">
          {children}
        </div>

        <div className="wizard-footer-actions">
          <button type="button" className="btn-secondary btn-large" onClick={onPrev} style={{ visibility: step === 0 ? "hidden" : "visible" }}>
            Wstecz
          </button>

          {step < totalSteps - 1 ? (
            <button type="button" className="btn-primary btn-large" onClick={onNext} disabled={disableNext} style={{ width: 'auto', minWidth: '150px' }}>
              Dalej
            </button>
          ) : (
            <button type="button" className="btn-primary btn-large" onClick={onSave} disabled={saving || disableNext} style={{ width: 'auto', minWidth: '150px' }}>
              {saving ? "Zapisywanie..." : "Zapisz profil"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndustries({ data, onChange }: { data: IndustryItem[], onChange: (d: IndustryItem[]) => void }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [mainCat, setMainCat] = useState("");

  useEffect(() => {
    api.offerCategories().then(d => setCategories(d.categories || [])).catch(() => { });
  }, []);

  const normalizedData = React.useMemo(() => {
    return data.map(item => {
      if (typeof item === 'string') {
        const cat = categories.find(c => c.name === item);
        return { main: item, subs: cat ? cat.subcategories.map((s: any) => s.name) : [] };
      }
      if (item && Array.isArray(item.subs) && item.subs.includes('__ALL__')) {
        const cat = categories.find(c => c.name === item.main);
        return { main: item.main, subs: cat ? cat.subcategories.map((s: any) => s.name) : [] };
      }
      return item;
    });
  }, [data, categories]);

  const subCats = categories.find(c => c.code === mainCat)?.subcategories || [];
  const mainCatName = categories.find(c => c.code === mainCat)?.name;
  const activeGroup = normalizedData.find(g => g.main === mainCatName) || { subs: [] };
  const allCurrentSubs = subCats.map((s: any) => s.name);
  const isAllSelected = subCats.length > 0 && activeGroup.subs.length === subCats.length && allCurrentSubs.every((s: string) => activeGroup.subs.includes(s));

  const toggle = (main: string, sub: string) => {
    let newData = [...normalizedData];
    let groupIdx = newData.findIndex(g => g.main === main);

    if (groupIdx === -1) {
      if (sub === '__ALL__') {
        newData.push({ main, subs: allCurrentSubs });
      } else {
        newData.push({ main, subs: [sub] });
      }
    } else {
      let group = { ...newData[groupIdx], subs: [...newData[groupIdx].subs] };

      if (sub === '__ALL__') {
        if (isAllSelected) {
          newData.splice(groupIdx, 1);
        } else {
          group.subs = allCurrentSubs;
          newData[groupIdx] = group;
        }
      } else {
        if (group.subs.includes(sub)) {
          group.subs = group.subs.filter(s => s !== sub);
          if (group.subs.length === 0) {
            newData.splice(groupIdx, 1);
          } else {
            newData[groupIdx] = group;
          }
        } else {
          group.subs.push(sub);
          newData[groupIdx] = group;
        }
      }
    }
    onChange(newData);
  };

  const removeGroup = (main: string) => {
    onChange(normalizedData.filter(g => g.main !== main));
  };

  return (
    <>
      <div style={{ marginBottom: "1.25rem" }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Wybierz branżę</span>
          <select className="input" style={{ cursor: 'pointer' }} value={mainCat} onChange={e => setMainCat(e.target.value)}>
            <option value="">Wybierz z listy...</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      {mainCat && (
        <div style={{ marginBottom: "1.5rem", animation: "fade-in 0.3s ease-out" }}>
          <h4 style={{ fontSize: "0.95rem", color: "var(--text)", margin: "0 0 0.75rem", fontWeight: 600 }}>Specjalizacje</h4>

          <div className="profile-chips" style={{ gap: "0.4rem" }}>
            <button
              type="button"
              className={`chip ${isAllSelected ? 'chip-skill' : ''}`}
              style={{
                padding: "0.35rem 0.75rem",
                border: isAllSelected ? "1px solid var(--accent)" : "1px dashed var(--muted)",
                background: isAllSelected ? "var(--accent-soft)" : "transparent",
                color: isAllSelected ? "var(--accent)" : "var(--text)",
                cursor: "pointer",
                fontWeight: 600,
                transition: "all 0.15s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem"
              }}
              onClick={() => toggle(mainCatName, '__ALL__')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Cała branża
            </button>

            {subCats.map((sub: any) => {
              const isSelected = activeGroup.subs.includes(sub.name);
              return (
                <button
                  type="button"
                  key={sub.code}
                  className={`chip ${isSelected ? 'chip-skill' : ''}`}
                  style={{
                    padding: "0.35rem 0.75rem",
                    border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: isSelected ? "var(--accent-soft)" : "#fff",
                    color: isSelected ? "var(--accent)" : "var(--text)",
                    cursor: "pointer",
                    fontWeight: isSelected ? 600 : 500,
                    transition: "all 0.15s ease"
                  }}
                  onClick={() => toggle(mainCatName, sub.name)}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {normalizedData.length > 0 && (
        <div style={{ paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", margin: "0 0 1rem" }}>
            Twoje wybrane branże
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {normalizedData.map((group, i) => (
              <SelectedDomainGroup
                key={i}
                group={group}
                onToggle={(sub) => toggle(group.main, sub)}
                onRemoveGroup={() => removeGroup(group.main)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SelectedDomainGroup({ group, onToggle, onRemoveGroup }: { group: any, onToggle: (sub: string) => void, onRemoveGroup: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ padding: "1rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", transition: "all 0.2s ease", borderColor: expanded ? "var(--accent)" : "var(--border)", boxShadow: expanded ? "0 4px 16px rgba(26,95,214,0.06)" : "0 2px 8px rgba(15,28,52,0.02)" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <h5 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>{group.main}</h5>
          {!expanded && (
            <span className="badge-count" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
              +{group.subs.length}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", background: expanded ? "var(--accent-soft)" : "transparent", borderRadius: "6px", color: expanded ? "var(--accent)" : "var(--muted)", transition: "all 0.15s" }}>
            {expanded ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemoveGroup(); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", background: "var(--miss-bg)", border: "none", borderRadius: "6px", color: "var(--miss)", cursor: "pointer", transition: "all 0.15s" }}
            title="Usuń branżę"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="profile-chips" style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
          {group.subs.map((sub: string) => (
            <span key={sub} className="chip" style={{ background: "#fff", border: "1px solid var(--border)", padding: "0.35rem 0.75rem" }}>
              {sub} <button type="button" className="chip-x" onClick={(e) => { e.stopPropagation(); onToggle(sub); }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StepExperience({ data, onChange }: { data: ExpType[], onChange: (d: ExpType[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ job_title: "", company_name: "", years: 0, months: 0 });

  const add = () => {
    if (form.job_title && form.company_name && (form.years > 0 || form.months > 0)) {
      const totalMonths = (form.years * 12) + form.months;
      onChange([...data, { job_title: form.job_title, company_name: form.company_name, duration_months: totalMonths }]);
      setForm({ job_title: "", company_name: "", years: 0, months: 0 });
      setShowForm(false);
    }
  };

  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {data.map((job, i) => (
          <ExperienceItem
            key={i}
            job={job}
            onChangeItem={(newJob) => {
              const newData = [...data];
              newData[i] = newJob;
              onChange(newData);
            }}
            onRemove={() => remove(i)}
          />
        ))}
      </div>

      {showForm ? (
        <div style={{ padding: "1.5rem", border: "1px solid var(--border)", borderRadius: "12px", background: "#fafbfd", marginBottom: "1rem" }}>
          <label className="field">
            <span className="field-label">Stanowisko</span>
            <input type="text" className="input" placeholder="np. Frontend Developer" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Firma</span>
            <input type="text" className="input" placeholder="np. Google" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">Lata</span>
              <select className="input" value={form.years} onChange={e => setForm({ ...form, years: parseInt(e.target.value) })}>
                {Array.from({ length: 31 }, (_, i) => <option key={`y-${i}`} value={i}>{i}</option>)}
              </select>
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">Miesiące</span>
              <select className="input" value={form.months} onChange={e => setForm({ ...form, months: parseInt(e.target.value) })}>
                {Array.from({ length: 12 }, (_, i) => <option key={`m-${i}`} value={i}>{i}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn-primary" onClick={add}>Zapisz</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Anuluj</button>
          </div>
        </div>
      ) : (
        <button type="button" className="wizard-add-btn" onClick={() => setShowForm(true)}>
          + Dodaj doświadczenie
        </button>
      )}
    </>
  );
}

function StepEducation({ data, onChange }: { data: EduType[], onChange: (d: EduType[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ university_name: "", field_of_study: "", degree_level: "" });

  const add = () => {
    if (form.university_name && form.field_of_study) {
      onChange([...data, form]);
      setForm({ university_name: "", field_of_study: "", degree_level: "" });
      setShowForm(false);
    }
  };

  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {data.map((edu, i) => (
          <EducationItem
            key={i}
            edu={edu}
            onChangeItem={(newEdu) => {
              const newData = [...data];
              newData[i] = newEdu;
              onChange(newData);
            }}
            onRemove={() => remove(i)}
          />
        ))}
      </div>

      {showForm ? (
        <div style={{ padding: "1.5rem", border: "1px solid var(--border)", borderRadius: "12px", background: "#fafbfd", marginBottom: "1rem" }}>
          <label className="field">
            <span className="field-label">Uczelnia</span>
            <input type="text" className="input" value={form.university_name} onChange={e => setForm({ ...form, university_name: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Kierunek</span>
            <input type="text" className="input" value={form.field_of_study} onChange={e => setForm({ ...form, field_of_study: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Stopień</span>
            <select className="input" value={form.degree_level} onChange={e => setForm({ ...form, degree_level: e.target.value })}>
              <option value="">Wybierz stopień...</option>
              <option value="Średnie">Średnie</option>
              <option value="Licencjat">Licencjat</option>
              <option value="Inżynier">Inżynier</option>
              <option value="Magister">Magister</option>
              <option value="Doktor">Doktor</option>
              <option value="Inne">Inne</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn-primary" onClick={add}>Zapisz</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Anuluj</button>
          </div>
        </div>
      ) : (
        <button type="button" className="wizard-add-btn" onClick={() => setShowForm(true)}>
          + Dodaj wykształcenie
        </button>
      )}
    </>
  );
}

function StepSkillsCombined({ data, onChange }: { data: Skill[], onChange: (d: Skill[]) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<any[]>([]);

  // Browsing states
  const [viewMode, setViewMode] = useState('search');
  const [categories, setCategories] = useState<any[]>([]);
  const [mainCode, setMainCode] = useState("");
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [subCode, setSubCode] = useState("");
  const [browseHits, setBrowseHits] = useState<any[]>([]);
  const [recommendedSkills, setRecommendedSkills] = useState<any[]>([]);

  // Collapse states for selected skills
  const [expandedMainCats, setExpandedMainCats] = useState<Record<string, boolean>>({});
  const [expandedSubCats, setExpandedSubCats] = useState<Record<string, boolean>>({});

  const toggleMainCat = (cat: string) => setExpandedMainCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  const toggleSubCat = (sub: string) => setExpandedSubCats(prev => ({ ...prev, [sub]: !prev[sub] }));

  // Fetch categories on mount
  useEffect(() => {
    api.categories().then(d => setCategories(d.categories || [])).catch(() => { });
  }, []);

  // Fetch subcategories when mainCode changes
  useEffect(() => {
    if (mainCode) {
      setSubCode("");
      setBrowseHits([]);
      api.subcategories(mainCode).then(d => setSubcategories(d.subcategories || [])).catch(() => { });
    } else {
      setSubcategories([]);
      setBrowseHits([]);
    }
  }, [mainCode]);

  // Fetch browse skills when subCode changes
  useEffect(() => {
    if (subCode) {
      api.browseSkills(mainCode, subCode).then(d => setBrowseHits(d.results || [])).catch(() => { });
    } else {
      setBrowseHits([]);
    }
  }, [subCode, mainCode]);

  const fetchRecommendations = () => {
    const currentNames = data.map(s => s.name);
    api.recommendSkills(currentNames).then(d => setRecommendedSkills(d.results || [])).catch(() => { });
  };

  useEffect(() => {
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      api.searchSkills(query).then((d) => setHits(d.results || [])).catch(() => setHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const addSkill = (skillObj: any) => {
    if (!data.find((s) => s.name === skillObj.name)) {
      onChange([...data, {
        name: skillObj.name,
        main_category: skillObj.main_category || "Inne",
        subcategory: skillObj.subcategory || "Ogólne"
      }]);
    }
    setQuery("");
    setHits([]);
  };

  const removeSkill = (name: string) => {
    onChange(data.filter((s) => s.name !== name));
  };

  // unused removeMainCategory

  const removeSubCategory = (mainCat: string, subCat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(data.filter(s => !((s.main_category || "Inne") === mainCat && (s.subcategory || "Ogólne") === subCat)));
  };

  const groupedSkills = React.useMemo(() => {
    const groups: Record<string, Record<string, Skill[]>> = {};
    data.forEach(skill => {
      const main = skill.main_category || "Inne";
      const sub = skill.subcategory || "Ogólne";
      if (!groups[main]) groups[main] = {};
      if (!groups[main][sub]) groups[main][sub] = [];
      groups[main][sub].push(skill);
    });
    return groups;
  }, [data]);

  return (
    <>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <button
            type="button"
            className={`chip ${viewMode === 'search' ? 'chip-skill' : ''}`}
            onClick={() => setViewMode('search')}
            style={{ padding: "0.5rem 1.25rem", border: viewMode === 'search' ? "1px solid var(--accent)" : "1px solid var(--border)", background: viewMode === 'search' ? "var(--accent-soft)" : "transparent", color: viewMode === 'search' ? "var(--accent)" : "var(--muted)", fontWeight: 600, borderRadius: "10px", cursor: "pointer", transition: "all 0.15s ease" }}
          >
            Wyszukaj
          </button>
          <button
            type="button"
            className={`chip ${viewMode === 'browse' ? 'chip-skill' : ''}`}
            onClick={() => setViewMode('browse')}
            style={{ padding: "0.5rem 1.25rem", border: viewMode === 'browse' ? "1px solid var(--accent)" : "1px solid var(--border)", background: viewMode === 'browse' ? "var(--accent-soft)" : "transparent", color: viewMode === 'browse' ? "var(--accent)" : "var(--muted)", fontWeight: 600, borderRadius: "10px", cursor: "pointer", transition: "all 0.15s ease" }}
          >
            Z katalogu
          </button>
          <button
            type="button"
            className={`chip ${viewMode === 'recommend' ? 'chip-skill' : ''}`}
            onClick={() => setViewMode('recommend')}
            style={{ padding: "0.5rem 1.25rem", border: viewMode === 'recommend' ? "1px solid var(--accent)" : "1px solid var(--border)", background: viewMode === 'recommend' ? "var(--accent-soft)" : "transparent", color: viewMode === 'recommend' ? "var(--accent)" : "var(--muted)", fontWeight: 600, borderRadius: "10px", cursor: "pointer", transition: "all 0.15s ease" }}
          >
            Polecane dla Ciebie
          </button>
        </div>

        {viewMode === 'search' && (
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Wyszukaj i dodaj kompetencje</span>
            <input
              type="search"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="np. Python, SQL, Project Management..."
              style={{ fontSize: '1.1rem', padding: '0.75rem 1rem' }}
            />
          </label>
        )}

        {viewMode === 'browse' && (
          <div style={{ display: "flex", gap: "1rem", flexDirection: "column", padding: "1rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
            <div style={{ display: "flex", gap: "1rem" }}>
              <label className="field" style={{ flex: 1, marginBottom: 0 }}>
                <span className="field-label" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Kategoria główna</span>
                <select className="input" style={{ cursor: "pointer" }} value={mainCode} onChange={e => setMainCode(e.target.value)}>
                  <option value="">Wybierz kategorię...</option>
                  {categories.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </label>
              {mainCode && (
                <label className="field" style={{ flex: 1, marginBottom: 0 }}>
                  <span className="field-label" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Podkategoria</span>
                  <select className="input" style={{ cursor: "pointer" }} value={subCode} onChange={e => setSubCode(e.target.value)}>
                    <option value="">Wybierz podkategorię...</option>
                    {subcategories.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                </label>
              )}
            </div>

            {browseHits.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                <h5 style={{ fontSize: "0.9rem", color: "var(--text)", margin: "0 0 0.75rem", fontWeight: 600 }}>Dostępne kompetencje</h5>
                <div className="profile-chips" style={{ gap: "0.5rem", maxHeight: "250px", overflowY: "auto", paddingRight: "0.5rem" }}>
                  {browseHits.map(s => {
                    const isSelected = data.some(existing => existing.name === s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`chip ${isSelected ? 'chip-skill' : ''}`}
                        onClick={() => isSelected ? removeSkill(s.name) : addSkill(s)}
                        style={{
                          padding: "0.4rem 0.8rem",
                          border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                          background: isSelected ? "var(--accent-soft)" : "#fff",
                          color: isSelected ? "var(--accent)" : "var(--text)",
                          cursor: "pointer",
                          fontWeight: isSelected ? 600 : 500,
                          transition: "all 0.15s ease"
                        }}
                      >
                        {s.name} {isSelected && <span style={{ marginLeft: "0.25rem" }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === 'recommend' && recommendedSkills.length > 0 && (
          <div style={{ padding: "1.25rem", background: "var(--surface)", border: "1px solid var(--accent-glow)", borderRadius: "12px", boxShadow: "0 2px 12px rgba(26,95,214,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.1rem" }}>✨</span>
                <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)" }}>Specjalnie dla Ciebie</h4>
              </div>
              <button
                type="button"
                className="btn-text"
                onClick={fetchRecommendations}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Pokaż inne
              </button>
            </div>
            <div className="profile-chips" style={{ gap: "0.6rem", display: "flex", flexWrap: "wrap" }}>
              {recommendedSkills.slice(0, 6).map(s => {
                const isSelected = data.some(existing => existing.name === s.name);
                return (
                  <button
                    key={`rec-${s.id}`}
                    type="button"
                    className={`chip ${isSelected ? 'chip-skill' : 'chip-recommend'}`}
                    onClick={() => isSelected ? removeSkill(s.name) : addSkill(s)}
                    title={isSelected ? "Usuń" : "Dodaj"}
                    style={{
                      padding: "0.4rem 0.8rem",
                      border: isSelected ? "1px solid var(--accent)" : undefined,
                      transition: "all 0.15s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem"
                    }}
                  >
                    {!isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>}
                    {s.name}
                    {isSelected && <span style={{ marginLeft: "0.1rem" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'recommend' && recommendedSkills.length === 0 && (
          <div style={{ padding: "2rem 1.5rem", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "12px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ background: "var(--accent-soft)", width: "48px", height: "48px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", marginBottom: "0.25rem" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, color: "var(--text)" }}>Brak rekomendacji</h4>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)", maxWidth: "320px", lineHeight: "1.5" }}>Dodaj pierwsze kompetencje, abyśmy mogli lepiej dopasować i zaproponować kolejne umiejętności do Twojego profilu.</p>
          </div>
        )}

        {viewMode === 'search' && hits.length > 0 && (
          <ul className="suggest" style={{ maxHeight: "300px", marginTop: "0.5rem" }}>
            {hits.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => addSkill(s)}>
                  {s.name} <span className="suggest-sub">{s.main_category}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.length > 0 && (
        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <h4 style={{ margin: "0 0 1.5rem 0", color: "var(--text)", fontSize: "1.2rem", fontWeight: 700 }}>Twoje kompetencje</h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {Object.keys(groupedSkills).sort().map(mainCat => {
              const mainCatCount = Object.values(groupedSkills[mainCat]).flat().length;
              const isMainExpanded = expandedMainCats[mainCat];

              return (
                <div key={mainCat} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", boxShadow: "0 2px 8px rgba(15,28,52,0.02)", overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => toggleMainCat(mainCat)}
                    style={{ width: "100%", padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: isMainExpanded ? "#f8fafc" : "transparent", border: "none", borderBottom: isMainExpanded ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}
                  >
                    <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>{mainCat}</span>
                    <span style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "0.2rem 0.6rem", borderRadius: "8px", fontSize: "0.85rem", fontWeight: 700 }}>
                      {mainCatCount} {mainCatCount === 1 ? 'kompetencja' : (mainCatCount % 10 >= 2 && mainCatCount % 10 <= 4 && (mainCatCount % 100 < 10 || mainCatCount % 100 >= 20)) ? 'kompetencje' : 'kompetencji'}
                    </span>
                  </button>

                  {isMainExpanded && (
                    <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {Object.keys(groupedSkills[mainCat]).sort().map(subCat => {
                        const subCatCount = groupedSkills[mainCat][subCat].length;
                        const subKey = `${mainCat}-${subCat}`;
                        const isSubExpanded = expandedSubCats[subKey];

                        return (
                          <div key={subCat} style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                            <button
                              type="button"
                              onClick={() => toggleSubCat(subKey)}
                              style={{ width: "100%", padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: isSubExpanded ? "#f8fafc" : "transparent", border: "none", borderBottom: isSubExpanded ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}
                            >
                              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>{subCat}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 700 }}>
                                  {subCatCount} {subCatCount === 1 ? 'kompetencja' : (subCatCount % 10 >= 2 && subCatCount % 10 <= 4 && (subCatCount % 100 < 10 || subCatCount % 100 >= 20)) ? 'kompetencje' : 'kompetencji'}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => removeSubCategory(mainCat, subCat, e)}
                                  style={{ background: "var(--error-soft)", border: "none", color: "var(--error)", borderRadius: "6px", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s ease", padding: 0 }}
                                  title="Usuń podkategorię"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                              </div>
                            </button>

                            {isSubExpanded && (
                              <div className="profile-chips" style={{ gap: "0.5rem", padding: "1rem" }}>
                                {groupedSkills[mainCat][subCat].sort((a, b) => a.name.localeCompare(b.name)).map(skill => (
                                  <div
                                    key={skill.name}
                                    className="chip"
                                    style={{
                                      background: "#fff",
                                      border: "1px solid var(--border)",
                                      padding: "0.4rem 0.6rem 0.4rem 0.8rem",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "0.6rem",
                                      transition: "all 0.15s ease"
                                    }}
                                  >
                                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{skill.name}</span>
                                    <button
                                      type="button"
                                      className="chip-x"
                                      onClick={(e) => { e.stopPropagation(); removeSkill(skill.name); }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  );
}

function StepLanguages({ data, onChange }: { data: LangType[], onChange: (d: LangType[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [langName, setLangName] = useState("");
  const [customLang, setCustomLang] = useState("");
  const [level, setLevel] = useState("B2");
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];

  const COMMON_LANGUAGES = ["", "Angielski", "Niemiecki", "Hiszpański", "Francuski", "Włoski", "Rosyjski", "Chiński", "Polski", "Inny"];

  const add = () => {
    const finalLang = langName === "Inny" ? customLang.trim() : langName.trim();
    if (finalLang && !data.find(l => l.name.toLowerCase() === finalLang.toLowerCase())) {
      onChange([...data, { name: finalLang, proficiency_level: level }]);
      setLangName("");
      setCustomLang("");
      setLevel("B2");
      setShowForm(false);
    }
  };

  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {data.map((lang, i) => (
          <LanguageItem
            key={i}
            lang={lang}
            onChangeItem={(newLang) => {
              const newData = [...data];
              newData[i] = newLang;
              onChange(newData);
            }}
            onRemove={() => remove(i)}
          />
        ))}
      </div>

      {showForm ? (
        <div style={{ padding: "1.5rem", border: "1px solid var(--border)", borderRadius: "12px", background: "#fafbfd", marginBottom: "1rem" }}>
          <label className="field">
            <span className="field-label">Język</span>
            <select className="input" value={langName} onChange={e => setLangName(e.target.value)}>
              {COMMON_LANGUAGES.map(l => (
                <option key={l} value={l}>{l === "" ? "Wybierz język..." : l}</option>
              ))}
            </select>
          </label>
          {langName === "Inny" && (
            <label className="field" style={{ marginTop: "1rem" }}>
              <span className="field-label">Wpisz język</span>
              <input type="text" className="input" placeholder="np. Japoński" value={customLang} onChange={e => setCustomLang(e.target.value)} />
            </label>
          )}
          <label className="field" style={{ marginTop: "1rem" }}>
            <span className="field-label">Poziom</span>
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn-primary" onClick={add}>Zapisz</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Anuluj</button>
          </div>
        </div>
      ) : (
        <button type="button" className="wizard-add-btn" onClick={() => setShowForm(true)}>
          + Dodaj język
        </button>
      )}
    </>
  );
}


function ExperienceItem({ job, onChangeItem, onRemove }: { job: ExpType, onChangeItem: (j: ExpType) => void, onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ padding: "1rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", transition: "all 0.2s ease", borderColor: expanded ? "var(--accent)" : "var(--border)", boxShadow: expanded ? "0 4px 16px rgba(26,95,214,0.06)" : "0 2px 8px rgba(15,28,52,0.02)" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>{job.job_title}</h4>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)", fontWeight: 500 }}>{job.company_name} • {Math.floor(job.duration_months / 12)} lat, {job.duration_months % 12} miesięcy</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", background: expanded ? "var(--accent-soft)" : "transparent", borderRadius: "6px", color: expanded ? "var(--accent)" : "var(--muted)", transition: "all 0.15s" }}>
            {expanded ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", background: "var(--miss-bg)", border: "none", borderRadius: "6px", color: "var(--miss)", cursor: "pointer", transition: "all 0.15s" }}
            title="Usuń"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: "1rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1rem", cursor: "default" }} onClick={e => e.stopPropagation()}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Stanowisko</span>
            <input type="text" className="input" placeholder="np. Frontend Developer" value={job.job_title} onChange={e => onChangeItem({ ...job, job_title: e.target.value })} />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Firma</span>
            <input type="text" className="input" placeholder="np. Google" value={job.company_name} onChange={e => onChangeItem({ ...job, company_name: e.target.value })} />
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label className="field" style={{ flex: 1, marginBottom: 0 }}>
              <span className="field-label">Lata</span>
              <select className="input" value={Math.floor(job.duration_months / 12)} onChange={e => onChangeItem({ ...job, duration_months: (parseInt(e.target.value) * 12) + (job.duration_months % 12) })}>
                {Array.from({ length: 31 }, (_, i) => <option key={`y-${i}`} value={i}>{i}</option>)}
              </select>
            </label>
            <label className="field" style={{ flex: 1, marginBottom: 0 }}>
              <span className="field-label">Miesiące</span>
              <select className="input" value={job.duration_months % 12} onChange={e => onChangeItem({ ...job, duration_months: (Math.floor(job.duration_months / 12) * 12) + parseInt(e.target.value) })}>
                {Array.from({ length: 12 }, (_, i) => <option key={`m-${i}`} value={i}>{i}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function EducationItem({ edu, onChangeItem, onRemove }: { edu: EduType, onChangeItem: (e: EduType) => void, onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ padding: "1rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", transition: "all 0.2s ease", borderColor: expanded ? "var(--accent)" : "var(--border)", boxShadow: expanded ? "0 4px 16px rgba(26,95,214,0.06)" : "0 2px 8px rgba(15,28,52,0.02)" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>{edu.university_name}</h4>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)", fontWeight: 500 }}>{edu.field_of_study} • {edu.degree_level}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", background: expanded ? "var(--accent-soft)" : "transparent", borderRadius: "6px", color: expanded ? "var(--accent)" : "var(--muted)", transition: "all 0.15s" }}>
            {expanded ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", background: "var(--miss-bg)", border: "none", borderRadius: "6px", color: "var(--miss)", cursor: "pointer", transition: "all 0.15s" }}
            title="Usuń"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: "1rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1rem", cursor: "default" }} onClick={e => e.stopPropagation()}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Uczelnia</span>
            <input type="text" className="input" value={edu.university_name} onChange={e => onChangeItem({ ...edu, university_name: e.target.value })} />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Kierunek</span>
            <input type="text" className="input" value={edu.field_of_study} onChange={e => onChangeItem({ ...edu, field_of_study: e.target.value })} />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Stopień</span>
            <select className="input" value={edu.degree_level} onChange={e => onChangeItem({ ...edu, degree_level: e.target.value })}>
              <option value="">Wybierz stopień...</option>
              <option value="Średnie">Średnie</option>
              <option value="Licencjat">Licencjat</option>
              <option value="Inżynier">Inżynier</option>
              <option value="Magister">Magister</option>
              <option value="Doktor">Doktor</option>
              <option value="Inne">Inne</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function LanguageItem({ lang, onChangeItem, onRemove }: { lang: LangType, onChangeItem: (l: LangType) => void, onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];
  // common languages

  return (
    <div style={{ padding: "1rem 1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", transition: "all 0.2s ease", borderColor: expanded ? "var(--accent)" : "var(--border)", boxShadow: expanded ? "0 4px 16px rgba(26,95,214,0.06)" : "0 2px 8px rgba(15,28,52,0.02)" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>{lang.name}</h4>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)", fontWeight: 500 }}>Poziom: {lang.proficiency_level}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", background: expanded ? "var(--accent-soft)" : "transparent", borderRadius: "6px", color: expanded ? "var(--accent)" : "var(--muted)", transition: "all 0.15s" }}>
            {expanded ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", background: "var(--miss-bg)", border: "none", borderRadius: "6px", color: "var(--miss)", cursor: "pointer", transition: "all 0.15s" }}
            title="Usuń"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: "1rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1rem", cursor: "default" }} onClick={e => e.stopPropagation()}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Język</span>
            <input type="text" className="input" value={lang.name} onChange={e => onChangeItem({ ...lang, name: e.target.value })} />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Poziom</span>
            <select className="input" value={lang.proficiency_level} onChange={e => onChangeItem({ ...lang, proficiency_level: e.target.value })}>
              {LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
export default function UserProfileWizard({ onComplete, onCancel }: { onComplete: (d: UserProfile) => void, onCancel?: () => void }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile>({
    education: [],
    experience: [],
    interested_industries: [],
    hard_skills: [],
    languages: []
  });

  useEffect(() => {
    api.getProfile().then(d => {
      if (d.profile_data) {
        setProfile({
          education: d.profile_data.education || [],
          experience: d.profile_data.experience || [],
          interested_industries: d.profile_data.interested_industries || [],
          hard_skills: d.profile_data.hard_skills || [],
          languages: d.profile_data.languages || []
        });
      }
      setLoading(false);
    }).catch(err => {
      console.error("Failed to load profile", err);
      setLoading(false);
    });
  }, []);

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const saveProfile = async () => {
    setError("");
    setSaving(true);
    try {
      await api.saveProfile(profile);
      onComplete(profile);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const currentStepData = [
    {
      title: "Dodaj swoją historię zatrudnienia",
      content: <StepExperience data={profile.experience} onChange={(d) => setProfile({ ...profile, experience: d })} />
    },
    {
      title: "Podaj informacje o ukończonych szkołach lub uczelniach",
      content: <StepEducation data={profile.education} onChange={(d) => setProfile({ ...profile, education: d })} />
    },
    {
      title: "Wyszukaj kompetencje, które posiadasz",
      content: <StepSkillsCombined data={profile.hard_skills} onChange={(d) => setProfile({ ...profile, hard_skills: d })} />
    },
    {
      title: "Dodaj języki, którymi się posługujesz",
      content: <StepLanguages data={profile.languages} onChange={(d) => setProfile({ ...profile, languages: d })} />
    },
    {
      title: "W jakich branżach chcesz pracować?",
      content: <StepIndustries data={profile.interested_industries} onChange={(d) => setProfile({ ...profile, interested_industries: d })} />
    }
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ color: 'var(--muted)', fontSize: '1.1rem', fontWeight: 600 }}>Ładowanie profilu...</div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: '100%', maxWidth: '600px' }}>
          <div className="alert">{error}</div>
        </div>
      )}
      <WizardLayout
        step={step}
        totalSteps={STEPS.length}
        title={currentStepData[step].title}
        subtitle={(currentStepData[step] as any).subtitle}
        onNext={nextStep}
        onPrev={prevStep}
        onSave={saveProfile}
        saving={saving}
        onCancel={onCancel}
        setStep={setStep}
      >
        {currentStepData[step].content}
      </WizardLayout>
    </>
  );
}

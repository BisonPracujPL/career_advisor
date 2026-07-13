import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import {
  EducationItem as EduType,
  ExperienceItem as ExpType,
  IndustryItem,
  LanguageItem as LangType,
} from "../types";
import { SingleSelect } from "./ui";

const NUM_OPTIONS = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ value: String(i), label: String(i) }));
const DEGREE_OPTIONS = [
  { value: "", label: "Wybierz stopień..." },
  { value: "Średnie", label: "Średnie" },
  { value: "Licencjat", label: "Licencjat" },
  { value: "Inżynier", label: "Inżynier" },
  { value: "Magister", label: "Magister" },
  { value: "Doktor", label: "Doktor" },
  { value: "Inne", label: "Inne" },
];

export function ProfileIndustriesEditor({ data, onChange }: { data: IndustryItem[], onChange: (d: IndustryItem[]) => void }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [mainCat, setMainCat] = useState("");

  useEffect(() => {
    api.offerCategories().then(d => setCategories(d.categories || [])).catch(() => { });
  }, []);

  const normalizedData = useMemo(() => {
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
          <SingleSelect
            value={mainCat}
            onChange={setMainCat}
            placeholder="Wybierz z listy..."
            options={[
              { value: "", label: "Wybierz z listy..." },
              ...categories.map((c) => ({ value: c.code, label: c.name })),
            ]}
          />
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

export function ProfileExperienceEditor({ data, onChange }: { data: ExpType[], onChange: (d: ExpType[]) => void }) {
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
              <SingleSelect
                value={String(form.years)}
                onChange={(v) => setForm({ ...form, years: parseInt(v) })}
                options={NUM_OPTIONS(31)}
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">Miesiące</span>
              <SingleSelect
                value={String(form.months)}
                onChange={(v) => setForm({ ...form, months: parseInt(v) })}
                options={NUM_OPTIONS(12)}
              />
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

export function ProfileEducationEditor({ data, onChange }: { data: EduType[], onChange: (d: EduType[]) => void }) {
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
            <SingleSelect
              value={form.degree_level}
              onChange={(v) => setForm({ ...form, degree_level: v })}
              placeholder="Wybierz stopień..."
              options={DEGREE_OPTIONS}
            />
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

export function ProfileLanguagesEditor({ data, onChange }: { data: LangType[], onChange: (d: LangType[]) => void }) {
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
            <SingleSelect
              value={langName}
              onChange={setLangName}
              placeholder="Wybierz język..."
              options={COMMON_LANGUAGES.map(l => ({
                value: l,
                label: l === "" ? "Wybierz język..." : l,
              }))}
            />
          </label>
          {langName === "Inny" && (
            <label className="field" style={{ marginTop: "1rem" }}>
              <span className="field-label">Wpisz język</span>
              <input type="text" className="input" placeholder="np. Japoński" value={customLang} onChange={e => setCustomLang(e.target.value)} />
            </label>
          )}
          <label className="field" style={{ marginTop: "1rem" }}>
            <span className="field-label">Poziom</span>
            <SingleSelect
              value={level}
              onChange={setLevel}
              options={LEVELS.map((lvl) => ({ value: lvl, label: lvl }))}
            />
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
              <SingleSelect
                value={String(Math.floor(job.duration_months / 12))}
                onChange={(v) => onChangeItem({ ...job, duration_months: (parseInt(v) * 12) + (job.duration_months % 12) })}
                options={NUM_OPTIONS(31)}
              />
            </label>
            <label className="field" style={{ flex: 1, marginBottom: 0 }}>
              <span className="field-label">Miesiące</span>
              <SingleSelect
                value={String(job.duration_months % 12)}
                onChange={(v) => onChangeItem({ ...job, duration_months: (Math.floor(job.duration_months / 12) * 12) + parseInt(v) })}
                options={NUM_OPTIONS(12)}
              />
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
            <SingleSelect
              value={edu.degree_level}
              onChange={(v) => onChangeItem({ ...edu, degree_level: v })}
              placeholder="Wybierz stopień..."
              options={DEGREE_OPTIONS}
            />
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
            <SingleSelect
              value={lang.proficiency_level}
              onChange={(v) => onChangeItem({ ...lang, proficiency_level: v })}
              options={LEVELS.map((lvl) => ({ value: lvl, label: lvl }))}
            />
          </label>
        </div>
      )}
    </div>
  );
}
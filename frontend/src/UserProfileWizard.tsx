import React, { useState, useEffect, ReactNode } from "react";
import { api } from "./api";
import { SkillsProfileEditor } from "./components/SkillsProfileEditor";
import {
  ProfileEducationEditor,
  ProfileExperienceEditor,
  ProfileIndustriesEditor,
  ProfileLanguagesEditor,
} from "./components/ProfileStepEditors";
import { UserProfile, Skill, IndustryItem } from "./types";

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
      content: <ProfileExperienceEditor data={profile.experience} onChange={(d) => setProfile({ ...profile, experience: d })} />
    },
    {
      title: "Podaj informacje o ukończonych szkołach lub uczelniach",
      content: <ProfileEducationEditor data={profile.education} onChange={(d) => setProfile({ ...profile, education: d })} />
    },
    {
      title: "Wyszukaj kompetencje, które posiadasz",
      content: <SkillsProfileEditor data={profile.hard_skills} onChange={(d) => setProfile({ ...profile, hard_skills: d })} />
    },
    {
      title: "Dodaj języki, którymi się posługujesz",
      content: <ProfileLanguagesEditor data={profile.languages} onChange={(d) => setProfile({ ...profile, languages: d })} />
    },
    {
      title: "W jakich branżach chcesz pracować?",
      content: <ProfileIndustriesEditor data={profile.interested_industries} onChange={(d) => setProfile({ ...profile, interested_industries: d })} />
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

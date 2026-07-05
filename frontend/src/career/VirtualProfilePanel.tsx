import { useState } from "react";
import { SkillsProfileEditor } from "../components/SkillsProfileEditor";
import {
  ProfileEducationEditor,
  ProfileExperienceEditor,
  ProfileIndustriesEditor,
  ProfileLanguagesEditor,
} from "../components/ProfileStepEditors";
import { VirtualCareerProfile } from "./careerVirtualProfile";

interface VirtualProfilePanelProps {
  profile: VirtualCareerProfile;
  onChange: (profile: VirtualCareerProfile) => void;
  onCopyFromReal: () => void;
  onResetVirtual: () => void;
}

function profileSummary(profile: VirtualCareerProfile) {
  const parts = [
    `${profile.hard_skills.length} komp.`,
    `${profile.experience.length} dośw.`,
    `${profile.education.length} wyksz.`,
    `${profile.interested_industries.length} branż`,
  ];
  return parts.join(" · ");
}

export function VirtualProfilePanel({
  profile,
  onChange,
  onCopyFromReal,
  onResetVirtual,
}: VirtualProfilePanelProps) {
  const [open, setOpen] = useState(false);
  const patch = (partial: Partial<VirtualCareerProfile>) =>
    onChange({ ...profile, ...partial });

  return (
    <section className={`virtual-profile-panel panel ${open ? "virtual-profile-panel--open" : ""}`}>
      <button
        type="button"
        className="virtual-profile-panel__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="virtual-profile-panel__title">Mój wirtualny profil</span>
        <span className="virtual-profile-panel__meta">
          <span className="virtual-profile-panel__count">{profileSummary(profile)}</span>
          <span className="virtual-profile-panel__chev" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </span>
      </button>

      {open && (
        <div className="virtual-profile-panel__body">
          <p className="muted virtual-profile-panel__hint">
            Te same sekcje co w Moim profilu — zmiany tylko w symulacji (localStorage), bez
            zapisu na koncie.
          </p>
          <div className="virtual-profile-panel__actions">
            <button type="button" className="btn-secondary" onClick={onCopyFromReal}>
              Skopiuj z mojego profilu
            </button>
            <button type="button" className="btn-secondary" onClick={onResetVirtual}>
              Reset wirtualny
            </button>
          </div>

          <div className="virtual-profile-sections">
            <section className="virtual-profile-section">
              <h3 className="virtual-profile-section__title">Dodaj swoją historię zatrudnienia</h3>
              <ProfileExperienceEditor
                data={profile.experience}
                onChange={(experience) => patch({ experience })}
              />
            </section>

            <section className="virtual-profile-section">
              <h3 className="virtual-profile-section__title">
                Podaj informacje o ukończonych szkołach lub uczelniach
              </h3>
              <ProfileEducationEditor
                data={profile.education}
                onChange={(education) => patch({ education })}
              />
            </section>

            <section className="virtual-profile-section">
              <h3 className="virtual-profile-section__title">Wyszukaj kompetencje, które posiadasz</h3>
              <SkillsProfileEditor
                data={profile.hard_skills}
                onChange={(hard_skills) => patch({ hard_skills })}
              />
            </section>

            <section className="virtual-profile-section">
              <h3 className="virtual-profile-section__title">Dodaj języki, którymi się posługujesz</h3>
              <ProfileLanguagesEditor
                data={profile.languages}
                onChange={(languages) => patch({ languages })}
              />
            </section>

            <section className="virtual-profile-section">
              <h3 className="virtual-profile-section__title">W jakich branżach chcesz pracować?</h3>
              <ProfileIndustriesEditor
                data={profile.interested_industries}
                onChange={(interested_industries) => patch({ interested_industries })}
              />
            </section>
          </div>
        </div>
      )}
    </section>
  );
}

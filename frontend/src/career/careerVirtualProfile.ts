import { ExperienceItem, Skill, UserProfile } from "../types";

const STORAGE_KEY = "career_advisor_virtual_profile";

export interface VirtualCareerProfile {
  hard_skills: Skill[];
  experience: ExperienceItem[];
  career_path: NonNullable<UserProfile["career_path"]>;
  interested_industries: UserProfile["interested_industries"];
}

export function emptyVirtualProfile(): VirtualCareerProfile {
  return {
    hard_skills: [],
    experience: [
      {
        job_title: "Specjalista",
        company_name: "Profil wirtualny",
        duration_months: 18,
      },
    ],
    career_path: { steps: [] },
    interested_industries: [],
  };
}

export function loadVirtualProfile(): VirtualCareerProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VirtualCareerProfile;
  } catch {
    return null;
  }
}

export function saveVirtualProfile(profile: VirtualCareerProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function virtualFromReal(
  skills: Skill[],
  profileData: UserProfile | null
): VirtualCareerProfile {
  return {
    hard_skills: [...skills],
    experience: profileData?.experience?.length
      ? [...profileData.experience]
      : emptyVirtualProfile().experience,
    career_path: { steps: [] },
    interested_industries: profileData?.interested_industries || [],
  };
}

export function mergeSkills(existing: Skill[], incoming: Skill[]): Skill[] {
  let next = [...existing];
  for (const skill of incoming) {
    if (!next.some((s) => String(s.id) === String(skill.id))) {
      next = [...next, skill];
    }
  }
  return next;
}

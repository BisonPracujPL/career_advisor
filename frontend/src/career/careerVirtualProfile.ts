import {
  EducationItem,
  ExperienceItem,
  IndustryItem,
  LanguageItem,
  Skill,
  UserProfile,
} from "../types";

const STORAGE_KEY = "career_advisor_virtual_profile";

export interface VirtualCareerProfile {
  hard_skills: Skill[];
  experience: ExperienceItem[];
  education: EducationItem[];
  languages: LanguageItem[];
  career_path: NonNullable<UserProfile["career_path"]>;
  interested_industries: IndustryItem[];
}

export function emptyVirtualProfile(): VirtualCareerProfile {
  return {
    hard_skills: [],
    experience: [],
    education: [],
    languages: [],
    career_path: { steps: [] },
    interested_industries: [],
  };
}

export function loadVirtualProfile(): VirtualCareerProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VirtualCareerProfile>;
    return {
      ...emptyVirtualProfile(),
      ...parsed,
      career_path: parsed.career_path || { steps: [] },
    };
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
    experience: profileData?.experience?.length ? [...profileData.experience] : [],
    education: profileData?.education?.length ? [...profileData.education] : [],
    languages: profileData?.languages?.length ? [...profileData.languages] : [],
    career_path: { steps: [] },
    interested_industries: profileData?.interested_industries?.length
      ? [...profileData.interested_industries]
      : [],
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

export function revertVirtualPathToCheckpoint(
  profile: VirtualCareerProfile,
  stepsToKeep: number
): VirtualCareerProfile {
  const allSteps = profile.career_path?.steps || [];
  const keptSteps = allSteps.slice(0, Math.max(0, stepsToKeep));

  const pathSkillIds = new Set(
    allSteps.flatMap((s) => (s.skill_ids?.length ? s.skill_ids : [s.skill_id]))
  );

  const baseSkills = profile.hard_skills.filter(
    (s) => !pathSkillIds.has(String(s.id))
  );

  let hard_skills = [...baseSkills];
  for (const step of keptSteps) {
    const ids = step.skill_ids?.length ? step.skill_ids : [step.skill_id];
    const stepSkills = ids.map((id, idx) => {
      const found = profile.hard_skills.find((s) => String(s.id) === String(id));
      return found || { id, name: idx === 0 ? step.skill_name : step.skill_name };
    });
    hard_skills = mergeSkills(hard_skills, stepSkills);
  }

  return {
    ...profile,
    hard_skills,
    career_path: {
      ...profile.career_path,
      steps: keptSteps,
    },
  };
}

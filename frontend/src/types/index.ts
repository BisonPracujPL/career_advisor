export interface Skill {
  id?: string | number;
  name: string;
  main_category?: string;
  subcategory?: string;
}

export interface ExperienceItem {
  job_title: string;
  company_name: string;
  duration_months: number;
}

export interface EducationItem {
  university_name: string;
  field_of_study: string;
  degree_level: string;
}

export interface LanguageItem {
  name: string;
  proficiency_level: string;
}

export type IndustryItem = string | { main: string; subs: string[] };

export interface CareerPathStep {
  skill_id: string;
  skill_name: string;
  skill_ids?: string[];
  step_type?: "single" | "bundle";
  lead_main_category: string;
  lead_sub_category: string;
  match_before: number;
  match_after: number;
}

export interface CareerPathProgress {
  steps?: CareerPathStep[];
  completed_milestones?: string[];
  role_reached?: boolean;
  chosen_branch?: { lead_main_category: string; lead_sub_category: string };
}

export interface UserProfile {
  experience: ExperienceItem[];
  education: EducationItem[];
  hard_skills: Skill[];
  languages: LanguageItem[];
  interested_industries: IndustryItem[];
  career_path?: CareerPathProgress;
}

export interface Offer {
  offer_id: string | number;
  job_title: string;
  lead_main_category: string;
  lead_sub_category: string;
  region_name: string;
  position_levels: string[];
  overlap?: {
    offer_coverage_pct: number;
    matched_count: number;
    offer_skill_count: number;
    profile_skill_count: number;
    matched_skills: Skill[];
    missing_skills: Skill[];
  };
  similarity_pct?: number;
  role_similarity_pct?: number;
  display_pct?: number;
}

export interface Filters {
  market_pillar: string;
  lead_main_category: string;
  lead_sub_category: string;
  region_name: string;
  position_level_groups: string[];
}

export interface SegmentKey {
  lead_main_category: string;
  lead_sub_category: string;
}

export interface OfferSkill {
  id: string;
  name: string;
  probability?: number;
}

export interface OfferDetail {
  offer_id: number;
  job_title: string;
  lead_main_category: string;
  lead_sub_category: string;
  pillar_label?: string;
  segment_display_label?: string;
  region_name: string;
  country_name: string;
  work_modes: string[];
  work_schedules: string[];
  position_levels: string[];
  type_of_contract: string[];
  keywords: string[];
  is_remote_work: boolean | null;
  salary_uop: SalaryBlock | null;
  salary_b2b: SalaryBlock | null;
  requirements_expected: string;
  requirements_optional: string;
  responsibilities: string;
  technologies_expected: string;
  skills: OfferSkill[];
  overlap?: Offer["overlap"];
  similarity_pct?: number | null;
  similar_offers?: Offer[];
  segment_offers?: Offer[];
  segment: SegmentKey;
}

export interface SalaryBlock {
  from: number | null;
  to: number | null;
  currency: string;
  duration: string;
  kind: string;
}

export interface SegmentSkillStat {
  id: string;
  name: string;
  offer_count: number;
  pct_of_segment: number;
}

export interface SegmentAnalytics {
  lead_main_category: string;
  lead_sub_category: string;
  pillar_label?: string;
  display_label?: string;
  label: string;
  offer_count: number;
  top_skills: SegmentSkillStat[];
  skills_wordcloud_png?: string | null;
  level_snapshot?: {
    level_id?: string;
    level: string;
    offer_count: number;
    pct?: number;
    median_salary: number | null;
    salary_n: number;
  }[];
  seniority_distribution: { level: string; count: number; pct: number }[];
  salary_by_level: { level: string; n: number; median: number; p25: number; p75: number }[];
  salary_uop_monthly: { n: number; median: number; p25: number; p75: number } | null;
  salary_b2b_monthly: { n: number; median: number; p25: number; p75: number } | null;
  skill_fit: {
    have: SegmentSkillStat[];
    missing: SegmentSkillStat[];
    coverage_pct: number;
  };
  match_score: {
    matching_offers: number;
    avg_similarity_pct: number;
    avg_coverage_pct: number;
  } | null;
  filters_applied?: { region_name?: string; position_level_groups?: string[] };
  salary_normalization?: { unit: string; hourly_to_monthly_hours: number };
  sample_offers: Offer[];
}

export type ExploreView = "results" | "offer" | "segment";

export interface CareerPathSegment {
  lead_main_category: string;
  lead_sub_category: string;
  display_label: string;
  offer_count: number;
  match_pct: number;
  skill_coverage_pct: number;
  top_missing_skills: SegmentSkillStat[];
  median_salary_uop: number | null;
}

export type RoadmapNodeStatus = "completed" | "active" | "locked" | "available";

export interface SegmentSalaryLevel {
  level_id: string;
  label: string;
  median: number;
  offers: number;
}

export interface SegmentInsight {
  offer_count: number;
  median_salary_uop: number | null;
  salary_by_level: Partial<Record<"junior" | "mid" | "senior", SegmentSalaryLevel | null>>;
}

export interface TreeSegmentSummary {
  display_label: string;
  match_pct: number;
  lead_main_category: string;
  lead_sub_category: string;
  offer_count?: number;
  segment_insight?: SegmentInsight;
}

export interface TreeStateNode {
  id: string;
  kind: "state";
  status: "completed" | "active";
  depth: number;
  title: string;
  subtitle: string;
  skill_ids: string[];
  skills: Skill[];
  match_pct: number;
  top_segments: TreeSegmentSummary[];
}

export interface TreeBranchNode {
  id: string;
  kind: "branch";
  branch_type?: "single" | "bundle";
  status: "completed" | "available" | "locked";
  skill_id: string;
  skill_name: string;
  skill_ids?: string[];
  skills?: Skill[];
  title: string;
  subtitle: string;
  lead_main_category: string;
  lead_sub_category: string;
  segment_label: string;
  match_before: number;
  match_after: number;
  match_delta: number;
  pct_of_segment?: number;
  segment_insight?: SegmentInsight;
}

export type TreeNode = TreeStateNode | TreeBranchNode;

export interface CareerTreeLevel {
  state: TreeStateNode;
  branches: TreeBranchNode[];
  chosen_branch_id: string | null;
}

export interface CareerTree {
  title: string;
  subtitle: string;
  levels: CareerTreeLevel[];
  depth: number;
  best_segment: {
    display_label: string;
    match_pct: number;
    lead_main_category: string;
    lead_sub_category: string;
  } | null;
  total_skills: number;
  branch_comparison: BranchComparison[];
  next_level_readiness: NextLevelReadiness | null;
  career_narrative: CareerNarrative;
}

export interface BranchComparison {
  skill_name: string;
  branch_type?: "single" | "bundle";
  segment_label: string;
  match_before: number;
  match_after: number;
  match_delta: number;
  lead_main_category: string;
  lead_sub_category: string;
}

export interface NextLevelReadiness {
  current_level: "junior" | "mid" | "senior";
  next_level: "junior" | "mid" | "senior";
  segment_label: string;
  lead_main_category: string;
  lead_sub_category: string;
  match_now: number;
  match_target_level: number;
  match_after_bundle: number;
  bundle_delta: number;
  missing_skills: { id: string; name: string }[];
}

export interface CareerNarrative {
  headline: string;
  body: string;
  goal_label?: string | null;
  recommended_skill?: string;
  recommended_delta?: number;
}

export function segmentInsightKey(leadMain: string, leadSub: string) {
  return `${leadMain}|${leadSub}`;
}

/** @deprecated legacy linear roadmap */
export interface RoadmapNode {
  id: string;
  kind: "skill" | "milestone" | "role" | "segment";
  status: RoadmapNodeStatus;
  title: string;
  subtitle: string;
  lane: number;
  skill_id?: string;
  skill_name?: string;
  pct_of_segment?: number;
  lead_main_category?: string;
  lead_sub_category?: string;
  match_pct?: number;
}

/** @deprecated legacy linear roadmap */
export interface CareerRoadmap {
  title: string;
  subtitle: string;
  target_segment: CareerPathSegment;
  skill_coverage_pct: number;
  match_pct: number;
  median_salary_uop: number | null;
  nodes: RoadmapNode[];
  hidden_completed_skills: number;
  branch: {
    label: string;
    status: RoadmapNodeStatus;
    options: RoadmapNode[];
  };
}

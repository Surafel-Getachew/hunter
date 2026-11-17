import { skills } from "../config.ts";
import type { Job } from "../types.ts";

/** Titles that are clearly in scope on their own. */
const SPECIFIC_TITLE = /\b(full[- ]?stack|front[- ]?end|react|next\.?js|node(\.?js)?|typescript|javascript|web (developer|engineer))\b/i;

/** Titles that could be anything; kept only when the description is about our stack. */
const GENERIC_TITLE =
  /\b(software (engineer|developer)|product engineer|application (engineer|developer)|ai engineer|founding engineer|developer|engineer)\b/i;

/** The title itself names our stack, as opposed to just saying "full stack". */
const TITLE_NAMES_OUR_STACK = /\b(react|next\.?js|node(\.?js)?|typescript|javascript)\b/i;

/** Wrong kind of role, whatever the stack. */
const EXCLUDED_ROLE = new RegExp(
  [
    "\\b(intern(ship)?|junior|jr\\.?|graduate|apprentice|trainee|entry[- ]level|volunteer|unpaid)\\b",
    "\\b(manager|director|head of|vp|vice president|chief|cto)\\b",
    "\\b(recruiter|sales|marketing|account|customer|support|success|designer|writer|analyst|consultant)\\b",
    "\\b(qa|quality assurance|sdet|tester)\\b",
    "\\b(salesforce|sap|wordpress|shopify|drupal|magento|unity|unreal|game|solidity|web3|blockchain)\\b",
  ].join("|"),
  "i",
);

/**
 * Off-stack specialisations; dropped unless the title also names our stack:
 * "Full Stack (Vue/React)" stays, ".NET Full-stack Developer" goes.
 */
const OFF_STACK_TITLE = new RegExp(
  [
    "\\b(data (scientist|engineer)|machine learning engineer|ml engineer|research(er)?)\\b",
    "\\b(devops|sre|site reliability|platform engineer|infrastructure|security|network|cloud engineer)\\b",
    "\\b(android|ios|swift|kotlin|flutter|mobile|embedded|firmware|hardware|fpga)\\b",
    "\\b(java|php|laravel|symfony|ruby|rails|golang|rust|scala|elixir|clojure|c\\+\\+|django|angular|vue(\\.?js)?|svelte)\\b",
    "(^|\\W)(\\.net|c#)(\\W|$)",
  ].join("|"),
  "i",
);

export interface RelevanceResult {
  relevant: boolean;
  reason: string;
  skillScore: number;
  matchedSkills: string[];
  /** Kept on the title alone, because the posting has no description. */
  titleOnly?: boolean;
}

export function assessRelevance(job: Job): RelevanceResult {
  const matchedSkills: string[] = [];
  let skillScore = 0;
  let hasCoreSkill = false;
  const haystack = `${job.title}\n${job.description}`;
  for (const skill of skills) {
    if (skill.pattern.test(haystack)) {
      matchedSkills.push(skill.label);
      skillScore += skill.weight;
      if (skill.core) hasCoreSkill = true;
    }
  }
  const result = { skillScore, matchedSkills };

  const excludedRole = `${job.title} ${job.employmentType ?? ""}`.match(EXCLUDED_ROLE);
  if (excludedRole) return { ...result, relevant: false, reason: `title: ${excludedRole[0].trim()}` };
  if (!hasCoreSkill) {
    // Boards that give no description (Jobgether) can only be judged by title.
    const titleOnly = !job.description.trim() && SPECIFIC_TITLE.test(job.title) && !OFF_STACK_TITLE.test(job.title);
    if (titleOnly) {
      return { ...result, relevant: true, titleOnly, reason: "title matches (no description to check the stack)" };
    }
    return { ...result, relevant: false, reason: "no React/Node/TypeScript in posting" };
  }
  const offStack = job.title.match(OFF_STACK_TITLE);
  if (offStack && !TITLE_NAMES_OUR_STACK.test(job.title)) {
    return { ...result, relevant: false, reason: `title: ${offStack[0].trim()}` };
  }
  if (SPECIFIC_TITLE.test(job.title)) return { ...result, relevant: true, reason: "title matches" };
  if (GENERIC_TITLE.test(job.title) && skillScore >= 5) {
    return { ...result, relevant: true, reason: "generic title, stack matches" };
  }
  return { ...result, relevant: false, reason: "title out of scope" };
}

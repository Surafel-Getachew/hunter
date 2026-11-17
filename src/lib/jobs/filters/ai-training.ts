import type { Job } from "../types.ts";

/** "AI Trainer", "AI Tutor – Software Engineer", "LLM Evaluator", "RLHF …". */
const AI_TRAINER_TITLE = /\b(ai|llm|model)\s+(trainer|tutor|training|evaluator|evaluation|rater)\b|\brlhf\b|\bdata trainer\b/i;

/** "Python Coding Specialist", "AI Code Reviewer", "Software Engineering Expert"… */
const CODING_EXPERT_TITLE =
  /\b(coding|code|software|programming|javascript|typescript|python|react|full[- ]?stack)\b.*\b(expert|specialist|evaluator|reviewer|annotator|contributor|tutor)\b/i;

/** The description is about training models, not shipping a product. */
const AI_CONTEXT =
  /\b(train(ing)?\s+(ai|llms?|(ai\s+)?models?)|ai models?|large language models?|llms?|rlhf|frontier (ai|models|labs)|ai labs?|model (outputs|responses)|post-training)\b/i;

/**
 * The title itself must be about code: descriptions of audio, language or
 * finance trainer projects often list Python as a nice-to-have.
 */
const CODING_TITLE = /\b(coding|code|coder|software|programming|programmer|developer|engineer(ing)?|javascript|typescript|python|react|node|full[- ]?stack|web)\b/i;

const EXCLUDED = /\b(manager|director|head of|recruiter|sales|marketing|lead generation)\b/i;

/** Coding-flavoured AI-training contracts. Non-coding trainer roles (audio, languages, finance…) are left out. */
export function isAiTrainingRole(job: Job): boolean {
  if (EXCLUDED.test(job.title) || !CODING_TITLE.test(job.title)) return false;
  return AI_TRAINER_TITLE.test(job.title) || (CODING_EXPERT_TITLE.test(job.title) && AI_CONTEXT.test(job.description));
}

// Values and labels shared by the database schema, the server and the browser.
// Client-safe: no database or Node imports.

export const ELIGIBILITIES = ["open", "likely", "unknown", "possible", "restricted"] as const;
export const JOB_CATEGORIES = ["main", "ai-training"] as const;

export const COMPANY_KINDS = ["unknown", "employer", "agency", "talent_network"] as const;
export type CompanyKind = (typeof COMPANY_KINDS)[number];
export const COMPANY_KIND_LABEL: Record<CompanyKind, string> = {
  unknown: "Unknown",
  employer: "Direct employer",
  agency: "Recruiting agency",
  talent_network: "Talent network",
};

export const SKIP_REASONS = [
  "wrong_stack",
  "seniority",
  "location_not_open",
  "salary",
  "company",
  "duplicate",
  "closed",
  "other",
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];
export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  wrong_stack: "Wrong stack",
  seniority: "Wrong seniority",
  location_not_open: "Not open to my location",
  salary: "Pay too low",
  company: "Don't want this company",
  duplicate: "Duplicate",
  closed: "Posting closed",
  other: "Other",
};

export const APPLICATION_CHANNELS = [
  "company_site",
  "easy_apply",
  "email",
  "referral",
  "talent_network",
  "recruiter_inbound",
  "direct_message",
  "other",
] as const;
export type ApplicationChannel = (typeof APPLICATION_CHANNELS)[number];
export const CHANNEL_LABEL: Record<ApplicationChannel, string> = {
  company_site: "Company's application page",
  easy_apply: "LinkedIn Easy Apply",
  email: "Email",
  referral: "Referral",
  talent_network: "Talent network",
  recruiter_inbound: "Recruiter contacted me",
  direct_message: "Messaged the hiring manager",
  other: "Other",
};

export const APPLICATION_STATUSES = [
  "applied",
  "screening",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: "Applied",
  screening: "Screening",
  interviewing: "Interviewing",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const ELIGIBILITY_CHECKS = ["confirmed_open", "restricted", "unclear"] as const;
export type EligibilityCheck = (typeof ELIGIBILITY_CHECKS)[number];
export const ELIGIBILITY_CHECK_LABEL: Record<EligibilityCheck, string> = {
  confirmed_open: "Confirmed open to me",
  restricted: "Turned out restricted",
  unclear: "Still unclear",
};

export const EVENT_TYPES = [
  "applied",
  "recruiter_reply",
  "screen",
  "technical_interview",
  "take_home",
  "final_interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "follow_up",
  "note",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_LABEL: Record<EventType, string> = {
  applied: "Applied",
  recruiter_reply: "Recruiter replied",
  screen: "Screening call",
  technical_interview: "Technical interview",
  take_home: "Take-home task",
  final_interview: "Final interview",
  offer: "Offer",
  accepted: "Accepted offer",
  rejected: "Rejected",
  withdrawn: "Withdrew",
  follow_up: "Sent follow-up",
  note: "Note",
};

/** Events you log after applying, in the order they usually happen. */
export const LOGGABLE_EVENTS: EventType[] = [
  "recruiter_reply",
  "screen",
  "technical_interview",
  "take_home",
  "final_interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "follow_up",
  "note",
];

/** Where a job you add by hand came from. */
export const MANUAL_JOB_SOURCES = [
  "LinkedIn",
  "LinkedIn post",
  "X",
  "Wellfound",
  "Google search",
  "Referral",
  "Talent network",
  "Recruiter",
  "Other",
] as const;

export type IsoDateString = `${number}-${number}-${number}`;

export interface StandardCouncilRecord {
  council: string | null;
  application_no: string | null;
  address: string | null;
  development_type: string | null;
  description: string | null;
  lodged_date: IsoDateString | null;
  decision: string | null;
  decision_date: IsoDateString | null;
  has_progress_info: boolean | null;
  has_documents: boolean | null;
  status_clarity_score: number | null;
  document_completeness_score: number | null;
  update_visibility_score: number | null;
  navigation_ease_score: number | null;
  notes: string | null;
}

export type DecisionBucket =
  | "Approved"
  | "Refused/Declined"
  | "Pending/In Progress/Under Assessment"
  | "Other/Unknown";


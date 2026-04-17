// JRE Secretary domain types. Mirrors supabase/migrations/jre_secretary_tables.sql

export type WeeklyClassStatus =
  | "awaiting_speaker"
  | "drafts_pending"
  | "approved"
  | "scheduled"
  | "sent"
  | "class_complete"
  | "paid"
  | "held_for_human"
  | "cancelled";

export type EmailDraftType =
  | "email_speaker"
  | "email_cc_1"
  | "email_cc_2"
  | "email_payment"
  | "email_reminder"
  | "email_elisheva_ask";

export type EmailDraftStatus =
  | "drafted"
  | "approved"
  | "scheduled"
  | "sent"
  | "held"
  | "cancelled"
  | "failed";

export type DeliveryChannel = "gmail" | "constant_contact";

export type PaymentMethod = "zelle" | "check" | "other";

export type JreSpeaker = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  last_fee_usd: number | null;
  total_talks: number;
  last_spoke_at: string | null;
  has_bio: boolean;
  has_headshot: boolean;
  bio: string | null;
  headshot_url: string | null;
  cc_last_campaign_id_1: string | null;
  cc_last_campaign_id_2: string | null;
  gmail_last_message_id: string | null;
  notes: string | null;
  is_active: boolean;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type JreWeeklyClass = {
  id: string;
  class_date: string; // ISO date
  class_time: string; // HH:MM:SS
  speaker_id: string | null;
  fee_usd: number | null;
  zoom_link: string | null;
  topic: string | null;
  dedication: string | null;
  status: WeeklyClassStatus;
  email_speaker_draft_id: string | null;
  email_cc_1_draft_id: string | null;
  email_cc_2_draft_id: string | null;
  email_payment_draft_id: string | null;
  email_reminder_draft_id: string | null;
  elisheva_asked_at: string | null;
  elisheva_replied_at: string | null;
  held_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type JreEmailDraft = {
  id: string;
  class_id: string;
  draft_type: EmailDraftType;
  delivery_channel: DeliveryChannel;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  to_list: string[];
  cc_list: string[];
  bcc_list: string[];
  subject: string;
  body_html: string;
  body_text: string | null;
  draft_v1_subject: string;
  draft_v1_body_html: string;
  cloned_from_provider: string | null;
  cloned_from_id: string | null;
  scheduled_send_at: string | null;
  sent_at: string | null;
  sent_provider_id: string | null;
  status: EmailDraftStatus;
  approved_at: string | null;
  approved_by: string | null;
  approval_channel: string | null;
  edit_diff_score: number | null;
  edit_is_meaningful: boolean | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type JrePayment = {
  id: string;
  class_id: string;
  speaker_id: string | null;
  amount_usd: number;
  payment_method: PaymentMethod;
  request_sent_at: string | null;
  paid: boolean;
  paid_at: string | null;
  paid_source: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type JreAuditLog = {
  id: string;
  week_of: string;
  class_id: string | null;
  draft_id: string | null;
  draft_type: string;
  was_edited: boolean;
  edit_diff_score: number | null;
  edit_is_meaningful: boolean | null;
  was_sent_on_time: boolean | null;
  was_sent_at_all: boolean | null;
  human_intervention: boolean;
  notes: string | null;
  created_at: string;
};

export type JreAutomationFlags = {
  id: number;
  email_speaker_auto: boolean;
  email_cc_1_auto: boolean;
  email_cc_2_auto: boolean;
  email_payment_auto: boolean;
  email_reminder_auto: boolean;
  kill_switch: boolean;
  kill_switch_reason: string | null;
  updated_at: string;
};

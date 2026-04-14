export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      email_signups: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          subject: string | null;
          message: string | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone?: string | null;
          subject?: string | null;
          message?: string | null;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          subject?: string | null;
          message?: string | null;
          source?: string;
          created_at?: string;
        };
      };
      donations: {
        Row: {
          id: string;
          amount: number;
          is_recurring: boolean;
          recurring_frequency: string | null;
          recurring_status: string;
          name: string;
          email: string;
          phone: string | null;
          honor_name: string | null;
          honor_email: string | null;
          sponsorship: string | null;
          message: string | null;
          payment_status: string;
          payment_reference: string | null;
          payment_error: string | null;
          card_ref: string | null; // Saved card token for recurring charges
          next_charge_date: string | null; // Next date to charge (ISO date)
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          amount: number;
          is_recurring?: boolean;
          recurring_frequency?: string | null;
          recurring_status?: string;
          name: string;
          email: string;
          phone?: string | null;
          honor_name?: string | null;
          honor_email?: string | null;
          sponsorship?: string | null;
          message?: string | null;
          payment_status?: string;
          payment_reference?: string | null;
          payment_error?: string | null;
          card_ref?: string | null;
          next_charge_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          amount?: number;
          is_recurring?: boolean;
          recurring_frequency?: string | null;
          recurring_status?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          honor_name?: string | null;
          honor_email?: string | null;
          sponsorship?: string | null;
          message?: string | null;
          payment_status?: string;
          payment_reference?: string | null;
          payment_error?: string | null;
          card_ref?: string | null;
          next_charge_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          date: string;
          start_time: string | null;
          end_time: string | null;
          location: string | null;
          location_url: string | null;
          image_url: string | null;
          theme_color: string | null;
          speaker: string | null;
          price_per_adult: number;
          kids_price: number;
          confetti_colors: string[] | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          date: string;
          start_time?: string | null;
          end_time?: string | null;
          location?: string | null;
          location_url?: string | null;
          image_url?: string | null;
          theme_color?: string | null;
          speaker?: string | null;
          price_per_adult?: number;
          kids_price?: number;
          confetti_colors?: string[] | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          date?: string;
          start_time?: string | null;
          end_time?: string | null;
          location?: string | null;
          location_url?: string | null;
          image_url?: string | null;
          theme_color?: string | null;
          speaker?: string | null;
          price_per_adult?: number;
          kids_price?: number;
          confetti_colors?: string[] | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_sponsorships: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          price: number;
          fair_market_value: number;
          description: string | null;
          max_available: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          price: number;
          fair_market_value?: number;
          description?: string | null;
          max_available?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          price?: number;
          fair_market_value?: number;
          description?: string | null;
          max_available?: number | null;
          created_at?: string;
        };
      };
      event_registrations: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          email: string;
          phone: string | null;
          adults: number;
          kids: number;
          sponsorship_id: string | null;
          message: string | null;
          subtotal: number;
          payment_status: string;
          payment_reference: string | null;
          payment_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          email: string;
          phone?: string | null;
          adults?: number;
          kids?: number;
          sponsorship_id?: string | null;
          message?: string | null;
          subtotal: number;
          payment_status?: string;
          payment_reference?: string | null;
          payment_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          adults?: number;
          kids?: number;
          sponsorship_id?: string | null;
          message?: string | null;
          subtotal?: number;
          payment_status?: string;
          payment_reference?: string | null;
          payment_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      gallery_photos: {
        Row: {
          id: string;
          title: string;
          caption: string | null;
          image_url: string;
          category: string;
          event_slug: string | null;
          drive_file_id: string | null;
          date_taken: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          caption?: string | null;
          image_url: string;
          category?: string;
          event_slug?: string | null;
          drive_file_id?: string | null;
          date_taken?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          caption?: string | null;
          image_url?: string;
          category?: string;
          event_slug?: string | null;
          drive_file_id?: string | null;
          date_taken?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      parsha_content: {
        Row: {
          id: string;
          slug: string;
          parsha: string;
          title: string;
          summary: string | null;
          content: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          parsha: string;
          title: string;
          summary?: string | null;
          content: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          parsha?: string;
          title?: string;
          summary?: string | null;
          content?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      personal_contacts: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          how_met: string;
          location: string | null;
          notes: string | null;
          follow_up: string | null;
          date_met: string;
          jewish_background: string | null;
          spouse_name: string | null;
          kids: string | null;
          interests: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          how_met?: string;
          location?: string | null;
          notes?: string | null;
          follow_up?: string | null;
          date_met?: string;
          jewish_background?: string | null;
          spouse_name?: string | null;
          kids?: string | null;
          interests?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          how_met?: string;
          location?: string | null;
          notes?: string | null;
          follow_up?: string | null;
          date_met?: string;
          jewish_background?: string | null;
          spouse_name?: string | null;
          kids?: string | null;
          interests?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      outreach_team_members: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          gender: 'male' | 'female';
          role: 'member' | 'admin';
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone?: string | null;
          gender: 'male' | 'female';
          role?: 'member' | 'admin';
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          gender?: 'male' | 'female';
          role?: 'member' | 'admin';
          is_active?: boolean;
          created_at?: string;
        };
      };
      outreach_contacts: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          gender: 'male' | 'female' | 'unknown';
          stage: OutreachStage;
          stage_updated_at: string;
          assigned_to: string | null;
          background: string | null;
          how_met: string | null;
          spouse_name: string | null;
          event_registration_id: string | null;
          next_followup_date: string | null;
          is_active: boolean;
          source: string;
          engagement_score: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          gender?: 'male' | 'female' | 'unknown';
          stage?: OutreachStage;
          stage_updated_at?: string;
          assigned_to?: string | null;
          background?: string | null;
          how_met?: string | null;
          spouse_name?: string | null;
          event_registration_id?: string | null;
          next_followup_date?: string | null;
          is_active?: boolean;
          source?: string;
          engagement_score?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          gender?: 'male' | 'female' | 'unknown';
          stage?: OutreachStage;
          stage_updated_at?: string;
          assigned_to?: string | null;
          background?: string | null;
          how_met?: string | null;
          spouse_name?: string | null;
          event_registration_id?: string | null;
          next_followup_date?: string | null;
          is_active?: boolean;
          source?: string;
          engagement_score?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      outreach_interactions: {
        Row: {
          id: string;
          contact_id: string;
          team_member_id: string | null;
          type: OutreachInteractionType;
          date: string;
          notes: string | null;
          location: string | null;
          stage_before: string | null;
          stage_after: string | null;
          event_id: string | null;
          donation_amount: number | null;
          parsed_by_ai: boolean;
          raw_input: string | null;
          whatsapp_message_sid: string | null;
          confirmation_status: 'pending' | 'confirmed' | 'corrected';
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          team_member_id?: string | null;
          type: OutreachInteractionType;
          date?: string;
          notes?: string | null;
          location?: string | null;
          stage_before?: string | null;
          stage_after?: string | null;
          event_id?: string | null;
          donation_amount?: number | null;
          parsed_by_ai?: boolean;
          raw_input?: string | null;
          whatsapp_message_sid?: string | null;
          confirmation_status?: 'pending' | 'confirmed' | 'corrected';
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          team_member_id?: string | null;
          type?: OutreachInteractionType;
          date?: string;
          notes?: string | null;
          location?: string | null;
          stage_before?: string | null;
          stage_after?: string | null;
          event_id?: string | null;
          donation_amount?: number | null;
          parsed_by_ai?: boolean;
          raw_input?: string | null;
          whatsapp_message_sid?: string | null;
          confirmation_status?: 'pending' | 'confirmed' | 'corrected';
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Helper types for easier usage
export type EmailSignup = Database["public"]["Tables"]["email_signups"]["Row"];
export type EmailSignupInsert = Database["public"]["Tables"]["email_signups"]["Insert"];

export type Donation = Database["public"]["Tables"]["donations"]["Row"];
export type DonationInsert = Database["public"]["Tables"]["donations"]["Insert"];

export type Event = Database["public"]["Tables"]["events"]["Row"];
export type EventInsert = Database["public"]["Tables"]["events"]["Insert"];

export type EventSponsorship = Database["public"]["Tables"]["event_sponsorships"]["Row"];
export type EventSponsorshipInsert = Database["public"]["Tables"]["event_sponsorships"]["Insert"];

export type EventRegistration = Database["public"]["Tables"]["event_registrations"]["Row"];
export type EventRegistrationInsert = Database["public"]["Tables"]["event_registrations"]["Insert"];

export type ParshaContent = Database["public"]["Tables"]["parsha_content"]["Row"];
export type ParshaContentInsert = Database["public"]["Tables"]["parsha_content"]["Insert"];

export type GalleryPhoto = Database["public"]["Tables"]["gallery_photos"]["Row"];
export type GalleryPhotoInsert = Database["public"]["Tables"]["gallery_photos"]["Insert"];

// ============================================================
// CRM / Outreach types
// ============================================================

export type OutreachStage =
  | 'new_contact'
  | 'in_touch'
  | 'event_connected'
  | 'deepening'
  | 'learning'
  | 'inner_circle'
  | 'multiplying';

export type OutreachInteractionType =
  | 'met'
  | 'call'
  | 'text'
  | 'coffee'
  | 'shabbos'
  | 'event'
  | 'learning'
  | 'email'
  | 'donation'
  | 'other';

export const STAGE_LABELS: Record<OutreachStage, string> = {
  new_contact:     'New Contact',
  in_touch:        'In Touch',
  event_connected: 'Event Connected',
  deepening:       'Deepening',
  learning:        'Learning',
  inner_circle:    'Inner Circle',
  multiplying:     'Multiplying',
};

export const INTERACTION_LABELS: Record<OutreachInteractionType, string> = {
  met:      'Met',
  call:     'Call',
  text:     'Text',
  coffee:   'Coffee',
  shabbos:  'Shabbos',
  event:    'Event',
  learning: 'Learning',
  email:    'Email',
  donation: 'Donation',
  other:    'Other',
};

export type OutreachTeamMember = Database["public"]["Tables"]["outreach_team_members"]["Row"];
export type OutreachTeamMemberInsert = Database["public"]["Tables"]["outreach_team_members"]["Insert"];

export type OutreachContact = Database["public"]["Tables"]["outreach_contacts"]["Row"];
export type OutreachContactInsert = Database["public"]["Tables"]["outreach_contacts"]["Insert"];

export type OutreachInteraction = Database["public"]["Tables"]["outreach_interactions"]["Row"];
export type OutreachInteractionInsert = Database["public"]["Tables"]["outreach_interactions"]["Insert"];

// Rich contact type with joined data (used in admin views)
export interface OutreachContactWithDetails extends OutreachContact {
  assigned_member?: OutreachTeamMember | null;
  interactions?: OutreachInteraction[];
  last_interaction_date?: string | null;
  last_interaction_type?: OutreachInteractionType | null;
  interaction_count?: number;
}

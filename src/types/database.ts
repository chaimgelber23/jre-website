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
          price_per_adult: number;
          kids_price: number;
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
          price_per_adult?: number;
          kids_price?: number;
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
          price_per_adult?: number;
          kids_price?: number;
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
          description: string | null;
          max_available: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          price: number;
          description?: string | null;
          max_available?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          price?: number;
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

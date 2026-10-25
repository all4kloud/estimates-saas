export type Lang = 'en' | 'es';
export type Role = 'owner' | 'admin' | 'member';
export type DocType = 'estimate' | 'invoice';
export type DocStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'paid' | 'void';

export interface Profile {
  id: string; email: string; full_name: string; phone: string; ui_lang: Lang; is_superadmin: boolean;
}

export interface Business {
  id: string; name: string; slug: string; owner_name: string; address1: string; address2: string;
  phone: string; email: string; website: string; tagline: string; logo_url: string | null;
  brand_color: string; accent_color: string; default_lang: Lang; tax_rate: number; valid_days: number;
  payment_text_en: string; payment_text_es: string; terms_est_en: string; terms_est_es: string;
  estimate_prefix: string; invoice_prefix: string; next_estimate: number; next_invoice: number;
  stripe_account_id: string | null; stripe_charges_enabled: boolean; active: boolean; created_at: string;
  // suscripción a la plataforma (0002_billing.sql)
  billing_exempt: boolean; subscription_status: SubStatus; stripe_customer_id: string | null;
  stripe_subscription_id: string | null; current_period_end: string | null; trial_end: string | null;
}

export type SubStatus = 'none' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';

export interface Service { id: string; business_id: string; name_en: string; name_es: string; price: number; sort: number; active: boolean; }

export interface Customer {
  id: string; business_id: string; name: string; phone: string; email: string; address: string; lang: Lang; notes: string; created_at: string;
}

export interface DocItem {
  id?: string; document_id?: string; service_id: string | null; name_en: string; name_es: string; qty: number; price: number; sort: number;
}

export interface Doc {
  id: string; business_id: string; type: DocType; number: string; customer_id: string; lang: Lang;
  issue_date: string; valid_until: string | null; status: DocStatus; notes: string; tax_rate: number;
  subtotal: number; tax: number; total: number; public_token: string; from_estimate_id: string | null;
  sent_at: string | null; viewed_at: string | null; accepted_at: string | null; accepted_name: string | null;
  declined_at: string | null; decline_reason: string | null; paid_at: string | null; payment_method: string | null;
  created_at: string; updated_at: string;
}

export interface DocEvent { id: number; document_id: string; kind: string; meta: Record<string, unknown>; created_at: string; }

export interface FullDoc extends Doc { items: DocItem[]; customer: Customer; }

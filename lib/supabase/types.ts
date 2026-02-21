// Auto-generated types will replace this file once you run:
//   npx supabase gen types typescript --local > lib/supabase/types.ts
//
// For now this is a placeholder so the client/server helpers compile.

export type Database = {
  public: {
    Tables: Record<string, unknown>
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}

// ─── Role type (mirrored from DB enum user_role) ──────────────────────────
export type UserRole = 'user' | 'gym_staff' | 'gym_admin' | 'platform_admin'

// ─── Profile type ─────────────────────────────────────────────────────────
export interface Profile {
  id: string
  display_name: string
  phone: string | null
  photo_path: string | null
  role: UserRole
  fraud_flags: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ─── Gym type ─────────────────────────────────────────────────────────────
export interface Gym {
  id: string
  public_code: string
  name: string
  address: string | null
  city: string | null
  state: string
  lat: number
  lng: number
  base_price_paise: number
  currency: string
  rules_text: string | null
  gym_logo_path: string | null
  is_paused: boolean
  created_at: string
}

// ─── Order / payment types ─────────────────────────────────────────────────
export type OrderType = 'ENTRY' | 'SUBSCRIPTION'
export type OrderStatus = 'CREATED' | 'PAID' | 'CANCELLED' | 'REFUNDED'

export interface Order {
  id: string
  type: OrderType
  user_id: string
  gym_id: string | null
  platform_fee_bps: number
  gst_rate_bps: number
  gym_price_paise: number
  platform_fee_paise: number
  gst_paise: number
  total_paise: number
  status: OrderStatus
  created_at: string
}

// ─── Check-in types ────────────────────────────────────────────────────────
export type CheckinStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'

export interface Checkin {
  id: string
  user_id: string
  gym_id: string
  order_id: string
  status: CheckinStatus
  expires_at: string
  approved_at: string | null
  rejected_at: string | null
  reject_reason: string | null
  created_at: string
}

// ─── Price window type ────────────────────────────────────────────────────
export interface GymPriceWindow {
  id: string
  gym_id: string
  label: string | null
  days_of_week: number[]
  start_time: string
  end_time: string
  price_paise: number
  created_at: string
}

// ─── Payment type ──────────────────────────────────────────────────────────
export type PaymentProvider = 'RAZORPAY'
export type PaymentStatus = 'CREATED' | 'CAPTURED' | 'FAILED' | 'REFUNDED'

export interface Payment {
  id: string
  order_id: string
  provider: PaymentProvider
  provider_order_id: string
  provider_payment_id: string | null
  status: PaymentStatus
  raw_webhook: Record<string, unknown> | null
  created_at: string
}

// ─── Subscription type ────────────────────────────────────────────────────
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED'

export interface Subscription {
  id: string
  user_id: string
  order_id: string
  status: SubscriptionStatus
  starts_at: string
  expires_at: string
  created_at: string
  updated_at: string
}

// ─── get_gyms_near RPC return type ────────────────────────────────────────
export interface GymNearResult extends Gym {
  distance_km: number
}

// ─── Pricing engine — all fee math lives here ─────────────────────────────────
// Formula (from CLAUDE.md):
//   platform_fee = round(gym_price_paise * bps / 10000)
//   gst          = round(platform_fee * gst_rate_bps / 10000)
//   total        = gym_price_paise + platform_fee + gst

export interface PriceBreakdown {
  gym_price_paise: number
  platform_fee_paise: number
  gst_paise: number
  total_paise: number
  platform_fee_bps: number
  gst_rate_bps: number
}

export interface GymPriceWindowInput {
  days_of_week: number[]  // 0=Sun … 6=Sat
  start_time: string      // "HH:MM:SS"
  end_time: string        // "HH:MM:SS"
  price_paise: number
}

/** Monthly subscription price for Platform Plus (MVP: fixed ₹199) */
export const SUBSCRIPTION_PRICE_PAISE = 19900

/**
 * Compute the full price breakdown for a gym entry.
 * @param gym_price_paise  The gym's price for this session (already resolved through windows)
 * @param is_subscriber    Whether the user has an active Crux Pass Plus subscription
 */
export function computePrice(
  gym_price_paise: number,
  is_subscriber: boolean
): PriceBreakdown {
  const platform_fee_bps = is_subscriber
    ? parseInt(process.env.PLATFORM_FEE_BPS_SUBSCRIBER ?? '500')
    : parseInt(process.env.PLATFORM_FEE_BPS_DEFAULT ?? '1000')
  const gst_rate_bps = parseInt(process.env.GST_RATE_BPS ?? '1800')

  const platform_fee_paise = Math.round((gym_price_paise * platform_fee_bps) / 10000)
  const gst_paise = Math.round((platform_fee_paise * gst_rate_bps) / 10000)
  const total_paise = gym_price_paise + platform_fee_paise + gst_paise

  return {
    gym_price_paise,
    platform_fee_paise,
    gst_paise,
    total_paise,
    platform_fee_bps,
    gst_rate_bps,
  }
}

/**
 * Returns the effective price for a gym at the current wall-clock time in IST.
 * Checks price windows in order; returns the first match or base_price_paise.
 */
export function currentGymPrice(
  base_price_paise: number,
  price_windows: GymPriceWindowInput[]
): number {
  // Convert current UTC time to IST for day-of-week / time comparisons
  const now = new Date()
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day = istDate.getDay() // 0=Sun, 6=Sat
  const hh = String(istDate.getHours()).padStart(2, '0')
  const mm = String(istDate.getMinutes()).padStart(2, '0')
  const ss = String(istDate.getSeconds()).padStart(2, '0')
  const timeStr = `${hh}:${mm}:${ss}` // "HH:MM:SS" for string comparison

  for (const win of price_windows) {
    if (
      win.days_of_week.includes(day) &&
      timeStr >= win.start_time &&
      timeStr < win.end_time
    ) {
      return win.price_paise
    }
  }
  return base_price_paise
}

/** Format paise to a human-readable INR string: 35000 → "₹350" */
export function formatINR(paise: number): string {
  const rupees = paise / 100
  return `₹${rupees % 1 === 0 ? rupees.toFixed(0) : rupees.toFixed(2)}`
}

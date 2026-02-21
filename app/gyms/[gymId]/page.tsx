import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Info, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatINR } from '@/lib/pricing/calc'

export const dynamic = 'force-dynamic'

interface GymDetailResponse {
  id: string
  public_code: string
  name: string
  address: string | null
  city: string | null
  state: string
  base_price_paise: number
  current_price_paise: number
  rules_text: string | null
  is_paused: boolean
  is_subscriber: boolean
  price_breakdown: {
    gym_price_paise: number
    platform_fee_paise: number
    gst_paise: number
    total_paise: number
    platform_fee_bps: number
  }
}

async function getGymDetail(gymId: string): Promise<GymDetailResponse | null> {
  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${base}/api/v1/gyms/${gymId}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function GymDetailPage({
  params,
}: {
  params: Promise<{ gymId: string }>
}) {
  const { gymId } = await params
  const gym = await getGymDetail(gymId)

  if (!gym) notFound()

  const isPeakNow = gym.current_price_paise !== gym.base_price_paise
  const feePercent = gym.price_breakdown.platform_fee_bps / 100

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{gym.name}</h1>
            {gym.is_paused && (
              <Badge variant="destructive" className="shrink-0">Paused</Badge>
            )}
          </div>
          {(gym.address || gym.city) && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {[gym.address, gym.city, gym.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        {/* Price card */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-600">Today&apos;s entry fee</p>
              {isPeakNow && (
                <Badge className="text-xs bg-amber-100 text-amber-800">Peak pricing</Badge>
              )}
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Gym fee</span>
                <span>{formatINR(gym.price_breakdown.gym_price_paise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Platform fee ({feePercent}%)
                  {gym.is_subscriber && (
                    <span className="ml-1 text-xs text-emerald-600">Plus rate</span>
                  )}
                </span>
                <span>{formatINR(gym.price_breakdown.platform_fee_paise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">GST (18%)</span>
                <span>{formatINR(gym.price_breakdown.gst_paise)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{formatINR(gym.price_breakdown.total_paise)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gym rules */}
        {gym.rules_text && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-gray-700">
                <Info className="w-4 h-4" />
                Gym rules
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-line">{gym.rules_text}</p>
            </CardContent>
          </Card>
        )}

        {/* Check-in CTA */}
        {gym.is_paused ? (
          <div className="text-center text-sm text-gray-500 py-4">
            This gym is not currently accepting check-ins.
          </div>
        ) : (
          <Button asChild className="w-full h-12 text-base" size="lg">
            <Link href={`/checkin/start/${gym.public_code}`}>
              Check in now
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        )}

        {!gym.is_subscriber && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Save on every visit with{' '}
            <Link href="/account" className="text-gray-600 underline">
              Crux Pass Plus
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

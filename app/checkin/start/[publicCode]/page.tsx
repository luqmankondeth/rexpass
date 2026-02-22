'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { MapPin, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/pricing/calc'
import { toast } from 'sonner'

interface GymInfo {
  id: string
  public_code: string
  name: string
  address: string | null
  city: string | null
  is_paused: boolean
  current_price_paise: number
  base_price_paise: number
  price_breakdown: {
    gym_price_paise: number
    platform_fee_paise: number
    gst_paise: number
    total_paise: number
    platform_fee_bps: number
  }
  is_subscriber: boolean
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any
  }
}

export default function CheckinStartPage({
  params,
}: {
  params: Promise<{ publicCode: string }>
}) {
  const { publicCode } = use(params)
  const router = useRouter()
  const [gym, setGym] = useState<GymInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)

  // Fetch gym info: first resolve public_code → gymId, then get full detail
  useEffect(() => {
    async function fetchGym() {
      try {
        // Step 1: find gym by public_code from the list
        const listRes = await fetch(`/api/v1/gyms`)
        if (!listRes.ok) throw new Error('Failed to load')
        const gyms: { id: string; public_code: string }[] = await listRes.json()
        const match = gyms.find((g) => g.public_code === publicCode)
        if (!match) {
          setError('Gym not found. Please check the QR code.')
          setLoading(false)
          return
        }
        // Step 2: fetch full detail (includes price_breakdown + is_subscriber)
        const detailRes = await fetch(`/api/v1/gyms/${match.id}`)
        if (!detailRes.ok) throw new Error('Failed to load gym detail')
        const gymDetail: GymInfo = await detailRes.json()
        setGym(gymDetail)
      } catch {
        setError('Failed to load gym details. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchGym()
  }, [publicCode])

  const startPayment = useCallback(async () => {
    if (!gym || !scriptReady) return
    setPaying(true)

    try {
      // Create internal order + Razorpay order
      const orderRes = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ENTRY', public_code: publicCode }),
      })

      const orderData = await orderRes.json()
      if (!orderRes.ok) {
        const msg = orderData?.error?.message ?? 'Failed to create order'
        toast.error(msg)
        setPaying(false)
        return
      }

      const { order_id, razorpay_order_id, amount_paise, key_id } = orderData

      // Open Razorpay checkout modal
      const rzp = new window.Razorpay({
        key: key_id,
        amount: amount_paise,
        currency: 'INR',
        order_id: razorpay_order_id,
        name: 'Crux Pass',
        description: `Entry — ${gym.name}`,
        theme: { color: '#0f172a' },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_signature: string
        }) => {
          try {
            const verifyRes = await fetch(`/api/v1/orders/${order_id}/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            })

            const verifyData = await verifyRes.json()
            if (!verifyRes.ok) {
              toast.error(verifyData?.error?.message ?? 'Payment verification failed')
              setPaying(false)
              return
            }

            // Navigate to countdown screen
            router.push(`/checkin/${verifyData.checkin_id}`)
          } catch {
            toast.error('Payment verification failed. Contact support.')
            setPaying(false)
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false)
          },
        },
      })

      rzp.open()
    } catch {
      toast.error('Something went wrong. Please try again.')
      setPaying(false)
    }
  }, [gym, scriptReady, publicCode, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !gym) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">{error ?? 'Gym not found'}</p>
        </div>
      </div>
    )
  }

  const breakdown = gym.price_breakdown
  const feePercent = breakdown.platform_fee_bps / 100

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onReady={() => setScriptReady(true)}
      />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-sm mx-auto px-4 py-8">
          {/* Gym info */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900">{gym.name}</h1>
            {(gym.address || gym.city) && (
              <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {gym.address ?? gym.city}
              </p>
            )}
          </div>

          {/* Price breakdown */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-gray-600 mb-3">Payment summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Gym entry fee</span>
                  <span>{formatINR(breakdown.gym_price_paise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 flex items-center gap-1">
                    Platform fee ({feePercent}%)
                    {gym.is_subscriber && (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 px-1 py-0">Plus</Badge>
                    )}
                  </span>
                  <span>{formatINR(breakdown.platform_fee_paise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">GST (18%)</span>
                  <span>{formatINR(breakdown.gst_paise)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatINR(breakdown.total_paise)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-gray-400 text-center mb-4">
            Your entry request will be sent to the gym for approval.
            Present your phone screen to reception.
          </p>

          {gym.is_paused ? (
            <div className="text-center text-sm text-gray-500 bg-gray-100 rounded-lg p-4">
              This gym is not currently accepting check-ins.
            </div>
          ) : (
            <Button
              className="w-full h-12 text-base"
              size="lg"
              onClick={startPayment}
              disabled={paying || !scriptReady}
            >
              {paying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing…
                </>
              ) : (
                `Pay ${formatINR(breakdown.total_paise)} & Check In`
              )}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

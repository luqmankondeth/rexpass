'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle2, XCircle, Clock, Loader2, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type CheckinStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'

interface CheckinData {
  id: string
  status: CheckinStatus
  expires_at: string
  approved_at: string | null
  rejected_at: string | null
  reject_reason: string | null
  photo_url: string | null
  gym: {
    name: string
    city: string | null
  } | null
  profile: {
    display_name: string
  } | null
}

function formatSeconds(seconds: number): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return m > 0 ? `${m}:${String(rem).padStart(2, '0')}` : `${s}s`
}

export default function CheckinStatusPage({
  params,
}: {
  params: Promise<{ checkinId: string }>
}) {
  const { checkinId } = use(params)
  const router = useRouter()
  const [checkin, setCheckin] = useState<CheckinData | null>(null)
  const [loading, setLoading] = useState(true)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const fetchCheckin = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/checkins/${checkinId}`)
      if (res.status === 401) {
        router.replace(`/auth?next=/checkin/${checkinId}`)
        return
      }
      if (!res.ok) return
      const data: CheckinData = await res.json()
      setCheckin(data)

      // Update countdown
      if (data.status === 'PENDING') {
        const expiresMs = new Date(data.expires_at).getTime()
        const remaining = Math.ceil((expiresMs - Date.now()) / 1000)
        setSecondsLeft(Math.max(0, remaining))
      }
    } catch {
      // ignore network errors
    } finally {
      setLoading(false)
    }
  }, [checkinId, router])

  useEffect(() => {
    fetchCheckin()
  }, [fetchCheckin])

  // Poll every 2 seconds while PENDING
  useEffect(() => {
    if (!checkin || checkin.status !== 'PENDING') return
    const interval = setInterval(fetchCheckin, 2000)
    return () => clearInterval(interval)
  }, [checkin, fetchCheckin])

  // Countdown timer tick
  useEffect(() => {
    if (!checkin || checkin.status !== 'PENDING') return
    if (secondsLeft <= 0) return
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(tick)
  }, [checkin, secondsLeft])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!checkin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-gray-500">Check-in not found.</p>
      </div>
    )
  }

  const gymName = checkin.gym?.name ?? 'Gym'
  const userName = checkin.profile?.display_name ?? 'User'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-sm mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500">{gymName}</p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">{userName}</h1>
        </div>

        {/* User photo */}
        <div className="flex justify-center mb-6">
          {checkin.photo_url ? (
            <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
              <Image
                src={checkin.photo_url}
                alt={userName}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white shadow-lg">
              <User className="w-16 h-16 text-gray-400" />
            </div>
          )}
        </div>

        {/* Status card */}
        <Card className="mb-4">
          <CardContent className="p-6 text-center">
            {checkin.status === 'PENDING' && (
              <>
                <div className="flex items-center justify-center mb-3">
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
                <h2 className="font-semibold text-gray-800 mb-1">Awaiting approval</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Show this screen to the gym reception
                </p>
                {secondsLeft > 0 ? (
                  <div>
                    <div className="text-4xl font-mono font-bold text-gray-900">
                      {formatSeconds(secondsLeft)}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">remaining</p>
                  </div>
                ) : (
                  <Badge variant="secondary" className="text-sm">Expired</Badge>
                )}
              </>
            )}

            {checkin.status === 'APPROVED' && (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h2 className="font-semibold text-gray-800 mb-1">Approved!</h2>
                <p className="text-sm text-gray-500">You&apos;re all set. Enjoy your workout!</p>
              </>
            )}

            {checkin.status === 'REJECTED' && (
              <>
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h2 className="font-semibold text-gray-800 mb-1">Entry declined</h2>
                {checkin.reject_reason && (
                  <p className="text-sm text-gray-500">{checkin.reject_reason}</p>
                )}
              </>
            )}

            {(checkin.status === 'EXPIRED' || (checkin.status === 'PENDING' && secondsLeft === 0)) && (
              <>
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h2 className="font-semibold text-gray-800 mb-1">Token expired</h2>
                <p className="text-sm text-gray-500">
                  The 90-second window has passed. Please start a new check-in.
                </p>
              </>
            )}

            {checkin.status === 'CANCELLED' && (
              <>
                <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h2 className="font-semibold text-gray-800 mb-1">Cancelled</h2>
              </>
            )}
          </CardContent>
        </Card>

        {/* Action buttons */}
        {(checkin.status === 'APPROVED' || checkin.status === 'REJECTED' ||
          checkin.status === 'EXPIRED' || checkin.status === 'CANCELLED') && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/gyms')}
          >
            Find more gyms
          </Button>
        )}
      </div>
    </div>
  )
}

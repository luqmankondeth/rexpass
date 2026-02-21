'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Clock, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatINR } from '@/lib/pricing/calc'

interface Gym {
  id: string
  name: string
  address: string | null
  city: string | null
  base_price_paise: number
  current_price_paise: number
  distance_km: number | null
  is_paused: boolean
  gym_logo_path: string | null
}

// Default to Kochi city center when geolocation is unavailable
const FALLBACK_LAT = 9.9312
const FALLBACK_LNG = 76.2673

export default function GymsPage() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [loading, setLoading] = useState(true)
  const [locationLabel, setLocationLabel] = useState('nearby gyms')

  useEffect(() => {
    async function loadGyms(lat: number, lng: number) {
      try {
        const res = await fetch(`/api/v1/gyms?lat=${lat}&lng=${lng}&radius_km=50`)
        const data = await res.json()
        if (Array.isArray(data)) setGyms(data)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationLabel('gyms near you')
          loadGyms(pos.coords.latitude, pos.coords.longitude)
        },
        () => {
          // Denied or unavailable — fall back to Kochi
          setLocationLabel('gyms in Kochi')
          loadGyms(FALLBACK_LAT, FALLBACK_LNG)
        },
        { timeout: 5000 }
      )
    } else {
      setLocationLabel('gyms in Kochi')
      loadGyms(FALLBACK_LAT, FALLBACK_LNG)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Find a gym</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            Showing {locationLabel}
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-40 mb-2" />
                  <Skeleton className="h-4 w-60 mb-3" />
                  <Skeleton className="h-4 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : gyms.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium">No gyms found nearby</p>
            <p className="text-sm mt-1">Try expanding your search radius</p>
          </div>
        ) : (
          <div className="space-y-3">
            {gyms.map((gym) => (
              <Link key={gym.id} href={`/gyms/${gym.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="font-semibold text-gray-900 truncate">{gym.name}</h2>
                          {gym.current_price_paise < gym.base_price_paise && (
                            <Badge variant="secondary" className="shrink-0 text-xs bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3 mr-1" />
                              Peak
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {gym.address ?? gym.city ?? ''}
                        </p>
                        {gym.distance_km != null && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {gym.distance_km < 1
                              ? `${Math.round(gym.distance_km * 1000)} m away`
                              : `${gym.distance_km.toFixed(1)} km away`}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900">
                          {formatINR(gym.current_price_paise)}
                        </p>
                        {gym.current_price_paise !== gym.base_price_paise && (
                          <p className="text-xs text-gray-400 line-through">
                            {formatINR(gym.base_price_paise)}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">per visit</p>
                      </div>
                    </div>
                    <div className="flex justify-end mt-2">
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

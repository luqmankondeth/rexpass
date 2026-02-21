import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Razorpay sends the raw body — do NOT parse before verifying
export const POST = async (req: NextRequest): Promise<Response> => {
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''

  // Validate webhook signature
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  if (expectedSig !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { event: string; payload: Record<string, unknown>; id?: string }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventId = event.id ?? `${event.event}-${Date.now()}`
  const svc = await createServiceClient()

  // Idempotency check — reject replays
  const { error: dupError } = await svc.from('audit_logs').insert({
    event_type: event.event,
    idempotency_key: `razorpay:${eventId}`,
    payload: event.payload as Record<string, unknown>,
  })

  if (dupError?.code === '23505') {
    // Duplicate event — already processed
    return NextResponse.json({ ok: true, note: 'duplicate' })
  }

  // Handle events
  try {
    switch (event.event) {
      case 'payment.captured':
      case 'payment.authorized': {
        const paymentEntity = (
          (event.payload as Record<string, unknown>).payment as Record<string, unknown>
        )?.entity as Record<string, unknown>
        if (!paymentEntity) break

        const providerPaymentId = paymentEntity.id as string
        const providerOrderId = paymentEntity.order_id as string

        if (!providerPaymentId || !providerOrderId) break

        // Find the payment record
        const { data: payment } = await svc
          .from('payments')
          .select('id, order_id, status')
          .eq('provider_order_id', providerOrderId)
          .eq('provider', 'RAZORPAY')
          .maybeSingle()

        if (payment && payment.status !== 'CAPTURED') {
          await svc
            .from('payments')
            .update({
              provider_payment_id: providerPaymentId,
              status: 'CAPTURED',
              raw_webhook: event.payload as Record<string, unknown>,
            })
            .eq('id', payment.id)

          // Also ensure order is marked PAID
          await svc
            .from('orders')
            .update({ status: 'PAID' })
            .eq('id', payment.order_id)
            .eq('status', 'CREATED')
        }
        break
      }

      case 'payment.failed': {
        const paymentEntity = (
          (event.payload as Record<string, unknown>).payment as Record<string, unknown>
        )?.entity as Record<string, unknown>
        if (!paymentEntity) break

        const providerOrderId = paymentEntity.order_id as string
        if (!providerOrderId) break

        const { data: payment } = await svc
          .from('payments')
          .select('id, order_id')
          .eq('provider_order_id', providerOrderId)
          .eq('provider', 'RAZORPAY')
          .maybeSingle()

        if (payment) {
          await svc
            .from('payments')
            .update({
              status: 'FAILED',
              raw_webhook: event.payload as Record<string, unknown>,
            })
            .eq('id', payment.id)

          await svc
            .from('orders')
            .update({ status: 'CANCELLED' })
            .eq('id', payment.order_id)
            .eq('status', 'CREATED')
        }
        break
      }

      case 'refund.processed': {
        const refundEntity = (
          (event.payload as Record<string, unknown>).refund as Record<string, unknown>
        )?.entity as Record<string, unknown>
        if (!refundEntity) break

        const providerPaymentId = refundEntity.payment_id as string
        if (!providerPaymentId) break

        // Find the payment and update refund status
        const { data: payment } = await svc
          .from('payments')
          .select('order_id')
          .eq('provider_payment_id', providerPaymentId)
          .eq('provider', 'RAZORPAY')
          .maybeSingle()

        if (payment) {
          await svc
            .from('payments')
            .update({ status: 'REFUNDED' })
            .eq('provider_payment_id', providerPaymentId)

          await svc
            .from('orders')
            .update({ status: 'REFUNDED' })
            .eq('id', payment.order_id)

          // Update refund record status if it exists
          await svc
            .from('refunds')
            .update({ status: 'SUCCEEDED' })
            .eq('order_id', payment.order_id)
            .eq('status', 'PENDING')
        }
        break
      }

      default:
        // Unhandled event — log and acknowledge
        console.log(`[Webhook] Unhandled event: ${event.event}`)
    }
  } catch (err) {
    console.error('[Webhook] Handler error', err)
    // Return 200 anyway so Razorpay doesn't retry — errors are logged
  }

  return NextResponse.json({ ok: true })
}

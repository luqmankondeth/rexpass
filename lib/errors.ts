import { NextResponse } from 'next/server'

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

/**
 * Creates a NextResponse with the standard Crux Pass error envelope.
 * Use `throw apiError(...)` inside route handlers to short-circuit execution.
 *
 * @example
 * throw apiError('NOT_FOUND', 'Gym not found', 404)
 */
export function apiError(
  code: string,
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): Response {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } } satisfies ApiErrorBody,
    { status }
  )
}

/**
 * Wraps a route handler to catch thrown Responses (from apiError) and
 * any unexpected errors (returning a 500).
 *
 * @example
 * export const GET = withErrorHandler(async (req) => {
 *   const data = await fetchSomething()
 *   return NextResponse.json(data)
 * })
 */
export function withErrorHandler(
  handler: (req: Request, ctx?: unknown) => Promise<Response>
) {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      // apiError() throws a Response directly
      if (err instanceof Response) return err

      console.error('[API Error]', err)
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
        { status: 500 }
      )
    }
  }
}

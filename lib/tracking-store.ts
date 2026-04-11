import { neon } from "@neondatabase/serverless"
import { Redis } from "@upstash/redis"
import type { Order, Session } from "@/lib/mock-data"
import {
  isTrackEventType,
  type SessionSignals,
  type TrackEventPayload,
  type TrackEventType,
  type TrackedProductEvent,
  type TrackingDashboardData,
  type TrackingStats,
} from "@/lib/tracking-types"

const databaseUrl = process.env.DATABASE_URL?.trim()
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim()
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

const sql = databaseUrl ? neon(databaseUrl) : null
const redis = upstashUrl && upstashToken ? Redis.fromEnv() : null

const SESSION_SIGNAL_TTL_SECONDS = 60 * 60 * 24

let ensureSchemaPromise: Promise<void> | null = null

function requireSql() {
  if (!sql) {
    throw new Error("DATABASE_URL is required for tracking APIs.")
  }
  return sql
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (typeof value === "bigint") {
    return Number(value)
  }

  return 0
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  const normalized = Math.floor(toNumber(value))
  if (normalized <= 0) {
    return fallback
  }

  return Math.min(normalized, 20000)
}

function normalizeUserType(value: unknown): "guest" | "customer" {
  return value === "customer" ? "customer" : "guest"
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`
}

interface SessionRow {
  id: string
  timestamp: string | number
  user_type: string
  user_id: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  pages_visited: string[] | null
  time_spent_ms: string | number | null
}

interface EventRow {
  id: string
  session_id: string
  product_id: string | null
  event_type: string
  time_spent_ms: string | number
  scroll_depth: string | number
  timestamp: string | number
  page: string | null
}

interface OrderRow {
  id: string
  session_id: string
  user_id: string | null
  product_id: string
  quantity: string | number
  price_paid: string | number
  timestamp: string | number
}

async function ensureTrackingSchema() {
  const db = requireSql()

  if (!ensureSchemaPromise) {
    ensureSchemaPromise = (async () => {
      await db`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          started_at BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT),
          user_type TEXT NOT NULL DEFAULT 'guest',
          user_id TEXT,
          utm_source TEXT,
          utm_medium TEXT,
          utm_campaign TEXT,
          utm_term TEXT,
          utm_content TEXT,
          last_activity_at BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT)
        );
      `

      await db`
        CREATE TABLE IF NOT EXISTS product_events (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          product_id TEXT,
          event_type TEXT NOT NULL,
          time_spent_ms INTEGER NOT NULL DEFAULT 0,
          scroll_depth INTEGER NOT NULL DEFAULT 0,
          page TEXT,
          timestamp BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT),
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        );
      `

      await db`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          user_id TEXT,
          product_id TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          price_paid NUMERIC NOT NULL DEFAULT 0,
          timestamp BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT)
        );
      `

      await db`
        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS utm_source TEXT,
        ADD COLUMN IF NOT EXISTS utm_medium TEXT,
        ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
        ADD COLUMN IF NOT EXISTS utm_term TEXT,
        ADD COLUMN IF NOT EXISTS utm_content TEXT;
      `

      await db`
        ALTER TABLE sessions
        ALTER COLUMN started_at SET DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT),
        ALTER COLUMN last_activity_at SET DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT);
      `

      await db`
        ALTER TABLE product_events
        ALTER COLUMN timestamp SET DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT);
      `

      await db`
        ALTER TABLE orders
        ALTER COLUMN timestamp SET DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT);
      `

      await db`
        CREATE INDEX IF NOT EXISTS idx_product_events_session_timestamp
        ON product_events(session_id, timestamp DESC);
      `

      await db`
        CREATE INDEX IF NOT EXISTS idx_product_events_event_type
        ON product_events(event_type);
      `

      await db`
        CREATE INDEX IF NOT EXISTS idx_orders_session_timestamp
        ON orders(session_id, timestamp DESC);
      `
    })()
  }

  await ensureSchemaPromise
}

async function upsertSession(params: {
  sessionId: string
  userType: "guest" | "customer"
  userId?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
}): Promise<Session> {
  const db = requireSql()
  const { sessionId, userType, userId, utmSource, utmMedium, utmCampaign, utmTerm, utmContent } = params

  await db`
    INSERT INTO sessions (
      id,
      user_type,
      user_id,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      last_activity_at
    )
    VALUES (
      ${sessionId},
      ${userType},
      ${userId ?? null},
      ${utmSource ?? null},
      ${utmMedium ?? null},
      ${utmCampaign ?? null},
      ${utmTerm ?? null},
      ${utmContent ?? null},
      ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT)
    )
    ON CONFLICT (id) DO UPDATE
      SET
        user_type = COALESCE(EXCLUDED.user_type, sessions.user_type),
        user_id = COALESCE(EXCLUDED.user_id, sessions.user_id),
        utm_source = COALESCE(sessions.utm_source, EXCLUDED.utm_source),
        utm_medium = COALESCE(sessions.utm_medium, EXCLUDED.utm_medium),
        utm_campaign = COALESCE(sessions.utm_campaign, EXCLUDED.utm_campaign),
        utm_term = COALESCE(sessions.utm_term, EXCLUDED.utm_term),
        utm_content = COALESCE(sessions.utm_content, EXCLUDED.utm_content),
        last_activity_at = GREATEST(
          sessions.last_activity_at,
          ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT)
        );
  `

  const [row] = (await db`
    SELECT
      s.id,
      s.started_at AS timestamp,
      s.user_type,
      s.user_id,
      s.utm_source,
      s.utm_medium,
      s.utm_campaign,
      s.utm_term,
      s.utm_content,
      COALESCE(
        ARRAY(
          SELECT DISTINCT pe.page
          FROM product_events pe
          WHERE pe.session_id = s.id AND pe.page IS NOT NULL
        ),
        ARRAY[]::TEXT[]
      ) AS pages_visited,
      GREATEST(
        COALESCE(MAX(pe.timestamp), s.last_activity_at, s.started_at) - s.started_at,
        0
      ) AS time_spent_ms
    FROM sessions s
    LEFT JOIN product_events pe ON pe.session_id = s.id
    WHERE s.id = ${sessionId}
    GROUP BY
      s.id,
      s.started_at,
      s.user_type,
      s.user_id,
      s.utm_source,
      s.utm_medium,
      s.utm_campaign,
      s.utm_term,
      s.utm_content,
      s.last_activity_at
    LIMIT 1;
  `) as SessionRow[]

  return {
    id: row?.id ?? sessionId,
    timestamp: toNumber(row?.timestamp ?? Date.now()),
    pages_visited: Array.isArray(row?.pages_visited) ? row.pages_visited : [],
    time_spent_ms: toNumber(row?.time_spent_ms),
    user_type: normalizeUserType(row?.user_type ?? userType),
    user_id: row?.user_id ?? undefined,
    utm_source: row?.utm_source ?? undefined,
    utm_medium: row?.utm_medium ?? undefined,
    utm_campaign: row?.utm_campaign ?? undefined,
    utm_term: row?.utm_term ?? undefined,
    utm_content: row?.utm_content ?? undefined,
  }
}

async function cacheSessionSignals(params: {
  sessionId: string
  eventType: TrackEventType
  productId?: string
  page?: string
}) {
  if (!redis) {
    return
  }

  const { sessionId, eventType, productId, page } = params
  const viewedProductsKey = `tracking:session:${sessionId}:viewed_products`
  const pageKey = `tracking:session:${sessionId}:last_page`
  const writes: Promise<unknown>[] = []

  if (
    productId &&
    (eventType === "product_view" || eventType === "click" || eventType === "add_to_cart")
  ) {
    writes.push(redis.sadd(viewedProductsKey, productId))
    writes.push(redis.expire(viewedProductsKey, SESSION_SIGNAL_TTL_SECONDS))
  }

  if (page) {
    writes.push(redis.set(pageKey, page, { ex: SESSION_SIGNAL_TTL_SECONDS }))
  }

  if (writes.length > 0) {
    await Promise.all(writes)
  }
}

export function isTrackingConfigured(): boolean {
  return sql !== null
}

export async function trackEvent(payload: TrackEventPayload): Promise<{
  session?: Session
  event?: TrackedProductEvent
}> {
  const db = requireSql()
  await ensureTrackingSchema()

  const metadata = payload.metadata ?? {}
  const sessionId = payload.session_id.trim()
  if (!sessionId) {
    throw new Error("session_id is required for tracking events.")
  }

  const userType = normalizeUserType(metadata.user_type)
  const userId = metadata.user_id

  const session = await upsertSession({
    sessionId,
    userType,
    userId,
    utmSource: metadata.utm_source,
    utmMedium: metadata.utm_medium,
    utmCampaign: metadata.utm_campaign,
    utmTerm: metadata.utm_term,
    utmContent: metadata.utm_content,
  })

  if (payload.event_type === "session_start") {
    await cacheSessionSignals({
      sessionId,
      eventType: payload.event_type,
      page: metadata.page,
    })

    return { session }
  }

  const eventId = createId("evt")
  const [insertedEvent] = (await db`
    INSERT INTO product_events (
      id,
      session_id,
      product_id,
      event_type,
      time_spent_ms,
      scroll_depth,
      page,
      metadata
    )
    VALUES (
      ${eventId},
      ${sessionId},
      ${payload.product_id ?? null},
      ${payload.event_type},
      ${Math.max(0, toNumber(metadata.time_spent_ms))},
      ${Math.max(0, toNumber(metadata.scroll_depth))},
      ${metadata.page ?? null},
      ${JSON.stringify(metadata)}::jsonb
    )
    RETURNING timestamp;
  `) as Array<{ timestamp: string | number }>

  const event: TrackedProductEvent = {
    id: eventId,
    session_id: sessionId,
    product_id: payload.product_id ?? null,
    event_type: payload.event_type,
    time_spent_ms: Math.max(0, toNumber(metadata.time_spent_ms)),
    scroll_depth: Math.max(0, toNumber(metadata.scroll_depth)),
    timestamp: toNumber(insertedEvent?.timestamp ?? Date.now()),
    page: metadata.page,
  }

  await cacheSessionSignals({
    sessionId,
    eventType: payload.event_type,
    productId: payload.product_id,
    page: metadata.page,
  })

  return { session, event }
}

export interface ConfirmedPaymentOrderInput {
  session_id: string
  user_id?: string
  product_id: string
  quantity: number
  price_paid: number
}

export async function recordConfirmedPaymentOrder(payload: ConfirmedPaymentOrderInput): Promise<Order> {
  const db = requireSql()
  await ensureTrackingSchema()

  const sessionId = payload.session_id.trim()
  if (!sessionId) {
    throw new Error("session_id is required for payment confirmation.")
  }

  const productId = payload.product_id.trim()
  if (!productId) {
    throw new Error("product_id is required for payment confirmation.")
  }

  const userId = payload.user_id?.trim()
  const quantity = Math.max(1, Math.floor(toNumber(payload.quantity) || 1))
  const pricePaid = Math.max(0, toNumber(payload.price_paid))

  await upsertSession({
    sessionId,
    userType: userId ? "customer" : "guest",
    userId,
  })

  const orderId = createId("ord")
  const [insertedOrder] = (await db`
    INSERT INTO orders (id, session_id, user_id, product_id, quantity, price_paid)
    VALUES (
      ${orderId},
      ${sessionId},
      ${userId ?? null},
      ${productId},
      ${quantity},
      ${pricePaid}
    )
    RETURNING timestamp;
  `) as Array<{ timestamp: string | number }>

  return {
    id: orderId,
    session_id: sessionId,
    user_id: userId,
    product_id: productId,
    quantity,
    price_paid: pricePaid,
    timestamp: toNumber(insertedOrder?.timestamp),
  }
}

async function getTrackingStats(): Promise<TrackingStats> {
  const db = requireSql()
  await ensureTrackingSchema()

  const [sessionsRow] = (await db`
    SELECT COUNT(*)::INT AS count FROM sessions;
  `) as Array<{ count: string | number }>

  const [eventsRow] = (await db`
    SELECT COUNT(*)::INT AS count FROM product_events;
  `) as Array<{ count: string | number }>

  const [ordersRow] = (await db`
    SELECT COUNT(*)::INT AS count, COALESCE(SUM(price_paid), 0) AS revenue FROM orders;
  `) as Array<{ count: string | number; revenue: string | number | null }>

  const [avgDurationRow] = (await db`
    SELECT COALESCE(AVG(duration_ms), 0) AS avg_duration_ms
    FROM (
      SELECT
        GREATEST(
          COALESCE(MAX(pe.timestamp), s.last_activity_at, s.started_at) - s.started_at,
          0
        ) AS duration_ms
      FROM sessions s
      LEFT JOIN product_events pe ON pe.session_id = s.id
      GROUP BY s.id, s.started_at, s.last_activity_at
    ) session_durations;
  `) as Array<{ avg_duration_ms: string | number | null }>

  const [cartRow] = (await db`
    WITH cart_sessions AS (
      SELECT DISTINCT session_id
      FROM product_events
      WHERE event_type = 'add_to_cart'
    )
    SELECT
      COUNT(*)::INT AS carts_started,
      COUNT(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.session_id = cart_sessions.session_id
        )
      )::INT AS carts_abandoned
    FROM cart_sessions;
  `) as Array<{ carts_started: string | number; carts_abandoned: string | number }>

  const totalSessions = toNumber(sessionsRow?.count)
  const totalRevenue = toNumber(ordersRow?.revenue)
  const cartsStarted = toNumber(cartRow?.carts_started)
  const cartsAbandoned = toNumber(cartRow?.carts_abandoned)

  return {
    totalSessions,
    totalEvents: toNumber(eventsRow?.count),
    totalOrders: toNumber(ordersRow?.count),
    totalRevenue,
    avgSessionDuration: Math.round(toNumber(avgDurationRow?.avg_duration_ms) / 1000),
    revenuePerVisitor: totalSessions > 0 ? Number((totalRevenue / totalSessions).toFixed(2)) : 0,
    cartAbandonmentRate:
      cartsStarted > 0 ? Number(((cartsAbandoned / cartsStarted) * 100).toFixed(1)) : 0,
    cartsStarted,
    cartsAbandoned,
  }
}

export interface TrackingDashboardQueryOptions {
  sessionLimit?: number
  eventLimit?: number
  orderLimit?: number
}

export async function getTrackingDashboardData(
  options: TrackingDashboardQueryOptions = {}
): Promise<TrackingDashboardData> {
  const db = requireSql()
  await ensureTrackingSchema()
  const sessionLimit = normalizeLimit(options.sessionLimit, 100)
  const eventLimit = normalizeLimit(options.eventLimit, 200)
  const orderLimit = normalizeLimit(options.orderLimit, 200)

  const [stats, rawSessionRows, rawEventRows, rawOrderRows] = await Promise.all([
    getTrackingStats(),
    db`
      SELECT
        s.id,
        s.started_at AS timestamp,
        s.user_type,
        s.user_id,
        s.utm_source,
        s.utm_medium,
        s.utm_campaign,
        s.utm_term,
        s.utm_content,
        COALESCE(
          ARRAY(
            SELECT DISTINCT pe.page
            FROM product_events pe
            WHERE pe.session_id = s.id AND pe.page IS NOT NULL
          ),
          ARRAY[]::TEXT[]
        ) AS pages_visited,
        GREATEST(
          COALESCE(MAX(pe.timestamp), s.last_activity_at, s.started_at) - s.started_at,
          0
        ) AS time_spent_ms
      FROM sessions s
      LEFT JOIN product_events pe ON pe.session_id = s.id
      GROUP BY
        s.id,
        s.started_at,
        s.user_type,
        s.user_id,
        s.utm_source,
        s.utm_medium,
        s.utm_campaign,
        s.utm_term,
        s.utm_content,
        s.last_activity_at
      ORDER BY s.started_at DESC
      LIMIT ${sessionLimit};
    `,
    db`
      SELECT
        id,
        session_id,
        product_id,
        event_type,
        time_spent_ms,
        scroll_depth,
        timestamp,
        page
      FROM product_events
      ORDER BY timestamp DESC
      LIMIT ${eventLimit};
    `,
    db`
      SELECT
        id,
        session_id,
        user_id,
        product_id,
        quantity,
        price_paid,
        timestamp
      FROM orders
      ORDER BY timestamp DESC
      LIMIT ${orderLimit};
    `,
  ])

  const sessionRows = rawSessionRows as unknown as SessionRow[]
  const eventRows = rawEventRows as unknown as EventRow[]
  const orderRows = rawOrderRows as unknown as OrderRow[]

  const sessions: Session[] = sessionRows.map((row) => ({
    id: row.id,
    timestamp: toNumber(row.timestamp),
    pages_visited: Array.isArray(row.pages_visited) ? row.pages_visited : [],
    time_spent_ms: toNumber(row.time_spent_ms),
    user_type: normalizeUserType(row.user_type),
    user_id: row.user_id ?? undefined,
    utm_source: row.utm_source ?? undefined,
    utm_medium: row.utm_medium ?? undefined,
    utm_campaign: row.utm_campaign ?? undefined,
    utm_term: row.utm_term ?? undefined,
    utm_content: row.utm_content ?? undefined,
  }))

  const events: TrackedProductEvent[] = eventRows.map((row) => ({
    id: row.id,
    session_id: row.session_id,
    product_id: row.product_id,
    event_type: isTrackEventType(row.event_type) ? row.event_type : "click",
    time_spent_ms: toNumber(row.time_spent_ms),
    scroll_depth: toNumber(row.scroll_depth),
    timestamp: toNumber(row.timestamp),
    page: row.page ?? undefined,
  }))

  const orders: Order[] = orderRows.map((row) => ({
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id ?? undefined,
    product_id: row.product_id,
    quantity: toNumber(row.quantity),
    price_paid: toNumber(row.price_paid),
    timestamp: toNumber(row.timestamp),
  }))

  return {
    stats,
    sessions,
    events,
    orders,
  }
}

export async function getSessionSignals(sessionId: string): Promise<SessionSignals> {
  const normalizedSessionId = sessionId.trim()
  if (!normalizedSessionId) {
    return { viewedProductIds: [], lastPage: null }
  }

  const viewedProductsKey = `tracking:session:${normalizedSessionId}:viewed_products`
  const pageKey = `tracking:session:${normalizedSessionId}:last_page`

  if (redis) {
    const [cachedViewedProducts, cachedPage] = await Promise.all([
      redis.smembers(viewedProductsKey),
      redis.get(pageKey),
    ])

    const viewedProductIds = Array.isArray(cachedViewedProducts)
      ? cachedViewedProducts.filter((value): value is string => typeof value === "string")
      : []
    const lastPage = typeof cachedPage === "string" ? cachedPage : null

    if (viewedProductIds.length > 0 || lastPage) {
      return { viewedProductIds, lastPage }
    }
  }

  if (!sql) {
    return { viewedProductIds: [], lastPage: null }
  }

  await ensureTrackingSchema()

  const db = requireSql()
  const [rawViewedRows, rawPageRows] = await Promise.all([
    db`
      SELECT product_id, MAX(timestamp) AS last_seen
      FROM product_events
      WHERE
        session_id = ${normalizedSessionId}
        AND product_id IS NOT NULL
        AND event_type IN ('product_view', 'click', 'add_to_cart')
      GROUP BY product_id
      ORDER BY last_seen DESC
      LIMIT 5;
    `,
    db`
      SELECT page
      FROM product_events
      WHERE session_id = ${normalizedSessionId} AND page IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT 1;
    `,
  ])

  const viewedRows = rawViewedRows as unknown as Array<{ product_id: string; last_seen: string | number }>
  const pageRows = rawPageRows as unknown as Array<{ page: string | null }>

  const viewedProductIds = viewedRows.map((row) => row.product_id)
  const lastPage = pageRows[0]?.page ?? null

  if (redis) {
    const writes: Promise<unknown>[] = []

    if (viewedProductIds.length > 0) {
      for (const viewedProductId of viewedProductIds) {
        writes.push(redis.sadd(viewedProductsKey, viewedProductId))
      }
      writes.push(redis.expire(viewedProductsKey, SESSION_SIGNAL_TTL_SECONDS))
    }

    if (lastPage) {
      writes.push(redis.set(pageKey, lastPage, { ex: SESSION_SIGNAL_TTL_SECONDS }))
    }

    if (writes.length > 0) {
      await Promise.all(writes)
    }
  }

  return {
    viewedProductIds,
    lastPage,
  }
}

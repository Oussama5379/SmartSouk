import { neon } from "@neondatabase/serverless"
import { products as defaultSeedProducts } from "@/lib/mock-data"
import {
  STORE_CATEGORIES,
  STORE_STOCK_STATUSES,
  type StoreCategory,
  type StoreProduct,
  type StoreSettings,
  type StoreSnapshot,
  type StoreStockStatus,
} from "@/lib/store-types"

const databaseUrl = process.env.DATABASE_URL?.trim()
const sql = databaseUrl ? neon(databaseUrl) : null

const STORE_DB_FAILURE_COOLDOWN_MS = 30_000
const STORE_DB_TIMEOUT_MS = 8_000
const STORE_DB_SCHEMA_TIMEOUT_MS = 20_000

const DEFAULT_STORE_SETTINGS: Omit<StoreSettings, "updated_at"> = {
  store_name: "SmartSouk",
  store_description:
    "Discover handcrafted ceramics, woven rugs, and organic oils from Tunisia. Every piece tells a story of tradition.",
  contact_email: "contact@smartsouk.tn",
  hero_image_url: "",
  site_icon_url: "",
  feature_one_title: "100% Natural",
  feature_one_description: "Organic oils and natural materials",
  feature_two_title: "Worldwide Shipping",
  feature_two_description: "Delivery to your doorstep",
  feature_three_title: "Handcrafted",
  feature_three_description: "By skilled local artisans",
}

const seedTimestamp = Date.now()
const seedProducts: StoreProduct[] = defaultSeedProducts.map((product) => ({
  id: product.id,
  name: product.name,
  category: product.category,
  price_tnd: product.price_tnd,
  stock_status: product.stock_status,
  description: product.description,
  image: product.image,
  created_at: seedTimestamp,
  updated_at: seedTimestamp,
}))

let ensureStoreSchemaPromise: Promise<void> | null = null
let storeDbUnavailableUntil = 0
let memoryProducts = seedProducts.map((product) => ({ ...product }))
let memorySettings: StoreSettings = {
  ...DEFAULT_STORE_SETTINGS,
  updated_at: Date.now(),
}

interface StoreProductRow {
  id: string
  name: string
  category: string
  price_tnd: string | number
  stock_status: string
  description: string
  image: string | null
  created_at: string | number
  updated_at: string | number
}

interface StoreSettingsRow {
  store_name: string
  store_description: string
  contact_email: string
  hero_image_url: string | null
  site_icon_url: string | null
  feature_one_title: string | null
  feature_one_description: string | null
  feature_two_title: string | null
  feature_two_description: string | null
  feature_three_title: string | null
  feature_three_description: string | null
  updated_at: string | number
}

export interface CreateStoreProductInput {
  name: string
  category: StoreCategory
  price_tnd: number
  stock_status: StoreStockStatus
  description: string
  image?: string
}

export interface UpdateStoreProductInput {
  name?: string
  category?: StoreCategory
  price_tnd?: number
  stock_status?: StoreStockStatus
  description?: string
  image?: string
}

export interface UpdateStoreSettingsInput {
  store_name?: string
  store_description?: string
  contact_email?: string
  hero_image_url?: string
  site_icon_url?: string
  feature_one_title?: string
  feature_one_description?: string
  feature_two_title?: string
  feature_two_description?: string
  feature_three_title?: string
  feature_three_description?: string
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  if (typeof value === "bigint") {
    return Number(value)
  }

  return 0
}

function cloneProduct(product: StoreProduct): StoreProduct {
  return { ...product }
}

function sortProductsByFreshness(products: StoreProduct[]): StoreProduct[] {
  return products.sort((left, right) => {
    if ((right.updated_at ?? 0) !== (left.updated_at ?? 0)) {
      return (right.updated_at ?? 0) - (left.updated_at ?? 0)
    }
    return (right.created_at ?? 0) - (left.created_at ?? 0)
  })
}

function listMemoryProducts(): StoreProduct[] {
  return sortProductsByFreshness(memoryProducts.map(cloneProduct))
}

function isStoreDbReachable(): boolean {
  if (!sql) {
    return false
  }
  return Date.now() >= storeDbUnavailableUntil
}

function markStoreDbRecovered() {
  storeDbUnavailableUntil = 0
}

function markStoreDbFailure(error: unknown, context: string) {
  if (!sql) {
    return
  }

  const now = Date.now()
  if (now >= storeDbUnavailableUntil) {
    console.error(`[store-data] Falling back to in-memory store after ${context} failed.`, error)
  }
  storeDbUnavailableUntil = now + STORE_DB_FAILURE_COOLDOWN_MS
}

async function withStoreDbTimeout<T>(operation: Promise<T>, context: string, timeoutMs = STORE_DB_TIMEOUT_MS): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`[store-data] ${context} timed out after ${timeoutMs}ms.`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([operation, timeoutPromise])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

function createProductId(): string {
  return `prd_${crypto.randomUUID().replace(/-/g, "")}`
}

function normalizeText(value: string, fallback: string, maxLength = 400): string {
  const normalized = value.trim()
  if (!normalized) {
    return fallback
  }
  return normalized.slice(0, maxLength)
}

function normalizeOptionalText(value: string | undefined, maxLength = 1000): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  if (!normalized) {
    return undefined
  }

  return normalized.slice(0, maxLength)
}

function normalizeCategory(value: unknown): StoreCategory {
  if (typeof value === "string" && STORE_CATEGORIES.includes(value as StoreCategory)) {
    return value as StoreCategory
  }
  return "ceramics"
}

function normalizeStockStatus(value: unknown): StoreStockStatus {
  if (typeof value === "string" && STORE_STOCK_STATUSES.includes(value as StoreStockStatus)) {
    return value as StoreStockStatus
  }
  return "in_stock"
}

function normalizePrice(value: unknown): number {
  const normalized = toNumber(value)
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return 1
  }

  return Number(normalized.toFixed(2))
}

function mapStoreProductRow(row: StoreProductRow): StoreProduct {
  return {
    id: row.id,
    name: row.name,
    category: normalizeCategory(row.category),
    price_tnd: normalizePrice(row.price_tnd),
    stock_status: normalizeStockStatus(row.stock_status),
    description: row.description,
    image: row.image ?? undefined,
    created_at: toNumber(row.created_at),
    updated_at: toNumber(row.updated_at),
  }
}

function mapStoreSettingsRow(row: StoreSettingsRow | undefined): StoreSettings {
  if (!row) {
    return {
      ...DEFAULT_STORE_SETTINGS,
      updated_at: Date.now(),
    }
  }

  return {
    store_name: normalizeText(row.store_name, DEFAULT_STORE_SETTINGS.store_name, 120),
    store_description: normalizeText(
      row.store_description,
      DEFAULT_STORE_SETTINGS.store_description,
      400
    ),
    contact_email: normalizeText(row.contact_email, DEFAULT_STORE_SETTINGS.contact_email, 180),
    hero_image_url: row.hero_image_url ?? "",
    site_icon_url: row.site_icon_url ?? "",
    feature_one_title: normalizeText(
      row.feature_one_title ?? "",
      DEFAULT_STORE_SETTINGS.feature_one_title ?? "100% Natural",
      80
    ),
    feature_one_description: normalizeText(
      row.feature_one_description ?? "",
      DEFAULT_STORE_SETTINGS.feature_one_description ?? "Organic oils and natural materials",
      180
    ),
    feature_two_title: normalizeText(
      row.feature_two_title ?? "",
      DEFAULT_STORE_SETTINGS.feature_two_title ?? "Worldwide Shipping",
      80
    ),
    feature_two_description: normalizeText(
      row.feature_two_description ?? "",
      DEFAULT_STORE_SETTINGS.feature_two_description ?? "Delivery to your doorstep",
      180
    ),
    feature_three_title: normalizeText(
      row.feature_three_title ?? "",
      DEFAULT_STORE_SETTINGS.feature_three_title ?? "Handcrafted",
      80
    ),
    feature_three_description: normalizeText(
      row.feature_three_description ?? "",
      DEFAULT_STORE_SETTINGS.feature_three_description ?? "By skilled local artisans",
      180
    ),
    updated_at: toNumber(row.updated_at) || Date.now(),
  }
}

async function ensureStoreSchema() {
  if (!isStoreDbReachable()) {
    return
  }

  const db = sql
  if (!db) {
    return
  }

  if (!ensureStoreSchemaPromise) {
    ensureStoreSchemaPromise = (async () => {
      await db`
        CREATE TABLE IF NOT EXISTS store_products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          price_tnd NUMERIC NOT NULL DEFAULT 1,
          stock_status TEXT NOT NULL DEFAULT 'in_stock',
          description TEXT NOT NULL,
          image TEXT,
          created_at BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT),
          updated_at BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT),
          deleted_at BIGINT
        );
      `

      await db`
        ALTER TABLE store_products
        ADD COLUMN IF NOT EXISTS deleted_at BIGINT;
      `

      await db`
        CREATE INDEX IF NOT EXISTS idx_store_products_updated_at
        ON store_products(updated_at DESC);
      `

      await db`
        CREATE INDEX IF NOT EXISTS idx_store_products_active_updated_at
        ON store_products(updated_at DESC)
        WHERE deleted_at IS NULL;
      `

      await db`
        CREATE TABLE IF NOT EXISTS store_settings (
          id INT PRIMARY KEY,
          store_name TEXT NOT NULL,
          store_description TEXT NOT NULL,
          contact_email TEXT NOT NULL,
          hero_image_url TEXT,
          site_icon_url TEXT,
          feature_one_title TEXT,
          feature_one_description TEXT,
          feature_two_title TEXT,
          feature_two_description TEXT,
          feature_three_title TEXT,
          feature_three_description TEXT,
          updated_at BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT),
          CONSTRAINT store_settings_single_row CHECK (id = 1)
        );
      `

      await db`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS site_icon_url TEXT;
      `

      await db`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS feature_one_title TEXT;
      `

      await db`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS feature_one_description TEXT;
      `

      await db`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS feature_two_title TEXT;
      `

      await db`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS feature_two_description TEXT;
      `

      await db`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS feature_three_title TEXT;
      `

      await db`
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS feature_three_description TEXT;
      `

      await db`
        INSERT INTO store_settings (
          id,
          store_name,
          store_description,
          contact_email,
          hero_image_url,
          site_icon_url,
          feature_one_title,
          feature_one_description,
          feature_two_title,
          feature_two_description,
          feature_three_title,
          feature_three_description
        )
        VALUES (
          1,
          ${DEFAULT_STORE_SETTINGS.store_name},
          ${DEFAULT_STORE_SETTINGS.store_description},
          ${DEFAULT_STORE_SETTINGS.contact_email},
          ${DEFAULT_STORE_SETTINGS.hero_image_url},
          ${DEFAULT_STORE_SETTINGS.site_icon_url ?? ""},
          ${DEFAULT_STORE_SETTINGS.feature_one_title ?? "100% Natural"},
          ${DEFAULT_STORE_SETTINGS.feature_one_description ?? "Organic oils and natural materials"},
          ${DEFAULT_STORE_SETTINGS.feature_two_title ?? "Worldwide Shipping"},
          ${DEFAULT_STORE_SETTINGS.feature_two_description ?? "Delivery to your doorstep"},
          ${DEFAULT_STORE_SETTINGS.feature_three_title ?? "Handcrafted"},
          ${DEFAULT_STORE_SETTINGS.feature_three_description ?? "By skilled local artisans"}
        )
        ON CONFLICT (id) DO NOTHING;
      `

      const [countRow] = (await db`
        SELECT COUNT(*)::INT AS count
        FROM store_products
        WHERE deleted_at IS NULL;
      `) as Array<{ count: string | number }>

      const existingCount = toNumber(countRow?.count)
      if (existingCount === 0) {
        for (const product of seedProducts) {
          await db`
            INSERT INTO store_products (
              id,
              name,
              category,
              price_tnd,
              stock_status,
              description,
              image,
              created_at,
              updated_at
            )
            VALUES (
              ${product.id},
              ${product.name},
              ${product.category},
              ${product.price_tnd},
              ${product.stock_status},
              ${product.description},
              ${product.image ?? null},
              ${product.created_at ?? Date.now()},
              ${product.updated_at ?? Date.now()}
            )
            ON CONFLICT (id) DO NOTHING;
          `
        }
      }
    })().catch((error) => {
      ensureStoreSchemaPromise = null
      throw error
    })
  }

  try {
    await withStoreDbTimeout(ensureStoreSchemaPromise, "ensureStoreSchema", STORE_DB_SCHEMA_TIMEOUT_MS)
    markStoreDbRecovered()
  } catch (error) {
    markStoreDbFailure(error, "ensureStoreSchema")
    throw error
  }
}

export function isStorePersisted(): boolean {
  return sql !== null && isStoreDbReachable()
}

export async function listStoreProducts(): Promise<StoreProduct[]> {
  if (!isStoreDbReachable()) {
    return listMemoryProducts()
  }

  const db = sql
  if (!db) {
    return listMemoryProducts()
  }

  try {
    await ensureStoreSchema()

    const rows = (await withStoreDbTimeout(
      db`
        SELECT id, name, category, price_tnd, stock_status, description, image, created_at, updated_at
        FROM store_products
        WHERE deleted_at IS NULL
        ORDER BY updated_at DESC, created_at DESC;
      `,
      "listStoreProducts"
    )) as StoreProductRow[]

    const mapped = rows.map(mapStoreProductRow)
    memoryProducts = mapped.map(cloneProduct)
    markStoreDbRecovered()
    return listMemoryProducts()
  } catch (error) {
    markStoreDbFailure(error, "listStoreProducts")
    return listMemoryProducts()
  }
}

export async function getStoreProductById(productId: string): Promise<StoreProduct | null> {
  const normalizedId = productId.trim()
  if (!normalizedId) {
    return null
  }

  if (!isStoreDbReachable()) {
    const found = memoryProducts.find((product) => product.id === normalizedId)
    return found ? cloneProduct(found) : null
  }

  const db = sql
  if (!db) {
    const found = memoryProducts.find((product) => product.id === normalizedId)
    return found ? cloneProduct(found) : null
  }

  try {
    await ensureStoreSchema()

    const [row] = (await withStoreDbTimeout(
      db`
        SELECT id, name, category, price_tnd, stock_status, description, image, created_at, updated_at
        FROM store_products
        WHERE id = ${normalizedId} AND deleted_at IS NULL
        LIMIT 1;
      `,
      "getStoreProductById"
    )) as StoreProductRow[]

    if (!row) {
      return null
    }

    const mapped = mapStoreProductRow(row)
    memoryProducts = memoryProducts.map((product) =>
      product.id === mapped.id ? cloneProduct(mapped) : product
    )
    markStoreDbRecovered()
    return cloneProduct(mapped)
  } catch (error) {
    markStoreDbFailure(error, "getStoreProductById")
    const found = memoryProducts.find((product) => product.id === normalizedId)
    return found ? cloneProduct(found) : null
  }
}

export async function createStoreProduct(input: CreateStoreProductInput): Promise<StoreProduct> {
  const now = Date.now()
  const product: StoreProduct = {
    id: createProductId(),
    name: normalizeText(input.name, "Untitled Product", 180),
    category: normalizeCategory(input.category),
    price_tnd: normalizePrice(input.price_tnd),
    stock_status: normalizeStockStatus(input.stock_status),
    description: normalizeText(input.description, "No description available.", 1000),
    image: normalizeOptionalText(input.image, 5_000_000),
    created_at: now,
    updated_at: now,
  }

  if (!isStoreDbReachable()) {
    memoryProducts = [cloneProduct(product), ...memoryProducts.filter((entry) => entry.id !== product.id)]
    return cloneProduct(product)
  }

  const db = sql
  if (!db) {
    memoryProducts = [cloneProduct(product), ...memoryProducts.filter((entry) => entry.id !== product.id)]
    return cloneProduct(product)
  }

  try {
    await ensureStoreSchema()

    const [row] = (await withStoreDbTimeout(
      db`
        INSERT INTO store_products (
          id,
          name,
          category,
          price_tnd,
          stock_status,
          description,
          image,
          created_at,
          updated_at
        )
        VALUES (
          ${product.id},
          ${product.name},
          ${product.category},
          ${product.price_tnd},
          ${product.stock_status},
          ${product.description},
          ${product.image ?? null},
          ${product.created_at ?? now},
          ${product.updated_at ?? now}
        )
        RETURNING id, name, category, price_tnd, stock_status, description, image, created_at, updated_at;
      `,
      "createStoreProduct"
    )) as StoreProductRow[]

    if (!row) {
      throw new Error("[store-data] Failed to create product row.")
    }

    const created = mapStoreProductRow(row)
    memoryProducts = [cloneProduct(created), ...memoryProducts.filter((entry) => entry.id !== created.id)]
    markStoreDbRecovered()
    return cloneProduct(created)
  } catch (error) {
    markStoreDbFailure(error, "createStoreProduct")
    memoryProducts = [cloneProduct(product), ...memoryProducts.filter((entry) => entry.id !== product.id)]
    return cloneProduct(product)
  }
}

export async function updateStoreProduct(
  productId: string,
  input: UpdateStoreProductInput
): Promise<StoreProduct | null> {
  const existing = await getStoreProductById(productId)
  if (!existing) {
    return null
  }

  const updated: StoreProduct = {
    ...existing,
    name:
      typeof input.name === "string"
        ? normalizeText(input.name, existing.name, 180)
        : existing.name,
    category:
      typeof input.category === "string"
        ? normalizeCategory(input.category)
        : existing.category,
    price_tnd:
      typeof input.price_tnd === "number" ? normalizePrice(input.price_tnd) : existing.price_tnd,
    stock_status:
      typeof input.stock_status === "string"
        ? normalizeStockStatus(input.stock_status)
        : existing.stock_status,
    description:
      typeof input.description === "string"
        ? normalizeText(input.description, existing.description, 1000)
        : existing.description,
    image:
      typeof input.image === "string"
        ? normalizeOptionalText(input.image, 5_000_000)
        : existing.image,
    updated_at: Date.now(),
  }

  if (!isStoreDbReachable()) {
    memoryProducts = memoryProducts.map((product) => (product.id === existing.id ? cloneProduct(updated) : product))
    return cloneProduct(updated)
  }

  const db = sql
  if (!db) {
    memoryProducts = memoryProducts.map((product) => (product.id === existing.id ? cloneProduct(updated) : product))
    return cloneProduct(updated)
  }

  try {
    await ensureStoreSchema()

    const [row] = (await withStoreDbTimeout(
      db`
        UPDATE store_products
        SET
          name = ${updated.name},
          category = ${updated.category},
          price_tnd = ${updated.price_tnd},
          stock_status = ${updated.stock_status},
          description = ${updated.description},
          image = ${updated.image ?? null},
          updated_at = ${updated.updated_at ?? Date.now()}
        WHERE id = ${existing.id} AND deleted_at IS NULL
        RETURNING id, name, category, price_tnd, stock_status, description, image, created_at, updated_at;
      `,
      "updateStoreProduct"
    )) as StoreProductRow[]

    if (!row) {
      return null
    }

    const mapped = mapStoreProductRow(row)
    memoryProducts = memoryProducts.map((product) =>
      product.id === mapped.id ? cloneProduct(mapped) : product
    )
    markStoreDbRecovered()
    return cloneProduct(mapped)
  } catch (error) {
    markStoreDbFailure(error, "updateStoreProduct")
    memoryProducts = memoryProducts.map((product) => (product.id === existing.id ? cloneProduct(updated) : product))
    return cloneProduct(updated)
  }
}

export async function deleteStoreProduct(productId: string): Promise<boolean> {
  const normalizedId = productId.trim()
  if (!normalizedId) {
    return false
  }

  if (!isStoreDbReachable()) {
    const before = memoryProducts.length
    memoryProducts = memoryProducts.filter((product) => product.id !== normalizedId)
    return memoryProducts.length < before
  }

  const db = sql
  if (!db) {
    const before = memoryProducts.length
    memoryProducts = memoryProducts.filter((product) => product.id !== normalizedId)
    return memoryProducts.length < before
  }

  try {
    await ensureStoreSchema()

    const now = Date.now()
    const rows = (await withStoreDbTimeout(
      db`
        UPDATE store_products
        SET deleted_at = ${now}, updated_at = ${now}
        WHERE id = ${normalizedId} AND deleted_at IS NULL
        RETURNING id;
      `,
      "deleteStoreProduct"
    )) as Array<{ id: string }>

    if (rows.length > 0) {
      memoryProducts = memoryProducts.filter((product) => product.id !== normalizedId)
      markStoreDbRecovered()
      return true
    }

    return false
  } catch (error) {
    markStoreDbFailure(error, "deleteStoreProduct")
    const before = memoryProducts.length
    memoryProducts = memoryProducts.filter((product) => product.id !== normalizedId)
    return memoryProducts.length < before
  }
}

export async function getStoreSettings(): Promise<StoreSettings> {
  if (!isStoreDbReachable()) {
    return { ...memorySettings }
  }

  const db = sql
  if (!db) {
    return { ...memorySettings }
  }

  try {
    await ensureStoreSchema()

    const [row] = (await withStoreDbTimeout(
      db`
        SELECT
          store_name,
          store_description,
          contact_email,
          hero_image_url,
          site_icon_url,
          feature_one_title,
          feature_one_description,
          feature_two_title,
          feature_two_description,
          feature_three_title,
          feature_three_description,
          updated_at
        FROM store_settings
        WHERE id = 1
        LIMIT 1;
      `,
      "getStoreSettings"
    )) as StoreSettingsRow[]

    memorySettings = mapStoreSettingsRow(row)
    markStoreDbRecovered()
    return { ...memorySettings }
  } catch (error) {
    markStoreDbFailure(error, "getStoreSettings")
    return { ...memorySettings }
  }
}

export async function updateStoreSettings(input: UpdateStoreSettingsInput): Promise<StoreSettings> {
  const existing = await getStoreSettings()
  const updated: StoreSettings = {
    store_name:
      typeof input.store_name === "string"
        ? normalizeText(input.store_name, existing.store_name, 120)
        : existing.store_name,
    store_description:
      typeof input.store_description === "string"
        ? normalizeText(input.store_description, existing.store_description, 400)
        : existing.store_description,
    contact_email:
      typeof input.contact_email === "string"
        ? normalizeText(input.contact_email, existing.contact_email, 180)
        : existing.contact_email,
    hero_image_url:
      typeof input.hero_image_url === "string"
        ? input.hero_image_url.trim().slice(0, 2048)
        : existing.hero_image_url,
    site_icon_url:
      typeof input.site_icon_url === "string"
        ? input.site_icon_url.trim().slice(0, 2048)
        : existing.site_icon_url,
    feature_one_title:
      typeof input.feature_one_title === "string"
        ? normalizeText(
            input.feature_one_title,
            existing.feature_one_title ?? DEFAULT_STORE_SETTINGS.feature_one_title ?? "100% Natural",
            80
          )
        : existing.feature_one_title,
    feature_one_description:
      typeof input.feature_one_description === "string"
        ? normalizeText(
            input.feature_one_description,
            existing.feature_one_description ??
              DEFAULT_STORE_SETTINGS.feature_one_description ??
              "Organic oils and natural materials",
            180
          )
        : existing.feature_one_description,
    feature_two_title:
      typeof input.feature_two_title === "string"
        ? normalizeText(
            input.feature_two_title,
            existing.feature_two_title ?? DEFAULT_STORE_SETTINGS.feature_two_title ?? "Worldwide Shipping",
            80
          )
        : existing.feature_two_title,
    feature_two_description:
      typeof input.feature_two_description === "string"
        ? normalizeText(
            input.feature_two_description,
            existing.feature_two_description ??
              DEFAULT_STORE_SETTINGS.feature_two_description ??
              "Delivery to your doorstep",
            180
          )
        : existing.feature_two_description,
    feature_three_title:
      typeof input.feature_three_title === "string"
        ? normalizeText(
            input.feature_three_title,
            existing.feature_three_title ?? DEFAULT_STORE_SETTINGS.feature_three_title ?? "Handcrafted",
            80
          )
        : existing.feature_three_title,
    feature_three_description:
      typeof input.feature_three_description === "string"
        ? normalizeText(
            input.feature_three_description,
            existing.feature_three_description ??
              DEFAULT_STORE_SETTINGS.feature_three_description ??
              "By skilled local artisans",
            180
          )
        : existing.feature_three_description,
    updated_at: Date.now(),
  }

  if (!isStoreDbReachable()) {
    memorySettings = { ...updated }
    return { ...memorySettings }
  }

  const db = sql
  if (!db) {
    memorySettings = { ...updated }
    return { ...memorySettings }
  }

  try {
    await ensureStoreSchema()

    const [row] = (await withStoreDbTimeout(
      db`
        UPDATE store_settings
        SET
          store_name = ${updated.store_name},
          store_description = ${updated.store_description},
          contact_email = ${updated.contact_email},
          hero_image_url = ${updated.hero_image_url || null},
          site_icon_url = ${updated.site_icon_url || null},
          feature_one_title = ${updated.feature_one_title || null},
          feature_one_description = ${updated.feature_one_description || null},
          feature_two_title = ${updated.feature_two_title || null},
          feature_two_description = ${updated.feature_two_description || null},
          feature_three_title = ${updated.feature_three_title || null},
          feature_three_description = ${updated.feature_three_description || null},
          updated_at = ${updated.updated_at}
        WHERE id = 1
        RETURNING
          store_name,
          store_description,
          contact_email,
          hero_image_url,
          site_icon_url,
          feature_one_title,
          feature_one_description,
          feature_two_title,
          feature_two_description,
          feature_three_title,
          feature_three_description,
          updated_at;
      `,
      "updateStoreSettings"
    )) as StoreSettingsRow[]

    memorySettings = mapStoreSettingsRow(row)
    markStoreDbRecovered()
    return { ...memorySettings }
  } catch (error) {
    markStoreDbFailure(error, "updateStoreSettings")
    memorySettings = { ...updated }
    return { ...memorySettings }
  }
}

export async function getStoreSnapshot(): Promise<StoreSnapshot> {
  const [settings, products] = await Promise.all([getStoreSettings(), listStoreProducts()])
  return { settings, products }
}

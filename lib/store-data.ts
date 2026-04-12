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

const DEFAULT_STORE_SETTINGS: Omit<StoreSettings, "updated_at"> = {
  store_name: "SmartSouk",
  store_description:
    "Discover handcrafted ceramics, woven rugs, and organic oils from Tunisia. Every piece tells a story of tradition.",
  contact_email: "contact@smartsouk.tn",
  hero_image_url: "",
}

const seedProducts: StoreProduct[] = defaultSeedProducts.map((product) => ({
  id: product.id,
  name: product.name,
  category: product.category,
  price_tnd: product.price_tnd,
  stock_status: product.stock_status,
  description: product.description,
  image: product.image,
}))

let ensureStoreSchemaPromise: Promise<void> | null = null
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
    updated_at: toNumber(row.updated_at) || Date.now(),
  }
}

async function ensureStoreSchema() {
  if (!sql) {
    return
  }

  if (!ensureStoreSchemaPromise) {
    ensureStoreSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS store_products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          price_tnd NUMERIC NOT NULL DEFAULT 1,
          stock_status TEXT NOT NULL DEFAULT 'in_stock',
          description TEXT NOT NULL,
          image TEXT,
          created_at BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT),
          updated_at BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT)
        );
      `

      await sql`
        CREATE INDEX IF NOT EXISTS idx_store_products_updated_at
        ON store_products(updated_at DESC);
      `

      await sql`
        CREATE TABLE IF NOT EXISTS store_settings (
          id INT PRIMARY KEY,
          store_name TEXT NOT NULL,
          store_description TEXT NOT NULL,
          contact_email TEXT NOT NULL,
          hero_image_url TEXT,
          updated_at BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT),
          CONSTRAINT store_settings_single_row CHECK (id = 1)
        );
      `

      await sql`
        INSERT INTO store_settings (id, store_name, store_description, contact_email, hero_image_url)
        VALUES (
          1,
          ${DEFAULT_STORE_SETTINGS.store_name},
          ${DEFAULT_STORE_SETTINGS.store_description},
          ${DEFAULT_STORE_SETTINGS.contact_email},
          ${DEFAULT_STORE_SETTINGS.hero_image_url}
        )
        ON CONFLICT (id) DO NOTHING;
      `

      const [countRow] = (await sql`
        SELECT COUNT(*)::INT AS count
        FROM store_products;
      `) as Array<{ count: string | number }>

      const existingCount = toNumber(countRow?.count)
      if (existingCount === 0) {
        for (const product of seedProducts) {
          await sql`
            INSERT INTO store_products (id, name, category, price_tnd, stock_status, description, image)
            VALUES (
              ${product.id},
              ${product.name},
              ${product.category},
              ${product.price_tnd},
              ${product.stock_status},
              ${product.description},
              ${product.image ?? null}
            )
            ON CONFLICT (id) DO NOTHING;
          `
        }
      }
    })()
  }

  await ensureStoreSchemaPromise
}

export function isStorePersisted(): boolean {
  return sql !== null
}

export async function listStoreProducts(): Promise<StoreProduct[]> {
  if (!sql) {
    return memoryProducts
      .map((product) => ({ ...product }))
      .sort((left, right) => (right.updated_at ?? 0) - (left.updated_at ?? 0))
  }

  await ensureStoreSchema()

  const rows = (await sql`
    SELECT id, name, category, price_tnd, stock_status, description, image, created_at, updated_at
    FROM store_products
    ORDER BY updated_at DESC, created_at DESC;
  `) as StoreProductRow[]

  return rows.map(mapStoreProductRow)
}

export async function getStoreProductById(productId: string): Promise<StoreProduct | null> {
  const normalizedId = productId.trim()
  if (!normalizedId) {
    return null
  }

  if (!sql) {
    const found = memoryProducts.find((product) => product.id === normalizedId)
    return found ? { ...found } : null
  }

  await ensureStoreSchema()

  const [row] = (await sql`
    SELECT id, name, category, price_tnd, stock_status, description, image, created_at, updated_at
    FROM store_products
    WHERE id = ${normalizedId}
    LIMIT 1;
  `) as StoreProductRow[]

  return row ? mapStoreProductRow(row) : null
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
    image: normalizeOptionalText(input.image, 2048),
    created_at: now,
    updated_at: now,
  }

  if (!sql) {
    memoryProducts = [product, ...memoryProducts]
    return { ...product }
  }

  await ensureStoreSchema()

  const [row] = (await sql`
    INSERT INTO store_products (id, name, category, price_tnd, stock_status, description, image, created_at, updated_at)
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
  `) as StoreProductRow[]

  return mapStoreProductRow(row)
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
        ? normalizeOptionalText(input.image, 2048)
        : existing.image,
    updated_at: Date.now(),
  }

  if (!sql) {
    memoryProducts = memoryProducts.map((product) => (product.id === existing.id ? updated : product))
    return { ...updated }
  }

  await ensureStoreSchema()

  const [row] = (await sql`
    UPDATE store_products
    SET
      name = ${updated.name},
      category = ${updated.category},
      price_tnd = ${updated.price_tnd},
      stock_status = ${updated.stock_status},
      description = ${updated.description},
      image = ${updated.image ?? null},
      updated_at = ${updated.updated_at ?? Date.now()}
    WHERE id = ${existing.id}
    RETURNING id, name, category, price_tnd, stock_status, description, image, created_at, updated_at;
  `) as StoreProductRow[]

  return row ? mapStoreProductRow(row) : null
}

export async function deleteStoreProduct(productId: string): Promise<boolean> {
  const normalizedId = productId.trim()
  if (!normalizedId) {
    return false
  }

  if (!sql) {
    const before = memoryProducts.length
    memoryProducts = memoryProducts.filter((product) => product.id !== normalizedId)
    return memoryProducts.length < before
  }

  await ensureStoreSchema()

  const rows = (await sql`
    DELETE FROM store_products
    WHERE id = ${normalizedId}
    RETURNING id;
  `) as Array<{ id: string }>

  return rows.length > 0
}

export async function getStoreSettings(): Promise<StoreSettings> {
  if (!sql) {
    return { ...memorySettings }
  }

  await ensureStoreSchema()

  const [row] = (await sql`
    SELECT store_name, store_description, contact_email, hero_image_url, updated_at
    FROM store_settings
    WHERE id = 1
    LIMIT 1;
  `) as StoreSettingsRow[]

  return mapStoreSettingsRow(row)
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
    updated_at: Date.now(),
  }

  if (!sql) {
    memorySettings = { ...updated }
    return { ...memorySettings }
  }

  await ensureStoreSchema()

  const [row] = (await sql`
    UPDATE store_settings
    SET
      store_name = ${updated.store_name},
      store_description = ${updated.store_description},
      contact_email = ${updated.contact_email},
      hero_image_url = ${updated.hero_image_url || null},
      updated_at = ${updated.updated_at}
    WHERE id = 1
    RETURNING store_name, store_description, contact_email, hero_image_url, updated_at;
  `) as StoreSettingsRow[]

  return mapStoreSettingsRow(row)
}

export async function getStoreSnapshot(): Promise<StoreSnapshot> {
  const [settings, products] = await Promise.all([getStoreSettings(), listStoreProducts()])
  return { settings, products }
}
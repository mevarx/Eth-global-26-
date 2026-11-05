import { createPublicClient, InvalidValueError, NoEntityFoundError, SchemaMismatchError } from '@arkiv-network/sdk'
import { asc, eq } from '@arkiv-network/sdk/query'
import { http, isHex } from 'viem'
import type { Hex, PublicConfig, WorkshopView } from '../shared/domain'
import { WORKSHOP_NAMESPACE, WorkshopSchema, arkivChainFromConfig, normalizeBytes32, parseWorkshopRow } from './schema'

export type ArkivReadErrorCode = 'INVALID_ENTITY_KEY' | 'INVALID_CONFIG' | 'ARKIV_UNAVAILABLE'

/** The only error read.ts throws. Messages never contain RPC URLs or provider detail. */
export class ArkivReadError extends Error {
  readonly code: ArkivReadErrorCode
  readonly retryable: boolean
  constructor(code: ArkivReadErrorCode, message: string, retryable: boolean) {
    super(message)
    this.name = 'ArkivReadError'
    this.code = code
    this.retryable = retryable
  }
}

const PAGE_SIZE = 100
const MAX_PAGES = 10 // 1,000 listings; beyond this the catalogue is reported as unavailable, not truncated silently.

const SELECTION = {
  $key: true,
  $owner: true,
  $expiresAt: true,
  app: true,
  title: true,
  description: true,
  active: true,
  jobType: true,
  sourceLang: true,
  targetLang: true,
  checkoutChainId: true,
  checkoutAddress: true,
  serviceId: true,
  termsHash: true,
} as const

export function createWorkshopClient(config: PublicConfig) {
  if (config.appNamespace !== WORKSHOP_NAMESPACE) {
    throw new ArkivReadError('INVALID_CONFIG', 'Configured namespace does not match this schema version.', false)
  }
  return createPublicClient({
    chain: arkivChainFromConfig(config.arkiv),
    transport: http(config.arkiv.rpcUrl, { retryCount: 1, timeout: 15_000 }),
  })
}

export type WorkshopReadClient = ReturnType<typeof createWorkshopClient>

function unavailable(): ArkivReadError {
  return new ArkivReadError('ARKIV_UNAVAILABLE', 'The Arkiv catalogue could not be read. Try again shortly.', true)
}

/** Translates SDK/viem failures; everything that is not a bad key becomes one sanitized code. */
export function mapReadError(error: unknown): ArkivReadError {
  if (error instanceof ArkivReadError) return error
  if (error instanceof InvalidValueError) {
    return new ArkivReadError('INVALID_ENTITY_KEY', 'The entity key is not valid.', false)
  }
  return unavailable()
}

function newFetchedAt(): string {
  return new Date().toISOString()
}

export async function readWorkshops(client: WorkshopReadClient, config: PublicConfig): Promise<WorkshopView[]> {
  const fetchedAt = newFetchedAt()
  const byKey = new Map<Hex, WorkshopView>()
  try {
    let offset = 0
    for (let page = 0; ; page++) {
      if (page >= MAX_PAGES) throw unavailable()
      const result = await client
        .select(SELECTION)
        .from(WorkshopSchema)
        .where(eq('app', WORKSHOP_NAMESPACE))
        .orderBy(asc('$key'))
        .limit(PAGE_SIZE)
        .offset(offset)
        .fetch()
      for (const row of result.entities) {
        const parsed = parseWorkshopRow(row, config, fetchedAt)
        if (parsed.ok) byKey.set(parsed.view.entityKey, parsed.view)
      }
      const covered = result.entities.length + result.skipped
      if (covered < PAGE_SIZE) break
      offset += covered
    }
  } catch (error) {
    throw mapReadError(error)
  }
  return [...byKey.values()]
}

export async function readWorkshop(client: WorkshopReadClient, config: PublicConfig, key: Hex): Promise<WorkshopView | null> {
  const normalizedKey = typeof key === 'string' && isHex(key, { strict: true }) ? normalizeBytes32(key) : null
  if (normalizedKey === null) throw new ArkivReadError('INVALID_ENTITY_KEY', 'The entity key is not valid.', false)
  const fetchedAt = newFetchedAt()
  try {
    const row = await client.getEntity(normalizedKey, WorkshopSchema)
    const parsed = parseWorkshopRow(row, config, fetchedAt)
    return parsed.ok ? parsed.view : null
  } catch (error) {
    // A missing/expired entity, or one not written through this schema, is a successful "not a listing".
    if (error instanceof NoEntityFoundError || error instanceof SchemaMismatchError) return null
    throw mapReadError(error)
  }
}

export async function listWorkshops(config: PublicConfig): Promise<WorkshopView[]> {
  return readWorkshops(createWorkshopClient(config), config)
}

export async function getWorkshop(config: PublicConfig, key: Hex): Promise<WorkshopView | null> {
  return readWorkshop(createWorkshopClient(config), config, key)
}

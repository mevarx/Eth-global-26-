import { defineSchema, bool, bytes, key, str, u64, addr } from '@arkiv-network/sdk/schema'
import { defineChain, getAddress, isAddress, isAddressEqual, isHex, hexToBytes } from 'viem'
import type { Chain } from 'viem'
import type { Address, CheckoutTerms, Hex, PublicConfig, WorkshopView } from '../shared/domain'

export const WORKSHOP_NAMESPACE = 'tool-city.workshop.v1'
export const WORKSHOP_JOB_TYPE = 'text.translate'
export const WORKSHOP_SOURCE_LANG = 'en'
export const WORKSHOP_TARGET_LANG = 'hi'

// title is a `str` column (SDK cap: 128 UTF-8 bytes); description is a `bytes` column (SDK cap: 128 KiB).
export const TITLE_MAX_CHARS = 60
export const TITLE_MAX_BYTES = 128
export const DESCRIPTION_MAX_CHARS = 500
export const DESCRIPTION_MAX_BYTES = 2000

export const WorkshopSchema = defineSchema(WORKSHOP_NAMESPACE, {
  app: str().indexed(),
  title: str(),
  description: bytes(),
  active: bool(),
  jobType: str(),
  sourceLang: str(),
  targetLang: str(),
  checkoutChainId: u64(),
  checkoutAddress: addr(),
  serviceId: key(),
  termsHash: key(),
})

export type WorkshopInputErrorField = 'title' | 'description' | 'active' | 'terms' | 'changes'

export class WorkshopInputError extends Error {
  readonly code = 'INVALID_INPUT' as const
  readonly field: WorkshopInputErrorField
  constructor(field: WorkshopInputErrorField, message: string) {
    super(message)
    this.name = 'WorkshopInputError'
    this.field = field
  }
}

export type PublishWorkshopInput = { title: string; description: string; active?: boolean }
export type WorkshopChanges = { title?: string; description?: string; active?: boolean }

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

function codePoints(text: string): number {
  return Array.from(text).length
}

function validateTitle(value: unknown): string {
  if (typeof value !== 'string') throw new WorkshopInputError('title', 'Title must be text.')
  const title = value.trim()
  if (title.length === 0) throw new WorkshopInputError('title', 'Title is required.')
  if (codePoints(title) > TITLE_MAX_CHARS || encoder.encode(title).length > TITLE_MAX_BYTES) {
    throw new WorkshopInputError('title', `Title must be at most ${TITLE_MAX_CHARS} characters and ${TITLE_MAX_BYTES} UTF-8 bytes.`)
  }
  return title
}

function validateDescription(value: unknown): Uint8Array {
  if (typeof value !== 'string') throw new WorkshopInputError('description', 'Description must be text.')
  const description = value.trim()
  if (description.length === 0) throw new WorkshopInputError('description', 'Description is required.')
  const encoded = encoder.encode(description)
  if (codePoints(description) > DESCRIPTION_MAX_CHARS || encoded.length > DESCRIPTION_MAX_BYTES) {
    throw new WorkshopInputError('description', `Description must be at most ${DESCRIPTION_MAX_CHARS} characters and ${DESCRIPTION_MAX_BYTES} UTF-8 bytes.`)
  }
  return encoded
}

function validateActive(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new WorkshopInputError('active', 'Active must be true or false.')
  return value
}

/** Attributes for createEntity. Checkout fields come from configured terms, never from the form. */
export function encodeWorkshopCreate(input: PublishWorkshopInput, terms: CheckoutTerms | null) {
  if (terms === null) throw new WorkshopInputError('terms', 'Checkout terms are not configured; a listing cannot be published yet.')
  const checkoutAddress = normalizeAddress(terms.checkoutAddress)
  const serviceId = normalizeBytes32(terms.serviceId)
  const termsHash = normalizeBytes32(terms.termsHash)
  if (checkoutAddress === null || serviceId === null || termsHash === null || !Number.isSafeInteger(terms.chainId) || terms.chainId <= 0) {
    throw new WorkshopInputError('terms', 'Configured checkout terms are malformed.')
  }
  return {
    app: WORKSHOP_NAMESPACE,
    title: validateTitle(input.title),
    description: validateDescription(input.description),
    active: input.active === undefined ? true : validateActive(input.active),
    jobType: WORKSHOP_JOB_TYPE,
    sourceLang: WORKSHOP_SOURCE_LANG,
    targetLang: WORKSHOP_TARGET_LANG,
    checkoutChainId: u64(BigInt(terms.chainId)),
    checkoutAddress: addr(checkoutAddress),
    serviceId: key(serviceId),
    termsHash: key(termsHash),
  }
}

const EDITABLE = new Set(['title', 'description', 'active'])

/** `set` payload for patchEntity. Only title, description and active are editable. */
export function encodeWorkshopPatch(changes: WorkshopChanges) {
  if (typeof changes !== 'object' || changes === null) throw new WorkshopInputError('changes', 'Changes must be an object.')
  const given = Object.keys(changes).filter((k) => (changes as Record<string, unknown>)[k] !== undefined)
  const rejected = given.filter((k) => !EDITABLE.has(k))
  if (rejected.length > 0) throw new WorkshopInputError('changes', `Not editable: ${rejected.join(', ')}.`)
  if (given.length === 0) throw new WorkshopInputError('changes', 'Nothing to update.')
  const set: { title?: string; description?: Uint8Array; active?: boolean } = {}
  if (changes.title !== undefined) set.title = validateTitle(changes.title)
  if (changes.description !== undefined) set.description = validateDescription(changes.description)
  if (changes.active !== undefined) set.active = validateActive(changes.active)
  return set
}

export function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) return null
  return getAddress(value) as Address
}

export function addressesEqual(a: unknown, b: unknown): boolean {
  const left = normalizeAddress(a)
  const right = normalizeAddress(b)
  return left !== null && right !== null && isAddressEqual(left, right)
}

export function normalizeBytes32(value: unknown): Hex | null {
  if (typeof value !== 'string' || !isHex(value, { strict: true }) || value.length !== 66) return null
  return value.toLowerCase() as Hex
}

export type ParseResult =
  | { ok: true; view: WorkshopView }
  | { ok: false; reason: string }

function cell(row: Record<string, unknown>, name: string): unknown {
  const entry = row[name]
  return typeof entry === 'object' && entry !== null && 'value' in entry ? (entry as { value: unknown }).value : undefined
}

function decodeDescription(value: unknown): string | null {
  if (!(typeof value === 'string' && isHex(value, { strict: true }))) return null
  try {
    return decoder.decode(hexToBytes(value))
  } catch {
    return null
  }
}

/** Dependency-free `supported` check; the server still compares against its own configured terms. */
export function computeSupported(
  view: Pick<WorkshopView, 'ownerAddress' | 'serviceId' | 'checkoutAddress' | 'checkoutChainId' | 'termsHash'>,
  terms: CheckoutTerms | null,
): boolean {
  if (terms === null) return false
  return (
    addressesEqual(view.ownerAddress, terms.merchantAddress) &&
    addressesEqual(view.checkoutAddress, terms.checkoutAddress) &&
    view.checkoutChainId === terms.chainId &&
    normalizeBytes32(view.serviceId) !== null &&
    normalizeBytes32(view.serviceId) === normalizeBytes32(terms.serviceId) &&
    normalizeBytes32(view.termsHash) !== null &&
    normalizeBytes32(view.termsHash) === normalizeBytes32(terms.termsHash)
  )
}

/**
 * Validates one raw SDK row (system fields + wrapped attribute cells) at runtime.
 * Rows that cannot be represented as a WorkshopView are rejected, never thrown on.
 */
export function parseWorkshopRow(raw: unknown, config: Pick<PublicConfig, 'terms'>, fetchedAt: string): ParseResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'row is not an object' }
  const row = raw as Record<string, unknown>

  const entityKey = normalizeBytes32(row.$key)
  if (entityKey === null) return { ok: false, reason: 'invalid entity key' }
  const ownerAddress = normalizeAddress(row.$owner)
  if (ownerAddress === null) return { ok: false, reason: 'missing or invalid owner' }

  if (cell(row, 'app') !== WORKSHOP_NAMESPACE) return { ok: false, reason: 'wrong app tag' }
  const title = cell(row, 'title')
  if (typeof title !== 'string' || title.length === 0) return { ok: false, reason: 'invalid title' }
  const description = decodeDescription(cell(row, 'description'))
  if (description === null) return { ok: false, reason: 'invalid description' }
  const active = cell(row, 'active')
  if (typeof active !== 'boolean') return { ok: false, reason: 'invalid active flag' }
  if (cell(row, 'jobType') !== WORKSHOP_JOB_TYPE) return { ok: false, reason: 'unsupported job type' }
  if (cell(row, 'sourceLang') !== WORKSHOP_SOURCE_LANG) return { ok: false, reason: 'unsupported source language' }
  if (cell(row, 'targetLang') !== WORKSHOP_TARGET_LANG) return { ok: false, reason: 'unsupported target language' }

  const chainIdRaw = cell(row, 'checkoutChainId')
  if (typeof chainIdRaw !== 'bigint' || chainIdRaw <= 0n || chainIdRaw > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, reason: 'invalid checkout chain id' }
  }
  const checkoutAddress = normalizeAddress(cell(row, 'checkoutAddress'))
  if (checkoutAddress === null) return { ok: false, reason: 'invalid checkout address' }
  const serviceId = normalizeBytes32(cell(row, 'serviceId'))
  if (serviceId === null) return { ok: false, reason: 'invalid service id' }
  const termsHash = normalizeBytes32(cell(row, 'termsHash'))
  if (termsHash === null) return { ok: false, reason: 'invalid terms hash' }

  let expiresAtBlock: string | null = null
  if (row.$expiresAt !== undefined && row.$expiresAt !== null) {
    if (typeof row.$expiresAt !== 'bigint' || row.$expiresAt < 0n) return { ok: false, reason: 'invalid expiry' }
    expiresAtBlock = row.$expiresAt.toString(10)
  }

  const checkoutChainId = Number(chainIdRaw)
  const view: WorkshopView = {
    entityKey,
    ownerAddress,
    title,
    description,
    active,
    sourceLang: WORKSHOP_SOURCE_LANG,
    targetLang: WORKSHOP_TARGET_LANG,
    jobType: WORKSHOP_JOB_TYPE,
    checkoutChainId,
    checkoutAddress,
    serviceId,
    termsHash,
    expiresAtBlock,
    fetchedAt,
    freshness: 'fresh',
    supported: false,
  }
  view.supported = computeSupported(view, config.terms)
  return { ok: true, view }
}

/** Chain definition built only from PublicConfig.arkiv; never hardcode endpoints. */
export function arkivChainFromConfig(arkiv: PublicConfig['arkiv']): Chain {
  return defineChain({
    id: arkiv.chainId,
    name: 'Arkiv',
    // Cosmetic only (shown by wallets on add-chain); PublicConfig carries no currency metadata.
    nativeCurrency: { name: 'tGLM', symbol: 'tGLM', decimals: 18 },
    rpcUrls: { default: { http: [arkiv.rpcUrl] } },
    blockExplorers: { default: { name: 'Explorer', url: arkiv.explorerUrl } },
  })
}


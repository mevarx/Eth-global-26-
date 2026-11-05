import { createWalletClient, ExpirationTime } from '@arkiv-network/sdk'
import { custom, isHex } from 'viem'
import { getChainId, switchChain } from 'viem/actions'
import type { EIP1193Provider, Transport } from 'viem'
import type { Address, Hex, PublicConfig } from '../shared/domain'
import { ArkivReadError, readWorkshop, createWorkshopClient } from './read'
import type { WorkshopReadClient } from './read'
import {
  WorkshopSchema,
  addressesEqual,
  arkivChainFromConfig,
  encodeWorkshopCreate,
  encodeWorkshopPatch,
  normalizeAddress,
  normalizeBytes32,
} from './schema'
import type { PublishWorkshopInput, WorkshopChanges } from './schema'

export type ArkivWriteErrorCode =
  | 'INVALID_ACCOUNT'
  | 'INVALID_ENTITY_KEY'
  | 'NOT_FOUND'
  | 'OWNER_LOOKUP_FAILED'
  | 'WRONG_OWNER'
  | 'WRONG_NETWORK'
  | 'USER_REJECTED'
  | 'TX_FAILED'

export class ArkivWriteError extends Error {
  readonly code: ArkivWriteErrorCode
  /** True when the user can simply try again (rejection, transient lookup failure). */
  readonly recoverable: boolean
  /** Set only when the SDK reported a real transaction hash. Pre-broadcast failures never have one. */
  readonly txHash: Hex | undefined
  readonly ownerAddress: Address | undefined
  readonly connectedAccount: Address | undefined
  constructor(
    code: ArkivWriteErrorCode,
    message: string,
    extra: { recoverable?: boolean; txHash?: Hex | undefined; ownerAddress?: Address; connectedAccount?: Address } = {},
  ) {
    super(message)
    this.name = 'ArkivWriteError'
    this.code = code
    this.recoverable = extra.recoverable ?? false
    this.txHash = extra.txHash
    this.ownerAddress = extra.ownerAddress
    this.connectedAccount = extra.connectedAccount
  }
}

/** A viem transport, or the connected wallet's EIP-1193 provider supplied by the caller. */
export type WalletTransport = Transport | EIP1193Provider

export type WriteContext = {
  config: PublicConfig
  transport: WalletTransport
  /** The connected wallet account (e.g. from the wallet provider state). */
  account: Address
  /** Optional pre-built public client for the owner lookup (reuse or tests). */
  publicClient?: WorkshopReadClient
}

export type PublishResult = { entityKey: Hex; txHash: Hex; expiresAtBlock: string }
export type UpdateResult = { entityKey: Hex; txHash: Hex }

function toTransport(transport: WalletTransport): Transport {
  return typeof transport === 'function' ? (transport as Transport) : custom(transport as EIP1193Provider)
}

function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = []
  let current: unknown = error
  for (let i = 0; i < 8 && current !== undefined && current !== null; i++) {
    chain.push(current)
    current = typeof current === 'object' ? (current as { cause?: unknown }).cause : undefined
  }
  return chain
}

function field(entry: unknown, name: string): unknown {
  return typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>)[name] : undefined
}

function isUserRejection(chain: unknown[]): boolean {
  return chain.some((e) => field(e, 'name') === 'UserRejectedRequestError' || field(e, 'code') === 4001)
}

function isNotOwner(chain: unknown[]): boolean {
  return chain.some((e) => {
    const data = field(e, 'data')
    if (field(data, 'errorName') === 'NotOwner') return true
    const message = field(e, 'message')
    return typeof message === 'string' && /\bNotOwner\b|is owned by 0x[0-9a-fA-F]{40}, not 0x/.test(message)
  })
}

function realTxHash(error: unknown): Hex | undefined {
  const hash = field(error, 'txHash')
  return typeof hash === 'string' ? normalizeBytes32(hash) ?? undefined : undefined
}

/** Maps SDK/wallet failures to ArkivWriteError. Provider detail is deliberately not forwarded. */
export function mapWriteError(error: unknown, ctx?: { ownerAddress?: Address; connectedAccount?: Address }): ArkivWriteError {
  if (error instanceof ArkivWriteError) return error
  const chain = causeChain(error)
  if (isUserRejection(chain)) {
    return new ArkivWriteError('USER_REJECTED', 'The request was rejected in the wallet. Nothing was sent.', { recoverable: true })
  }
  if (isNotOwner(chain)) {
    return new ArkivWriteError('WRONG_OWNER', 'The connected wallet does not own this listing.', {
      txHash: realTxHash(error),
      ...ctx,
    })
  }
  return new ArkivWriteError('TX_FAILED', 'The transaction could not be completed.', { recoverable: true, txHash: realTxHash(error) })
}

function walletClient(ctx: WriteContext) {
  const account = normalizeAddress(ctx.account)
  if (account === null) throw new ArkivWriteError('INVALID_ACCOUNT', 'No valid wallet account is connected.')
  const chain = arkivChainFromConfig(ctx.config.arkiv)
  return { client: createWalletClient({ chain, transport: toTransport(ctx.transport), account }), chain, account }
}

type Wallet = ReturnType<typeof walletClient>['client']

async function ensureNetwork(client: Wallet, chain: ReturnType<typeof arkivChainFromConfig>): Promise<void> {
  try {
    if ((await getChainId(client)) === chain.id) return
    try {
      await switchChain(client, { id: chain.id })
    } catch (error) {
      if (isUserRejection(causeChain(error))) throw error
      // Wallet may not know the chain yet (EIP-3085): add it, then switch.
      await client.addChain({ chain })
      await switchChain(client, { id: chain.id })
    }
  } catch (error) {
    if (isUserRejection(causeChain(error))) throw mapWriteError(error)
    throw new ArkivWriteError('WRONG_NETWORK', 'Switch your wallet to the Arkiv network and try again.', { recoverable: true })
  }
}

export async function publishWorkshop(ctx: WriteContext, input: PublishWorkshopInput): Promise<PublishResult> {
  const values = encodeWorkshopCreate(input, ctx.config.terms)
  const { client, chain } = walletClient(ctx)
  await ensureNetwork(client, chain)
  try {
    const created = await client.createEntity(WorkshopSchema, values, { expiration: ExpirationTime.max() })
    return { entityKey: created.entityKey, txHash: created.txHash, expiresAtBlock: created.expiresAt.toString(10) }
  } catch (error) {
    throw mapWriteError(error)
  }
}

export async function updateWorkshop(ctx: WriteContext, entityKey: Hex, changes: WorkshopChanges): Promise<UpdateResult> {
  const set = encodeWorkshopPatch(changes)
  const key = typeof entityKey === 'string' && isHex(entityKey, { strict: true }) ? normalizeBytes32(entityKey) : null
  if (key === null) throw new ArkivWriteError('INVALID_ENTITY_KEY', 'The entity key is not valid.')
  const { client, chain, account } = walletClient(ctx)

  // Fail closed: ownership is checked from chain state before anything is signed.
  let owner: Address
  try {
    const current = await readWorkshop(ctx.publicClient ?? createWorkshopClient(ctx.config), ctx.config, key)
    if (current === null) throw new ArkivWriteError('NOT_FOUND', 'This listing was not found. It may have expired or is not a Tool City listing.')
    owner = current.ownerAddress
  } catch (error) {
    if (error instanceof ArkivWriteError) throw error
    if (error instanceof ArkivReadError) {
      throw new ArkivWriteError('OWNER_LOOKUP_FAILED', 'Could not verify the listing owner, so nothing was sent.', { recoverable: error.retryable })
    }
    throw error
  }
  if (!addressesEqual(owner, account)) {
    throw new ArkivWriteError('WRONG_OWNER', 'The connected wallet does not own this listing. Nothing was sent.', {
      ownerAddress: owner,
      connectedAccount: account,
    })
  }

  await ensureNetwork(client, chain)
  try {
    const patched = await client.patchEntity(WorkshopSchema, key, { set })
    return { entityKey: key, txHash: patched.txHash }
  } catch (error) {
    throw mapWriteError(error, { ownerAddress: owner, connectedAccount: account })
  }
}

/** Owner-signed `active=false` update. Existing paid jobs are unaffected. */
export function withdrawWorkshop(ctx: WriteContext, entityKey: Hex): Promise<UpdateResult> {
  return updateWorkshop(ctx, entityKey, { active: false })
}

// Run with: npx tsx --test src/lib/arkiv/arkiv.test.ts  (synthetic fixtures; no network)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { InvalidValueError, NoEntityFoundError } from '@arkiv-network/sdk'
import { bytesToHex, getAddress } from 'viem'
import type { Address, CheckoutTerms, Hex, PublicConfig } from '../shared/domain'
import { ArkivReadError, readWorkshop, readWorkshops } from './read'
import type { WorkshopReadClient } from './read'
import {
  WORKSHOP_NAMESPACE,
  WorkshopInputError,
  addressesEqual,
  computeSupported,
  encodeWorkshopCreate,
  encodeWorkshopPatch,
  parseWorkshopRow,
} from './schema'
import { ArkivWriteError, publishWorkshop, updateWorkshop, withdrawWorkshop } from './write'

const MERCHANT = getAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') as Address
const OTHER = getAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') as Address
const CHECKOUT = getAddress('0xcccccccccccccccccccccccccccccccccccccccc') as Address
const SERVICE = ('0x' + '11'.repeat(32)) as Hex
const TERMS_HASH = ('0x' + '22'.repeat(32)) as Hex
const KEY = ('0x' + '33'.repeat(32)) as Hex

const terms: CheckoutTerms = {
  chainId: 1874,
  checkoutAddress: CHECKOUT,
  tokenAddress: '0x0000000000000000000000000000000000000001',
  tokenDecimals: 6,
  amountAtomic: '1000000',
  merchantAddress: MERCHANT,
  serviceId: SERVICE,
  termsHash: TERMS_HASH,
}
const config = {
  schemaVersion: 1,
  configured: true,
  appNamespace: WORKSHOP_NAMESPACE,
  sourceLang: 'en',
  targetLang: 'hi',
  maxWords: 250,
  maxChars: 5000,
  arkiv: { chainId: 7794095, rpcUrl: 'http://127.0.0.1:1', explorerUrl: 'http://127.0.0.1:2' },
  whitechain: { chainId: 1874, rpcUrl: 'http://127.0.0.1:3', explorerUrl: 'http://127.0.0.1:4', tokenAddress: terms.tokenAddress },
  terms,
  serviceTermsText: '',
} as PublicConfig

// Mimics the SDK row shape: system fields bare, attributes wrapped as { value }.
function rowFrom(values: ReturnType<typeof encodeWorkshopCreate>, extra: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = { $key: KEY, $owner: MERCHANT, $expiresAt: 7_884_100n }
  for (const [name, v] of Object.entries(values)) {
    const raw = v instanceof Uint8Array ? bytesToHex(v) : typeof v === 'object' && v !== null && 'value' in v ? (v as { value: unknown }).value : v
    row[name] = { value: raw }
  }
  return { ...row, ...extra }
}
const goodRow = (extra?: Record<string, unknown>) =>
  rowFrom(encodeWorkshopCreate({ title: 'हिंदी अनुवाद कार्यशाला', description: 'Private English→Hindi text translation.' }, terms), extra)

test('encode → parse round-trips, including non-ASCII text, bigint expiry as string', () => {
  const parsed = parseWorkshopRow(goodRow(), config, '2026-01-01T00:00:00.000Z')
  assert.ok(parsed.ok)
  assert.equal(parsed.view.title, 'हिंदी अनुवाद कार्यशाला')
  assert.equal(parsed.view.description, 'Private English→Hindi text translation.')
  assert.equal(parsed.view.expiresAtBlock, '7884100')
  assert.equal(parsed.view.checkoutChainId, 1874)
  assert.equal(parsed.view.serviceId, SERVICE)
  assert.equal(parsed.view.supported, true)
  assert.doesNotThrow(() => JSON.stringify(parsed.view))
})

test('missing expiry is null, never a fabricated date', () => {
  const row = goodRow({ $expiresAt: undefined })
  const parsed = parseWorkshopRow(row, config, 'x')
  assert.ok(parsed.ok && parsed.view.expiresAtBlock === null)
})

test('address comparison is case-insensitive and rejects malformed input', () => {
  assert.equal(addressesEqual(MERCHANT, MERCHANT.toLowerCase()), true)
  assert.equal(addressesEqual(MERCHANT, OTHER), false)
  assert.equal(addressesEqual(MERCHANT, 'nope'), false)
  assert.equal(addressesEqual(undefined, undefined), false)
})

test('supported compares owner, service, checkout, chain and terms against config terms', () => {
  const base = { ownerAddress: MERCHANT.toLowerCase() as Address, serviceId: SERVICE, checkoutAddress: CHECKOUT, checkoutChainId: 1874, termsHash: TERMS_HASH }
  assert.equal(computeSupported(base, terms), true)
  assert.equal(computeSupported({ ...base, ownerAddress: OTHER }, terms), false)
  assert.equal(computeSupported({ ...base, serviceId: ('0x' + 'aa'.repeat(32)) as Hex }, terms), false)
  assert.equal(computeSupported({ ...base, termsHash: ('0x' + 'aa'.repeat(32)) as Hex }, terms), false)
  assert.equal(computeSupported({ ...base, checkoutChainId: 1 }, terms), false)
  assert.equal(computeSupported({ ...base, checkoutAddress: OTHER }, terms), false)
  assert.equal(computeSupported(base, null), false)
})

test('a squatter using our app tag parses but is not supported', () => {
  const parsed = parseWorkshopRow(goodRow({ $owner: OTHER }), config, 'x')
  assert.ok(parsed.ok && parsed.view.supported === false)
})

test('invalid rows are rejected, not thrown', () => {
  for (const bad of [
    null,
    {},
    goodRow({ $owner: undefined }),
    goodRow({ app: { value: 'other.app' } }),
    goodRow({ targetLang: { value: 'fr' } }),
    goodRow({ active: { value: 'yes' } }),
    goodRow({ serviceId: { value: '0x1234' } }),
    goodRow({ description: { value: '0xff' } }),
    goodRow({ checkoutChainId: { value: -1n } }),
  ]) {
    assert.equal(parseWorkshopRow(bad, config, 'x').ok, false)
  }
})

test('input limits and non-editable fields are rejected before sending', () => {
  assert.throws(() => encodeWorkshopCreate({ title: 'x'.repeat(61), description: 'd' }, terms), WorkshopInputError)
  assert.throws(() => encodeWorkshopCreate({ title: 'ह'.repeat(50), description: 'd' }, terms), WorkshopInputError) // 150 bytes
  assert.throws(() => encodeWorkshopCreate({ title: 't', description: 'd'.repeat(501) }, terms), WorkshopInputError)
  assert.throws(() => encodeWorkshopCreate({ title: 't', description: 'd' }, null), WorkshopInputError)
  assert.throws(() => encodeWorkshopPatch({ price: 5 } as never), WorkshopInputError)
  assert.throws(() => encodeWorkshopPatch({ serviceId: SERVICE } as never), WorkshopInputError)
  assert.throws(() => encodeWorkshopPatch({}), WorkshopInputError)
  assert.deepEqual(Object.keys(encodeWorkshopPatch({ active: false })), ['active'])
})

type FakeClient = { getEntity?: (...a: unknown[]) => Promise<unknown>; select?: () => unknown }
const asClient = (c: FakeClient) => c as unknown as WorkshopReadClient

test('getWorkshop: missing record is null; network failure and bad key are typed errors', async () => {
  const missing = asClient({ getEntity: async () => { throw new NoEntityFoundError(KEY) } })
  assert.equal(await readWorkshop(missing, config, KEY), null)

  const down = asClient({ getEntity: async () => { throw Object.assign(new Error('fetch failed http://secret-rpc'), { name: 'HttpRequestError' }) } })
  await assert.rejects(readWorkshop(down, config, KEY), (e: unknown) => {
    assert.ok(e instanceof ArkivReadError)
    assert.equal(e.code, 'ARKIV_UNAVAILABLE')
    assert.ok(!e.message.includes('secret-rpc'))
    return true
  })

  const badKey = asClient({ getEntity: async () => { throw new Error('must not be called') } })
  await assert.rejects(readWorkshop(badKey, config, '0x12' as Hex), { code: 'INVALID_ENTITY_KEY' })
  const sdkBadKey = asClient({ getEntity: async () => { throw new InvalidValueError('key', 'x', 'bad') } })
  await assert.rejects(readWorkshop(sdkBadKey, config, KEY), { code: 'INVALID_ENTITY_KEY' })
})

test('listWorkshops: pages past 100, drops invalid rows, and a failure rejects instead of returning []', async () => {
  const keyN = (n: number) => ('0x' + n.toString(16).padStart(64, '0')) as Hex
  const pages = [
    { entities: Array.from({ length: 100 }, (_, i) => goodRow({ $key: keyN(i + 1) })), skipped: 0 },
    { entities: [goodRow({ $key: keyN(101) }), goodRow({ $key: keyN(102), app: { value: 'other' } })], skipped: 1 },
  ]
  const offsets: number[] = []
  const builder = (offset = 0) => ({
    from: () => builder(offset), where: () => builder(offset), orderBy: () => builder(offset), limit: () => builder(offset),
    offset: (o: number) => { offsets.push(o); return builder(o) },
    fetch: async () => (offset === 0 ? pages[0] : pages[1]),
  })
  const ok = asClient({ select: () => builder() })
  const list = await readWorkshops(ok, config)
  assert.equal(list.length, 101)
  assert.deepEqual(offsets, [0, 100])

  const failing = { from() { return this }, where() { return this }, orderBy() { return this }, limit() { return this }, offset() { return this }, fetch: async () => { throw new Error('boom') } }
  await assert.rejects(readWorkshops(asClient({ select: () => failing }), config), { code: 'ARKIV_UNAVAILABLE' })
})

function recordingProvider(onRequest?: (method: string) => unknown) {
  const calls: string[] = []
  return {
    calls,
    request: async ({ method }: { method: string }) => {
      calls.push(method)
      if (onRequest) return onRequest(method)
      throw Object.assign(new Error('unexpected wallet call'), { code: -32000 })
    },
  }
}
const ownerClient = (owner: string) => asClient({ getEntity: async () => goodRow({ $owner: owner }) })

test('wrong wallet fails before any wallet request, with no tx hash', async () => {
  const wallet = recordingProvider()
  await assert.rejects(
    updateWorkshop({ config, transport: wallet as never, account: OTHER, publicClient: ownerClient(MERCHANT) }, KEY, { title: 'New' }),
    (e: unknown) => {
      assert.ok(e instanceof ArkivWriteError)
      assert.equal(e.code, 'WRONG_OWNER')
      assert.equal(e.txHash, undefined)
      return true
    },
  )
  await assert.rejects(withdrawWorkshop({ config, transport: wallet as never, account: OTHER, publicClient: ownerClient(MERCHANT) }, KEY), { code: 'WRONG_OWNER' })
  assert.deepEqual(wallet.calls, [])
})

test('owner lookup failure and missing listing also fail before any wallet request', async () => {
  const wallet = recordingProvider()
  const down = asClient({ getEntity: async () => { throw new Error('rpc down') } })
  await assert.rejects(updateWorkshop({ config, transport: wallet as never, account: MERCHANT, publicClient: down }, KEY, { active: false }), { code: 'OWNER_LOOKUP_FAILED' })
  const missing = asClient({ getEntity: async () => { throw new NoEntityFoundError(KEY) } })
  await assert.rejects(updateWorkshop({ config, transport: wallet as never, account: MERCHANT, publicClient: missing }, KEY, { active: false }), { code: 'NOT_FOUND' })
  assert.deepEqual(wallet.calls, [])
})

test('wallet signature rejection is a typed, recoverable error with no tx hash', async () => {
  const wallet = recordingProvider((method) => {
    if (method === 'eth_chainId') return '0x' + (7794095).toString(16)
    throw Object.assign(new Error('User rejected the request.'), { code: 4001 })
  })
  await assert.rejects(
    updateWorkshop({ config, transport: wallet as never, account: MERCHANT.toLowerCase() as never, publicClient: ownerClient(MERCHANT) }, KEY, { title: 'New' }),
    (e: unknown) => {
      assert.ok(e instanceof ArkivWriteError)
      assert.equal(e.code, 'USER_REJECTED')
      assert.equal(e.recoverable, true)
      assert.equal(e.txHash, undefined)
      return true
    },
  )
})

test('publish encodes through the real SDK schema and reaches the wallet; rejection is typed', async () => {
  const wallet = recordingProvider((method) => {
    if (method === 'eth_chainId') return '0x' + (7794095).toString(16)
    throw Object.assign(new Error('User rejected the request.'), { code: 4001 })
  })
  await assert.rejects(
    publishWorkshop({ config, transport: wallet as never, account: MERCHANT }, { title: 'Hindi translation', description: 'Fixed-price private translation.' }),
    { code: 'USER_REJECTED' },
  )
  assert.ok(wallet.calls.some((m) => m !== 'eth_chainId'), 'encoding succeeded and a wallet request was attempted')
  await assert.rejects(
    publishWorkshop({ config: { ...config, terms: null }, transport: wallet as never, account: MERCHANT }, { title: 't', description: 'd' }),
    WorkshopInputError,
  )
})

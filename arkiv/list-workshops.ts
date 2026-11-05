// Read-only: lists Tool City workshop listings from Arkiv. No wallet, no keys, no writes.
// Usage: ARKIV_RPC_URL=<rpc> [ARKIV_CHAIN_ID=7794095] [ARKIV_EXPLORER_URL=<url>] [PUBLIC_CONFIG_FILE=<PublicConfig json>] npx tsx arkiv/list-workshops.ts
import { readFileSync } from 'node:fs'
import { ArkivReadError, listWorkshops } from '../src/lib/arkiv/read'
import { WORKSHOP_NAMESPACE } from '../src/lib/arkiv/schema'
import type { PublicConfig } from '../src/lib/shared/domain'

function loadConfig(): PublicConfig {
  const file = process.env.PUBLIC_CONFIG_FILE
  if (file) return JSON.parse(readFileSync(file, 'utf8')) as PublicConfig
  const rpcUrl = process.env.ARKIV_RPC_URL
  if (!rpcUrl) throw new Error('Set ARKIV_RPC_URL (or PUBLIC_CONFIG_FILE).')
  return {
    schemaVersion: 1,
    configured: false,
    appNamespace: WORKSHOP_NAMESPACE,
    sourceLang: 'en',
    targetLang: 'hi',
    maxWords: 250,
    maxChars: 5000,
    arkiv: {
      chainId: Number(process.env.ARKIV_CHAIN_ID ?? 7794095),
      rpcUrl,
      explorerUrl: process.env.ARKIV_EXPLORER_URL ?? '',
    },
    whitechain: { chainId: 0, rpcUrl: '', explorerUrl: '', tokenAddress: '0x0000000000000000000000000000000000000000' },
    terms: null, // without configured terms every listing reports supported=false
    serviceTermsText: '',
  }
}

try {
  const workshops = await listWorkshops(loadConfig())
  console.log(JSON.stringify({ count: workshops.length, workshops }, null, 2))
} catch (error) {
  if (error instanceof ArkivReadError) console.error(`${error.code}: ${error.message}`)
  else console.error(error instanceof Error ? error.message : 'unexpected error')
  process.exit(1)
}

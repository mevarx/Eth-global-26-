# Arkiv friction

The integration required careful handling of uncertain wallet submission. An older intent remains unresolved with no transaction hash; it was preserved rather than retried. During integration, viem could fall back from `eth_sendTransaction` to `wallet_sendTransaction` after some errors despite transport retry being set to zero. A single-submission guard and immediate transaction-hash capture were added to reduce duplicate-write risk. This is an observed client behavior, not a proven cause of the older intent’s status.

Other observed integration edges were optional public RPC rate limits, pagination pages with no rows but a continuation cursor, and multibyte title encoding. The independent reader handles cursor continuation and title bytes. The live demo verifies create, receipt, readback, and public discovery; update, close, and native expiry have only offline checks. See [live evidence](../docs/evidence/LIVE_DEMO.md).

# Why Arkiv

BriefMint’s purpose is to let an owner deliberately publish an approved opportunity and make it discoverable independently of the application’s private service. Arkiv gives the publication network-enforced wallet ownership and indexed public records that a separate reader can query without BriefMint’s API, session, or SQLite database.

A conventional centralized database such as Postgres could store listings, but readers would depend on the publisher’s service and its availability and access policy. BriefMint intentionally keeps private notes in its SQLite-backed app backend while using Arkiv for the public record and discovery layer. The demonstrated scope is one create and read/discovery; live update, close, and native-expiry behavior are not claimed.

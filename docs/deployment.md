# Deployment

work360 deploys two ways: as a Cloudflare Worker (see [Workers](#workers)), and
as two Docker Compose stacks on a Dokploy host behind Traefik. The application
stack and the engine stack run separately and meet on the external
`dokploy-network` network.

| Stack       | Compose file                                  | Image file                                  | Environment template                                                        |
| ----------- | --------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| Application | [`compose.app.yml`](../compose.app.yml)       | [`Dockerfile`](../Dockerfile)               | [`ops/deployment/app.env.example`](../ops/deployment/app.env.example)       |
| Engine      | [`compose.engine.yml`](../compose.engine.yml) | [`Dockerfile.engine`](../Dockerfile.engine) | [`ops/deployment/engine.env.example`](../ops/deployment/engine.env.example) |

Copy each template to `.env` in the stack's working directory. The web
[configuration](web-configuration.md) describes the application values. The
[engine readme](../crates/engine/readme.md) describes the engine values.

## Application stack

The stack runs two services from the application image. Both mount
`$APP_DATA_PATH/uploads` at `/var/lib/crm-web`. The SQLite stores live in its
`data` directory and uploads in its `documents` directory.

- `prepare` runs once. It runs `bun run provision:prod`, which creates the
  stores and the installation without demo data. `web` waits for it to complete.
- `web` serves the application with `bun run start` on port 3000. Traefik routes
  `APP_DOMAIN` to it. The same process runs queue and maintenance work.

The template sets three names that must be unique per deployment:
`DEPLOYMENT_NAME`, `APP_DOMAIN`, and `APP_DATA_PATH`. The compose file fixes the
production values for `HOST`, `PORT`, `WEB_DATA_DIR`, `ENGINE_CONNECT_MODE`,
`ENGINE_URL`, and `WEB_UPLOADS_ROOT`, so the `.env` file does not set them.

Sentry settings are in [web configuration](web-configuration.md#observability).

## Engine stack

The `engine` service runs `engine` as uid 10001 with ingest enabled. It stores
its databases and ingest uploads under `$ENGINE_DATA_PATH`. That directory must
be writable by uid 10001 and must already hold `contacts.sqlite`. Publish it
with the [pipeline](../crates/pipeline/readme.md), then restart the engine. The
engine creates `leads.sqlite` and `ingest.sqlite` when they are missing.

The container binds `0.0.0.0` with `ENGINE_CONNECT_MODE=internal`. It is
reachable only as `crm-engine` on `dokploy-network`.

`ENGINE_HMAC_KEYS_JSON` holds one key per application deployment. The
[engine readme](../crates/engine/readme.md#configuration) describes how each
deployment pairs with its key.

The engine healthcheck calls `GET /health`. The `web` healthcheck requests `/`
and fails on a 5xx response.

## Workers

[`apps/web/wrangler.jsonc`](../apps/web/wrangler.jsonc) deploys the Worker
`work360` to the custom domain `work360.rising.sh`, with its three Durable
Object classes, the R2 bucket `work360-files` for files, and the plain
variables. The bucket must exist before the first deploy:

```sh
cd apps/web
bunx wrangler r2 bucket create work360-files
bun run build:workers
bunx wrangler deploy -c dist/worker/wrangler.json
```

CI runs those two last commands on every master push after Check passes (the
`deploy` job in [`ci.yml`](../.github/workflows/ci.yml)). The job runs in the
GitHub environment `production`, which admits only `master`. It reads
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the risinghq org
secrets, which reach the repo because it is public. It reads the browser DSN
from the environment variable `VITE_SENTRY_DSN`, and uploads source maps when
the variables `SENTRY_ORG` and `SENTRY_PROJECT` and the secret
`SENTRY_AUTH_TOKEN` are set. Keep no repo or environment copy of the Cloudflare
secrets: a copy overrides the org secret and goes stale when the token rotates.
Deploy by hand only for the first deploy or a broken pipeline.

The secrets `SESSION_SECRET`, `TOTP_ENCRYPTION_KEY`, `RECOVERY_CODE_PEPPER`,
`ENGINE_HMAC_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` are set once with
`bunx wrangler secret bulk FILE -c dist/worker/wrangler.json`. Keep a copy of
`TOTP_ENCRYPTION_KEY`: without it, no enrolled TOTP secret can be decrypted.

The deploy sends email through Resend from `work360.rising.sh`, a domain
verified in Resend with its DNS records in the rising.sh zone. The secret
`RESEND_API_KEY` holds a sending-only key scoped to that domain. WhatsApp has no
route, so the deploy sends none.

Server errors reach Sentry from the Worker and from each Durable Object once the
secret `SENTRY_DSN` is set with
`bunx wrangler secret put SENTRY_DSN -c dist/worker/wrangler.json`. Without it
the client stays off.

The assets binding serves pages and static files without running the Worker, so
the middleware's security headers never reach them. The Workers build writes
[`_headers`](https://developers.cloudflare.com/workers/static-assets/headers/)
into `dist/client` from the same `securityHeaders`, plus a year of immutable
caching for the content-hashed `/assets/*`. Every other path, the HTML shell
among them, carries `Cache-Control: no-transform`. That keeps Cloudflare from
injecting the rising.sh Web Analytics beacon, which the CSP would block, without
a paid RUM rule. The build also writes `.assetsignore`, which keeps the bundle
analyzer's report out of the upload.

A path no asset matches runs the Worker
([app-shell.ts](../apps/web/src/server/platform/http/app-shell.ts)). A client
route gets the HTML shell with the same headers. A missing file under `/assets/`
gets an uncached 404. During a deploy a page from one build can request a chunk
only the other build has. Cloudflare's own `single-page-application` fallback
answered that with the HTML shell, which the year of immutable caching kept
under the script's name, so the page stayed blank in that browser.

### Stores

On Cloudflare Workers each store is a SQLite Durable Object. Provisioning runs
on Bun into local files, then copies them into the deployed objects.
`provision:prod` creates the installation without demo data and one admin from
the `INSTALLATION_ADMIN_*` variables (see
[web configuration](web-configuration.md#application-and-storage)):

```sh
cd apps/web
INSTALLATION_PASSWORD=... INSTALLATION_ADMIN_EMAIL=... \
  INSTALLATION_ADMIN_NAMES=... INSTALLATION_ADMIN_SURNAME=... \
  WEB_DATA_DIR=./provisioned bun run provision:prod
bunx wrangler secret put LOAD_TOKEN -c dist/worker/wrangler.json
LOAD_TOKEN=... WEB_DATA_DIR=./provisioned bun run stores:push https://HOST
bunx wrangler secret delete LOAD_TOKEN -c dist/worker/wrangler.json
```

`stores:push` prints the rows each store loaded:

```text
registry: 34 rows
platform: 111 rows
workspaces/803c1384-bb0d-53b7-83b8-96fed8c601c9: 133 rows
```

A store moves in pages of about 4 MB, because a request carries at most 100 MB
and an object holds 128 MB of memory, and an imported workspace outgrows both.
Each operation is a `POST /api/admin/stores/<name>/<operation>`:

| Operation  | What it does                                                   |
| ---------- | -------------------------------------------------------------- |
| `manifest` | returns the schema version and each table's row count          |
| `page`     | returns a table's rows in primary key order, after a given key |
| `clear`    | drops the receiving store's stage tables                       |
| `stage`    | adds rows to a stage table inside the receiving store          |
| `commit`   | replaces every table with its stage in one transaction         |

After the commit, the push reads both stores page by page and fails unless they
hold the same rows. The routes answer 404 without the `LOAD_TOKEN` secret, so
delete it after the push.

A commit refuses a manifest from another schema version, a stage that lacks a
row of the manifest, and a stage that would drop a row the object already holds,
so it never overwrites a store in use. A refused commit drops its stage. Pushing
the same files again changes nothing.

Store names after the URL push only those stores, such as
`stores:push https://HOST platform workspaces/ID`. A commit swaps every table of
a store at once, and a store of several hundred thousand rows runs past the
object's time limit, so a push after a pull names the stores it changed.

`stores:pull` is the reverse. It copies every deployed store into an empty
`WEB_DATA_DIR`, so a local command can write to production's rows and
`stores:push` can send them back. A pull reads each store over many requests, so
run it while nobody writes. A store that gains rows between the pull and the
push refuses the push, so the copy never overwrites newer writes:

```sh
bunx wrangler secret put LOAD_TOKEN -c dist/worker/wrangler.json
LOAD_TOKEN=... WEB_DATA_DIR=./pulled bun run stores:pull https://HOST
# a local command writes to ./pulled
LOAD_TOKEN=... WEB_DATA_DIR=./pulled bun run stores:push https://HOST
bunx wrangler secret delete LOAD_TOKEN -c dist/worker/wrangler.json
```

# MedLabel Server

API server for MedLabel, a tool that prints injection and infusion labels during nursing drug preparation. Nurses scan a patient code in the MedLabel Chrome extension; this server looks the patient up in the HIS Postgres database and returns the medication lines. The extension chooses which lines to print and renders the labels locally.

The server also hosts the extension's auto-update files (`updates.xml` + `.crx`).

The Chrome extension lives in a separate repo: `medlabel-extension` (checked out next to this one as `../MedLabelExtension`).

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Hospital deployment and workstation rollout: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (Windows + NSSM; not Docker)

## Requirements

- Node.js 22 LTS
- Access to the hospital network (HIS Postgres at `172.16.16.23`)
- Production on Windows: NSSM (see `deploy/setup-windows-server.ps1`)

## Setup

```bash
yarn
cp .env.example .env   # fill in the real (rotated) PGPASSWORD
yarn dev               # watch mode on http://0.0.0.0:8080
```

## API

| Method | Path                          | Purpose                                                           |
| ------ | ----------------------------- | ----------------------------------------------------------------- |
| `GET`  | `/health`                     | Liveness + DB check. `503` when HIS Postgres is unreachable.      |
| `GET`  | `/api/lookup?ma-ho-so=…`      | Lookup by mã hồ sơ (`his_patientdocument`, 10 digits YYMMDD+STT). |
| `GET`  | `/api/lookup?ma-benh-an=…`    | Lookup by mã bệnh án (`his_medicalrecordno`, latest encounter).   |
| `GET`  | `/updates.xml`, `/<name>.crx` | Extension auto-update files from `UPDATE_DIR`.                    |

`ma-ho-so` / `ma-benh-an` also accept `maHoSo` / `maBenhAn`. Send only one of the two.

Every JSON response carries `apiVersion`. The payload shape is defined in [`src/contracts/lookup.v1.ts`](src/contracts/lookup.v1.ts) — the single source of truth shared with the extension. Errors are `{ apiVersion, error, code }`:

| HTTP  | `code`       | When                                                                                              |
| ----- | ------------ | ------------------------------------------------------------------------------------------------- |
| `400` | `VALIDATION` | Missing parameter, both parameters, or a code that fails parsing.                                 |
| `404` | `NOT_FOUND`  | No active encounter for that code.                                                                |
| `429` | `RATE_LIMIT` | More than `RATE_LIMIT_PER_MINUTE` lookups from one client address.                                |
| `500` | `INTERNAL`   | Unexpected failure. Postgres errors use a fixed sentence; table and column names stay in the log. |

Anything other than `GET` is `405` plain text. An unknown path, including a missing update file, is `404` plain text.

### What `/api/lookup` returns

Every active, non-deleted `his_service_product` line on the encounter — not only injections, and not only today's orders. Lines are grouped into `orders` by `createdfromrecord_id` (tờ điều trị), newest `thoiGianKe` first. A solvent or co-drug (`ref_service_union_id`) stays in `medications` and is also nested on the main line as `thuocDungKem`.

The extension, not this server, decides what is printable: a route whose name starts with "Tiêm" and does not contain "truyền" is an injection label; a route containing "truyền" is an infusion label. Lines flagged `laThuocDungKem` are not their own label. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Changing the contract

1. Edit `src/contracts/lookup.v1.ts`. Additive, optional fields are fine in v1.
2. For a breaking change, create `lookup.v2.ts`, bump `LOOKUP_API_VERSION`, and release a matching extension. Extensions on v1 refuse to print against a v2 server rather than render mismatched data.
3. In the extension repo run `yarn sync:contract`.

## Configuration (`.env`)

| Variable                                                 | Default   | Notes                                                    |
| -------------------------------------------------------- | --------- | -------------------------------------------------------- |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | —         | HIS Postgres, read-only use.                             |
| `PORT`                                                   | `8080`    |                                                          |
| `BIND_HOST`                                              | `0.0.0.0` | Must not be `localhost`, or workstations cannot connect. |
| `UPDATE_DIR`                                             | `updates` | Folder with `updates.xml` and `.crx` files.              |
| `RATE_LIMIT_PER_MINUTE`                                  | `60`      | Per client IP on `/api/lookup`.                          |
| `STATEMENT_TIMEOUT_MS`                                   | `8000`    | Postgres cancels a query after this many ms.             |
| `REQUEST_TIMEOUT_MS`                                     | `10000`   | HTTP handler returns `503` if still open after this.     |
| `SHUTDOWN_DRAIN_MS`                                      | `10000`   | Max wait for in-flight requests on SIGTERM/SIGINT.       |

## Scripts

| Script                              | Purpose                                            |
| ----------------------------------- | -------------------------------------------------- |
| `yarn dev`                          | Run the server in watch mode                       |
| `yarn start`                        | Run the server from source                         |
| `yarn build`                        | Bundle to `dist/server.js` for the Windows service |
| `yarn test`                         | Unit tests                                         |
| `yarn typecheck` / `yarn lint`      | Static checks                                      |
| `yarn lookup --ma-ho-so=2609230012` | CLI lookup, prints JSON (debugging)                |

## HIS database docs

| Doc                                                | Content                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| [docs/HIS_DB_OVERVIEW.md](docs/HIS_DB_OVERVIEW.md) | Connection, platform, scale                                         |
| [docs/HIS_DB_MEDLABEL.md](docs/HIS_DB_MEDLABEL.md) | Entity map + the query this server runs (see **Mã hồ sơ vs mã NB**) |
| [docs/HIS_DB_CATALOG.md](docs/HIS_DB_CATALOG.md)   | Routes, product types, nursing glossary                             |
| [docs/HIS_DB_OBJECTS.md](docs/HIS_DB_OBJECTS.md)   | Key table/view column inventory                                     |

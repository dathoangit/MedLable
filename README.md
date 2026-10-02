# MedLabel Server

API server for MedLabel, a tool that prints medication injection labels during nursing drug preparation. Nurses scan a patient code in the MedLabel Chrome extension; this server looks the patient up in the HIS Postgres database and returns the medication lines. The extension renders and prints the labels locally.

The server also hosts the extension's auto-update files (`updates.xml` + `.crx`).

The Chrome extension lives in a separate repo: `medlabel-extension` (checked out next to this one as `../MedLabelExtension`).

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Hospital deployment and workstation rollout: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Requirements

- Node.js 22 LTS
- Access to the hospital network (HIS Postgres at `172.16.16.23`)

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

Every JSON response carries `apiVersion`. The payload shape is defined in [`src/contracts/lookup.v1.ts`](src/contracts/lookup.v1.ts) — the single source of truth shared with the extension. Errors are `{ apiVersion, error, code }` where `code` is `VALIDATION`, `NOT_FOUND`, `RATE_LIMIT` or `INTERNAL`. Database error details are logged server-side only.

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

| Doc                                                | Content                                                    |
| -------------------------------------------------- | ---------------------------------------------------------- |
| [docs/HIS_DB_OVERVIEW.md](docs/HIS_DB_OVERVIEW.md) | Connection, platform, scale                                |
| [docs/HIS_DB_MEDLABEL.md](docs/HIS_DB_MEDLABEL.md) | Entity map + suggested queries (see **Mã hồ sơ vs mã NB**) |
| [docs/HIS_DB_CATALOG.md](docs/HIS_DB_CATALOG.md)   | Routes, product types, nursing glossary                    |
| [docs/HIS_DB_OBJECTS.md](docs/HIS_DB_OBJECTS.md)   | Key table/view column inventory                            |

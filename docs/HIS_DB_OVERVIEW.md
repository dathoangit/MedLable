# HIS Database Overview

Read-only analysis of the hospital HIS PostgreSQL database for the MedLabel project (medication infusion labels).

**Captured:** 2026-09-23  
**Access:** local `.env` (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`)  
**Policy:** documentation only — no patient row samples, no passwords.

## Connection

| Item           | Value                                       |
| -------------- | ------------------------------------------- |
| Host           | `172.16.16.23`                              |
| Port           | `5432`                                      |
| Database       | `produce`                                   |
| User           | `his_stpaul` (verify credentials in `.env`) |
| Engine         | PostgreSQL **11.12** (x86_64 Linux)         |
| Primary schema | `adempiere`                                 |
| Other schemas  | `public` (empty of business tables)         |

Copy [`.env.example`](../.env.example) → `.env`. Never commit `.env`.

### CLI lookup

```bash
yarn lookup --ma-ho-so=2609230012
yarn lookup --ma-benh-an=2641600
```

Mã hồ sơ uses `his_patientdocument` only (not mã NB). Mã bệnh án uses `his_medicalrecordno` and, when several encounters share it, the latest `timegoin`. See [HIS_DB_MEDLABEL.md](HIS_DB_MEDLABEL.md).

```bash
# Quick connectivity check (from repo root)
node --input-type=module -e "
import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionTimeoutMillis: 8000 });
await c.connect();
console.log((await c.query('select current_database(), current_user, left(version(),60)')).rows[0]);
await c.end();
"
```

(`pg` + `dotenv` are project dependencies.)

## Platform

This HIS is built on **ADempiere** conventions:

- Schema: `adempiere`
- Soft delete: `isdeleted` (`Y`/`N`), soft active: `isactive` (`Y`/`N`)
- Audit: `created`, `createdby`, `updated`, `updatedby`, `ad_client_id`, `ad_org_id`
- Surrogate keys: `*_id` (`numeric`), UUID columns: `*_uu`

**Scale (approx., 2026-09-23):**

| Object                     | Rows     |
| -------------------------- | -------- |
| Base tables in `adempiere` | **1210** |
| `his_*` tables             | **337**  |
| `his_patient`              | ~1.1M    |
| `his_patienthistory`       | ~3.5M    |
| `his_prescription`         | ~2.9M    |
| `his_service_product`      | ~42.6M   |
| `his_storage_document`     | ~20.3M   |
| `his_storage_documentline` | ~6.4M    |
| `his_product`              | ~27k     |
| `his_danhmuc_thuoc`        | ~800     |
| `his_dosage`               | ~816     |
| `his_methoduse`            | 64       |

Full table scans on `his_service_product` / `his_storage_document` will time out. Always filter by `his_patienthistory_id`, date, or storage document id (indexes exist).

## Document index

| Doc                                      | Content                                               |
| ---------------------------------------- | ----------------------------------------------------- |
| [HIS_DB_OVERVIEW.md](HIS_DB_OVERVIEW.md) | This file — connection, platform, scale               |
| [HIS_DB_MEDLABEL.md](HIS_DB_MEDLABEL.md) | Entity map + the lookup query the server runs         |
| [HIS_DB_CATALOG.md](HIS_DB_CATALOG.md)   | Catalog lists (routes, product types, transfer units) |
| [HIS_DB_OBJECTS.md](HIS_DB_OBJECTS.md)   | Key tables/views column inventories                   |

## Safety notes

1. Prefer a **read-only** DB role in production tooling.
2. Do not log or commit PHI (names, id numbers, scan codes, addresses).
3. The Chrome extension must not open Postgres. This repo is the only client.
4. Aggregates over multi-day `his_service_product` need date bounds + indexed columns. The lookup itself is bounded by `his_patienthistory_id`.

## Decisions already in the server

1. Nurses look up **mã hồ sơ** (`his_patientdocument`) or **mã bệnh án** (`his_medicalrecordno`). Not `value` (mã NB), not `scancode`.
2. The server returns every active medication line on the encounter. It does not filter by day, route, or dispense status (`isverified` / `da_phat`).
3. The extension prints injection and infusion routes only, and nests solvents on the main line instead of giving them their own label. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Still open (hospital IT / pharmacy)

1. Should a future release hide lines that pharmacy has not dispensed?
2. Mã bệnh án has no index. If that lookup is slow on the ward, ask the DBA for one on `his_patienthistory.his_medicalrecordno`.

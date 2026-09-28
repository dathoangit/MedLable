# MedLabel

Chrome extension shell for printing medication infusion labels during nursing drug preparation. Nurses will scan a patient code; the label printer will output patient, medication, and administration details to stick on syringes.

This repository currently keeps the extension scaffolding only. Scan and print flows are not implemented yet.

## Requirements

- Google Chrome
- Access to the hospital network (HIS hosts and optional Postgres below)

## HIS hosts

| Constant   | URL                        | Role        |
| ---------- | -------------------------- | ----------- |
| `HIS_HOST` | `http://172.16.16.17:2301` | HIS API     |
| `APP_HOST` | `http://172.16.16.17:2382` | HIS web app |

Defined in [`src/config/env.ts`](src/config/env.ts).

## HIS database (read-only analysis)

Postgres credentials live in `.env` (copy from [`.env.example`](.env.example)). Do not commit `.env`.

Database documentation (schema map for infusion labels):

| Doc | Content |
| --- | ------- |
| [docs/HIS_DB_OVERVIEW.md](docs/HIS_DB_OVERVIEW.md) | Connection, platform, scale |
| [docs/HIS_DB_MEDLABEL.md](docs/HIS_DB_MEDLABEL.md) | Entity map + suggested queries |
| [docs/HIS_DB_CATALOG.md](docs/HIS_DB_CATALOG.md) | Routes, product types, nursing glossary |
| [docs/HIS_DB_OBJECTS.md](docs/HIS_DB_OBJECTS.md) | Key table/view column inventory |

## Lookup by mã hồ sơ (CLI)

Validate patient + medication lines before building UI:

```bash
yarn lookup --ma-ho-so=2609230012
yarn lookup --ma-benh-an=2641600
```

- Resolves **mã hồ sơ** via `his_patienthistory.his_patientdocument` only (not mã NB / `value`).
- Resolves **mã bệnh án** via `his_medicalrecordno` (latest encounter if duplicates).
- Prints JSON: patient demographics + medication lines (`lieuDung`, `duongDung`, `thoiGianKe`, …).
- Requires hospital network + filled `.env`.

### Test UI (local)

```bash
yarn test:ui
```

Open [http://localhost:4177](http://localhost:4177), chọn loại mã, nhập mã, xem hành chính BN + bảng thuốc. API: `GET /api/lookup?ma-ho-so=…` hoặc `?ma-benh-an=…`.

See [docs/HIS_DB_MEDLABEL.md](docs/HIS_DB_MEDLABEL.md) (section **Mã hồ sơ vs mã NB**).

## Install & build

```bash
yarn
yarn dev     # HMR → load unpacked from dist/
# or
yarn build   # production → dist/
```

1. Open `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select the `dist/` folder
3. Click the extension icon → the side panel opens

## Scripts

| Script           | Purpose                              |
| ---------------- | ------------------------------------ |
| `yarn dev`       | Dev build with HMR                   |
| `yarn build`     | Typecheck + build                    |
| `yarn typecheck` | TypeScript check                     |
| `yarn lint`      | ESLint                               |
| `yarn lookup`    | CLI lookup by mã hồ sơ (needs `.env`) |
| `yarn test:ui`   | Local test UI at http://localhost:4177 |

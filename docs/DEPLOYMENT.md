# MedLabel Deployment

Deploy on a hospital **Windows** server with **Node.js 22 + NSSM** (not Docker). Docker Desktop adds WSL2/NAT overhead for a single lightweight API process and is not supported by this repo.

## 0. Before anything else

- [ ] **Rotate the HIS database password.** The old one was committed in `.env.example` and is still in git history. A DBA runs [`deploy/rotate-db-password.sql`](../deploy/rotate-db-password.sql); put the new value only in the server `.env`.
- [ ] **Ask IT for a DNS record** `medlabel.local` → the MedLabel server IP.
- [ ] **Confirm how workstations are managed** (see step 3). This decides whether self-hosted install works at all.

## 1. Server (once)

On the hospital server (Windows, elevated PowerShell). Install **Node.js 22 LTS**, **Yarn** (`corepack enable`), **NSSM** on `PATH`, and **Git**.

```powershell
git clone <medlabel-server> C:\MedLabel
cd C:\MedLabel
copy .env.example .env
# Edit .env: set the rotated PGPASSWORD (and PGHOST if needed)

# Pre-flight: .env, Postgres TCP, DNS hint, optional firewall
powershell -ExecutionPolicy Bypass -File .\deploy\prepare-windows-server.ps1 `
  -OpenFirewall -FirewallRemoteAddress <ward-subnet>

# yarn install + yarn build + NSSM Windows service
powershell -ExecutionPolicy Bypass -File .\deploy\setup-windows-server.ps1
```

`prepare-windows-server.ps1` is also run from setup unless you pass `-SkipPrepare`.

The service starts with Windows, restarts 5 s after a crash, and logs to `C:\MedLabel\logs\`.

Smoke test (on the server or a workstation):

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\verify-health.ps1 -BaseUrl http://medlabel.local:8080
```

Expect `{"ok":true,"apiVersion":1,"service":"medlabel","db":"up"}`.

### Updating the server

```powershell
cd C:\MedLabel
git pull
powershell -ExecutionPolicy Bypass -File .\deploy\setup-windows-server.ps1 -SkipPrepare
```

Or manually: `yarn` → `yarn build` → `nssm restart MedLabel`.

## 2. Extension releases

In the extension repo (see its README):

```bash
yarn release          # patch bump; or: yarn release minor
```

This writes `release/medlabel-<version>.crx` and `release/updates.xml`. Publish to the server **with the `.crx` first, then `updates.xml`**:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\publish-extension-updates.ps1 `
  -SourceDir C:\path\to\MedLabelExtension\release

powershell -ExecutionPolicy Bypass -File .\deploy\verify-health.ps1 `
  -BaseUrl http://medlabel.local:8080 -CheckUpdates
```

No service restart needed.

## 3. Workstations (once per machine)

### Hard requirement

On Windows, Chrome force-installs extensions from outside the Chrome Web Store **only** when the machine is:

- joined to an Active Directory domain, or
- joined to Azure AD / Entra ID, or
- enrolled in Chrome Browser Cloud Management (CBCM).

On any other machine Chrome accepts the policy but blocks the extension ("not detected as enterprise managed"). Writing the registry value by hand does **not** get around this.

| Situation                                   | Path                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domain-joined                               | GPO, or run the script below on each machine                                                                                                                       |
| No domain, no Azure AD                      | Enroll in CBCM (free; needs a Google Admin account), then run the script with `-CloudManagementEnrollmentToken`. Or policy can come from the CBCM console instead. |
| Workstations have internet, want zero infra | Publish the extension as **unlisted** on the Chrome Web Store instead of self-hosting. The Web Store restriction above then does not apply.                        |

### Install policy + silent-printing shortcut

From an elevated PowerShell prompt (copy the `deploy\chrome-policy` folder or the whole repo onto the workstation):

```powershell
# Once: open the MedLabel Chrome profile, print one label, pick the label
# printer, Margins = None, close Chrome.
powershell -ExecutionPolicy Bypass -File .\deploy\chrome-policy\setup-ward-workstation.ps1 -SetupPrinter

# Policy + desktop shortcut + health check from this machine
powershell -ExecutionPolicy Bypass -File .\deploy\chrome-policy\setup-ward-workstation.ps1 `
  -ExtensionId kmcaolgjiahblobhmnniihieggicjlkp `
  -ServerOrigin http://medlabel.local:8080
```

Or call the lower-level scripts directly:

```powershell
.\deploy\chrome-policy\install-medlabel-policy.ps1 `
  -ExtensionId kmcaolgjiahblobhmnniihieggicjlkp `
  -ServerOrigin http://medlabel.local:8080

.\deploy\chrome-policy\create-medlabel-shortcut.ps1 -SetupPrinter
.\deploy\chrome-policy\create-medlabel-shortcut.ps1
```

Policy writes `HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist`, then warns if the machine is not managed. Roll back with `-Remove` on `install-medlabel-policy.ps1`.

GPO equivalent: _Computer Configuration → Administrative Templates → Google Chrome → Extensions → Configure the list of force-installed apps and extensions_, value `kmcaolgjiahblobhmnniihieggicjlkp;http://medlabel.local:8080/updates.xml`.

The **MedLabel** desktop shortcut runs Chrome with `--kiosk-printing` in a dedicated profile (`C:\MedLabelChrome`).

Why a dedicated profile: `--kiosk-printing` removes the print dialog for **every** page printed in that profile. In the nurse's normal Chrome, HIS printouts would go straight to the label roll. The separate profile keeps silent printing scoped to MedLabel. The machine-wide policy installs the extension in that profile too.

Chrome ignores command-line flags when that profile is already running; close all MedLabel windows before relaunching.

## 4. Acceptance on one test machine

- [ ] `chrome://policy` shows `ExtensionInstallForcelist` with no error.
- [ ] `chrome://extensions` shows MedLabel, "Installed by your administrator", ID `kmcaolgjiahblobhmnniihieggicjlkp`.
- [ ] MedLabel options → **Kiểm tra kết nối** reports OK.
- [ ] Look up a known mã hồ sơ; labels print on the roll with no dialog, one row per page, no blank label fed after the last row.
- [ ] The nurse's normal Chrome still shows the print dialog for HIS pages.
- [ ] Run `yarn release`, publish with `publish-extension-updates.ps1`, then click **Update** in `chrome://extensions` (Developer mode) — the version increases.
- [ ] Without clicking Update, the next release arrives on its own within about 5 hours.

Chrome ignores `print()` inside a side panel, so each print opens a small MedLabel window that prints and closes itself. With the kiosk shortcut the window only flashes; without it the print dialog appears inside that window.

## Deploy scripts reference

| Script                                                                                                  | Role                                              |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [`deploy/prepare-windows-server.ps1`](../deploy/prepare-windows-server.ps1)                             | `.env`, Postgres TCP, DNS hint, optional firewall |
| [`deploy/setup-windows-server.ps1`](../deploy/setup-windows-server.ps1)                                 | `yarn` + `build` + NSSM install                   |
| [`deploy/install-windows-service.ps1`](../deploy/install-windows-service.ps1)                           | NSSM service only (used by setup)                 |
| [`deploy/verify-health.ps1`](../deploy/verify-health.ps1)                                               | `GET /health` (+ optional update assets)          |
| [`deploy/publish-extension-updates.ps1`](../deploy/publish-extension-updates.ps1)                       | Copy `.crx` then `updates.xml`                    |
| [`deploy/chrome-policy/setup-ward-workstation.ps1`](../deploy/chrome-policy/setup-ward-workstation.ps1) | Policy + shortcut + health from a ward PC         |

## Troubleshooting

| Symptom                                            | Check                                                                                                                                                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension blocked, "not enterprise managed"        | Machine is not domain / Azure AD / CBCM managed (step 3).                                                                                                                                                             |
| Extension never installs                           | `updates.xml` reachable from the workstation? `appid` matches the policy ID?                                                                                                                                          |
| Update never arrives                               | Version in `updates.xml` must be higher than installed. `.crx` served as `application/x-chrome-extension` (`curl -I`).                                                                                                |
| "Phiên bản API server … không khớp"                | Server and extension disagree on `apiVersion`. Release the matching side.                                                                                                                                             |
| `/health` returns `503`                            | Server is up but cannot reach HIS Postgres (network, password).                                                                                                                                                       |
| Lookup succeeds, "không có thuốc tiêm hoặc truyền" | The encounter's lines are oral or other non-parenteral routes. The server returns them; the extension does not print them.                                                                                            |
| Mã bệnh án is slow                                 | `his_medicalrecordno` has no index. Mã hồ sơ uses the unique index on `his_patientdocument`.                                                                                                                          |
| Lookup returns `503` / "Hết thời gian chờ"         | HIS query hit `STATEMENT_TIMEOUT_MS` or the HTTP `REQUEST_TIMEOUT_MS`. Prefer mã hồ sơ; ask DBA for an index on `his_medicalrecordno` if mã bệnh án is the main path. Check `logs/service-out.log` for `lookup ms=…`. |

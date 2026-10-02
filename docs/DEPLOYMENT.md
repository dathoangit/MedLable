# MedLabel Deployment

## 0. Before anything else

- [ ] **Rotate the HIS database password.** The old one was committed in `.env.example` and is still in git history. A DBA runs [`deploy/rotate-db-password.sql`](../deploy/rotate-db-password.sql); put the new value only in the server `.env`.
- [ ] **Ask IT for a DNS record** `medlabel.local` → the MedLabel server IP.
- [ ] **Confirm how workstations are managed** (see step 3). This decides whether self-hosted install works at all.

## 1. Server (once)

On the hospital server (Windows, Node.js 22 LTS, NSSM on `PATH`):

```powershell
git clone <medlabel-server> C:\MedLabel
cd C:\MedLabel
yarn
copy .env.example .env      # fill in the rotated PGPASSWORD
yarn build
powershell -ExecutionPolicy Bypass -File .\deploy\install-windows-service.ps1 -AppRoot C:\MedLabel
```

The service starts with Windows, restarts 5 s after a crash, and logs to `C:\MedLabel\logs\`.

Open TCP 8080 inbound in Windows Firewall for the ward subnet only.

Check from a workstation:

```text
http://medlabel.local:8080/health  →  {"ok":true,"apiVersion":1,"service":"medlabel","db":"up"}
```

### Updating the server

```powershell
cd C:\MedLabel
git pull
yarn
yarn build
nssm restart MedLabel
```

## 2. Extension releases

In the extension repo (see its README):

```bash
yarn release          # patch bump; or: yarn release minor
```

This writes `release/medlabel-<version>.crx` and `release/updates.xml`. Copy them to `C:\MedLabel\updates\` — **the `.crx` first, then `updates.xml`**, so Chrome never sees a version it cannot download. No service restart needed.

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

### Install policy

From an elevated PowerShell prompt, with the extension ID printed by `yarn keygen` / `yarn release`:

```powershell
.\deploy\chrome-policy\install-medlabel-policy.ps1 `
  -ExtensionId kmcaolgjiahblobhmnniihieggicjlkp `
  -ServerOrigin http://medlabel.local:8080
```

It writes `HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist`, then warns if the machine is not managed. Roll back with `-Remove`.

GPO equivalent: _Computer Configuration → Administrative Templates → Google Chrome → Extensions → Configure the list of force-installed apps and extensions_, value `kmcaolgjiahblobhmnniihieggicjlkp;http://medlabel.local:8080/updates.xml`.

### Silent printing shortcut

```powershell
.\deploy\chrome-policy\create-medlabel-shortcut.ps1 -SetupPrinter
# In the Chrome window that opens: print one label, pick the label printer,
# Margins = None, close Chrome.
.\deploy\chrome-policy\create-medlabel-shortcut.ps1
```

This creates a **MedLabel** desktop shortcut running Chrome with `--kiosk-printing` in a dedicated profile (`C:\MedLabelChrome`).

Why a dedicated profile: `--kiosk-printing` removes the print dialog for **every** page printed in that profile. In the nurse's normal Chrome, HIS printouts would go straight to the label roll. The separate profile keeps silent printing scoped to MedLabel. The machine-wide policy installs the extension in that profile too.

Chrome ignores command-line flags when that profile is already running; close all MedLabel windows before relaunching.

## 4. Acceptance on one test machine

- [ ] `chrome://policy` shows `ExtensionInstallForcelist` with no error.
- [ ] `chrome://extensions` shows MedLabel, "Installed by your administrator", ID `kmcaolgjiahblobhmnniihieggicjlkp`.
- [ ] MedLabel options → **Kiểm tra kết nối** reports OK.
- [ ] Look up a known mã hồ sơ; labels print on the roll with no dialog, one row per page, no blank label fed after the last row.
- [ ] The nurse's normal Chrome still shows the print dialog for HIS pages.
- [ ] Run `yarn release`, copy the files, then click **Update** in `chrome://extensions` (Developer mode) — the version increases.
- [ ] Without clicking Update, the next release arrives on its own within about 5 hours.

Chrome ignores `print()` inside a side panel, so each print opens a small MedLabel window that prints and closes itself. With the kiosk shortcut the window only flashes; without it the print dialog appears inside that window.

## Troubleshooting

| Symptom                                     | Check                                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Extension blocked, "not enterprise managed" | Machine is not domain / Azure AD / CBCM managed (step 3).                                                              |
| Extension never installs                    | `updates.xml` reachable from the workstation? `appid` matches the policy ID?                                           |
| Update never arrives                        | Version in `updates.xml` must be higher than installed. `.crx` served as `application/x-chrome-extension` (`curl -I`). |
| "Phiên bản API server … không khớp"         | Server and extension disagree on `apiVersion`. Release the matching side.                                              |
| `/health` returns `503`                     | Server is up but cannot reach HIS Postgres (network, password).                                                        |

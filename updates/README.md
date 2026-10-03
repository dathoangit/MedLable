# Extension update files

Drop the release artifacts from the MedLabel extension repo here:

- `updates.xml`
- `medlabel-<version>.crx`

Prefer the ordered copy helper (`.crx` first, then XML):

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\publish-extension-updates.ps1 `
  -SourceDir C:\path\to\MedLabelExtension\release
```

The API serves them at `/updates.xml` and `/<file>.crx` with
`Content-Type: application/x-chrome-extension` for `.crx` files.
Chrome reads `updates.xml` on each update check, so that file is sent
with `Cache-Control: no-cache`.

Do not commit `.crx` binaries.

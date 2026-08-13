# setly

Guided UI for describing and setting application configuration across projects.

Setly scans a project folder for known config files, turns them into guided forms
with metadata (`describe-config*.json`), and writes updates back through providers
(JSON / DotEnv today).

## Quick start

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173. The API runs on port 3847 and is proxied from the UI.

On the home page, **Add project** and point at [`examples`](examples) (absolute path).

### Production / global CLI

```bash
npm run build
npm start
# or
npm link
setly
```

Flags:

- `--no-open` — do not launch the browser
- `--port <n>` — listen on a fixed port (default: ephemeral)

## How it works

1. **Add a project** — scan a folder (recursive, sensible depth) for supported configs.
2. **Open a config** from the project page or sidebar sub-item.
3. If describe metadata is missing beside the target, it is generated automatically.
4. **Configure** — fill the typed form (session values until you generate).
5. **Describe** — edit labels, types, defaults, required; add parameters.
6. **Preview / Generate** — preview output, overwrite the file, or copy to clipboard.

## Providers

| Provider | Discovers |
|----------|-----------|
| **JSON** | `appsettings.json`, `appsettings.*.json` |
| **DotEnv** | `.env`, `.env.*` (skips `.env.example` / `.env.sample`) |

## Storage

Projects (root path, editable label, discovered configs) live in browser
**`localStorage`** (`setly:projects:v2`). Removing a project only forgets it in the UI.

## describe metadata

Sibling files next to each config, e.g.:

- `appsettings.json` → `describe-config.json`
- `appsettings.Development.json` → `describe-config.appsettings.Development.json`
- `.env` → `describe-config.env.json`

Supported field types: `string`, `number`, `boolean`, `json`.

## Publishing to npm

Releases are published by [`.github/workflows/publish-npm.yml`](.github/workflows/publish-npm.yml) when you publish a GitHub Release (or run the workflow manually).

Required secret in the repo (**Settings → Secrets and variables → Actions**):

- `NPM_TOKEN` — npm automation/access token with permission to publish the `setly` package

Suggested release flow:

1. Bump `"version"` in `package.json` (and commit).
2. Create a GitHub Release / tag such as `v0.1.0`.
3. The workflow builds and runs `npm publish --access public --provenance`.

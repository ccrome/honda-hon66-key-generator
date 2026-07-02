# HON66 Key Generator

Browser-based HON66 key geometry generator with live 3D preview and STEP/STL export.

App: [GitHub Pages](https://ccrome.github.io/honda-hon66-key-generator/)

Repository: [origin](https://github.com/ccrome/honda-hon66-key-generator)

## What It Does

This app generates a parametric HON66-style key model from A/B bitting values. It runs the CAD model directly in the browser using OpenCascade WebAssembly through `replicad`, previews the result with Three.js, and exports the generated solid as either STEP or STL.

Current defaults:

- A bitting: `234561`
- B bitting: `654321`
- Key width: `3mm`
- Handle: octagonal bow

The handle selector includes:

- `Octagonal bow`: standard bow-style handle with a through hole.
- `Keyless`: rectangular/keyless-style handle with the keyless-specific notch and top chamfer.

## Privacy

The app runs entirely in your browser. No key data is stored locally or sent to a server. For extra privacy, use an incognito or private browser window.

## Local Development

Requirements:

- Node.js 20 or newer
- npm

Install dependencies:

```bash
npm ci
```

Start the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/
```

Build the production site:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

On every push to `main`, GitHub Actions will:

1. Install dependencies with `npm ci`.
2. Build the app with `npm run build`.
3. Upload `dist/` as a GitHub Pages artifact.
4. Deploy it to GitHub Pages.

In GitHub repository settings, set Pages source to `GitHub Actions`.

The Vite config uses `base: "./"` so the app works when hosted under a repository path such as:

```text
https://ccrome.github.io/honda-hon66-key-generator/
```

## Project Layout

- `src/hon66Model.ts`: Parametric CAD model and geometry generation.
- `src/main.ts`: Browser UI, Three.js preview, and export handling.
- `src/styles.css`: App styling.
- `.github/workflows/pages.yml`: GitHub Pages deployment workflow.
- `vite.config.ts`: Vite build configuration.

## Export Formats

The generated model can be exported as:

- `STEP`: Preferred CAD interchange format.
- `STL`: Mesh format for slicers and quick inspection.

## Notes

This is a modeling tool, not a guarantee that an exported key will be mechanically correct or safe to use. Verify dimensions and behavior against your actual requirements before manufacturing anything.

# Deploying This App

This app is deployed through `GitHub + Vercel`, with Shopify app config managed through the Shopify CLI.

## Normal Deploy Flow

Use this when you changed app code and did **not** change Shopify app config.

```bash
git status
git add .
git commit -m "your message"
git push origin main
```

What happens next:

- GitHub receives the new commit.
- Vercel auto-deploys from `main`.
- Production updates at `https://variable-pricing.vercel.app`.

## When You Also Need Shopify Deploy

Run this too if you changed any Shopify app configuration, especially:

- `shopify.app.toml`
- access scopes
- webhook subscriptions
- redirect URLs
- app URL

Command:

```bash
pnpm run deploy
```

That runs:

```bash
shopify app deploy
```

Use this after your code is pushed, or anytime Shopify needs the latest app config synced.

## One-Time or Rare Commands

If this local repo ever gets disconnected from the Shopify app:

```bash
pnpm run config:link
```

If you need local development:

```bash
pnpm run dev
```

## Current Production Setup

These are the important production values currently in this repo:

- App URL: `https://variable-pricing.vercel.app`
- Main branch is the deploy branch for Vercel
- Shopify deploy script: `pnpm run deploy`

## Fast Checklist

For most changes:

1. `git status`
2. `git add .`
3. `git commit -m "message"`
4. `git push origin main`
5. Check Vercel deployment

If Shopify config changed:

6. `pnpm run deploy`

## If Something Looks Wrong

- Vercel did not update: check the latest GitHub push and Vercel deployment status.
- Shopify auth/scopes are acting weird: run `pnpm run deploy`.
- Local app is not connected to the correct Shopify app: run `pnpm run config:link`.

## Adding A New Extension

This app already has extensions under `extensions/`, so the normal flow is:

1. Generate the extension with Shopify CLI:

```bash
pnpm run generate
```

Choose the extension type Shopify asks for, then give it a name. Shopify will create a new folder under `extensions/`.

2. Build the extension code inside the new extension folder.

Typical files to edit:

- `extensions/<new-extension>/shopify.extension.toml`
- `extensions/<new-extension>/src/*`
- `extensions/<new-extension>/locales/en.default.json`

3. Test locally:

```bash
pnpm run dev
```

4. Commit and push the code:

```bash
git status
git add .
git commit -m "add <extension-name> extension"
git push origin main
```

5. Sync the extension to Shopify:

```bash
pnpm run deploy
```

6. Check Vercel if the app code changed, and check Shopify Admin to confirm the extension appears where expected.

### Important

- Adding a new extension is not only a GitHub/Vercel deploy.
- The extension also needs `pnpm run deploy` so Shopify registers it.
- If you only push to GitHub, Vercel may update but Shopify may not know about the new extension yet.

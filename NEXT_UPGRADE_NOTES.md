# Next.js Upgrade Notes

## 12 -> 13 (App Router introduction)
- Upgrade to React 18+ and ensure `next`, `react`, and `react-dom` use matching versions.
- Adopt the `/app` router: replace `pages/_app.js` and `_document.js` with `app/layout.js` and the `Metadata` API; move React Context providers into a shared `providers` component used inside the layout.
- Update routing helpers: replace `next/router` with `next/navigation` in client components; prefer the new `<Link>` signature without wrapping `<a>`.
- Replace deprecated props on `next/image` (`layout`, `objectFit`, etc.) with the modern `fill` and `style` props.
- Co-locate data fetching with components: Server Components can `await` data directly; migrate `getServerSideProps`/`getStaticProps` to `fetch` or Route Handlers as needed.
- Replace `pages/api` routes with `app/api/*/route.js` for Edge/server handlers when migrating.
- Move global CSS imports to `app/globals.css`; component-level CSS Modules continue to work unchanged.

## 13 -> 14 (App Router stabilization)
- Enable the turbopack development server (optional) but confirm compatibility with custom Webpack plugins before switching.
- Use the stable `Server Actions` API (`export const action = async (formData) => {}`) and `use server` annotations where appropriate.
- Adopt the `generateMetadata` function or static `metadata` export for per-route head management; remove legacy `next/head` usage.
- Switch TypeScript `moduleResolution` to `bundler` (or remove overrides) for the enhanced compiler pipeline.
- Update `next.config` to use the stable `experimental` flags only when necessary; many previously experimental App Router features are now default.
- Prefer the built-in `next/font` for font loading; remove custom `<link>` tags where possible.

## 14 -> 15 (Latest defaults and React 19 readiness)
- Ensure the project runs on React 19+ and that third-party libraries declare compatibility.
- Migrate any remaining `pages` routes or API handlers; the App Router is the primary path forward in 15.
- Adopt the `next/navigation` revalidation helpers (`revalidatePath`, `revalidateTag`) and remove deprecated `unstable_revalidate` calls.
- Update middleware to use the Edge runtime exports from `next/server`; confirm config stays at the repo root as `middleware.js`.
- Review new config defaults: `eslint.ignoreDuringBuilds` defaults to `false`, `typescript.ignoreBuildErrors` defaults to `false`, and standalone output uses the modern directory layout.
- Revisit caching: fetch requests default to React cache semantics; opt out with `cache: 'no-store'` or `revalidate` as needed.

## Project TODOs
- [x] Move each route from `/pages` into `/app` (app router) or `/app/api` (route handlers).
- [x] Consolidate context providers into the reusable `app/providers.jsx` wrapper used by the root layout.
- [x] Create `middleware.js` in the project root to replace the legacy Auth0 middleware.
- [x] Replace direct `<Head>` usage with `metadata` exports and shared layout tags.
- [x] Update TypeScript config for Next.js 15 defaults.
- [x] Remove obsolete files (`pages/_app.js`, `_document.js`, redundant pages`).



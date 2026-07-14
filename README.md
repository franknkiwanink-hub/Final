# Siterifty — Next.js migration

> **Stack: Next.js 15 + React 19.** This project targets Next.js 15 (not 14) —
> upgraded deliberately for SEO and because `fetch()` is no longer cached by
> default in Server Components/Route Handlers (opt IN with `cache: 'force-cache'`
> when you want caching, instead of opting out). If you're an AI picking this
> project up, do not scaffold or suggest Next.js 14 patterns/APIs. `params`/
> `searchParams` in Server Components are async (`Promise`-based) in this
> version — await them, don't destructure synchronously. Client-side
> `fetch()` calls in `"use client"` hooks (all current data fetching in this
> repo) are unaffected by either version's caching default.

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000

**4 env vars get login/signup working** — the public Firebase client config
is hardcoded directly in `lib/firebase.ts` since those values aren't secret
(they're visible in any browser's dev tools on a live Firebase web app
regardless). These 4 are the Firebase Admin SDK credentials, used
server-side by every ported API route:

```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
ADMIN_EMAIL=
```

**Beyond these 4**, Step 7 ported several more API routes (paypal, deal,
push, webhooks, aistudio) that each need their own secrets (PayPal API
keys, VAPID keys, webhook signing secret, cron secret, AI provider keys,
etc.) before *those specific features* work — see Step 7's changelog
entry below for the full list. None of those are required just to run
the app or to sign in; each one only matters once you're exercising the
specific feature that needs it (e.g. `PAYPAL_CLIENT_SECRET` only matters
once something calls `/api/paypal`).

These are the same values your old Vercel deployment already has set —
copy them from Vercel dashboard → your project → Settings → Environment Variables.
Keep the `\n` escapes in `FIREBASE_PRIVATE_KEY` literal (don't convert to
real newlines) — the code converts them at runtime.

Without these 4 set, the site will build and load fine, but login/signup
(anything touching `app/api/account`) will fail until they're added.

If `npm run dev` throws any error, copy the full error message back to Claude —
this scaffold was hand-written (no network access in the build sandbox to run
`npm install` and verify), so there may be a small mismatch to fix on first run.

## What's done

**Step 1 — scaffold:**
- Next.js 15, App Router, TypeScript
- `app/globals.css` — your full `styles/siterifty.css` copied in unchanged
- Layout shell as real components (Header, NavDrawer, BottomNav, AnnouncementBar)
- `lib/firebase.ts` — Firebase client init as a real module, replacing `window.__db`
- Real routes replacing the old `vercel.json` rewrites (placeholder content):
  `/marketplace`, `/settings`, `/myprofile`, `/profile`, `/sellers`, `/messages`,
  `/messages/deal/[id]`, `/messages/group/[id]`, `/aiagent`, `/leaderboard`, `/sell`,
  `/seller/[id]`, `/listing/[id]`

**Step 2 — Auth modal (this step):**
- `lib/AuthContext.tsx` — replaces `window.__fbUser` / `window.__authReady` /
  `__syncUserSession` with real React state (`useAuth()` hook), backed by
  `onAuthStateChanged` + a live Firestore `onSnapshot` on `users/{uid}`
  (upgraded from the old one-time `getDoc`, so wallet balance/plan update live)
- `lib/authActions.ts` — replaces `window.__doLogin` / `__doSignup` / `__doGoogle` /
  `__doGithub` / `__doForgot` / `__doLogout` as plain importable functions
- `components/auth/AuthModal.tsx` — full login/signup UI (email+password,
  Google, GitHub, forgot password, username validation, avatar picker),
  same markup/styling as the original, driven by React state instead of
  `getElementById`
- `components/auth/AuthModalProvider.tsx` — lets any component open the
  modal via `useAuthModal().openAuthModal()`
- `app/api/account/route.ts` + `_handler.js` — your original `api/account.js`
  copied byte-for-byte (all 6 actions: ensureAccount, amIAdmin, setPrivacy,
  revokeApiKey, notifyOnRestore, submitAppeal) with a thin adapter so it runs
  under Next.js's route handler signature. Account creation still happens
  server-side only, exactly as the original comments require — the client
  can never set its own `walletBalance`/`plan`.
- Header and NavDrawer now show real logged-in/out state, real avatar,
  wallet balance, and plan; login button opens the modal; logout button works

**Step 3 — Marketplace grid (this step):**
- `app/api/_lib/limits.js`, `app/api/_lib/storage.js` — copied from the
  original `api/limits.js` / `api/storage.js` unchanged, shared by any
  route that needs them (currently just listings)
- `app/api/listings/_handler.js` + `route.ts` — your original
  `api/listings.js` ported the same way as `account` (byte-for-byte copy,
  only its two relative imports repointed to `_lib/`; adapter translates
  Vercel's `(req,res)` shape to a Next.js route handler). Only `POST` is
  wired since the original API is POST-only even for reads (action-based
  dispatch: `listing.feed`, `.mine`, `.create`, etc. — see that file's
  top-of-file comment block for the full list). Only `listing.feed` has a
  client caller wired up so far.
- `lib/listings.ts` — `Listing` type (superset covering website/app/game
  fields, since the feed returns raw Firestore docs), `fetchFeed()`,
  `trackListing()` (impression/view beacon), and formatting helpers
  (`fmtPrice`, `fmtFinVal`, `isBoosted`, `isPremiumSeller`) ported from
  marketplace.js
- `lib/useFeed.ts` — React hook wrapping `fetchFeed`, handling the
  seed/cursor pagination contract (seed generated server-side on first
  call, echoed back verbatim on every subsequent page/reset)
- `lib/useSeller.ts` — **lightweight** seller lookup (username/profilePic/
  rating only, single `getDoc`) for the card strip. Deliberately NOT a
  port of `mpGetSeller`, which also fetches the seller's listings,
  follower count, and lifetime deals for the full profile popup — that's
  heavier and belongs to a future "seller profile modal" step
- `components/marketplace/`: `Stars`, `SellerStrip`, `SaveButton` (direct
  Firestore writes, optimistic UI + revert-on-failure, same as
  `mpToggleSave`), `SiteCard`, `AppCard`, `GameCard` (all three ported
  1:1 from `mpRenderCard`'s three template branches), `ListingCard`
  (type dispatcher)
- `components/marketplace/MarketplaceGrid.tsx` — real grid wired to
  `useFeed`, with loading/empty/error states matching the original's
  `mp-state` markup, and an `IntersectionObserver`-based infinite scroll
  sentinel (`rootMargin: '200px'`, same as `_setupSentinel`). Clicking a
  card opens a bare placeholder modal (not the real listing detail/seller
  modals yet) just so the click wiring is visibly testable. (Originally
  written directly in `app/marketplace/page.tsx`; extracted into this
  shared component in Step 4 below so both `/` and `/marketplace` can
  render it — see Step 4 for why.)
- Trust badges (`sellerBadgesHtml` — verified checkmarks, deal-tier badge)
  are NOT shown on cards yet since they need the heavier seller data
  `useSeller` deliberately doesn't fetch. `_srBadgeCluster` (boosted-listing
  badge) was confirmed a genuine no-op in the original source (its own
  comment says "Badges disabled — CSS missing, causes layout breakage") so
  it was not ported at all, not even as a stub.

**Step 4 — Hero section + homepage layout fix:**
- `components/home/Hero.tsx` — ports the `.hero` section 1:1 (eyebrow,
  title, description, two CTAs). Both CTAs are auth-gated exactly like
  the original's `__requireAuth` in `auth-modal.js`: signed-out visitors
  get the auth modal instead of navigating; signed-in visitors go to
  `/sell` (Start Selling) or `/marketplace` (Browse Marketplace) via
  `next/navigation`'s router.
- `components/home/CreditsTicker.tsx` — the auto-scrolling "credits" strip
  under the hero CTAs (founder/mission/etc. one-liners), ported from
  `announcement-settings.js`'s `initCredits()` — same
  `requestAnimationFrame` loop, same seamless-loop-via-doubled-list trick,
  same resize-based remeasuring of the ticker's clipping window against
  the CTA row's position.
- **Layout fix while wiring this in:** the original site renders the hero
  and the marketplace grid on the *same page* (`index.html` has
  `<section class="hero">` immediately followed by `#marketplaceOverlay`,
  inline, not on separate routes) — this wasn't reflected in the Next.js
  version yet. Extracted the grid out of `app/marketplace/page.tsx` into
  `components/marketplace/MarketplaceGrid.tsx` so it can render in two
  places without duplicating code: the homepage (`app/page.tsx`, now
  `<Hero /><MarketplaceGrid />`) and the standalone `/marketplace` route
  (kept as its own linkable page for share links/SEO/nav). The grid
  component itself carries no top margin; each page that renders it
  controls its own top spacing (`/marketplace` adds `marginTop: 92` since
  there's no hero above it there; the homepage doesn't need to, since
  `.hero`'s own CSS already has `margin-top: 92px` built in).
- `.hero-bg`'s background image is a placeholder Amazon CDN URL that was
  already in the original CSS — not changed, but worth swapping for a
  real hosted asset before launch.

**Step 5 — Settings sidebar + first 3 panels:**
- `lib/useSettingsState.ts` — `SettingsState` type (same fields as the
  original's module-scope `state` object in `support-modals.js`, now
  React state instead of a mutable global) + `useSettingsState()` hook,
  porting `loadStateFromFirebase()`: reads `users/{uid}`, resolves
  `apiKeyIds` against the `apiKeys` collection, and applies font-size/
  compact-mode to `<body>` on load exactly like the original (these are
  document-wide effects, not scoped to the settings page). Sessions are
  intentionally NOT loaded here — ported the original's own comment that
  they're fetched lazily only when the Sessions panel opens.
- `lib/useToast.ts` — ports the `toast()` helper (bottom-center pill,
  fade-in-up, 2s display + 0.4s fade) as a hook + `<ToastHost/>` component
  instead of a raw DOM-append function. Added its keyframe to
  `globals.css` (renamed `fadeInUp` → `srf-toast-fade-in-up` to avoid any
  future name collision in that 8000+ line stylesheet — original didn't
  have that class name reserved anywhere else, this was just caution).
- `components/settings/SettingsSidebar.tsx` — the actual sidebar nav: all
  5 sections, all 14 items in original order, both badges (Security "2",
  Referrals "New"), active-state switching. Footer has two real behaviors:
  **Sign Out** is fully wired (confirm modal → `signOut(auth)` → hard
  redirect home, porting `__logoutWithConfirm`/`__doLogout` exactly,
  including the hard `window.location.href` reload rather than client-side
  nav, so no stale in-memory session data lingers). **Raise a Dispute**
  is a placeholder callback — the real flow needs a deal-picker modal and
  `/api/deal`'s `escrow-dispute` action, neither of which exist yet
  (see `misc-modals.js`'s `_loadDeals`); wired as a prop so the parent
  page controls what "not built yet" looks like, rather than a silent
  no-op.
- Three real panels in `components/settings/panels/`:
  - **`AccountPanel.tsx`** — avatar upload (Imgur, using the *same*
    Client-ID `support-modals.js` itself used — note the original
    codebase actually has two different Imgur Client-IDs across different
    files, a pre-existing inconsistency, not something introduced here),
    display name / username / timezone save with the same client-side
    username validation + direct-Firestore uniqueness check as the
    original. Email field is intentionally left editable-but-functionally-
    inert, matching the original exactly — `saveAccountBtn` never reads
    it; real email changes would need Firebase Auth's `updateEmail()` +
    verification, which the original never implemented either.
  - **`SecurityPanel.tsx`** — real password change via
    `reauthenticateWithCredential` + `updatePassword`, with the same
    error-code-specific messages as the original. 2FA and Login Alerts
    toggles auto-save to Firestore on change, no separate save button,
    matching the original.
  - **`NotificationsPanel.tsx`** — four toggles instant-save to
    `notificationPrefs.<key>`, plus a batch "Save Notification Settings"
    button that writes all five at once (redundant with the toggles, but
    that's how the original works too — both paths hit the same field).
    Push toggle is the one place this deliberately **degrades** from the
    original: subscribing needs a registered service worker + the real
    VAPID key (`core-early.js` has it: `window.__VAPID_PUBLIC_KEY`, not
    yet ported anywhere) + `/api/push/subscribe` (not yet ported either).
    Rather than silently pretending to subscribe, the toggle checks for
    an existing service worker registration and tells the user plainly if
    push isn't wired up yet, while still saving the Firestore preference
    flag either way — same as what the original does when the enable
    path fails partway through.
- `app/settings/page.tsx` — real page (not the original's full-screen
  modal-over-everything — this app uses dedicated routes, matching the
  pattern already established for `/marketplace` etc.) wiring sidebar +
  the three built panels; the other 11 panels show a specific "not built
  yet" message per panel rather than a generic placeholder.

**Step 6 — Listing detail page, App type only (Layer A):**
- Scoped explicitly with the user before building: `mpOpenModal` is ~690
  lines covering 3 listing types plus several sub-features (ad-gated
  preview/play buttons, game fullscreen runner, seller reveals/reviews,
  lightbox, SEO). Agreed to build one type at a time, and within each
  type to build the static layout with real data first ("Layer A"),
  deferring the heavier interactive sub-features to follow-up passes
  ("Layer B" — see the list below).
- `app/listing/[id]/page.tsx` is now a real page, not a placeholder. On
  mount it fetches the full listing doc directly from Firestore by id
  (`lib/listings.ts`'s new `fetchListingById`) and shows
  `ListingDetailSkeleton` (built from the existing `.skel-block`/
  `mp-skel-shimmer` shimmer classes already in `globals.css` — the same
  ones the marketplace grid's own card skeleton uses) while that load is
  in flight. **Deliberately no in-memory "seed" shortcut** — even though
  a card click already has the full listing object in memory, the page
  always re-fetches from Firestore as the single source of truth and
  shows the shimmer during that fetch, rather than trying to instant-paint
  from whatever the previous page happened to have and risk it going
  stale or inconsistent with what's actually saved. This matches how the
  original itself always treats Firestore as the source of truth for a
  detail view. `MarketplaceGrid`'s card `onClick` now calls
  `router.push('/listing/'+id)` instead of the old placeholder modal.
- `lib/listings.ts`: `Listing` type extended with the fields the app body
  needs that the feed-only version didn't have yet — `settings`,
  `platforms` (typed), `apkIpaFileName`/`apkFileName`, `additionalFiles`,
  `notLive`/`notLiveBuildFiles`, `attachedRepo`. Added `fetchListingById`
  (a plain Firestore `getDoc` against the `listings` collection — same
  collection every other part of this app already reads from).
- `components/listing/`: new shared pieces used by the app body and
  reusable for website/game bodies later — `FinancialsBlock` (ports the
  shared `finHtml`), `SellerBlock` (ports the seller-row portion of
  `sellerHtml`, deliberately using the same lightweight `useSeller` hook
  cards already use rather than the full `mpGetSeller` — same deferral
  `SellerStrip` already established, so no trust-badge cluster yet),
  `TransferMethodsBlock` (ports `_buildTransferMethodsHtml`, full 24-entry
  icon+label table), `AttachedRepoBlock` (ports `_buildAttachedRepoHtml`),
  `DescriptionBlock` (ports the read-more truncation — `WORD_LIMIT`
  hardcoded to 50, the same fallback value the original itself falls back
  to when `window.__limits` isn't loaded, since `/api/limits` isn't wired
  into a client global here yet), `ListingDetailSkeleton`.
- `components/listing/AppListingBody.tsx` — the actual app-type body,
  ported from the `type === 'app'` branch of `mpOpenModal`: hero with
  icon badge + platform pills, screenshot gallery, description, app-store
  links, build-file download list (handles both direct `url` files and
  `storagePath` files that need `listing.file-url` signing at click time,
  same as `window.__downloadListingBuildFile`), tech stack grid,
  financials, app details grid, attached repo, transfer methods, seller.
- **Layer B — explicitly deferred, not built this pass:** ad-gated
  interstitial before store links / preview open (`mpShowAdThenAction` —
  store links and the demo-preview toggle just act immediately here
  instead); seller reveals/reviews sub-list (separate Firestore query,
  own loading/empty/error states); lightbox for cover/gallery images;
  "View Seller" click → seller profile page (page itself doesn't exist
  yet either); dynamic per-listing SEO (`__seo.applyListing` — will be
  re-approached via Next's native `generateMetadata` rather than ported
  verbatim, since that's the idiomatic equivalent in this framework).
  Website and game type bodies were not built in this step — Website
  was ported in Step 8; the page still shows a "not built yet" message
  for game only.

**Step 7 — Remaining API routes:**
- Ported every remaining main-site `/api/*.js` using the same adapter
  pattern as `account`/`listings`: `aistudio`, `deal`, `objectives`,
  `paypal`, `push` (as `/api/push/[...slug]`), `webhooks`. Skipped `admin`
  and `edit-file` — confirmed by grepping every `Js/*.js` file that
  neither is ever called from the main site; `admin` only serves
  `admin.html`/`tools/admin` (explicitly out of scope per the ground
  rules) and `edit-file` only serves `tools/github` (a separate internal
  tool, same category as admin.html). Left both untouched rather than
  guessing they might be needed.
- **Extracted the adapter shim into `app/api/_lib/legacyAdapter.ts`**
  (`runLegacyHandler`), refactoring `account`/`listings`'s route.ts to
  use it too, since duplicating the same ~50-line shim across 8 routes
  would just invite drift. Behavior is identical to what those two had
  before. The shared version also now forwards **real request headers**
  and supports `res.end()`/`res.setHeader()`, neither of which
  `account.js`/`listings.js` ever needed but several of these new ones
  do: `deal.js` reads `req.headers.authorization` for its two Vercel Cron
  endpoints (`sweep-expired-deals`, `agent-sweep` — both GET, gated by a
  shared `CRON_SECRET`) and `req.headers.cookie` for the `admin_session`
  gate on dispute-resolution actions; `paypal.js` reads
  `req.headers['paypal-transmission-id']` to detect webhook calls before
  its normal POST/action dispatch, and also reads `req.headers.cookie`
  for the same admin gate on payout approve/reject.
- **Shared-dependency files copied into `_lib/` instead of duplicated**:
  `push.js` and `webhooks.js` are both an HTTP endpoint AND a module
  `deal.js` imports from (`sendPushToUser`, `dispatchWebhook`) — same
  situation `limits.js`/`storage.js` were already in. Canonical copies
  live in `_lib/push.js` and `_lib/webhooks.js`; each route's
  `_handler.js` is either the real file (`push`'s catch-all imports
  `_lib/push.js` directly) or a one-line re-export (`webhooks/_handler.js`
  → `export { default } from '../_lib/webhooks.js'`) — either way there's
  only one real copy of each, so `deal.js` and the HTTP route can never
  drift apart.
- **`/api/push` is a catch-all route** (`app/api/push/[...slug]/route.ts`),
  not a plain route — the original routes `/api/push/subscribe` and
  `/api/push/unsubscribe` by checking `req.url`'s suffix inside one
  Vercel function (see that file's own "same convention github.js uses"
  comment) rather than being two separate files. The shared adapter
  forwards the real request pathname as `req.url`, so that suffix check
  keeps working unmodified.
- Relative imports repointed (same mechanical fix as `listings.js`
  already had): `paypal.js`'s `./limits.js` → `../_lib/limits.js`;
  `deal.js`'s four imports (`storage.js`, `limits.js`, `push.js`,
  `webhooks.js`) → their `../_lib/` equivalents. `aistudio.js` and
  `objectives.js` had no relative imports to fix (only the
  `firebase-admin` package). Every internal action/business-logic line
  is otherwise byte-for-byte unchanged from the original.
- **Env vars this adds**, beyond the 4 already documented above (grepped
  every newly-ported file for `process.env.*`) — none of these existed in
  the app before this step, so none currently have a value:
  `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`,
  `VAPID_PUBLIC_KEY`, `VAPID_SECRET`, `VAPID_SUBJECT`,
  `WEBHOOK_SIGNING_SECRET`, `CRON_SECRET`, `AUTOSEND_CRON_SECRET`,
  `SESSION_SECRET`, `AISTUDIO_INTERNAL_TOKEN`, `GEMINI_API_KEY`,
  `GROQ_API_KEY`, `RESEND_API_KEY`, `DEAL_EMAIL_FROM`,
  `PUBLIC_BASE_URL`/`NEXT_PUBLIC_SITE_URL`/`VERCEL_URL` (base-URL fields
  used for building links in emails/webhooks — check which of these
  three each file actually reads before assuming one covers all of them).
  All of these are the same values your old Vercel deployment already
  has set — copy them the same way as the original 4.
- **Not covered by this step**: none of these routes have client callers
  wired up yet except `listing.feed`/`listing.view`/`listing.file-url`
  (from earlier steps) — e.g. the Settings panels that will eventually
  call `paypal`/`push`/`webhooks` (Payment Methods, Notifications' push
  toggle, Webhooks panel) still need their client-side fetch calls
  written in a later step; this step only makes the server routes exist
  and work.

**Step 8 — Listing detail page, Website type (Layer A):**
- `components/listing/WebsiteListingBody.tsx` — ported from the
  `type === 'website'` branch of `mpOpenModal` (marketplace.js
  ~line 1774), same Layer A scope already agreed for the App type in
  Step 6: static layout with real data, heavier interactive
  sub-features deferred. Section order matches the original exactly:
  hero → gallery (images[0]/[1] as portrait shots, images[3] as a wide
  shot — index 2 is reserved for the hero/cover, same as the original)
  → description+URL row → tech stack → financials → business details
  (category/site age/location/structure/reason for selling) → attached
  repo → transfer methods → seller.
- Reuses the same shared blocks `AppListingBody` already established
  (`FinancialsBlock`, `SellerBlock`, `TransferMethodsBlock`,
  `AttachedRepoBlock`, `DescriptionBlock`) — no new shared
  infrastructure needed, only the type-specific hero/fields.
- `lib/listings.ts`: added `location` to `ListingSettings` — it's a
  website-only field the app type never uses, so the feed/app-body
  work in Steps 3/6 hadn't needed it yet.
- **Layer B deferral, consistent with Step 6's precedent for the App
  type**: the original wires the "Preview" button through
  `mpShowAdThenAction` (ad-gated interstitial) before opening an
  in-page preview iframe via `mpOpenPreview`. This port opens the URL
  directly in a new tab instead — same simplification already applied
  to `AppListingBody`'s store links and demo-preview toggle, not a new
  deviation. Lightbox for cover/gallery images and per-listing SEO are
  still deferred site-wide (see Step 6's Layer B list).
- `app/listing/[id]/page.tsx` now dispatches on type for both `app`
  and `website`; only `game` still shows the "not built yet" message.

**Step 9 — Listing detail page, Game type (Layer A) — all 3 types now done:**
- `components/listing/GameListingBody.tsx` — ported from the
  `type === 'game'` branch of `mpOpenModal` (marketplace.js ~line
  2026). Same Layer A scope as Website/App: static layout with real
  data. Section order: title/description + "View Game" external link →
  Launch Game → game details (platform/genre/game age/structure/
  delivery method/reason) → financials → attached repo → transfer
  methods → seller. Reuses the same `platform`/`genre` field mapping
  the original uses (`tech.frontend`/`tech.backend`, repurposed from
  their website/app meaning) and the same hero-image mapping
  (`images[2]` landscape as hero, `images[0]`/`[1]` portraits as the
  gallery strip).
- **Layer B deferral, same pattern as Website/App**: the original
  wires "Launch Game" through `mpShowAdThenAction` into
  `mpOpenGameFullscreen` — a full-screen runner that fetches/unzips
  browser-upload builds or embeds the external link in an iframe, with
  its own ad-countdown gate. That's a substantially heavier
  sub-feature (same category as the lightbox and per-listing SEO), so
  this port opens the game URL directly in a new tab instead, matching
  the same simplification already applied to the other two types'
  preview/store-link buttons.
- `app/listing/[id]/page.tsx` now dispatches all three listing types
  to a real body; the fallback branch only catches an unexpected/
  corrupt `type` value on the Firestore doc, not "not built yet".

**Step 10 — Settings panels: Appearance + Privacy & Data:**
- `components/settings/panels/AppearancePanel.tsx` — ported from
  `support-modals.js`'s `renderAppearance()` + its `case 'appearance':`
  handler block. Theme picker is a placeholder button (real theme-picker
  modal is a separate future feature, same as other unbuilt sub-features
  elsewhere in this port) toasting "isn't built yet" instead of a silent
  no-op. Font size 3-way picker applies instantly (CSS var + `body`
  font-size + `localStorage` fallback) and saves to Firestore on click,
  matching the original's instant-apply behavior. Compact mode toggle
  also applies its class instantly. Save button persists both
  `fontSize`+`compactMode` together, same redundant-but-faithful pattern
  as the original (instant-apply AND an explicit save button both write
  the same fields).
- `components/settings/panels/PrivacyPanel.tsx` — ported from
  `renderPrivacy()` + its `case 'privacy':` handler. Profile visibility
  select (public/members/private), with "Private" disabled unless
  `state.plan !== 'free'` — mirrors the original's client-side guard,
  which is explicitly a UX nicety only; real enforcement is server-side
  in `/api/account`'s `setPrivacy` action (already ported, Step 2) via a
  fresh plan check on write, exactly as the original comment says the
  client-only check alone left a devtools-exploitable gap. Show
  email/show social/data collection toggles. Save button posts to
  `/api/account?action=setPrivacy`.
- Both wired into `app/settings/page.tsx`'s panel switch. Settings is now
  5 of 14 panels built (Account, Security, Notifications, Appearance,
  Privacy & Data); 9 remain: Billing & Plans, Payment Methods, API &
  Integrations, Webhooks, Active Sessions, Referrals, Listing Analytics,
  Seller Badge, Danger Zone.
- No new state fields needed — `useSettingsState.ts` already had
  `fontSize`/`compactMode`/`theme` and `profileVisibility`/`showEmail`/
  `showSocial`/`dataCollection` from Step 5's original scaffold.

**Step 11 — Settings panels: Billing & Plans + Payment Methods:**
- `components/settings/panels/BillingPanel.tsx` — ported from
  `support-modals.js`'s `renderBilling()` + its `case 'billing':` handler.
  Current-plan card, Cancel Subscription (only shown for paid plans) with
  a danger-themed confirm dialog before calling `/api/paypal` with
  `action: 'cancel-sub'` (route already ported server-side, Step 7), and
  upgrade cards for the other 3 plans.
  - **Flagged simplification**: the original's plan pricing/fee/description
    data normally comes from `window.__limits.plans`, populated by a
    `fetch('/api/limits')` call in `core-early.js`. `/api/limits` itself
    is not ported in this app yet — only its shared `_lib/limits.js`
    helper was copied (Step 3). This panel uses the same hardcoded
    fallback values `renderBilling()` itself falls back to when
    `__limits` hasn't loaded (`free`/`starter`/`growth`/`pro` prices,
    colors, fees, descriptions) — not new numbers invented for this port.
    Porting `/api/limits` as a real GET route is still open (add to task
    list if plan data ever needs to be dynamic here).
  - Upgrade buttons are a placeholder toast, same pattern as
    AppearancePanel's theme picker — the original wires `data-paypal-plan`
    buttons through a separate standalone Plans modal
    (`window.__openPlansModal`) via document-level delegation, not
    through this panel's own handler, so that modal is out of scope here.
  - No shared confirm-modal system exists in this port yet, so the cancel
    confirmation follows the same lightweight inline-overlay pattern
    already used for the Sign Out confirm in `SettingsSidebar.tsx`
    (Step 5), rather than porting `window.srfModal.confirm` as a new
    generic component.
- `components/settings/panels/PaymentsPanel.tsx` — ported from
  `renderPayments()` + its `case 'payments':` handler. PayPal-connected
  info card (shown when `paypalEmail` is already set), editable email
  input with the same `@`-contains validation, save button writing
  directly to Firestore. Credit/debit card section ported as a disabled
  "COMING SOON" placeholder, exactly as the original — not a gap in this
  port, the original never built that path either.
- Both wired into `app/settings/page.tsx`'s panel switch. Settings is now
  7 of 14 panels built (Account, Security, Notifications, Appearance,
  Privacy & Data, Billing & Plans, Payment Methods); 7 remain: API &
  Integrations, Webhooks, Active Sessions, Referrals, Listing Analytics,
  Seller Badge, Danger Zone.
- No new state fields needed — `useSettingsState.ts` already had `plan`
  and `paypalEmail` from Step 5's original scaffold.

**Step 12 — Settings panels: API & Integrations + Webhooks + Active Sessions (10 of 14 done):**
- `components/settings/panels/ApiPanel.tsx` — ported from
  `support-modals.js`'s `renderAPI()` + its `case 'api':` handler.
  - Key-count badge: `GET /api/deal?action=agent-limits&uid=...`, a
    public read-only lookup (route already ported, Step 7).
  - Generate key: `POST /api/deal` with `agent-check-key-limit` first (no
    key limits hardcoded client-side, matches original), then
    `agent-create-key` if allowed. Limit-reached case shows an inline
    dialog (same pattern as below) instead of proceeding, mirroring
    `window.srfModal.alert`'s danger dialog.
  - Revoke key: `POST /api/account?action=revokeApiKey` (already ported,
    Step 2) — ownership of the key is verified server-side against the
    caller's own token, not trusted from the client, exactly as the
    original comment describes (this used to be a raw client `updateDoc`
    with no ownership check at all before that route existed).
  - Add external key: direct client-side Firestore query against the
    `apiKeys` collection (`where key == ..., active == true`) — ported
    as-is, this is a real Firestore read from the client in the original
    too, not a route this port is missing.
  - No shared confirm-modal system exists yet in this port, so the
    revoke-key confirmation and the key-limit-reached alert both use the
    same lightweight inline-overlay pattern already established for Sign
    Out (`SettingsSidebar`, Step 5) and Cancel Subscription
    (`BillingPanel`, Step 11).
- `components/settings/panels/WebhooksPanel.tsx` — ported from
  `renderWebhooks()` + its `case 'webhooks':` handler, including the
  shared `_apiWebhooks()` caller (ported as a local `apiWebhooks()`
  helper at the top of the file — every action needs a fresh idToken and
  uses the same `{ ok, data }` envelope as `deal.js`/`listings.js`).
  `/api/webhooks` was already ported server-side (Step 7) with all 5
  actions (`webhook.list`/`.add`/`.delete`/`.test`/`.logs`) — this step
  only writes the client calls. Loads webhooks + delivery logs once per
  mount (guarded by `state.webhooksLoaded`, same as the original, so
  switching tabs back and forth doesn't refetch every time; only marks
  loaded on success so a failed load can be retried by revisiting the
  panel rather than being permanently cached as empty).
- `components/settings/panels/SessionsPanel.tsx` — ported from
  `renderSessions()` + its `case 'sessions':` handler. Fetches the
  current device's session doc from `users/{uid}/sessions/{sKey}`, where
  `sKey` comes from `localStorage.getItem('__srSK')`.
  - **Flagged finding, not a gap introduced by this port**: grepped the
    entire original source for `__srSK` — it is only ever *read*
    (`support-modals.js`), never *written* anywhere in the codebase. No
    file sets that localStorage key at login. In practice this means the
    lookup almost always falls through to the userAgent-sniffing
    fallback card (browser/OS/mobile detected from
    `navigator.userAgent`, no `createdAt`/`lastSeen` dates) — which the
    original also does whenever the key is missing, so this port
    reproduces that exact same fallback rather than inventing a
    session-key writer that doesn't exist in the source. If a future
    step finds the missing writer (maybe in a file outside this zip), the
    Firestore-doc path is already wired and will pick it up automatically.
  - `fetchSessions()` in `lib/useSettingsState.ts` (added speculatively
    before this step, per the original handoff notes) turned out to be
    for a *different* original code path (a hypothetical full
    session-list view) than what `renderSessions()` actually does (a
    single-device lookup by key) — this panel does its own direct
    `getDoc` instead, matching the real original function. Left
    `fetchSessions()` in place unused rather than deleting it, in case a
    future multi-session-list feature wants it.
- All three wired into `app/settings/page.tsx`'s panel switch. Settings
  is now 10 of 14 panels built (Account, Security, Notifications,
  Appearance, Privacy & Data, Billing & Plans, Payment Methods, API &
  Integrations, Webhooks, Active Sessions); 4 remain: Referrals, Listing
  Analytics, Seller Badge, Danger Zone.
- No new state fields needed for API/Sessions — `useSettingsState.ts`
  already had `apiKeys`/`externalApiKeys` and `currentSession` from
  Step 5's original scaffold. Webhooks panel writes `webhooks`/
  `webhookLogs`/`webhooksLoaded` into the same state object, also
  already present.

**Step 13 — Settings panels: Referrals + Listing Analytics + Seller Badge + Danger Zone (14 of 14 done — all settings panels complete):**
- `components/settings/panels/ReferralsPanel.tsx` — ported from
  `renderReferrals()` + its `case 'referrals':` handler. Referral link
  is `${origin}/r/${username}` (no dedicated route for this — the
  original builds it client-side too). Copy-link uses
  `navigator.clipboard`, same as source, with the same silent
  fallback toast if the browser blocks it. `referralCount`/
  `referralEarned` are read directly off the user doc via a plain
  `getDoc` — there's no `/api/*` route for referral stats in the
  original, so nothing here was skipped; it's a genuine direct
  Firestore read same as the source. Commission-per-plan table is
  static copy (30% of $15/$30/$60), matching the original's hardcoded
  numbers exactly.
- `components/settings/panels/AnalyticsPanel.tsx` — ported from
  `renderAnalytics()` + its `case 'analytics':` handler. Same
  `getDoc(users/{uid})` read as Referrals, pulling
  `totalListingViews`/`totalOffersReceived`/`totalDealsClosed` and
  computing conversion rate client-side exactly like the original
  (`offers > 0 ? deals/offers*100 : '—'`). Compact-number formatting
  (`1.2k` etc.) ported as its own `fmtCompact()` helper, matching the
  original's inline `>= 1000 ? …+'k' : v` expressions verbatim. No
  per-listing analytics here — the panel's own copy says that lives on
  each listing card, which is out of scope for this step.
- `components/settings/panels/SellerBadgePanel.tsx` — ported from
  `renderSellerBadge()`. Its `case 'sellerbadge':` handler in the
  original is a no-op ("badge data is rendered statically from state
  — no extra listeners needed"), so this panel has no side effects,
  just render logic. **Flagged, not introduced by this port**: only
  the "Verified Seller" badge has real unlock logic (`plan !== 'free'`)
  — the other three (Trusted/Top Rated/Power Seller) are hardcoded
  `unlocked: false` in the original source itself. There's no
  deal-count, rating, or sales-volume check anywhere in the codebase
  for those three; this isn't a simplification, the upstream feature
  is genuinely unfinished. Ported as-is per the "don't silently fix"
  rule rather than inventing unlock logic that doesn't exist.
- `components/settings/panels/DangerZonePanel.tsx` — ported from
  `renderDanger()` + its `case 'danger':` handler. Two real destructive
  flows:
  - **Export All Data**: gathers `users/{uid}` (profile, minus
    `passwordHash`/`token`), `users/{uid}/transactions`, `listings`
    where `ownerUid == uid`, and `apiKeys` where `ownerUid == uid`
    (metadata only — key values themselves are never included, same
    as original), then builds a ZIP client-side with JSZip and
    triggers a browser download. JSZip is lazy-loaded from the exact
    same CDN URL (`cdnjs.cloudflare.com/.../jszip/3.10.1/jszip.min.js`)
    the original uses, only on click — not bundled up front, matching
    the source's on-demand load.
  - **Delete Account**: confirm-toggle gates the delete button (same
    as original), click opens an inline password re-auth prompt
    (styled to match the original's dynamically-injected overlay
    exactly — same copy, same layout), successful re-auth writes
    `{ scheduledDelete: true, deleteAt: Date.now(), deletionConfirmedAt:
    serverTimestamp() }` to the user doc, then calls real Firebase Auth
    `user.delete()`, then reloads the page after a toast — same
    sequence and same Firestore flag shape as the original, nothing
    added or removed from the flow.
- All four wired into `app/settings/page.tsx`'s panel switch.
  **Settings is now complete: all 14 of 14 panels built** (Account,
  Security, Notifications, Appearance, Privacy & Data, Billing &
  Plans, Payment Methods, API & Integrations, Webhooks, Active
  Sessions, Referrals, Listing Analytics, Seller Badge, Danger Zone).
  No panels remain as placeholders.
- No new fields needed in `useSettingsState.ts` — Referrals/Analytics
  read their own `getDoc` directly (matching how Sessions already
  works, since neither original render function pulls from the shared
  `state` object beyond `username`/`plan`, which were already there).

## What's NOT done yet (later steps)

- All three listing types (website/app/game) now have real detail
  bodies (Steps 6, 8, 9). Seller profile page/popup (`mpOpenSellerModal`
  equivalent) — still a bare placeholder. **This is the next
  recommended step** — core marketplace function, scope the Layer A/B
  split with the user before building (same convention as listing
  detail).
- Listing detail Layer B sub-features (ad-gated preview/play, seller
  reveals/reviews, lightbox, game fullscreen runner, per-listing SEO) —
  see Step 6 for the full deferred list
- Trust badge cluster on cards (verified checkmarks, deal-tier badge) —
  needs the heavier seller-data fetch `useSeller` intentionally skips
- Search/filter chips, boosted row, premium sellers strip, ad slots,
  seller-promo/AI-promo interstitial cards — all present in the original
  `mpRenderCards`/marketplace page but not yet ported
- OAuth onboarding modal (username/avatar setup for new Google/GitHub
  users) — `AuthModalProvider`'s `onNewOAuthUser` callback is wired but
  empty
- "Welcome back" screen, banned/suspended account overlay, admin flag —
  these read more fields from the user doc than Step 2 brought over
- Live listings count in the nav drawer (currently shows "—" rather than a
  fabricated 0, matching the original's own "don't fabricate a number" policy)
- Plan badge and unread-message action slot in the announcement bar
- All main-site API routes are now ported server-side (Step 7) — but
  most have no client caller wired up yet (only `listing.feed`/`.view`/
  `.file-url` are actually called from the UI so far). `admin` and
  `edit-file` are intentionally not ported (see Step 7) since neither is
  used outside `admin.html`/`tools/github`, both out of scope.
- No content in the other route placeholder pages yet (seller/[id], sell,
  profile, myprofile, messages, etc.) — `/settings` (sidebar + all 14
  panels, Steps 5, 10, 11, 12 & 13 — now complete) and `/listing/[id]`
  (all 3 types, Steps 6, 8 & 9) are the two routes with real content so far
- Settings is fully built: all 14 of 14 panels done as of Step 13
  (Account, Security, Notifications, Appearance, Privacy & Data, Billing
  & Plans, Payment Methods, API & Integrations, Webhooks, Active
  Sessions, Referrals, Listing Analytics, Seller Badge, Danger Zone). No
  panels remain as placeholders — this task is complete and off the
  priority list.
- Push notification subscribe/unsubscribe (Notifications panel's push
  toggle only saves the preference flag right now) — needs a registered
  service worker, the real VAPID key wired in from `core-early.js`, and
  `/api/push/*` ported
- Dispute picker (deal-selection modal + `/api/deal`'s `escrow-dispute`
  action) — the sidebar's "Raise a Dispute" button is currently a
  placeholder alert

## Notes

- Header/NavDrawer/AnnouncementBar are siblings of `<main>` in `app/layout.tsx`,
  matching the original — the original code has comments warning that nesting
  modals inside `<main>` breaks z-index stacking, so this is preserved deliberately.
- All original element `id`s were kept as-is in the ported markup so future JS
  logic (event handlers, DOM queries) can be ported without renaming lookups.
- `app/api/account/_handler.js` and `app/api/listings/_handler.js` are direct
  copies of the old `api/account.js` / `api/listings.js`. If you need to
  change what an action actually does, edit `_handler.js` — `route.ts` is
  only a request/response format adapter. This adapter pattern is the
  template for porting the rest of `/api/*.js`: copy the file into
  `app/api/<name>/_handler.js`, fix any relative imports to point at
  `app/api/_lib/`, then copy an existing `route.ts` and swap the import.

// Shared types + client fetch helpers for /api/listings.
//
// Mirrors the real server contract in app/api/listings/_handler.js
// (ported byte-for-byte from the original api/listings.js) — see that
// file's top-of-file comment block for the full action list. This file
// only covers what the marketplace grid needs so far: `listing.feed`.
//
// Listing objects here are raw Firestore docs (`{ id, ...d.data() }`),
// so this type is intentionally a superset covering website/app/game
// fields — most fields are optional because a given listing only has
// the ones relevant to its `type`.

export type ListingType = "website" | "app" | "game";

export interface ListingFinancials {
  price?: number;
  revenue?: number;
  expenses?: number;
  profit?: number;
}

export interface ListingTech {
  frontend?: string;
  backend?: string;
  database?: string;
  monetization?: string;
}

// Mirrors the `settings` sub-object as read by the app-listing modal body
// (category/age/structure/reason) — the original reuses this same field
// name across website/app/game types with type-specific keys, so like the
// rest of this file it's kept as a loose superset rather than split per type.
export interface ListingSettings {
  category?: string;
  age?: string;
  location?: string; // website-type only, mirrors settings.location in mpOpenModal's website branch
  structure?: string;
  reason?: string;
}

export interface ListingBuildFile {
  filename?: string;
  url?: string | null;
  storagePath?: string | null;
}

export interface AttachedRepo {
  fullName?: string;
  htmlUrl?: string;
  private?: boolean;
  language?: string;
}

export interface Listing {
  id: string;
  type: ListingType;
  title?: string;
  description?: string;
  tagline?: string;
  url?: string;
  isTemplate?: boolean;
  status?: string;
  ownerId?: string;
  ownerEmail?: string;
  ownerPlan?: string;
  financials?: ListingFinancials & { model?: string; subMonthly?: number; subAnnual?: number };
  tech?: ListingTech;
  settings?: ListingSettings;
  images?: string[];
  imageCover?: string;
  appIcon?: string;
  category?: string;
  gameType?: string;
  videoUrl?: string;
  previewUrl?: string;
  // Platform selection + store links for app listings — mirrors
  // listing.platforms in the original (selected/iosUrl/androidUrl/webUrl/
  // previewUrl).
  platforms?: {
    selected?: string[];
    iosUrl?: string;
    androidUrl?: string;
    webUrl?: string;
    previewUrl?: string;
  };
  apkUrl?: string;
  apkStorageUrl?: string;
  apkIpaFileName?: string;
  apkFileName?: string;
  additionalFiles?: ListingBuildFile[];
  notLive?: boolean;
  notLiveBuildFiles?: { global?: ListingBuildFile[] };
  attachedRepo?: AttachedRepo;
  transferMethods?: string[];
  saves?: number;
  boostedUntil?: number | { toMillis?: () => number; seconds?: number };
  createdAt?: unknown;
}

export interface FeedResponse {
  listings: Listing[];
  seed: number;
  cursor: Record<string, number>;
  exhausted: boolean;
}

interface ApiEnvelopeOk<T> {
  ok: true;
  data: T;
}
interface ApiEnvelopeFail {
  ok: false;
  error: { message: string; code: string };
}
type ApiEnvelope<T> = ApiEnvelopeOk<T> | ApiEnvelopeFail;

export class ListingsApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

async function callListingsApi<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  
  // FIX APPLIED HERE: Bycasting the response to 'any' to bypass strict TypeScript union checks
  const out = (await res.json()) as any;
  
  if (!out.ok) {
    throw new ListingsApiError(out.error.message, out.error.code);
  }
  
  return out.data;
}

// Fetches the full listing doc straight from Firestore by id. Unlike the
// original (where mpOpenModal only ever ran off an already-in-memory
// listing object handed to it by whichever card/list triggered it —
// there was no route that could cold-load a listing by id alone), a
// Next.js /listing/[id] page is directly linkable/refreshable, so this
// is the real source of truth for that route. Reads the same `listings`
// collection every other part of this app reads from (see e.g.
// marketplace.js's doc(db,'listings',listingId)). Returns null if the
// doc doesn't exist or was deleted.
export async function fetchListingById(id: string): Promise<Listing | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const { db } = await import("@/lib/firebase");
  const snap = await getDoc(doc(db, "listings", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Listing, "id">) };
}

// action: 'listing.feed' — public, no auth required. `seed`/`cursor` must
// be echoed back verbatim from the previous response to continue the same
// shuffled session (see _handler.js's handleFeed for why).
export async function fetchFeed(params: {
  seed?: number;
  cursor?: Record<string, number>;
  pageSize?: number;
  type?: ListingType;
  idToken?: string | null;
} = {}): Promise<FeedResponse> {
  return callListingsApi<FeedResponse>("listing.feed", params);
}

// Fire-and-forget analytics beacon — mirrors _mpTrackListing. Never throws
// into the caller; a failed impression/view ping should never break
// browsing.
export async function trackListing(action: "listing.impression" | "listing.view", listingId: string, idToken?: string | null) {
  if (!listingId) return;
  try {
    await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, idToken: idToken || null, listingId }),
    });
  } catch (err) {
    console.error("[trackListing]", action, err);
  }
}

// $ formatting for site cards — full number, comma-separated.
export function fmtPrice(n: number | undefined | null): string {
  return typeof n === "number" ? `$${n.toLocaleString()}` : "Make offer";
}

// $ formatting for app/game card stat strips — abbreviates large numbers
// (1.2M / 45k). Mirrors fmtFinVal in the original marketplace.js exactly.
export function fmtFinVal(n: number | undefined | null): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 10_000) return "$" + (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + n.toLocaleString();
}

// Mirrors _isBoosted exactly — server Timestamp fields come back with
// .toMillis(), plain numbers stay numbers.
export function isBoosted(listing: Listing): boolean {
  const until = listing.boostedUntil;
  if (!until) return false;
  const ms =
    typeof until === "number"
      ? until
      : until.toMillis
      ? until.toMillis()
      : until.seconds
      ? until.seconds * 1000
      : 0;
  return ms > Date.now();
}

export const SR_PAID_PLANS = ["starter", "growth", "pro"] as const;

// Mirrors _isPremiumSeller — purely visual (shimmer), carries no
// placement/ranking weight. `ownerPlan` is attached server-side in the
// feed response.
export function isPremiumSeller(listing: Listing): boolean {
  return SR_PAID_PLANS.includes((listing.ownerPlan as any) || "free");
}

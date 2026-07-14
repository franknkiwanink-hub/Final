"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Lightweight seller summary for a card's SellerStrip — just what's
// visually needed (avatar/name/stars). This is deliberately NOT a port of
// mpGetSeller, which also fetches the seller's listings, follower count,
// and lifetime deals for the full seller-profile popup — that's a
// separate, heavier feature to build later (see original marketplace.js
// mpGetSeller). Trust badges (sellerBadgesHtml) need that heavier data
// too, so cards intentionally don't show them yet.
export interface SellerSummary {
  uid: string;
  username: string;
  profilePic: string;
  rating: number;
  ratingCount: number;
}

const cache = new Map<string, SellerSummary>();

export function useSeller(uid: string | undefined | null): SellerSummary | null {
  const [seller, setSeller] = useState<SellerSummary | null>(uid ? cache.get(uid) || null : null);

  useEffect(() => {
    if (!uid) return;
    if (cache.has(uid)) {
      setSeller(cache.get(uid)!);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        const d = snap.exists() ? snap.data() : ({} as any);
        const summary: SellerSummary = {
          uid,
          username: d.username || d.displayName || d.email?.split("@")[0] || "Anonymous",
          profilePic: d.profilePic || "",
          rating: typeof d.rating === "number" ? d.rating : 0,
          ratingCount: typeof d.ratingCount === "number" ? d.ratingCount : 0,
        };
        cache.set(uid, summary);
        if (!cancelled) setSeller(summary);
      } catch (err) {
        console.error("[useSeller] failed to load", uid, err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return seller;
}

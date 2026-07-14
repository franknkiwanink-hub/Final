"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchListingById, trackListing, type Listing } from "@/lib/listings";
import ListingDetailSkeleton from "@/components/listing/ListingDetailSkeleton";
import AppListingBody from "@/components/listing/AppListingBody";
import WebsiteListingBody from "@/components/listing/WebsiteListingBody";
import GameListingBody from "@/components/listing/GameListingBody";

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [listing, setListing] = useState<Listing | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setListing(null);
    setNotFound(false);
    setError(null);
    (async () => {
      try {
        const l = await fetchListingById(id);
        if (cancelled) return;
        if (!l) {
          setNotFound(true);
          return;
        }
        setListing(l);
        // Detail-view beacon — fires once per open, distinct from the
        // card-impression counter. Mirrors _mpTrackListing('listing.view', ...)
        // in mpOpenModal.
        trackListing("listing.view", l.id);
      } catch (err) {
        console.error("[ListingDetailPage] failed to load listing", id, err);
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load listing.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div style={{ marginTop: 92, padding: "40px 24px 80px", textAlign: "center", color: "#fff" }}>
        <h1>Something went wrong</h1>
        <p style={{ opacity: 0.7 }}>{error}</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ marginTop: 92, padding: "40px 24px 80px", textAlign: "center", color: "#fff" }}>
        <h1>Listing not found</h1>
        <p style={{ opacity: 0.7 }}>This listing may have been removed or the link is incorrect.</p>
      </div>
    );
  }

  if (!listing) {
    return <ListingDetailSkeleton />;
  }

  const type = listing.type || "website";

  if (type === "app") {
    return (
      <div style={{ marginTop: 92, maxWidth: 760, margin: "92px auto 0", padding: "0 0 80px" }}>
        <AppListingBody listing={listing} />
      </div>
    );
  }

  if (type === "website") {
    return (
      <div style={{ marginTop: 92, maxWidth: 760, margin: "92px auto 0", padding: "0 0 80px" }}>
        <WebsiteListingBody listing={listing} />
      </div>
    );
  }

  if (type === "game") {
    return (
      <div style={{ marginTop: 92, maxWidth: 760, margin: "92px auto 0", padding: "0 0 80px" }}>
        <GameListingBody listing={listing} />
      </div>
    );
  }

  // Every known listing type (website/app/game) now has a real body —
  // this only catches an unexpected/corrupt `type` value on the doc.
  return (
    <div style={{ marginTop: 92, padding: "40px 24px 80px", textAlign: "center", color: "#fff" }}>
      <h1>{listing.title || "Listing"}</h1>
      <p style={{ opacity: 0.7 }}>This listing has an unrecognized type (&ldquo;{type}&rdquo;) and can&apos;t be displayed.</p>
    </div>
  );
}

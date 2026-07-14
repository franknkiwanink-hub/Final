"use client";

import { useState } from "react";

// Ports mpOpenModal's descHtml + the read-more click handler. WORD_LIMIT
// is hardcoded to 50 (the original reads window.__limits.listing.
// descPreviewWords with a 50 fallback — /api/limits isn't wired into a
// client-side global here yet, so this uses the same fallback value the
// original falls back to, not a fixed re-decision).
const WORD_LIMIT = 50;

export default function DescriptionBlock({ description }: { description?: string }) {
  const desc = description || "No description provided.";
  const [expanded, setExpanded] = useState(false);

  const words = desc.trim().split(/\s+/);
  const needsReadMore = words.length > WORD_LIMIT;
  const short = needsReadMore ? words.slice(0, WORD_LIMIT).join(" ") + "…" : desc;

  if (!needsReadMore) {
    return <p className="modal-desc">{desc}</p>;
  }

  return (
    <>
      <p className="modal-desc">{expanded ? desc : short}</p>
      <button className="mp-read-more-btn" onClick={() => setExpanded((e) => !e)}>
        {expanded ? "Show less" : "Read more"}
      </button>
    </>
  );
}

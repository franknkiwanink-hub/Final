import MarketplaceGrid from "@/components/marketplace/MarketplaceGrid";

// Standalone, directly-linkable /marketplace route (share links, SEO, the
// header's "Marketplace" nav link). The homepage (app/page.tsx) renders
// the same MarketplaceGrid component inline below the hero, matching the
// original site's layout where the marketplace sits right after the hero
// on "/" — this route exists in addition to that, not instead of it.
export default function MarketplacePage() {
  return (
    <div style={{ marginTop: 92 }}>
      <MarketplaceGrid />
    </div>
  );
}

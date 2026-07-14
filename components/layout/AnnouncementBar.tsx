"use client";

import { useAuth } from "@/lib/AuthContext";

export default function AnnouncementBar() {
  const { user, profile } = useAuth();

  const displayName = user
    ? profile?.username || user.email?.split("@")[0] || "User"
    : "Guest";
  const plan = profile?.plan || "free";

  return (
    <div id="announcement-bar" data-plan={plan}>
      <div className="ab-left">
        <span className="ab-username" id="ab-user">
          {displayName}
        </span>
        {/* Plan badge content driven by Js/announcement-settings.js originally —
            wired up in a later step. */}
        <span className="plan-badge" id="ab-badge" />
      </div>
      {/* Unread-messages / notifications action slot, driven by Js/inbox.js
          originally — wired up in a later step. */}
      <div id="ab-action" />
    </div>
  );
}

"use client";

import { useAuth } from "@/lib/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModalProvider";

const DEFAULT_AVATAR =
  "https://i.pinimg.com/736x/8d/c1/be/8dc1be45b32f2d6efebea0ec78e6b036.jpg";

export default function Header() {
  const { user, profile } = useAuth();
  const { openAuthModal } = useAuthModal();

  const isLoggedIn = !!user;
  const label = isLoggedIn ? "Profile" : "Sign up / Log in";
  const avatarSrc = profile?.profilePic || DEFAULT_AVATAR;

  return (
    <header>
      <div className="left">
        <button className="hamburger" id="hbg" aria-label="Menu">
          <span id="l1" />
          <span id="l2" />
          <span id="l3" />
        </button>
        <div className="brand">
          Siterifty<span>.com</span>
        </div>
      </div>
      <div className="btn-wrap">
        {isLoggedIn && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: "4px 11px 4px 9px",
              marginRight: 8,
              fontSize: 12.5,
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="2.2"
              style={{ flexShrink: 0 }}
            >
              <path d="M9 12h6M12 8v8" strokeLinecap="round" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span>${(profile?.walletBalance ?? 0).toFixed(2)}</span>
          </div>
        )}
        <button
          className="btn-login"
          onClick={() => {
            if (!isLoggedIn) openAuthModal();
          }}
        >
          {isLoggedIn && (
            <img
              src={avatarSrc}
              alt=""
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span
            style={{
              maxWidth: 110,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </button>
      </div>
    </header>
  );
}

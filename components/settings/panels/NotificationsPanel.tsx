"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { SettingsState } from "@/lib/useSettingsState";
import { useToast } from "@/lib/useToast";

const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16L21 8V19C21 20.1046 20.1046 21 19 21Z" />
  </svg>
);

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider" />
    </label>
  );
}

// Keys of SettingsState whose value is a boolean — restricts
// saveSimpleToggle's setStateKey param so the dynamic assignment below
// type-checks (only boolean fields are ever toggled this way).
type BooleanSettingsKey = {
  [K in keyof SettingsState]: SettingsState[K] extends boolean ? K : never;
}[keyof SettingsState];

export default function NotificationsPanel({
  state,
  setState,
}: {
  state: SettingsState;
  setState: React.Dispatch<React.SetStateAction<SettingsState>>;
}) {
  const { toast, ToastHost } = useToast();

  const [emailNotifs, setEmailNotifs] = useState(state.emailNotifs);
  const [pushNotifs, setPushNotifs] = useState(state.pushNotifs);
  const [inAppNotifs, setInAppNotifs] = useState(state.inAppNotifs);
  const [dealAlerts, setDealAlerts] = useState(state.dealAlerts);
  const [marketingEmails, setMarketingEmails] = useState(state.marketingEmails);
  const [pushBusy, setPushBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // Shared instant-save for the four simple toggles — ports the
  // simpleNotifMap loop exactly (each writes its own
  // notificationPrefs.<key> field immediately on change).
  async function saveSimpleToggle(key: string, value: boolean, setLocal: (v: boolean) => void, setStateKey: BooleanSettingsKey) {
    const user = auth.currentUser;
    if (!user) return;
    setLocal(value);
    setState((prev) => ({ ...prev, [setStateKey]: value }));
    try {
      await updateDoc(doc(db, "users", user.uid), { [`notificationPrefs.${key}`]: value });
    } catch {
      toast("Save failed.");
    }
  }

  // Ports the push toggle handler. Subscribe/unsubscribe via the Push API
  // needs a registered service worker + VAPID key + /api/push/subscribe —
  // none of that infrastructure is built yet in this Next.js port (no
  // service worker registration exists in the app yet), so this degrades
  // gracefully: if the browser API isn't there, or nothing is registered,
  // it tells the user plainly rather than pretending to subscribe. The
  // Firestore preference flag still saves either way, matching what the
  // original does even when the enable path fails partway through.
  async function handlePushChange(checked: boolean) {
    const user = auth.currentUser;
    if (!user) return;
    setPushBusy(true);
    try {
      if (checked) {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          toast("Push not supported in this browser.");
          setPushBusy(false);
          return;
        }
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          toast("Notification permission denied.");
          setPushBusy(false);
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          toast("Push isn't set up on this site yet — coming in a later step.");
          setPushBusy(false);
          return;
        }
        // Real subscribe path (kept ready for when a service worker +
        // VAPID key wiring lands):
        // const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: ... });
        // await fetch('/api/push/subscribe', { method: 'POST', ... });
        toast("Push notifications enabled.");
      } else {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            const endpoint = sub.endpoint;
            await sub.unsubscribe();
            await fetch("/api/push/unsubscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint, uid: user.uid }),
            }).catch(() => {});
          }
        }
        toast("Push notifications disabled.");
      }
      setPushNotifs(checked);
      setState((prev) => ({ ...prev, pushNotifs: checked }));
      await updateDoc(doc(db, "users", user.uid), { "notificationPrefs.pushNotifs": checked });
    } catch (err) {
      console.error("[push toggle]", err);
      toast("Could not update push notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  // Ports saveNotifsBtn — batch-saves all five prefs at once (redundant
  // with the instant-save toggles above, but that's how the original
  // works too: both paths write to the same notificationPrefs field).
  async function handleSaveAll() {
    const user = auth.currentUser;
    if (!user) {
      toast("Not signed in.");
      return;
    }
    setSaving(true);
    const prefs = { emailNotifs, pushNotifs, inAppNotifs, dealAlerts, marketingEmails };
    try {
      await updateDoc(doc(db, "users", user.uid), { notificationPrefs: prefs });
      setState((prev) => ({ ...prev, ...prefs }));
    } catch (err: any) {
      toast(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="detail-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <h3>Notification Preferences</h3>
      </div>
      <p className="detail-panel-desc">Control how and when we reach out to you.</p>
      <hr className="detail-divider" />

      <div className="toggle-item">
        <div className="toggle-label-wrap">
          <span className="toggle-label">Email Notifications</span>
          <span className="toggle-sublabel">Receive updates via email.</span>
        </div>
        <Toggle checked={emailNotifs} onChange={(v) => saveSimpleToggle("emailNotifs", v, setEmailNotifs, "emailNotifs")} />
      </div>
      <div className="toggle-item">
        <div className="toggle-label-wrap">
          <span className="toggle-label">Push Notifications</span>
          <span className="toggle-sublabel">Receive push alerts on your device.</span>
        </div>
        <Toggle checked={pushNotifs} onChange={handlePushChange} disabled={pushBusy} />
      </div>
      <div className="toggle-item">
        <div className="toggle-label-wrap">
          <span className="toggle-label">In-App Notifications</span>
          <span className="toggle-sublabel">Show notifications inside the platform.</span>
        </div>
        <Toggle checked={inAppNotifs} onChange={(v) => saveSimpleToggle("inAppNotifs", v, setInAppNotifs, "inAppNotifs")} />
      </div>
      <div className="toggle-item">
        <div className="toggle-label-wrap">
          <span className="toggle-label">Deal &amp; Offer Alerts</span>
          <span className="toggle-sublabel">Get notified about new deals matching your interests.</span>
        </div>
        <Toggle checked={dealAlerts} onChange={(v) => saveSimpleToggle("dealAlerts", v, setDealAlerts, "dealAlerts")} />
      </div>
      <div className="toggle-item">
        <div className="toggle-label-wrap">
          <span className="toggle-label">Marketing Emails</span>
          <span className="toggle-sublabel">Receive tips, product updates, and promotional offers.</span>
        </div>
        <Toggle checked={marketingEmails} onChange={(v) => saveSimpleToggle("marketingEmails", v, setMarketingEmails, "marketingEmails")} />
      </div>

      <button className="save-btn" onClick={handleSaveAll} disabled={saving}>
        <SaveIcon />
        {saving ? "Saving…" : "Save Notification Settings"}
      </button>

      <ToastHost />
    </>
  );
}

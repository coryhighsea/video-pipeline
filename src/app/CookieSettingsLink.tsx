"use client";

import { OPEN_COOKIE_SETTINGS } from "./CookieBanner";

export default function CookieSettingsLink() {
  return (
    <button type="button" className="link" onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))}>
      Cookie settings
    </button>
  );
}

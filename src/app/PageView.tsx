"use client";

import { useEffect, useRef } from "react";
import { attribution } from "./attribution";

/** Counts a view of this page for /admin (no cookies; the server dedupes per visitor and day). */
export default function PageView({ page }: { page: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch("/api/pageview", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, ...attribution() }),
    }).catch(() => {});
  }, [page]);
  return null;
}

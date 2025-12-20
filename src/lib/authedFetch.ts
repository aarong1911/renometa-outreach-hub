// src/lib/authedFetch.ts

import type { User } from "firebase/auth";

export async function authedFetch(user: User, url: string, init: RequestInit = {}) {
  const idToken = await user.getIdToken();
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${idToken}`);

  // If you send JSON bodies, ensure content-type
  if (init.body && !headers.get("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}

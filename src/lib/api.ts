// src/lib/api.ts
import { User } from "firebase/auth";

export async function authedFetch(
  user: User,
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const token = await user.getIdToken();
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  // if JSON body, ensure content-type
  if (init.body && !headers.get("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, { ...init, headers });
}

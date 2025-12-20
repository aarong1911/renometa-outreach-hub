export function readServiceAccountFromEnv(envVarName: string) {
  const raw = process.env[envVarName];
  if (!raw) throw new Error(`${envVarName} env var is missing`);

  // If you stored base64, support that too
  const decoded = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");

  const sa = JSON.parse(decoded);

  if (typeof sa.private_key === "string") {
    // ✅ CRITICAL: convert escaped newlines into real newlines for PEM parsing
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }

  return sa;
}

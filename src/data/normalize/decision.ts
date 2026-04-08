export function normalizeDecision(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  if (raw === "Application Approved") return "Approved";
  return raw;
}


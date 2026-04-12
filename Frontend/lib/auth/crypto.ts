import { createHash, randomBytes } from "crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateOpaqueToken(byteLength = 48): string {
  return randomBytes(byteLength).toString("base64url");
}

export function timingSafeDelay(startedAt: number, minimumMs = 350): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= minimumMs) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, minimumMs - elapsed));
}

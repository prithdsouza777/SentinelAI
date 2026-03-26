export type UserRole = "Operator" | "Supervisor" | "Read-Only";

type TokenPayload = {
  sub?: string;
  email: string;
  name?: string;
  picture?: string;
  role: UserRole;
  exp: number;
};

const TOKEN_KEY = "sentinelai_token";
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

// ── JWT decode (no verification — backend is the authority) ──────────────────

function decodeJwtPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      // Real JWT — decode the payload (part[1])
      const payload = JSON.parse(atob(parts[1]!));
      return {
        sub: payload.sub,
        email: payload.email || "",
        name: payload.name || "",
        picture: payload.picture || "",
        role: payload.role || "Operator",
        exp: payload.exp ? payload.exp * 1000 : 0, // JWT exp is in seconds
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Legacy base64 token (mock/demo mode) ─────────────────────────────────────

function encodeLegacyToken(payload: TokenPayload): string {
  return btoa(JSON.stringify(payload));
}

function decodeLegacyToken(token: string): TokenPayload | null {
  try {
    const raw = atob(token);
    const parsed = JSON.parse(raw) as TokenPayload;
    if (!parsed || typeof parsed.email !== "string") return null;
    if (typeof parsed.exp !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Unified decode — handles both real JWT and legacy base64 tokens ──────────

function decodeToken(token: string): TokenPayload | null {
  // Try JWT first (has 3 dot-separated parts)
  if (token.includes(".")) {
    return decodeJwtPayload(token);
  }
  // Fall back to legacy base64 token
  return decodeLegacyToken(token);
}

// ── Public API ───────────────────────────────────────────────────────────────

export function createMockToken(email: string, role: UserRole, now = Date.now()): string {
  const payload: TokenPayload = {
    email,
    role,
    exp: now + EIGHT_HOURS_MS,
  };
  return encodeLegacyToken(payload);
}

export function setSessionToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSessionToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getValidSession(now = Date.now()): TokenPayload | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  const decoded = decodeToken(raw);
  if (!decoded) return null;
  if (decoded.exp <= now) return null;
  return decoded;
}

export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export type UserRole = "Operator" | "Supervisor" | "Read-Only";

type TokenPayload = {
  email: string;
  role: UserRole;
  exp: number;
};

const TOKEN_KEY = "sentinelai_token";
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

function encodeToken(payload: TokenPayload): string {
  return btoa(JSON.stringify(payload));
}

function decodeToken(token: string): TokenPayload | null {
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

export function createMockToken(email: string, role: UserRole, now = Date.now()): string {
  const payload: TokenPayload = {
    email,
    role,
    exp: now + EIGHT_HOURS_MS,
  };
  return encodeToken(payload);
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

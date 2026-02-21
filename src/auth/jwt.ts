export function parseJwt(token: string): any | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// seu backend coloca o userId aqui:
export function getUserIdFromJwt(token: string): string | null {
  const p = parseJwt(token);
  return p?.sub ?? null;
}

// ClaimTypes.Role normalmente vira "role"
export function getRoleFromJwt(token: string): number | null {
  const p = parseJwt(token);
  const r = p?.role;
  return r == null ? null : Number(r);
}
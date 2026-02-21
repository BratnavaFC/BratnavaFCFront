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
export function getRoleFromJwt(token: string): string | null {
    const p = parseJwt(token);
    if (!p) return null;

    // 1) formato moderno: "role"
    if (typeof p.role === "string") return p.role;

    // 2) formato .NET ClaimTypes.Role
    const msKey = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
    const ms = p[msKey];

    if (typeof ms === "string") return ms;

    return null;
}
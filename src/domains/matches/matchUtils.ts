import type { GroupSettingsDto, PlayerInMatchDto, TeamOptionDto } from "./matchTypes";

export function pad2(n: number) {
    return String(n).padStart(2, "0");
}

export function toDateInputValue(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isValidHHmm(v: string) {
    if (!/^\d{2}:\d{2}$/.test(v)) return false;
    const [hh, mm] = v.split(":").map(Number);
    return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

export function toUtcIso(dateStr: string, timeStr: string) {
    const local = new Date(`${dateStr}T${timeStr}:00`);
    return local.toISOString();
}

export function cls(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(" ");
}

export function getMaxPlayers(gs: GroupSettingsDto | null) {
    // maxPlayers is the real backend field; fallbacks keep old behaviour for cached data
    const n = gs?.maxPlayers ?? gs?.maxPlayersPerMatch ?? gs?.maxPlayersInMatch ?? 12;
    return Math.max(2, Number(n) || 12);
}

export function getMatchId(m: any): string | null {
    const id = m?.matchId ?? m?.id ?? null;
    if (typeof id !== "string") return null;
    const t = id.trim();
    if (!t || t === "undefined" || t === "null") return null;
    return t;
}

export function canUserActOnPlayer(isUserAdmin: boolean, activePlayerId: string | null, targetPlayerId: string) {
    if (isUserAdmin) return true;
    if (!activePlayerId) return false;
    return String(activePlayerId) === String(targetPlayerId);
}

export function uniqById<T extends { id: string }>(items: T[]): T[] {
    const map = new Map<string, T>();
    for (const it of items) {
        if (it?.id) map.set(it.id, it);
    }
    return Array.from(map.values());
}

export function fmtWeight(n: number) {
    if (!Number.isFinite(n)) return "�";
    return n.toFixed(3);
}

export function normalizeTeamGenOptions(data: any): TeamOptionDto[] {
    const opts = (data?.options ?? data?.Options ?? data?.items ?? data) as any;
    if (!Array.isArray(opts)) return [];
    return opts;
}

export function pickActiveMatch(list: any[]) {
    if (!Array.isArray(list) || list.length === 0) return null;

    const notFinalized = list
        .filter((m) => Number(m?.status) !== 6 && String(m?.statusName) !== "Finalized")
        .sort((a, b) => new Date(b.playedAt ?? 0).getTime() - new Date(a.playedAt ?? 0).getTime());

    return notFinalized[0] ?? null;
}

export function buildAllPlayers(current: { unassignedPlayers?: PlayerInMatchDto[]; teamAPlayers?: PlayerInMatchDto[]; teamBPlayers?: PlayerInMatchDto[] } | null) {
    if (!current) return [];
    return [
        ...(current.unassignedPlayers ?? []),
        ...(current.teamAPlayers ?? []),
        ...(current.teamBPlayers ?? []),
    ];
}
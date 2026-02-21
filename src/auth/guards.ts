import { useAccountStore } from "./accountStore";

export function getRole(): number | null {
    const active = useAccountStore.getState().getActive();
    return active?.roles?.length ? Number(active.roles[0]) : null;
}

export function isAdmin(): boolean {
    const r = getRole();
    return r === 2 || r === 3;
}

export function isGodMode(): boolean {
    return getRole() === 3;
}
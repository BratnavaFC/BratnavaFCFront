import { useAccountStore } from "./accountStore";

export function getRole(): string | null {
    const active = useAccountStore.getState().getActive();
    return active?.roles?.length ? active.roles[0] : null;
}

export function isAdmin(): boolean {
    const role = getRole();
    return role === "Admin" || role === "GodMode";
}

export function isGodMode(): boolean {
    return getRole() === "GodMode";
}
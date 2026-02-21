import { useAccountStore } from "./accountStore";

export function getRole(): string | null {
    const acc = useAccountStore.getState().getActive();
    if (!acc || !acc.roles?.length) return null;

    // prioridade: GodMode > Admin > User
    if (acc.roles.includes("GodMode")) return "GodMode";
    if (acc.roles.includes("Admin")) return "Admin";
    if (acc.roles.includes("User")) return "User";

    return acc.roles[0] ?? null;
}
export function isAdmin(): boolean {
    const role = getRole();
    return role === "Admin" || role === "GodMode";
}

export function isGodMode(): boolean {
    return getRole() === "GodMode";
}
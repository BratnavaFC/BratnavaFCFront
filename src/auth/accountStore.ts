import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Account = {
    userId: string;                 // GUID do usuário (vem do JWT sub)
    name: string;
    email: string;

    // ✅ Agora como TEXTO
    roles: string[];                // "User", "Admin", "GodMode"

    accessToken: string;
    refreshToken: string;

    activeGroupId?: string | null;  // group selecionado no app
    activePlayerId?: string | null; // jogador/perfil selecionado
    groupAdminIds?: string[];       // IDs das patotas onde o usuário é admin
    groupFinanceiroIds?: string[];  // IDs das patotas onde o usuário é financeiro
    activeGroupIsAdmin?: boolean;       // role do usuário na patota ATIVA (atualiza a cada troca)
    activeGroupIsFinanceiro?: boolean;  // idem para financeiro
};

type AccountState = {
    accounts: Account[];
    activeAccountId: string | null;

    // selectors/helpers
    getActive: () => Account | null;
    hasRole: (role: string) => boolean;
    isAdmin: () => boolean;
    isGroupAdmin: (groupId: string) => boolean;
    isGroupFinanceiro: (groupId: string) => boolean;

    // mutations
    upsertAccount: (acc: Account) => void;
    removeAccount: (userId: string) => void;
    setActiveAccount: (userId: string) => void;
    updateActive: (patch: Partial<Account>) => void;
    logoutActive: () => void;
    logout: () => void;
};

export const useAccountStore = create<AccountState>()(
    persist(
        (set, get) => ({
            accounts: [],
            activeAccountId: null,

            // ========================
            // SELECTORS
            // ========================

            getActive: () => {
                const { accounts, activeAccountId } = get();
                if (!activeAccountId) return null;
                return accounts.find((a) => a.userId === activeAccountId) ?? null;
            },

            hasRole: (role: string) => {
                const acc = get().getActive();
                if (!acc) return false;
                return acc.roles.includes(role);
            },

            isAdmin: () => {
                const acc = get().getActive();
                if (!acc) return false;
                return (
                    acc.roles.includes("Admin") ||
                    acc.roles.includes("GodMode")
                );
            },

            isGroupAdmin: (groupId: string) => {
                if (!groupId) return false;
                const acc = get().getActive();
                if (!acc) return false;
                if (acc.roles.includes("Admin") || acc.roles.includes("GodMode")) return true;
                return acc.groupAdminIds?.includes(groupId) ?? false;
            },

            isGroupFinanceiro: (groupId: string) => {
                if (!groupId) return false;
                const acc = get().getActive();
                if (!acc) return false;
                if (acc.roles.includes("GodMode")) return true;
                return acc.groupFinanceiroIds?.includes(groupId) ?? false;
            },

            // ========================
            // MUTATIONS
            // ========================

            upsertAccount: (acc) => {
                set((state) => {
                    const idx = state.accounts.findIndex((a) => a.userId === acc.userId);

                    const nextAccounts =
                        idx >= 0
                            ? state.accounts.map((a, i) =>
                                i === idx ? { ...a, ...acc } : a
                            )
                            : [...state.accounts, acc];

                    return {
                        accounts: nextAccounts,
                        activeAccountId: acc.userId, // conta recém logada vira ativa
                    };
                });
            },

            removeAccount: (userId) => {
                set((state) => {
                    const next = state.accounts.filter((a) => a.userId !== userId);

                    const nextActive =
                        state.activeAccountId === userId
                            ? next[0]?.userId ?? null
                            : state.activeAccountId;

                    return {
                        accounts: next,
                        activeAccountId: nextActive,
                    };
                });
            },

            setActiveAccount: (userId) => {
                set(() => ({ activeAccountId: userId }));
            },

            updateActive: (patch) => {
                set((state) => {
                    const id = state.activeAccountId;
                    if (!id) return state;

                    return {
                        accounts: state.accounts.map((a) =>
                            a.userId === id ? { ...a, ...patch } : a
                        ),
                    };
                });
            },

            logoutActive: () => {
                // Revoga o refresh token no backend antes de limpar o estado local.
                // Fire-and-forget: erros de rede não impedem o logout local.
                const active = get().getActive();
                if (active?.refreshToken) {
                    const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)
                        ?.trim()
                        ?.replace(/\/+$/, '') ?? '';
                    fetch(`${baseUrl}/api/Authentication/revoke`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken: active.refreshToken }),
                    }).catch(() => { /* fire-and-forget */ });
                }

                set((state) => {
                    const id = state.activeAccountId;
                    if (!id) return state;

                    const nextAccounts = state.accounts.filter((a) => a.userId !== id);

                    return {
                        accounts: nextAccounts,
                        activeAccountId: nextAccounts[0]?.userId ?? null,
                    };
                });
            },

            logout: () => get().logoutActive(),
        }),
        {
            name: "bratnava.accounts.v4",
            // localStorage: persiste entre abas e sessões do browser.
            // O refreshToken garante expiração controlada pelo backend.
            storage: createJSONStorage(() => localStorage),
        }
    )
);

// Export default para imports do tipo:
// import useAccountStore from ...
export default useAccountStore;
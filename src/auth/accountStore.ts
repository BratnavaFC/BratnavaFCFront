import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Account = {
    userId: string;                 // GUID do usuário (vem do JWT sub)
    name: string;
    email: string;
    roles: number[];                // 1=User, 2=Admin, 3=GodMode
    accessToken: string;
    refreshToken: string;
    activeGroupId?: string | null;  // group selecionado no app

    // ✅ ADICIONADO: perfil/jogador selecionado (por conveniência)
    activePlayerId?: string | null;
};

type AccountState = {
    accounts: Account[];
    activeAccountId: string | null;

    // selectors/helpers
    getActive: () => Account | null;

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

            getActive: () => {
                const { accounts, activeAccountId } = get();
                if (!activeAccountId) return null;
                return accounts.find((a) => a.userId === activeAccountId) ?? null;
            },

            upsertAccount: (acc) => {
                set((state) => {
                    const idx = state.accounts.findIndex((a) => a.userId === acc.userId);
                    const nextAccounts =
                        idx >= 0
                            ? state.accounts.map((a, i) => (i === idx ? { ...a, ...acc } : a))
                            : [...state.accounts, acc];

                    return {
                        accounts: nextAccounts,
                        activeAccountId: acc.userId, // quando loga/adiciona, vira ativa
                    };
                });
            },

            removeAccount: (userId) => {
                set((state) => {
                    const next = state.accounts.filter((a) => a.userId !== userId);
                    const nextActive =
                        state.activeAccountId === userId
                            ? (next[0]?.userId ?? null)
                            : state.activeAccountId;

                    return { accounts: next, activeAccountId: nextActive };
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
            name: "bratnava.accounts.v1",
        }
    )
);

// ✅ também exporta default pra cobrir imports do tipo: import useAccountStore from ...
export default useAccountStore;
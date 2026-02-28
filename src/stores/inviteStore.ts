import { create } from "zustand";

type InviteState = {
    pendingCount: number;
    setPendingCount: (count: number) => void;
};

export const useInviteStore = create<InviteState>((set) => ({
    pendingCount: 0,
    setPendingCount: (count) => set({ pendingCount: count }),
}));

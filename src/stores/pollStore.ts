import { create } from "zustand";

type PollState = {
    pendingPollsCount: number;
    setPendingPollsCount: (count: number) => void;
};

export const usePollStore = create<PollState>((set) => ({
    pendingPollsCount: 0,
    setPendingPollsCount: (count) => set({ pendingPollsCount: count }),
}));

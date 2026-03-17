import { create } from 'zustand';
import type { GroupIconConfig } from '../lib/groupIcons';

interface GroupIconsState {
    /** Cache: groupId → config */
    configs: Record<string, GroupIconConfig>;
    setConfig: (groupId: string, config: GroupIconConfig) => void;
    clearConfig: (groupId: string) => void;
}

export const useGroupIconsStore = create<GroupIconsState>((set) => ({
    configs: {},
    setConfig: (groupId, config) =>
        set((s) => ({ configs: { ...s.configs, [groupId]: config } })),
    clearConfig: (groupId) =>
        set((s) => {
            const next = { ...s.configs };
            delete next[groupId];
            return { configs: next };
        }),
}));

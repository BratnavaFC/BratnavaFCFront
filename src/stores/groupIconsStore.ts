import { create } from 'zustand';
import type { GroupIconConfig } from '../lib/groupIcons';

interface GroupIconsState {
    /** Cache: groupId → icon config */
    configs: Record<string, GroupIconConfig>;
    /** Cache: groupId → showPlayerStats */
    showPlayerStatsMap: Record<string, boolean>;
    setConfig: (groupId: string, config: GroupIconConfig) => void;
    setShowPlayerStats: (groupId: string, value: boolean) => void;
    clearConfig: (groupId: string) => void;
}

export const useGroupIconsStore = create<GroupIconsState>((set) => ({
    configs: {},
    showPlayerStatsMap: {},
    setConfig: (groupId, config) =>
        set((s) => ({ configs: { ...s.configs, [groupId]: config } })),
    setShowPlayerStats: (groupId, value) =>
        set((s) => ({ showPlayerStatsMap: { ...s.showPlayerStatsMap, [groupId]: value } })),
    clearConfig: (groupId) =>
        set((s) => {
            const nextConfigs = { ...s.configs };
            const nextStats   = { ...s.showPlayerStatsMap };
            delete nextConfigs[groupId];
            delete nextStats[groupId];
            return { configs: nextConfigs, showPlayerStatsMap: nextStats };
        }),
}));

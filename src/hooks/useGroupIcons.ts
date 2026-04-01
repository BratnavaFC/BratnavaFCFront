import { useEffect } from 'react';
import { GroupSettingsApi } from '../api/endpoints';
import type { GroupIconConfig } from '../lib/groupIcons';
import { DEFAULT_ICONS } from '../lib/groupIcons';
import { useGroupIconsStore } from '../stores/groupIconsStore';

/** Conjunto de requisições em andamento para evitar duplicatas */
const _pending = new Set<string>();

/**
 * Hook que retorna a config de ícones da patota.
 * Busca uma vez e armazena em cache global (Zustand).
 * Retorna DEFAULT_ICONS enquanto carrega ou se groupId for nulo.
 */
export function useGroupIcons(groupId?: string | null): GroupIconConfig {
    const { configs, setConfig, setShowPlayerStats } = useGroupIconsStore();
    const cached = groupId ? configs[groupId] : undefined;

    useEffect(() => {
        if (!groupId || cached || _pending.has(groupId)) return;

        _pending.add(groupId);
        GroupSettingsApi.get(groupId)
            .then((res) => {
                const gs = res.data.data as any;
                setConfig(groupId, {
                    goalIcon:       gs?.goalIcon       ?? null,
                    goalkeeperIcon: gs?.goalkeeperIcon ?? null,
                    assistIcon:     gs?.assistIcon     ?? null,
                    ownGoalIcon:    gs?.ownGoalIcon    ?? null,
                    mvpIcon:        gs?.mvpIcon        ?? null,
                    playerIcon:     gs?.playerIcon     ?? null,
                });
                setShowPlayerStats(groupId, gs?.showPlayerStats ?? false);
            })
            .catch(() => {
                // silencioso — vai usar defaults
                setConfig(groupId, {
                    goalIcon: null, goalkeeperIcon: null,
                    assistIcon: null, ownGoalIcon: null, mvpIcon: null, playerIcon: null,
                });
                setShowPlayerStats(groupId, false);
            })
            .finally(() => {
                _pending.delete(groupId);
            });
    }, [groupId, cached, setConfig, setShowPlayerStats]);

    return cached ?? DEFAULT_ICONS;
}

/**
 * Hook que retorna se a patota permite que jogadores comuns
 * vejam gols/assistências. Retorna false enquanto carrega.
 * Depende do useGroupIcons ter sido chamado para o mesmo groupId.
 */
export function useShowPlayerStats(groupId?: string | null): boolean {
    const { showPlayerStatsMap } = useGroupIconsStore();
    return groupId ? (showPlayerStatsMap[groupId] ?? false) : false;
}

/** Invalida o cache de ícones e showPlayerStats para um groupId (usar após salvar) */
export function invalidateGroupIcons(groupId: string) {
    useGroupIconsStore.getState().clearConfig(groupId);
}

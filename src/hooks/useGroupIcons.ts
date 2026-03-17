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
    const { configs, setConfig } = useGroupIconsStore();
    const cached = groupId ? configs[groupId] : undefined;

    useEffect(() => {
        if (!groupId || cached || _pending.has(groupId)) return;

        _pending.add(groupId);
        GroupSettingsApi.get(groupId)
            .then((res) => {
                const gs = res.data as any;
                setConfig(groupId, {
                    goalIcon:       gs?.goalIcon       ?? null,
                    goalkeeperIcon: gs?.goalkeeperIcon ?? null,
                    assistIcon:     gs?.assistIcon     ?? null,
                    ownGoalIcon:    gs?.ownGoalIcon    ?? null,
                    mvpIcon:        gs?.mvpIcon        ?? null,
                    playerIcon:     gs?.playerIcon     ?? null,
                });
            })
            .catch(() => {
                // silencioso — vai usar defaults
                setConfig(groupId, {
                    goalIcon: null, goalkeeperIcon: null,
                    assistIcon: null, ownGoalIcon: null, mvpIcon: null, playerIcon: null,
                });
            })
            .finally(() => {
                _pending.delete(groupId);
            });
    }, [groupId, cached, setConfig]);

    return cached ?? DEFAULT_ICONS;
}

/** Invalida o cache de ícones para um groupId (usar após salvar) */
export function invalidateGroupIcons(groupId: string) {
    useGroupIconsStore.getState().clearConfig(groupId);
}

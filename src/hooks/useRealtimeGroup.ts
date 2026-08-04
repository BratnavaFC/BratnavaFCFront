import { useEffect, useRef } from 'react';
import { subscribeToGroup, type RealtimeEvent } from '../realtime/realtimeConnection';
import { useAccountStore } from '../auth/accountStore';

export type { RealtimeEvent };

/**
 * Assina os eventos de um grupo.
 *
 * A assinatura desta função não mudou — os 5 call sites continuam iguais. O que mudou é que
 * ela não constrói mais um HubConnection próprio: agora assina na conexão compartilhada de
 * `realtime/realtimeConnection`. Antes, cada consumidor abria a sua, e cada conexão custava
 * uma query de autorização no `JoinGroup`.
 */
export function useRealtimeGroup(
    groupId: string | null | undefined,
    onEvent: (event: RealtimeEvent) => void | Promise<void>,
) {
    const handlerRef = useRef(onEvent);
    const token = useAccountStore(s => s.getActive()?.accessToken ?? null);

    useEffect(() => {
        handlerRef.current = onEvent;
    }, [onEvent]);

    useEffect(() => {
        if (!groupId || !token) return;

        // Delega para o ref para que trocar o callback não reassine o grupo — reassinar
        // dispararia LeaveGroup + JoinGroup, e JoinGroup custa uma query no banco.
        return subscribeToGroup(groupId, event => handlerRef.current(event));
    }, [groupId, token]);
}

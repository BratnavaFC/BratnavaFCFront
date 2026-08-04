import { useEffect, useRef } from 'react';
import {
    subscribeToConnected,
    subscribeToNotifications,
    type RealtimeNotification,
} from '../realtime/realtimeConnection';
import { useAccountStore } from '../auth/accountStore';

export type { RealtimeNotification };

/**
 * Assina o canal de notificações do próprio usuário.
 *
 * Diferente de `useRealtimeGroup`, não recebe groupId: o sininho existe em qualquer página,
 * inclusive sem grupo ativo, e a entrega é por usuário (`Clients.User` no servidor). É o que
 * permite trocar o polling de `unread-count` por push.
 *
 * @param onNotification chamado a cada notificação nova.
 * @param onConnected    chamado a cada conexão estabelecida, incluindo a primeira e as
 *                       reconexões. Use para ressincronizar a contagem — é a única leitura de
 *                       banco que sobra, e acontece por conexão, não por minuto.
 */
export function useRealtimeNotifications(
    onNotification: (event: RealtimeNotification) => void | Promise<void>,
    onConnected?: () => void | Promise<void>,
) {
    const notificationRef = useRef(onNotification);
    const connectedRef    = useRef(onConnected);
    const token = useAccountStore(s => s.getActive()?.accessToken ?? null);

    useEffect(() => {
        notificationRef.current = onNotification;
        connectedRef.current    = onConnected;
    }, [onNotification, onConnected]);

    useEffect(() => {
        if (!token) return;

        // Os refs evitam reassinar quando o componente re-renderiza com callbacks novos:
        // reassinar aqui derrubaria e recriaria a conexão compartilhada.
        const unsubscribeNotifications = subscribeToNotifications(
            event => notificationRef.current(event),
        );
        const unsubscribeConnected = subscribeToConnected(
            () => connectedRef.current?.(),
        );

        return () => {
            unsubscribeNotifications();
            unsubscribeConnected();
        };
    }, [token]);
}

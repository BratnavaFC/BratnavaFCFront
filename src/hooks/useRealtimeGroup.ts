import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { apiBaseUrl } from '../api/http';
import { useAccountStore } from '../auth/accountStore';

export type RealtimeEvent = {
    type: 'match.changed' | 'poll.changed' | 'group.changed' | string;
    groupId: string;
    matchId?: string | null;
    pollId?: string | null;
    reason: string;
    occurredAtUtc: string;
};

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
        if (!groupId || !token || !apiBaseUrl) return;

        let disposed = false;
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(`${apiBaseUrl}/hubs/realtime`, {
                accessTokenFactory: () => useAccountStore.getState().getActive()?.accessToken ?? token,
                withCredentials: false,
            })
            .withAutomaticReconnect()
            .build();

        const join = async () => {
            if (disposed || connection.state !== signalR.HubConnectionState.Connected) return;
            try {
                await connection.invoke('JoinGroup', groupId);
            } catch {
                // The REST API remains the source of truth if realtime is temporarily unavailable.
            }
        };

        connection.on('RealtimeEvent', (event: RealtimeEvent) => {
            if (event?.groupId?.toLowerCase() !== groupId.toLowerCase()) return;
            void handlerRef.current(event);
        });

        connection.onreconnected(() => {
            void join();
        });

        connection
            .start()
            .then(join)
            .catch(() => {
                // Silent by design: realtime should improve UX, not block normal usage.
            });

        return () => {
            disposed = true;
            void connection.stop();
        };
    }, [groupId, token]);
}

import * as signalR from '@microsoft/signalr';
import { apiBaseUrl } from '../api/http';
import { useAccountStore } from '../auth/accountStore';

/**
 * Conexão SignalR única do app.
 *
 * Antes, `useRealtimeGroup` construía um HubConnection dentro do próprio useEffect — então
 * cada consumidor abria a SUA conexão, e com MatchesPage + LinkedPollWidget montados juntos
 * eram duas ou três por aba. Isso custa caro no lugar errado: cada conexão que entra num
 * grupo dispara `RealtimeHub.CanAccessGroupAsync`, que faz um SELECT em Players para
 * autorizar. Três conexões = três queries de autorização em vez de uma.
 *
 * Aqui a conexão é uma só e multiplexa tudo — é para isso que um hub existe. Os `JoinGroup`
 * são contados por referência, então o grupo só é assinado quando aparece o primeiro
 * interessado e liberado quando sai o último.
 */

export type RealtimeEvent = {
    type: 'match.changed' | 'poll.changed' | 'group.changed' | string;
    groupId: string;
    matchId?: string | null;
    pollId?: string | null;
    reason: string;
    occurredAtUtc: string;
};

export type RealtimeNotification = {
    type: 'notification.created' | string;
    groupId: string | null;
    title: string;
    notificationType: string | null;
    occurredAtUtc: string;
};

type GroupHandler        = (event: RealtimeEvent) => void | Promise<void>;
type NotificationHandler = (event: RealtimeNotification) => void | Promise<void>;
type ConnectedHandler    = () => void | Promise<void>;

let connection: signalR.HubConnection | null = null;
let activeToken: string | null = null;
let startPromise: Promise<void> | null = null;

const groupHandlers        = new Map<string, Set<GroupHandler>>();
const notificationHandlers = new Set<NotificationHandler>();
const connectedHandlers    = new Set<ConnectedHandler>();

const isConnected = () =>
    connection?.state === signalR.HubConnectionState.Connected;

// ── Despacho ──────────────────────────────────────────────────────────────────

function dispatchGroupEvent(event: RealtimeEvent) {
    if (!event?.groupId) return;

    // O filtro por grupo vive aqui, não no consumidor: uma conexão só recebe eventos de
    // todos os grupos assinados, e cada assinante só quer o seu.
    const handlers = groupHandlers.get(event.groupId.toLowerCase());
    handlers?.forEach(handler => void handler(event));
}

function dispatchNotification(event: RealtimeNotification) {
    notificationHandlers.forEach(handler => void handler(event));
}

function notifyConnected() {
    connectedHandlers.forEach(handler => void handler());
}

// ── Ciclo de vida ─────────────────────────────────────────────────────────────

async function joinGroup(groupId: string) {
    if (!isConnected()) return;
    try {
        await connection!.invoke('JoinGroup', groupId);
    } catch {
        // A API REST continua sendo a fonte de verdade se o realtime falhar.
    }
}

async function leaveGroup(groupId: string) {
    if (!isConnected()) return;
    try {
        await connection!.invoke('LeaveGroup', groupId);
    } catch {
        // Idem: sair do canal é otimização, não correção.
    }
}

async function onReconnected() {
    // Reentrar nos grupos ANTES de avisar os assinantes: quem escuta `connected` costuma
    // refazer fetch, e queremos que já esteja recebendo eventos quando isso acontecer.
    await Promise.all([...groupHandlers.keys()].map(joinGroup));
    notifyConnected();
}

function buildConnection(token: string) {
    const built = new signalR.HubConnectionBuilder()
        .withUrl(`${apiBaseUrl}/hubs/realtime`, {
            accessTokenFactory: () => useAccountStore.getState().getActive()?.accessToken ?? token,
            withCredentials: false,
        })
        .withAutomaticReconnect()
        .build();

    built.on('RealtimeEvent', dispatchGroupEvent);
    built.on('NotificationEvent', dispatchNotification);
    built.onreconnected(() => { void onReconnected(); });

    return built;
}

function teardown() {
    const stopping = connection;
    connection = null;
    activeToken = null;
    startPromise = null;
    void stopping?.stop();
}

/**
 * Garante uma conexão iniciada. Idempotente: chamadas concorrentes compartilham a mesma
 * promessa de start, senão dois consumidores montando no mesmo tick abririam duas conexões —
 * exatamente o problema que este módulo existe para resolver.
 */
function ensureStarted(): Promise<void> {
    const token = useAccountStore.getState().getActive()?.accessToken ?? null;
    if (!token || !apiBaseUrl) return Promise.resolve();

    // Troca de conta/token: a conexão antiga carrega credencial de outro usuário.
    if (connection && activeToken !== token) teardown();

    if (!connection) {
        activeToken = token;
        connection = buildConnection(token);
    }

    if (isConnected()) return Promise.resolve();

    startPromise ??= connection
        .start()
        .then(async () => {
            await Promise.all([...groupHandlers.keys()].map(joinGroup));
            notifyConnected();
        })
        .catch(() => {
            // Silencioso por desenho: realtime melhora a UX, não bloqueia o uso normal.
            startPromise = null;
        });

    return startPromise;
}

/** Encerra a conexão quando não sobrou ninguém interessado. */
function stopIfIdle() {
    if (groupHandlers.size === 0 && notificationHandlers.size === 0 && connectedHandlers.size === 0)
        teardown();
}

// ── API pública ───────────────────────────────────────────────────────────────

export function subscribeToGroup(groupId: string, handler: GroupHandler): () => void {
    const key = groupId.toLowerCase();
    const existing = groupHandlers.get(key);

    if (existing) {
        existing.add(handler);
        void ensureStarted();
    } else {
        groupHandlers.set(key, new Set([handler]));
        void ensureStarted().then(() => joinGroup(groupId));
    }

    return () => unsubscribeFromGroup(key, handler);
}

function unsubscribeFromGroup(key: string, handler: GroupHandler) {
    const handlers = groupHandlers.get(key);
    if (!handlers) return;

    handlers.delete(handler);
    if (handlers.size > 0) return;

    groupHandlers.delete(key);
    void leaveGroup(key);
    stopIfIdle();
}

export function subscribeToNotifications(handler: NotificationHandler): () => void {
    notificationHandlers.add(handler);
    void ensureStarted();

    return () => {
        notificationHandlers.delete(handler);
        stopIfIdle();
    };
}

/**
 * Dispara após cada conexão bem-sucedida, incluindo a primeira e cada reconexão. É o gancho
 * para quem precisa ressincronizar estado que pode ter mudado enquanto estava offline.
 *
 * Se a conexão já estiver de pé quando o assinante chega, dispara na hora — senão um
 * componente montado depois do start nunca receberia o sinal e ficaria sem sincronizar.
 */
export function subscribeToConnected(handler: ConnectedHandler): () => void {
    connectedHandlers.add(handler);

    if (isConnected()) void handler();
    else void ensureStarted();

    return () => {
        connectedHandlers.delete(handler);
        stopIfIdle();
    };
}

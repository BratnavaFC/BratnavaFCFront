/**
 * Computa a rota interna do site para um tipo de notificação.
 *
 * @param type  campo `type` da notificação (ex: "match_invite_reminder")
 * @param data  IDs extraídos do dataJson (matchId, groupId, pollId…)
 * @returns     path do React Router (ex: "/app/history/xxx/yyy")
 */
export function notificationRoute(
    type: string | null,
    data: Record<string, string | undefined> = {}
): string {
    if (!type) return '/app';

    const { matchId, groupId } = data;

    switch (type) {
        // ── Partidas ──────────────────────────────────────────────────────
        case 'match_invite':
        case 'match_invite_reminder':
        case 'match_started':
        case 'teams_assigned':
        case 'match_ended':
        case 'match_no_quorum':
        case 'mvp_voting_reminder':
        case 'attendance_accepted':
        case 'attendance_rejected':
            return '/app/matches';

        case 'match_finalized':
        case 'match_mvp':
            if (groupId && matchId) return `/app/history/${groupId}/${matchId}`;
            return '/app/history';

        // ── Votações ──────────────────────────────────────────────────────
        case 'poll_created':
        case 'poll_closed':
        case 'poll_reminder':
        case 'poll_deadline_changed':
            return '/app/polls';

        // ── Calendário ────────────────────────────────────────────────────
        case 'event_created':
        case 'event_deleted':
        case 'event_reminder':
            return '/app/calendar';

        // ── Financeiro ────────────────────────────────────────────────────
        case 'payment_pending':
        case 'payment_confirmed':
        case 'monthly_payment_reminder':
        case 'extra_charge_discount':
            return '/app/payments';

        // ── Grupo / membros ───────────────────────────────────────────────
        case 'group_invite':
        case 'player_left':
        case 'player_removed':
        case 'player_removed_self':
        case 'promoted_admin':
        case 'promoted_financeiro':
            return '/app/groups';

        // ── Apostas ───────────────────────────────────────────────────────
        case 'bet_resolved':
        case 'bet_created':
            return '/app/bet';

        // ── Outros ────────────────────────────────────────────────────────
        case 'birthday':
            return '/app/birthday-status';

        default:
            return '/app';
    }
}

/** Faz parse seguro de uma string JSON de IDs de notificação. */
export function parseNotifData(dataJson: string | null): Record<string, string | undefined> {
    if (!dataJson) return {};
    try {
        return JSON.parse(dataJson) as Record<string, string | undefined>;
    } catch {
        return {};
    }
}

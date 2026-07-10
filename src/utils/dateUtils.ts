/**
 * Interpreta a data como horario literal da partida, sem conversao por fuso.
 *
 * @example
 * toUtcDate("2025-05-15T21:00:00")   // interpreta como 21:00
 * toUtcDate("2025-05-15T21:00:00Z")  // tambem interpreta como 21:00
 */
export function toUtcDate(iso: string): Date {
    if (!iso) return new Date(NaN);
    return new Date(stripTimezone(iso));
}

/**
 * Formata uma data ISO em objeto com componentes legiveis em pt-BR.
 */
export function formatUtcDate(iso?: string | null) {
    if (!iso) return null;
    const d = toUtcDate(iso);
    if (Number.isNaN(d.getTime())) return null;
    return {
        day:   d.toLocaleDateString('pt-BR', { day: '2-digit' }),
        month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        time:  d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        full:  d.toLocaleString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }),
        short: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    };
}

export function stripTimezone(iso: string): string {
    return iso
        .replace(/Z$/i, '')
        .replace(/([+-]\d{2}:\d{2})$/, '');
}

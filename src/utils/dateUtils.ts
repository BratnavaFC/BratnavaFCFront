/**
 * Garante que uma string ISO seja interpretada como UTC.
 * Se a string não tiver sufixo de offset (Z ou +HH:MM), adiciona 'Z'.
 *
 * Motivação: `new Date("2025-05-15T21:00:00")` sem offset é interpretado
 * como horário LOCAL pelo browser. Para datas vindas do backend (UTC),
 * isso causa exibição errada para usuários em fusos diferentes de UTC.
 *
 * @example
 * toUtcDate("2025-05-15T21:00:00")   // → interpreta como 21:00 UTC
 * toUtcDate("2025-05-15T21:00:00Z")  // → igual, Z já presente
 */
export function toUtcDate(iso: string): Date {
    if (!iso) return new Date(NaN);
    return new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
}

/**
 * Formata uma data ISO (UTC) em objeto com componentes legíveis em pt-BR.
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

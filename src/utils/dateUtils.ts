/**
 * Interpreta datas de partida preservando o horario esperado no Brasil.
 *
 * Valores novos chegam sem timezone e devem ser exibidos literalmente.
 * Valores antigos podem chegar com Z/offset e representam UTC; nesses casos,
 * convertemos para o horario de Sao Paulo antes de montar o Date local.
 * Alguns registros antigos ja chegam sem Z, mas gravados como 00:00 UTC;
 * esses tambem sao tratados como legado para preservar a exibicao anterior.
 *
 * @example
 * toUtcDate("2025-05-15T21:00:00")   // interpreta como 21:00
 * toUtcDate("2025-05-16T00:00:00Z")  // interpreta como 21:00 em Sao Paulo
 */
export function toUtcDate(iso: string): Date {
    if (!iso) return new Date(NaN);
    if (hasTimezone(iso)) return toSaoPauloWallDate(iso);
    if (isLegacyMidnightUtc(iso)) return toSaoPauloWallDate(`${iso}Z`);
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

function hasTimezone(iso: string): boolean {
    return /Z$/i.test(iso) || /([+-]\d{2}:\d{2})$/.test(iso);
}

function isLegacyMidnightUtc(iso: string): boolean {
    return /T00:00(?::00(?:\.000)?)?$/.test(iso);
}

function toSaoPauloWallDate(iso: string): Date {
    const instant = new Date(iso);
    if (Number.isNaN(instant.getTime())) return instant;

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(instant);

    const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
    return new Date(
        get('year'),
        get('month') - 1,
        get('day'),
        get('hour'),
        get('minute'),
        get('second'),
    );
}

/**
 * Verifica se o prazo de uma enquete já passou.
 *
 * Usa offset explícito -03:00 (Brasília, UTC-3 fixo desde 2019) para garantir
 * que o prazo seja interpretado igual para todos os usuários,
 * independente do fuso horário do browser.
 *
 * @param deadlineDate  - Data no formato "YYYY-MM-DD"
 * @param deadlineTime  - Hora no formato "HH:MM" (padrão: "23:59")
 */
export function isDeadlinePassed(
    deadlineDate?: string | null,
    deadlineTime?: string | null,
): boolean {
    if (!deadlineDate) return false;
    const timeStr = deadlineTime ?? '23:59';
    const deadline = new Date(`${deadlineDate}T${timeStr}:00-03:00`);
    return Date.now() > deadline.getTime();
}

/**
 * Formata a data e hora de um prazo em string legível (pt-BR).
 */
export function formatDeadline(
    deadlineDate?: string | null,
    deadlineTime?: string | null,
): string | null {
    if (!deadlineDate) return null;
    const [y, m, d] = deadlineDate.split('-');
    const dateStr = `${d}/${m}/${y}`;
    return deadlineTime ? `${dateStr} às ${deadlineTime}` : dateStr;
}

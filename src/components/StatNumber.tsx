/**
 * StatNumber — renderiza um número APENAS via CSS (::before com content: attr).
 *
 * Por que isso ajuda:
 *  - O valor está no atributo data-n, não como nó de texto no DOM
 *  - Ctrl+U (ver source): mostra data-n="3" mas não o texto "3" como conteúdo
 *  - Selecionar e copiar: retorna string vazia (não há texto copiável)
 *  - Scraping de DOM (querySelector + textContent): retorna ""
 *  - Screenshot: continua aparecendo normalmente (CSS é renderizado)
 *  - aria-label garante que leitores de tela reais funcionem
 */
export default function StatNumber({
    value,
    className = "",
}: {
    value: number | string;
    className?: string;
}) {
    return (
        <span
            data-n={String(value)}
            aria-label={String(value)}
            className={`stat-num ${className}`}
        />
    );
}

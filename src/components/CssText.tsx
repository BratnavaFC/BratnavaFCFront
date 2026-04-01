/**
 * CssText — renderiza qualquer string APENAS via CSS (::before com content: attr).
 *
 * - Selecionar e copiar → retorna vazio
 * - Ctrl+U → mostra data-txt="..." no atributo, mas sem nó de texto copiável
 * - textContent via JS → ""
 * - Screenshot → aparece normalmente
 * - aria-label preserva acessibilidade
 */
export default function CssText({
    value,
    className = "",
}: {
    value: string;
    className?: string;
}) {
    return (
        <span
            data-txt={value}
            aria-label={value}
            className={`css-txt ${className}`}
        />
    );
}

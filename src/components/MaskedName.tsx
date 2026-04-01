/**
 * MaskedName — oculta o nome por padrão e revela no hover (desktop).
 *
 * Estado padrão (e em screenshots):  ● ● ●
 * Hover no desktop:                  João Silva  ← via CSS, não copiável
 * Mobile (sem hover):                ● ● ●  (sempre mascarado)
 *
 * Por que funciona contra IA:
 *  - Screenshot estático captura "● ● ●" — a IA não tem o nome
 *  - Mesmo com hover a tela toda fica visível, mas o watermark identifica quem tirou
 *  - O nome revelado ainda usa CssText (sem texto no DOM): copy-paste → vazio
 */

interface Props {
    value: string;
    className?: string;
    /** Quantos pontos mostrar como placeholder. Padrão: 3 */
    dots?: number;
}

export default function MaskedName({ value, className = "", dots = 3 }: Props) {
    const placeholder = Array(dots).fill("●").join(" ");

    return (
        <span className={`relative inline-flex items-center ${className}`}>
            {/* Placeholder visível por padrão; some no hover */}
            <span
                aria-hidden="true"
                className="
                    tracking-widest text-slate-300 dark:text-slate-600
                    group-hover/goal:opacity-0
                    transition-opacity duration-150
                "
            >
                {placeholder}
            </span>

            {/* Nome real: aparece no hover via CSS, NÃO como texto no DOM */}
            <span
                data-txt={value}
                aria-label={value}
                className="
                    css-txt
                    absolute inset-0
                    opacity-0
                    group-hover/goal:opacity-100
                    transition-opacity duration-150
                    whitespace-nowrap
                "
            />
        </span>
    );
}

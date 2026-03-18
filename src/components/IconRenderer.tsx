/**
 * IconRenderer
 *
 * Renderiza um ícone a partir de um valor de string:
 *   - "lucide:Trophy"  → componente Lucide dinâmico
 *   - "letter:G"       → texto em negrito estilizado
 *   - "⚽"             → span com o emoji
 *
 * Usado em toda a aplicação para exibir ícones configuráveis por patota.
 */

import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

interface IconRendererProps {
    /** Valor vindo do banco: "⚽" | "lucide:Trophy" | "letter:G" etc. */
    value: string;
    /** Tamanho do ícone Lucide (px) — também base para letter. Default 16 */
    size?: number;
    /** Classe extra para o wrapper span (emoji) ou o ícone Lucide */
    className?: string;
    /** Props extras para ícones Lucide (color, strokeWidth…) */
    lucideProps?: Omit<LucideProps, 'size'>;
}

export function IconRenderer({ value, size = 16, className, lucideProps }: IconRendererProps) {
    // ── Ícone Lucide ─────────────────────────────────────────────────────────
    if (value.startsWith('lucide:')) {
        const name = value.slice(7) as keyof typeof LucideIcons;
        const LucideIcon = LucideIcons[name] as React.ComponentType<LucideProps> | undefined;
        if (LucideIcon) {
            return <LucideIcon size={size} className={className} {...lucideProps} />;
        }
        return <span className={className} title={value}>?</span>;
    }

    // ── Texto / letra estilizada ──────────────────────────────────────────────
    if (value.startsWith('letter:')) {
        const text = value.slice(7);
        // escala a fonte: texto longo fica menor proporcionalmente
        const scale = text.length <= 2 ? 0.85 : text.length === 3 ? 0.72 : 0.60;
        const fontSize = Math.round(size * scale);
        return (
            <span
                className={className}
                aria-label={text}
                style={{
                    fontWeight: 800,
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: `${fontSize}px`,
                    lineHeight: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    letterSpacing: '-0.04em',
                }}
            >
                {text}
            </span>
        );
    }

    // ── Emoji / caractere ────────────────────────────────────────────────────
    return <span className={className} aria-label={value}>{value}</span>;
}

// ─── Re-export conveniente ────────────────────────────────────────────────────

export default IconRenderer;

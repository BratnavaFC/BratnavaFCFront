/**
 * IconRenderer
 *
 * Renderiza um ícone a partir de um valor de string:
 *   - "lucide:Trophy"  → componente Lucide dinâmico
 *   - "⚽"             → span com o emoji
 *
 * Usado em toda a aplicação para exibir ícones configuráveis por patota.
 */

import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

interface IconRendererProps {
    /** Valor vindo do banco: "⚽" | "lucide:Trophy" etc. */
    value: string;
    /** Tamanho do ícone Lucide (px) — ignorado para emoji. Default 16 */
    size?: number;
    /** Classe extra para o wrapper span (emoji) ou o ícone Lucide */
    className?: string;
    /** Props extras para ícones Lucide (color, strokeWidth…) */
    lucideProps?: Omit<LucideProps, 'size'>;
}

export function IconRenderer({ value, size = 16, className, lucideProps }: IconRendererProps) {
    if (value.startsWith('lucide:')) {
        const name = value.slice(7) as keyof typeof LucideIcons;
        const LucideIcon = LucideIcons[name] as React.ComponentType<LucideProps> | undefined;
        if (LucideIcon) {
            return <LucideIcon size={size} className={className} {...lucideProps} />;
        }
        // fallback se o nome não existir
        return <span className={className} title={value}>?</span>;
    }

    return <span className={className} aria-label={value}>{value}</span>;
}

// ─── Re-export conveniente ────────────────────────────────────────────────────

export default IconRenderer;

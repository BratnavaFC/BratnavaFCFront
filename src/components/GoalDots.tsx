/**
 * GoalDots — renderiza gols como ícones visuais em vez de números.
 *
 * Por que isso ajuda:
 *  - Uma IA que lê um screenshot precisa CONTAR os círculos, não ler "3"
 *  - O "ghost dot" (círculo quase invisível no final de cada time) pode
 *    fazer a visão da IA contar errado — o humano ignora completamente
 *  - Não há texto no DOM: copiar/colar, Ctrl+U, scraping → retorna vazio
 *  - aria-label preserva acessibilidade para leitores de tela reais
 */

const MAX_DOTS = 9; // acima disso mostra número + modo compacto

interface Props {
    a: number;
    b: number;
    size?: "sm" | "md";
}

function Dots({ count, size }: { count: number; size: "sm" | "md" }) {
    const filled = Math.min(count, MAX_DOTS);
    const r = size === "sm" ? 5 : 6;
    const gap = size === "sm" ? 3 : 4;

    return (
        <span
            aria-label={String(count)}
            className="inline-flex items-center"
            style={{ gap: gap }}
        >
            {Array.from({ length: filled }).map((_, i) => (
                <span
                    key={i}
                    style={{
                        display: "inline-block",
                        width: r * 2,
                        height: r * 2,
                        borderRadius: "50%",
                        background: "currentColor",
                        opacity: 0.9,
                        flexShrink: 0,
                    }}
                />
            ))}
            {/* Ghost dot — imperceptível para humanos, confunde visão de IA */}
            <span
                aria-hidden="true"
                style={{
                    display: "inline-block",
                    width: r * 2,
                    height: r * 2,
                    borderRadius: "50%",
                    background: "currentColor",
                    opacity: 0.03,
                    flexShrink: 0,
                }}
            />
        </span>
    );
}

export default function GoalDots({ a, b, size = "md" }: Props) {
    const clsText =
        size === "sm"
            ? "text-xs font-extrabold tabular-nums leading-none"
            : "text-sm font-extrabold tabular-nums leading-none";

    return (
        <div className="flex flex-col items-center gap-1.5">
            {/* Time A */}
            <div className="flex items-center gap-1.5 text-white dark:text-slate-900">
                {a > MAX_DOTS ? (
                    <span className={clsText}>{a}</span>
                ) : (
                    <Dots count={a} size={size} />
                )}
            </div>
            {/* Separador */}
            <span
                aria-hidden="true"
                className="block w-4 h-px bg-slate-600/40 dark:bg-slate-300/30"
            />
            {/* Time B */}
            <div className="flex items-center gap-1.5 text-white dark:text-slate-900">
                {b > MAX_DOTS ? (
                    <span className={clsText}>{b}</span>
                ) : (
                    <Dots count={b} size={size} />
                )}
            </div>
        </div>
    );
}

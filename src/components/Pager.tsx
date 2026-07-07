import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

/**
 * Tamanho de página persistido no navegador (localStorage).
 * Default 5 quando não há nada salvo.
 */
export function usePageSize(storageKey: string, defaultSize = 5) {
    const [pageSize, setPageSizeState] = useState<number>(() => {
        const n = parseInt(localStorage.getItem(storageKey) ?? "", 10);
        return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : defaultSize;
    });
    const setPageSize = (n: number) => {
        setPageSizeState(n);
        localStorage.setItem(storageKey, String(n));
    };
    return [pageSize, setPageSize] as const;
}

/** Seletor "Por página" (compacto, para cabeçalhos). */
export function PageSizeSelect({ pageSize, loading, onChange, label = "Por página" }: {
    pageSize: number;
    loading?: boolean;
    onChange: (size: number) => void;
    label?: string;
}) {
    return (
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="hidden sm:inline">{label}</span>
            <select
                value={pageSize}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={loading}
                className="bg-transparent font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer disabled:opacity-50 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 px-1 py-0.5"
            >
                {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n} className="bg-white dark:bg-slate-800">{n}</option>
                ))}
            </select>
        </label>
    );
}

/** Navegação Anterior / Pág X de Y / Próxima — ocupa toda a largura do container. */
export function PagerNav({ page, pageSize, total, loading, onPageChange, className }: {
    page: number;
    pageSize: number;
    total: number;
    loading?: boolean;
    onPageChange: (p: number) => void;
    className?: string;
}) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return (
        <div className={className ?? "flex items-center justify-between gap-2"}>
            <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <ChevronLeft size={14} /> Anterior
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Pág. <span className="font-semibold text-slate-800 dark:text-slate-100">{page}</span> de{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">{totalPages}</span>
            </span>
            <button
                type="button"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                Próxima <ChevronRight size={14} />
            </button>
        </div>
    );
}

/**
 * Paginação página-a-página (seletor + Anterior/Próxima em uma linha).
 * Some quando não há itens. Usado onde o layout de uma linha basta (ex.: BETs).
 */
export default function Pager({
    page, pageSize, total, loading,
    onPageChange, onPageSizeChange,
}: {
    page: number;
    pageSize: number;
    total: number;
    loading?: boolean;
    onPageChange: (p: number) => void;
    onPageSizeChange: (size: number) => void;
}) {
    if (total === 0) return null;
    return (
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                <PageSizeSelect pageSize={pageSize} loading={loading} onChange={onPageSizeChange} />
            </div>
            <PagerNav page={page} pageSize={pageSize} total={total} loading={loading} onPageChange={onPageChange} />
        </div>
    );
}

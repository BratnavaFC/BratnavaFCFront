import { Loader2 } from 'lucide-react';

export type { PagedResult } from '../api/paged';

interface LoadMoreButtonProps {
    /** Quantos itens já estão carregados. */
    loaded: number;
    /** Total informado pelo backend. */
    total: number;
    loading: boolean;
    onClick(): void;
    className?: string;
}

/** Botão "Carregar mais (N restantes)" — some quando tudo já foi carregado. */
export default function LoadMoreButton({ loaded, total, loading, onClick, className }: LoadMoreButtonProps) {
    if (loaded >= total) return null;
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={
                className ??
                'w-full flex items-center justify-center gap-2 py-2.5 text-xs text-sky-600 dark:text-sky-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 transition disabled:opacity-50'
            }
        >
            {loading
                ? <><Loader2 size={12} className="animate-spin" /> Carregando...</>
                : `Carregar mais (${total - loaded} restante${total - loaded !== 1 ? 's' : ''})`}
        </button>
    );
}

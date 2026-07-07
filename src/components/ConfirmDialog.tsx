import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import ModalBackdrop from './modals/ModalBackdrop';

export interface ConfirmOptions {
    title?: string;
    message: string;
    /** Texto do botão de confirmação (default "Confirmar"). */
    confirmLabel?: string;
    /** Estilo destrutivo (vermelho) — use para exclusões/limpezas. */
    danger?: boolean;
}

/**
 * Hook de confirmação padronizado — substitui window.confirm.
 *
 * ```tsx
 * const { confirm, confirmDialog } = useConfirm();
 * ...
 * if (!(await confirm({ message: 'Excluir este item?', danger: true }))) return;
 * ...
 * return (<div>... {confirmDialog}</div>);
 * ```
 */
export function useConfirm() {
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const resolverRef = useRef<((ok: boolean) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmOptions) => {
        setOptions(opts);
        return new Promise<boolean>(resolve => { resolverRef.current = resolve; });
    }, []);

    const close = useCallback((ok: boolean) => {
        resolverRef.current?.(ok);
        resolverRef.current = null;
        setOptions(null);
    }, []);

    const confirmDialog: ReactNode = options ? (
        <ModalBackdrop onClose={() => close(false)}>
            <div className="relative w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl p-5">
                <div className="flex items-start gap-3">
                    <div className={[
                        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                        options.danger
                            ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
                    ].join(' ')}>
                        {options.danger ? <AlertTriangle size={18} /> : <HelpCircle size={18} />}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        {options.title && (
                            <h2 className="font-semibold text-sm text-slate-900 dark:text-white mb-1">{options.title}</h2>
                        )}
                        <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{options.message}</p>
                    </div>
                </div>
                <div className="flex gap-2 mt-5">
                    <button
                        type="button"
                        onClick={() => close(false)}
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        autoFocus
                        onClick={() => close(true)}
                        className={[
                            'flex-1 rounded-xl py-2 text-sm font-semibold text-white transition',
                            options.danger
                                ? 'bg-rose-600 hover:bg-rose-500'
                                : 'bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200',
                        ].join(' ')}
                    >
                        {options.confirmLabel ?? 'Confirmar'}
                    </button>
                </div>
            </div>
        </ModalBackdrop>
    ) : null;

    return { confirm, confirmDialog };
}

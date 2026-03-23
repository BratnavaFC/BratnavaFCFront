/**
 * IconPicker
 *
 * Grade de seleção de ícones para uma categoria.
 * Exibe todos os ícones disponíveis; o selecionado fica destacado.
 */

import { IconRenderer } from './IconRenderer';
import type { IconOption } from '../lib/groupIcons';

interface IconPickerProps {
    options: IconOption[];
    value: string | null;
    onChange: (value: string) => void;
}

export function IconPicker({ options, value, onChange }: IconPickerProps) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map((opt) => {
                const selected = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        title={opt.label}
                        aria-label={opt.label}
                        aria-pressed={selected}
                        onClick={() => onChange(opt.value)}
                        className={[
                            'flex items-center justify-center w-10 h-10 rounded-xl border text-lg transition-all',
                            selected
                                ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-300 shadow-sm scale-110'
                                : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-violet-500 dark:hover:bg-violet-900/20',
                        ].join(' ')}
                    >
                        <IconRenderer value={opt.value} size={18} />
                    </button>
                );
            })}
        </div>
    );
}

export default IconPicker;

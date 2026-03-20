import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PaymentsApi } from "../../api/endpoints";

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

interface MonthlyCell {
    month: number; status: number; amount: number; discount: number;
    discountReason?: string; paidAt?: string; hasProof: boolean; proofFileName?: string;
}
interface PlayerRow  { playerId: string; playerName: string; months: MonthlyCell[]; }

function fileToBase64(file: File): Promise<string> {
    return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res((reader.result as string).split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });
}

interface MonthlyModalProps {
    open: boolean;
    groupId: string; row: PlayerRow; month: number; isAdmin: boolean;
    onClose(): void; onSaved(): void;
}

function MonthlyPaymentModal({ open, groupId, row, month, isAdmin, onClose, onSaved }: MonthlyModalProps) {
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    if (!open) return null;

    const cell   = (row.months ?? []).find(c => c.month === month);
    const isPaid = cell?.status === 1;
    const [discount, setDiscount]   = useState(String(cell?.discount ?? 0));
    const [discReason, setDiscReason] = useState(cell?.discountReason ?? '');
    const [file, setFile]           = useState<File | null>(null);
    const [saving, setSaving]       = useState(false);

    async function submit(status: 0 | 1) {
        setSaving(true);
        try {
            let proofBase64: string | undefined;
            let proofFileName: string | undefined;
            let proofMimeType: string | undefined;
            if (file) {
                proofBase64   = await fileToBase64(file);
                proofFileName = file.name;
                proofMimeType = file.type;
            }
            await PaymentsApi.upsertMonthly(groupId, {
                playerId: row.playerId,
                year: new Date().getFullYear(),
                month,
                status,
                discount: isAdmin ? parseFloat(discount) || 0 : undefined,
                discountReason: isAdmin ? discReason || undefined : undefined,
                proofBase64, proofFileName, proofMimeType,
            });
            toast.success(status === 1 ? 'Marcado como pago!' : 'Marcado como pendente');
            onSaved();
            onClose();
        } catch { toast.error('Erro ao salvar pagamento'); }
        finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {row.playerName} — {MONTHS[month-1]}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                    Valor: <span className="font-semibold">R$ {(cell?.amount ?? 0).toFixed(2)}</span>
                    {(cell?.discount ?? 0) > 0 && <> · Desconto: <span className="text-green-600 font-semibold">R$ {cell!.discount.toFixed(2)}</span></>}
                </p>

                {isAdmin && (
                    <div className="space-y-3 mb-4">
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Desconto (R$)</label>
                            <input type="number" min="0" step="0.01"
                                value={discount} onChange={e => setDiscount(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Motivo do desconto</label>
                            <input type="text" value={discReason} onChange={e => setDiscReason(e.target.value)}
                                placeholder="Opcional"
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                        </div>
                    </div>
                )}

                <div className="mb-5">
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                        Comprovante {isAdmin ? '(opcional)' : '(opcional)'}
                    </label>
                    <input type="file" accept="image/*,application/pdf"
                        onChange={e => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                    {cell?.hasProof && <p className="text-xs text-slate-400 mt-1">Comprovante já enviado: {cell.proofFileName}</p>}
                </div>

                <div className="flex gap-2">
                    {!isPaid && (
                        <button onClick={() => submit(1)} disabled={saving}
                            className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
                            Marcar como pago
                        </button>
                    )}
                    {isPaid && isAdmin && (
                        <button onClick={() => submit(0)} disabled={saving}
                            className="flex-1 bg-rose-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin"/> : <XCircle size={14}/>}
                            Marcar pendente
                        </button>
                    )}
                    {!isPaid && isAdmin && (
                        <button onClick={() => submit(0)} disabled={saving}
                            className="flex-1 border border-slate-200 text-slate-700 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
                            Só salvar desconto
                        </button>
                    )}
                    <button onClick={onClose}
                        className="px-4 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default MonthlyPaymentModal;

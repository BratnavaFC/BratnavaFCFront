import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PaymentsApi } from "../../api/endpoints";
import { getResponseMessage } from "../../api/apiResponse";

interface ExtraChargePayment {
    playerId: string; playerName: string; amount: number; discount: number;
    finalAmount: number; discountReason?: string; status: number;
    paidAt?: string; hasProof: boolean; proofFileName?: string;
}
interface ExtraCharge {
    id: string; name: string; description?: string; amount: number;
    dueDate?: string; createdAt: string; isCancelled: boolean;
    payments: ExtraChargePayment[];
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res((reader.result as string).split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });
}

interface ExtraPaymentModalProps {
    open: boolean;
    groupId: string; charge: ExtraCharge; payment: ExtraChargePayment;
    isAdmin: boolean; onClose(): void; onSaved(): void;
}

function ExtraPaymentModal({ open, groupId, charge, payment, isAdmin, onClose, onSaved }: ExtraPaymentModalProps) {
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    if (!open) return null;

    const isPaid = payment.status === 1;
    const [discount, setDiscount]     = useState(String(payment.discount ?? 0));
    const [discReason, setDiscReason] = useState(payment.discountReason ?? '');
    const [file, setFile]             = useState<File | null>(null);
    const [saving, setSaving]         = useState(false);

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
            const res = await PaymentsApi.upsertExtraChargePayment(groupId, charge.id, payment.playerId, {
                status,
                discount: isAdmin ? parseFloat(discount) || 0 : undefined,
                discountReason: isAdmin ? discReason || undefined : undefined,
                proofBase64, proofFileName, proofMimeType,
            });
            if (res.data.message) toast.success(res.data.message);
            onSaved(); onClose();
        } catch (e) { toast.error(getResponseMessage(e, 'Erro ao salvar pagamento')); }
        finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-none dark:ring-1 dark:ring-slate-700 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{payment.playerName}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {charge.name} · R$ {payment.amount.toFixed(2)}
                    {payment.discount > 0 && <> · Desconto: <span className="text-green-600 font-semibold">R$ {payment.discount.toFixed(2)}</span></>}
                </p>

                {isAdmin && (
                    <div className="space-y-3 mb-4">
                        <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Desconto (R$)</label>
                            <input type="number" min="0" step="0.01"
                                value={discount} onChange={e => setDiscount(e.target.value)}
                                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Motivo do desconto</label>
                            <input type="text" value={discReason} onChange={e => setDiscReason(e.target.value)} placeholder="Opcional"
                                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" />
                        </div>
                    </div>
                )}

                <div className="mb-5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Comprovante (opcional)</label>
                    <input type="file" accept="image/*,application/pdf"
                        onChange={e => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-700 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-600" />
                    {payment.hasProof && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Já enviado: {payment.proofFileName}</p>}
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
                            className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50">
                            Só desconto
                        </button>
                    )}
                    <button onClick={onClose} className="px-4 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ExtraPaymentModal;

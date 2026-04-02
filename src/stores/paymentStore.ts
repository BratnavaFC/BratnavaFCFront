import { create } from "zustand";

type PaymentState = {
    pendingPaymentsCount: number;
    setPendingPaymentsCount: (count: number) => void;
};

export const usePaymentStore = create<PaymentState>((set) => ({
    pendingPaymentsCount: 0,
    setPendingPaymentsCount: (count) => set({ pendingPaymentsCount: count }),
}));

/** Calcula o total de pendências a partir do summary retornado pela API */
export function calcPendingPaymentsCount(summary: any): number {
    if (!summary || summary.isUpToDate) return 0;
    const monthly = summary.hasPendingMonthly ? (summary.pendingMonthsCount ?? 1) : 0;
    const extra   = Array.isArray(summary.pendingExtraCharges) ? summary.pendingExtraCharges.length : 0;
    return monthly + extra;
}

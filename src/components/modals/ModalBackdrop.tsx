import React, { useEffect } from "react";

function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
            <div className="absolute inset-0 flex items-end sm:items-center justify-center sm:p-4">
                {children}
            </div>
        </div>
    );
}

export default ModalBackdrop;

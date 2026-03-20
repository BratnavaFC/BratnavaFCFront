import React from "react";

function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="absolute inset-0 flex items-end sm:items-center justify-center sm:p-4">
                {children}
            </div>
        </div>
    );
}

export default ModalBackdrop;

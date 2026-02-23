import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false); // overlay aberto
    const [sidebarPinned, setSidebarPinned] = useState(false); // opcional: se quiser “fixar”
    const autoCloseTimer = useRef<number | null>(null);

    const scheduleAutoClose = () => {
        if (autoCloseTimer.current) window.clearTimeout(autoCloseTimer.current);
        // só auto-fecha quando está aberto e não está “fixado”
        if (!sidebarOpen || sidebarPinned) return;

        autoCloseTimer.current = window.setTimeout(() => {
            setSidebarOpen(false);
        }, 4000);
    };

    const cancelAutoClose = () => {
        if (autoCloseTimer.current) window.clearTimeout(autoCloseTimer.current);
        autoCloseTimer.current = null;
    };

    // Sempre que abrir, agenda auto-close
    useEffect(() => {
        if (sidebarOpen) scheduleAutoClose();
        else cancelAutoClose();

        return () => cancelAutoClose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sidebarOpen, sidebarPinned]);

    // ESC fecha
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSidebarOpen(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar compacta (sempre visível) + overlay quando aberto */}
            <Sidebar
                open={sidebarOpen}
                pinned={sidebarPinned}
                onOpen={() => setSidebarOpen(true)}
                onClose={() => setSidebarOpen(false)}
                onToggle={() => setSidebarOpen((v) => !v)}
                onPinToggle={() => setSidebarPinned((v) => !v)}
                onUserActivity={scheduleAutoClose}
                onUserStop={cancelAutoClose}
            />

            {/* Overlay backdrop (só quando aberto e não pinado) */}
            {sidebarOpen && !sidebarPinned && (
                <button
                    aria-label="Fechar menu"
                    className="fixed inset-0 z-40 bg-black/30"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div className="flex-1 flex flex-col min-w-0">
                <Topbar />

                {/* Conteúdo */}
                <main className="flex-1 p-6 overflow-auto min-w-0">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useIsMobile } from "../hooks/UseIsMobile";
import WatermarkOverlay from "../components/WatermarkOverlay";

export default function Layout() {
    const isMobile = useIsMobile(768);

    const [sidebarOpen, setSidebarOpen] = useState(() => {
        if (typeof window === 'undefined') return false;
        const isDesktop = !window.matchMedia('(max-width: 768px)').matches;
        if (!isDesktop) return false;
        try { return localStorage.getItem('bratnava-sidebar-open') === 'true'; } catch { return false; }
    });
    const [sidebarPinned, setSidebarPinned] = useState(false); // opcional desktop
    const autoCloseTimer = useRef<number | null>(null);

    const scheduleAutoClose = () => {
        if (!isMobile) return; // desktop: sem auto-close, usuário controla manualmente
        if (autoCloseTimer.current) window.clearTimeout(autoCloseTimer.current);
        if (!sidebarOpen) return;

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
    }, [sidebarOpen, sidebarPinned, isMobile]);

    // ESC fecha
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSidebarOpen(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    // Persiste estado do sidebar no localStorage (desktop apenas)
    useEffect(() => {
        if (isMobile) return;
        try { localStorage.setItem('bratnava-sidebar-open', String(sidebarOpen)); } catch { /* noop */ }
    }, [sidebarOpen, isMobile]);

    // Se entrou em mobile, n�o faz sentido manter pinned e nem sidebar aberta �presa�
    useEffect(() => {
        if (isMobile) {
            setSidebarPinned(false);
            setSidebarOpen(false);
        }
    }, [isMobile]);

    const showDesktopSidebar = !isMobile; // sidebar sempre vis�vel no desktop
    const showMobileSidebar = isMobile && sidebarOpen; // sidebar s� aparece quando abrir no mobile

    return (
        <div className="flex h-dvh bg-slate-50 dark:bg-slate-800/50">
            <WatermarkOverlay />
            {/* ===== Desktop: Sidebar sempre vis�vel ===== */}
            {showDesktopSidebar && (
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
            )}

            {/* ===== Mobile: Sidebar como drawer (s� quando aberto) ===== */}
            {showMobileSidebar && (
                <div className="fixed inset-0 z-50">
                    {/* Backdrop */}
                    <button
                        aria-label="Fechar menu"
                        className="absolute inset-0 bg-black/30"
                        onClick={() => setSidebarOpen(false)}
                    />

                    {/* Drawer */}
                    <div className="absolute left-0 top-0 h-full w-[280px] max-w-[85vw]">
                        <Sidebar
                            open={true}
                            pinned={false}
                            onOpen={() => setSidebarOpen(true)}
                            onClose={() => setSidebarOpen(false)}
                            onToggle={() => setSidebarOpen((v) => !v)}
                            onPinToggle={() => { }}
                            onUserActivity={scheduleAutoClose}
                            onUserStop={cancelAutoClose}
                        />
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col min-w-0">
                <Topbar
                    onMenuClick={() => setSidebarOpen((v) => !v)}
                    isMobile={isMobile}
                />

                {/* Conte�do */}
                <main
                    className={[
                        "flex-1 overflow-auto min-w-0",
                        isMobile ? "p-3" : "p-6",
                    ].join(" ")}
                >
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
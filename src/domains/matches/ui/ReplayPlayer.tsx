/**
 * ReplayPlayer — player de vídeo profissional para replays SILENCIOSOS (sem áudio).
 *
 * Substitui o `<video controls>` nativo por uma barra de controles custom,
 * idêntica em desktop e mobile, pensada para análise de lances:
 *  - play/pause tocando na superfície (+ barra de espaço)
 *  - scrubber arrastável (mouse + touch) com faixa de buffered e tempo
 *  - velocidade / câmera lenta (0.25×–2×, persistida)
 *  - avanço quadro a quadro (◀▏ ▕▶ / teclas , .)
 *  - loop (tecla L, persistido)
 *  - tela cheia (tecla F)
 *
 * NÃO há controle de volume: os clipes não têm som.
 *
 * O elemento <video> é exposto via `videoRef` para o container (Lightbox)
 * aplicar pinch-to-zoom e fullscreen sem precisar remontá-lo entre clipes.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Expand, Maximize2, Minimize2, Pause, Play, Repeat, Shrink, SkipBack, SkipForward } from "lucide-react";

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type Speed = (typeof SPEEDS)[number];

/** m:ss a partir de segundos (mantido local para evitar dependência circular). */
function formatDuration(seconds: number) {
    const s = Math.max(0, Math.round(seconds || 0));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Passo aproximado de um quadro a 30fps (não sabemos o fps real do clipe).
const FRAME_STEP = 1 / 30;

function loadSpeed(): Speed {
    const n = parseFloat(localStorage.getItem("replay_speed") ?? "1");
    return (SPEEDS.includes(n as Speed) ? n : 1) as Speed;
}
function loadLoop(): boolean {
    return localStorage.getItem("replay_loop") === "1";
}
function loadFitCover(): boolean {
    return localStorage.getItem("replay_fit_cover") === "1";
}
function loadObjPos(): { x: number; y: number } {
    const x = parseFloat(localStorage.getItem("replay_obj_x") ?? "50");
    const y = parseFloat(localStorage.getItem("replay_obj_y") ?? "50");
    return { x: isFinite(x) ? x : 50, y: isFinite(y) ? y : 50 };
}
const clampPct = (n: number) => Math.max(0, Math.min(100, n));

export interface ReplayPlayerHandle {
    /** Elemento <video> subjacente (para pinch-zoom / fullscreen no container). */
    video: HTMLVideoElement | null;
    toggleFullscreen: () => void;
}

interface ReplayPlayerProps {
    src: string;
    /** Chave do clipe atual — muda ⇒ recarrega e dá play sem remontar o <video>. */
    clipKey: string;
    /** Altura máxima do vídeo (o container controla o layout externo). */
    maxHeight?: string;
    /** Disparado ao terminar (usado para auto-avançar quando não está em loop). */
    onEnded?: () => void;
    /** Registra o handler de teclado global (o container pode ter os seus). */
    bindKeys?: boolean;
}

const ReplayPlayer = forwardRef<ReplayPlayerHandle, ReplayPlayerProps>(function ReplayPlayer(
    { src, clipKey, maxHeight, onEnded, bindKeys = true },
    ref,
) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrubbing = useRef(false);

    const [speed, setSpeed] = useState<Speed>(loadSpeed);
    const [loop, setLoop] = useState<boolean>(loadLoop);
    // Em tela cheia: contain (ajusta, mostra tudo) x cover (preenche, corta laterais).
    const [fitCover, setFitCover] = useState<boolean>(loadFitCover);
    // Parte do vídeo em foco no modo "preencher" (arrastável). 0–100% em cada eixo.
    const [objPos, setObjPos] = useState<{ x: number; y: number }>(loadObjPos);
    const [showPanHint, setShowPanHint] = useState(false);
    // Estado do arraste (pan) — ref para não re-renderizar a cada movimento.
    const drag = useRef({ active: false, moved: false, startX: 0, startY: 0, baseX: 50, baseY: 50, w: 1, h: 1 });
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showCenter, setShowCenter] = useState(false);

    // ── Fullscreen no container do PLAYER (preenche a tela via CSS :fullscreen) ─
    function toggleFullscreen() {
        const el = containerRef.current;
        const video = videoRef.current;
        if (!el || !video) return;
        if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
            (document.exitFullscreen ?? (document as any).webkitExitFullscreen)?.call(document);
            return;
        }
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(() => (video as any).webkitEnterFullscreen?.());
        } else if ((el as any).webkitRequestFullscreen) {
            (el as any).webkitRequestFullscreen();
        } else {
            // iOS Safari não faz fullscreen de div — usa o fullscreen nativo do vídeo.
            (video as any).webkitEnterFullscreen?.();
        }
    }

    useImperativeHandle(ref, () => ({
        get video() { return videoRef.current; },
        toggleFullscreen,
    }), []);

    // ── Velocidade / loop ─────────────────────────────────────────────────────
    function applySpeed(s: Speed) {
        setSpeed(s);
        localStorage.setItem("replay_speed", String(s));
        if (videoRef.current) videoRef.current.playbackRate = s;
    }
    function toggleLoop() {
        setLoop((prev) => {
            const next = !prev;
            localStorage.setItem("replay_loop", next ? "1" : "0");
            if (videoRef.current) videoRef.current.loop = next;
            return next;
        });
    }
    function toggleFit() {
        setFitCover((prev) => {
            const next = !prev;
            localStorage.setItem("replay_fit_cover", next ? "1" : "0");
            // Ao ligar "preencher" em tela cheia, dá a dica de arrastar.
            if (next && isFullscreen) setShowPanHint(true);
            return next;
        });
    }

    // Só arrasta o foco quando faz sentido: modo preencher + tela cheia.
    const canPan = () => fitCover && isFullscreen;

    function onSurfacePointerDown(e: React.PointerEvent) {
        const el = e.currentTarget as HTMLElement;
        drag.current = {
            active: true, moved: false,
            startX: e.clientX, startY: e.clientY,
            baseX: objPos.x, baseY: objPos.y,
            w: el.clientWidth || 1, h: el.clientHeight || 1,
        };
        el.setPointerCapture(e.pointerId);
    }
    function onSurfacePointerMove(e: React.PointerEvent) {
        const d = drag.current;
        if (!d.active) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (!d.moved && Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
        if (canPan() && d.moved) {
            // "Segura e arrasta": puxar para a direita revela a parte esquerda.
            setObjPos({
                x: clampPct(d.baseX - (dx / d.w) * 100),
                y: clampPct(d.baseY - (dy / d.h) * 100),
            });
            setShowPanHint(false);
        }
    }
    function onSurfacePointerUp(e: React.PointerEvent) {
        const d = drag.current;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        d.active = false;
        if (!d.moved) { togglePlay(); return; }        // toque simples = play/pause
        if (canPan()) {                                 // fim do arraste: persiste o foco
            localStorage.setItem("replay_obj_x", String(objPos.x));
            localStorage.setItem("replay_obj_y", String(objPos.y));
        }
    }

    useEffect(() => {
        const v = videoRef.current;
        if (v) { v.playbackRate = speed; v.loop = loop; }
    }, [speed, loop]);

    // ── Troca de clipe: recarrega e dá play (sem remontar) ────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        setCurrent(0); setDuration(0); setBuffered(0);
        v.load();
        v.play().catch(() => {});
    }, [clipKey]);

    // ── Play/pause + frame step ───────────────────────────────────────────────
    function togglePlay() {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play().catch(() => {});
        else v.pause();
        setShowCenter(true);
        window.setTimeout(() => setShowCenter(false), 500);
    }
    function stepFrame(dir: 1 | -1) {
        const v = videoRef.current;
        if (!v) return;
        v.pause();
        v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + dir * FRAME_STEP));
    }

    // ── Scrubber ──────────────────────────────────────────────────────────────
    function seekToClientX(clientX: number, track: HTMLElement) {
        const v = videoRef.current;
        if (!v || !v.duration) return;
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        v.currentTime = ratio * v.duration;
        setCurrent(v.currentTime);
    }

    // ── Sync do estado do vídeo ───────────────────────────────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const onTime = () => { if (!scrubbing.current) setCurrent(v.currentTime); };
        const onDur = () => { setDuration(v.duration || 0); v.playbackRate = speed; v.loop = loop; };
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onProgress = () => {
            try {
                if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
            } catch { /* ignore */ }
        };
        v.addEventListener("timeupdate", onTime);
        v.addEventListener("loadedmetadata", onDur);
        v.addEventListener("durationchange", onDur);
        v.addEventListener("play", onPlay);
        v.addEventListener("pause", onPause);
        v.addEventListener("progress", onProgress);
        return () => {
            v.removeEventListener("timeupdate", onTime);
            v.removeEventListener("loadedmetadata", onDur);
            v.removeEventListener("durationchange", onDur);
            v.removeEventListener("play", onPlay);
            v.removeEventListener("pause", onPause);
            v.removeEventListener("progress", onProgress);
        };
    }, [speed, loop]);

    // ── Fullscreen state ──────────────────────────────────────────────────────
    useEffect(() => {
        const onFs = () => setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
        const onVBegin = () => setIsFullscreen(true);
        const onVEnd = () => setIsFullscreen(false);
        document.addEventListener("fullscreenchange", onFs);
        document.addEventListener("webkitfullscreenchange", onFs);
        const v = videoRef.current;
        v?.addEventListener("webkitbeginfullscreen", onVBegin);
        v?.addEventListener("webkitendfullscreen", onVEnd);
        return () => {
            document.removeEventListener("fullscreenchange", onFs);
            document.removeEventListener("webkitfullscreenchange", onFs);
            v?.removeEventListener("webkitbeginfullscreen", onVBegin);
            v?.removeEventListener("webkitendfullscreen", onVEnd);
        };
    }, []);

    // ── Atalhos de teclado ────────────────────────────────────────────────────
    useEffect(() => {
        if (!bindKeys) return;
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
            if (e.key === " ") { e.preventDefault(); togglePlay(); }
            else if (e.key === ",") stepFrame(-1);
            else if (e.key === ".") stepFrame(1);
            else if (e.key === "l" || e.key === "L") toggleLoop();
            else if (e.key === "f" || e.key === "F") toggleFullscreen();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [bindKeys]);

    const pct = duration ? (current / duration) * 100 : 0;
    const bufPct = duration ? (buffered / duration) * 100 : 0;

    const ctrlBtn = "flex items-center justify-center rounded-lg text-white/70 hover:text-white transition-colors active:scale-95";
    const ctrlBtnStyle = { width: 30, height: 30, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" } as const;

    return (
        <div
            ref={containerRef}
            className={`replay-player relative bg-black overflow-hidden select-none ${isFullscreen ? "" : "rounded-2xl"}`}
            // Em tela cheia, o container preenche a tela e vira coluna flex; assim o
            // vídeo cresce e centraliza (não depende só do CSS :fullscreen).
            style={isFullscreen ? { width: "100vw", height: "100vh", display: "flex", flexDirection: "column" } : undefined}
        >
            {/* Superfície de vídeo — toque = play/pause; arraste (modo preencher) = foco */}
            <div
                className="replay-surface relative flex items-center justify-center"
                style={{
                    ...(isFullscreen ? { flex: "1 1 auto", minHeight: 0 } : {}),
                    cursor: canPan() ? "grab" : "pointer",
                    touchAction: canPan() ? "none" : undefined,
                }}
                onPointerDown={onSurfacePointerDown}
                onPointerMove={onSurfacePointerMove}
                onPointerUp={onSurfacePointerUp}
            >
                <video
                    ref={videoRef}
                    src={src}
                    className="w-full bg-black block"
                    style={isFullscreen
                        ? { width: "100%", height: "100%", maxHeight: "none", objectFit: fitCover ? "cover" : "contain", objectPosition: fitCover ? `${objPos.x}% ${objPos.y}%` : undefined, transformOrigin: "center center" }
                        : { maxHeight: maxHeight ?? "min(calc(100svh - 300px), calc(100vh - 300px))", transformOrigin: "center center" }}
                    muted
                    playsInline
                    preload="metadata"
                    onEnded={() => { if (!loop) onEnded?.(); }}
                />
                {/* Ícone central que pisca ao alternar play/pause */}
                <div className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${showCenter ? "opacity-100" : "opacity-0"}`}>
                    <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        {playing ? <Play size={30} className="text-white ml-1" fill="white" /> : <Pause size={28} className="text-white" fill="white" />}
                    </div>
                </div>
                {/* Dica de arraste no modo preencher */}
                {canPan() && showPanHint && (
                    <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2"
                        style={{ background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999 }}>
                        Arraste o vídeo para escolher o foco
                    </div>
                )}
            </div>

            {/* Barra de controles */}
            <div className="px-2.5 py-2" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.35))" }}
                onClick={(e) => e.stopPropagation()}>
                {/* Scrubber */}
                <div
                    className="relative h-4 flex items-center cursor-pointer group"
                    onPointerDown={(e) => {
                        scrubbing.current = true;
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        seekToClientX(e.clientX, e.currentTarget);
                    }}
                    onPointerMove={(e) => { if (scrubbing.current) seekToClientX(e.clientX, e.currentTarget); }}
                    onPointerUp={(e) => {
                        scrubbing.current = false;
                        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                    }}
                >
                    <div className="relative w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.18)" }}>
                        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${bufPct}%`, background: "rgba(255,255,255,0.25)" }} />
                        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: "#34d399" }} />
                    </div>
                    <div className="absolute rounded-full bg-white shadow transition-transform group-hover:scale-110"
                        style={{ width: 11, height: 11, left: `calc(${pct}% - 5.5px)` }} />
                </div>

                {/* Linha de botões — play/pause no meio dos quadros ◀ ▶ */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <button type="button" onClick={() => stepFrame(-1)} title="Quadro anterior (,)" className={ctrlBtn} style={ctrlBtnStyle}>
                        <SkipBack size={13} />
                    </button>
                    <button type="button" onClick={togglePlay} title="Reproduzir/Pausar (espaço)" className={ctrlBtn} style={ctrlBtnStyle}>
                        {playing ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button type="button" onClick={() => stepFrame(1)} title="Próximo quadro (.)" className={ctrlBtn} style={ctrlBtnStyle}>
                        <SkipForward size={13} />
                    </button>

                    {/* Tempo */}
                    <span className="text-[11px] font-medium tabular-nums px-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                        {formatDuration(current)} / {formatDuration(duration)}
                    </span>

                    <div className="flex-1" />

                    {/* Velocidade / câmera lenta */}
                    <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.14)" }}>
                        {([0.25, 0.5, 1, 1.5, 2] as Speed[]).map((s) => (
                            <button key={s} type="button" onClick={() => applySpeed(s)}
                                title={s < 1 ? "Câmera lenta" : "Velocidade"}
                                className="text-[11px] font-bold transition-colors"
                                style={{
                                    padding: "4px 7px",
                                    color: speed === s ? "#0f172a" : "rgba(255,255,255,0.7)",
                                    background: speed === s ? "#fff" : "transparent",
                                }}>
                                {s}×
                            </button>
                        ))}
                    </div>

                    <button type="button" onClick={toggleLoop} title="Repetir (L)" className={ctrlBtn}
                        style={{ ...ctrlBtnStyle, background: loop ? "rgba(52,211,153,0.25)" : ctrlBtnStyle.background, borderColor: loop ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.14)", color: loop ? "#6ee7b7" : "rgba(255,255,255,0.7)" }}>
                        <Repeat size={13} />
                    </button>
                    {/* Ajustar (mostra tudo) x Preencher tela (corta laterais) — só em fullscreen */}
                    {isFullscreen && (
                        <button type="button" onClick={toggleFit}
                            title={fitCover ? "Ajustar à tela (mostrar tudo)" : "Preencher a tela (corta laterais)"}
                            className={ctrlBtn}
                            style={{ ...ctrlBtnStyle, background: fitCover ? "rgba(52,211,153,0.25)" : ctrlBtnStyle.background, borderColor: fitCover ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.14)", color: fitCover ? "#6ee7b7" : "rgba(255,255,255,0.7)" }}>
                            {fitCover ? <Shrink size={13} /> : <Expand size={13} />}
                        </button>
                    )}
                    <button type="button" onClick={toggleFullscreen} title="Tela cheia (F)" className={ctrlBtn} style={ctrlBtnStyle}>
                        {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default ReplayPlayer;

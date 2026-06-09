import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Share2, Download, X } from "lucide-react";
import type { PlayerInMatchDto } from "../matchTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MatchFlyerProps {
  teamAName:    string;
  teamBName:    string;
  teamAHex:     string;
  teamBHex:     string;
  teamAPlayers: PlayerInMatchDto[];
  teamBPlayers: PlayerInMatchDto[];
  playedAt:     string;
  onClose:      () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "";
  const d     = new Date(iso);
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day   = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  let prefix: string;
  if (day.getTime() === today.getTime()) {
    prefix = "Hoje";
  } else if (day.getTime() === today.getTime() + 86_400_000) {
    prefix = "Amanhã";
  } else {
    prefix = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  }

  return `${prefix} - ${time}`;
}

function fgForBg(hex: string): string {
  const c  = hex.replace("#", "");
  const r  = parseInt(c.slice(0, 2), 16);
  const g  = parseInt(c.slice(2, 4), 16);
  const b  = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? "#1e293b" : "#ffffff";
}

// ── Jersey SVG ────────────────────────────────────────────────────────────────

function Jersey({ color }: { color: string }) {
  const id = `j-${color.replace('#', '')}`;
  return (
    <svg viewBox="0 0 120 130" width={120} height={130}>
      <defs>
        {/* Body gradient — iluminação de cima */}
        <linearGradient id={`${id}-body`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.22)" />
          <stop offset="45%"  stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
        </linearGradient>
        {/* Sleeve gradient */}
        <linearGradient id={`${id}-slv`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.15)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.20)" />
        </linearGradient>
        <filter id={`${id}-shadow`}>
          <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* ── Manga esquerda ───────────────────────────────────────────── */}
      <path
        d={`
          M 44,10
          C 36,8 20,10 8,18
          L 2,38
          C 2,42 6,44 9,42
          L 22,36
          C 22,36 26,54 28,60
          L 38,58
          C 36,50 34,36 34,30
          Z
        `}
        fill={color}
        filter={`url(#${id}-shadow)`}
      />
      <path
        d={`M 44,10 C 36,8 20,10 8,18 L 2,38 C 2,42 6,44 9,42 L 22,36 C 22,36 26,54 28,60 L 38,58 C 36,50 34,36 34,30 Z`}
        fill={`url(#${id}-slv)`}
      />

      {/* ── Manga direita ────────────────────────────────────────────── */}
      <path
        d={`
          M 76,10
          C 84,8 100,10 112,18
          L 118,38
          C 118,42 114,44 111,42
          L 98,36
          C 98,36 94,54 92,60
          L 82,58
          C 84,50 86,36 86,30
          Z
        `}
        fill={color}
        filter={`url(#${id}-shadow)`}
      />
      <path
        d={`M 76,10 C 84,8 100,10 112,18 L 118,38 C 118,42 114,44 111,42 L 98,36 C 98,36 94,54 92,60 L 82,58 C 84,50 86,36 86,30 Z`}
        fill={`url(#${id}-slv)`}
      />

      {/* ── Corpo ────────────────────────────────────────────────────── */}
      <path
        d={`
          M 34,30
          C 30,30 28,32 28,34
          L 24,128
          L 96,128
          L 92,34
          C 92,32 90,30 86,30
          L 78,12
          C 74,6 70,3 66,3
          L 64,12
          C 62,18 58,22 60,22
          C 62,22 60,22 60,22
          Q 60,26 60,26
          Q 60,26 60,26
          C 58,26 56,24 54,22
          L 56,12
          L 54,3
          C 50,3 46,6 42,12
          L 34,30
          Z
        `}
        fill={color}
        filter={`url(#${id}-shadow)`}
      />
      <path
        d={`M 34,30 C 30,30 28,32 28,34 L 24,128 L 96,128 L 92,34 C 92,32 90,30 86,30 L 78,12 C 74,6 70,3 66,3 L 64,12 C 62,18 58,22 60,22 C 58,26 60,26 60,26 C 58,26 56,24 54,22 L 56,12 L 54,3 C 50,3 46,6 42,12 L 34,30 Z`}
        fill={`url(#${id}-body)`}
      />

      {/* ── Gola V ───────────────────────────────────────────────────── */}
      <path
        d={`M 54,3 L 46,22 L 60,30 L 74,22 L 66,3`}
        fill={color}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.8"
      />
      <path
        d={`M 54,3 L 46,22 L 60,30 L 74,22 L 66,3`}
        fill={`url(#${id}-body)`}
      />
      {/* borda interna da gola */}
      <path
        d={`M 54,3 L 46,22 L 60,30 L 74,22 L 66,3`}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.6"
      />

      {/* ── Costura central (corpo) ──────────────────────────────────── */}
      <line x1="60" y1="30" x2="60" y2="128"
        stroke="rgba(0,0,0,0.08)" strokeWidth="0.8" strokeDasharray="4 3" />

      {/* ── Costura das mangas ───────────────────────────────────────── */}
      <path d="M 34,30 C 34,44 36,56 38,60"
        fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth="0.8" />
      <path d="M 86,30 C 86,44 84,56 82,60"
        fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth="0.8" />

      {/* ── Punho manga esquerda ─────────────────────────────────────── */}
      <path d="M 9,40 L 22,36 L 28,60 L 14,64 Z"
        fill="rgba(0,0,0,0.12)" />

      {/* ── Punho manga direita ──────────────────────────────────────── */}
      <path d="M 111,40 L 98,36 L 92,60 L 106,64 Z"
        fill="rgba(0,0,0,0.12)" />

      {/* ── Brilho ombro esquerdo ────────────────────────────────────── */}
      <ellipse cx="40" cy="22" rx="10" ry="5"
        fill="rgba(255,255,255,0.12)" transform="rotate(-30 40 22)" />

      {/* ── Brilho ombro direito ─────────────────────────────────────── */}
      <ellipse cx="80" cy="22" rx="10" ry="5"
        fill="rgba(255,255,255,0.12)" transform="rotate(30 80 22)" />
    </svg>
  );
}

// ── Main flyer component ──────────────────────────────────────────────────────

function FlyerContent({
  teamAName, teamBName, teamAHex, teamBHex,
  teamAPlayers, teamBPlayers, playedAt,
}: Omit<MatchFlyerProps, "onClose">) {
  const fgA = fgForBg(teamAHex);
  const fgB = fgForBg(teamBHex);

  function TeamPanel({
    name, hex, fg, players,
  }: { name: string; hex: string; fg: string; players: PlayerInMatchDto[] }) {
    return (
      <div className="flex flex-col items-center gap-2 flex-1">
        {/* Jersey */}
        <Jersey color={hex} />

        {/* Team card */}
        <div className="w-full rounded-xl overflow-hidden shadow-lg">
          {/* Header */}
          <div
            className="py-2 px-3 text-center text-[11px] font-black uppercase tracking-widest"
            style={{ backgroundColor: hex, color: fg }}
          >
            TIME {name.toUpperCase()}
          </div>

          {/* Players */}
          <div style={{ backgroundColor: `${hex}22` }}>
            {players.map((p, i) => (
              <div
                key={p.matchPlayerId ?? i}
                className="flex items-center gap-2 px-3 py-[7px] border-b last:border-b-0"
                style={{ borderColor: `${hex}33` }}
              >
                <span className="text-[13px] leading-none">
                  {(p as any).isGoalkeeper ? "🥅" : "⚽"}
                </span>
                <span
                  className="text-[12px] font-semibold truncate"
                  style={{ color: `${hex}dd` === "#000000dd" ? "#1e293b" : `${hex}ee` }}
                >
                  {(p as any).playerName ?? (p as any).name ?? ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{
        width: 380,
        background: "linear-gradient(180deg, #0a1628 0%, #0d2045 50%, #0a1628 100%)",
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* Stadium background overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "url(/stadium-bg.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      />

      {/* Spotlights */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-8 left-[10%]"
          style={{
            width: 200, height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -top-8 right-[10%]"
          style={{
            width: 200, height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-4 pb-5">
        {/* Logo */}
        <img
          src="/bratnava-logo.png"
          alt="Bratnava"
          className="mt-4 mb-1"
          style={{ width: 90, height: 90, objectFit: "contain" }}
        />

        {/* Date */}
        <p
          className="text-center font-extrabold text-lg mb-4 px-2"
          style={{ color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.6)", letterSpacing: "0.02em" }}
        >
          {formatDate(playedAt)}
        </p>

        {/* Teams */}
        <div className="flex gap-3 w-full">
          <TeamPanel name={teamAName} hex={teamAHex} fg={fgA} players={teamAPlayers} />
          <TeamPanel name={teamBName} hex={teamBHex} fg={fgB} players={teamBPlayers} />
        </div>
      </div>
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

export function MatchFlyerModal(props: MatchFlyerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  async function download() {
    if (!ref.current) return;
    setSaving(true);
    try {
      const png = await toPng(ref.current, { pixelRatio: 3, cacheBust: true });
      const a   = document.createElement("a");
      a.href     = png;
      a.download = "bratnava-escalacao.png";
      a.click();
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    if (!ref.current) return;
    setSaving(true);
    try {
      const png   = await toPng(ref.current, { pixelRatio: 3, cacheBust: true });
      const blob  = await (await fetch(png)).blob();
      const file  = new File([blob], "bratnava-escalacao.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Escalação BratnavaFC" });
      } else {
        // Fallback: download
        const a = document.createElement("a");
        a.href     = png;
        a.download = "bratnava-escalacao.png";
        a.click();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="flex flex-col items-center gap-4 max-h-[90vh] overflow-y-auto">
        {/* Flyer */}
        <div ref={ref}>
          <FlyerContent
            teamAName={props.teamAName}
            teamBName={props.teamBName}
            teamAHex={props.teamAHex}
            teamBHex={props.teamBHex}
            teamAPlayers={props.teamAPlayers}
            teamBPlayers={props.teamBPlayers}
            playedAt={props.playedAt}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={props.onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
          >
            <X size={15} /> Fechar
          </button>
          <button
            onClick={download}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-sm transition-colors disabled:opacity-50"
          >
            <Download size={15} /> {saving ? "Gerando…" : "Baixar"}
          </button>
          <button
            onClick={share}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Share2 size={15} /> {saving ? "Gerando…" : "Compartilhar"}
          </button>
        </div>
      </div>
    </div>
  );
}

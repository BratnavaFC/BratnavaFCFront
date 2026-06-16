// Shared football-field visualizations for matchmaking and assigned teams.
// TeamFieldPair  → two mini fields side-by-side (carousel / generation preview)
// MatchDayField  → single full field, Team A at top, Team B at bottom

// ── Types ─────────────────────────────────────────────────────────────────────

export type FieldPlayer = {
    id: string;
    name: string;
    isGoalkeeper: boolean;
    dimmed?: boolean;           // e.g. didNotPlay
    attackRating?: number | null;
    defenseRating?: number | null;
};

type Pos = { x: number; y: number };
type SelState = 'none' | 'sel1' | 'sel2';

// ── Color helpers ─────────────────────────────────────────────────────────────

function normalizeHex(v: string): string {
    const s = (v ?? '').trim();
    if (!s) return '';
    return s.startsWith('#') ? s : `#${s}`;
}

function isWhiteish(hex: string): boolean {
    const h = normalizeHex(hex).replace('#', '').toLowerCase();
    return h === 'ffffff' || h === 'fff';
}

function safeColor(hex: string, fallback: string): string {
    const n = normalizeHex(hex);
    if (!n || isWhiteish(n)) return fallback;
    return n;
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Position tables ───────────────────────────────────────────────────────────

// Mini field (one team): GK at y=0.86, outfield fills top 75%
const MINI_OUT: Record<number, Pos[]> = {
    0: [],
    1: [{ x: 0.50, y: 0.44 }],
    2: [{ x: 0.28, y: 0.44 }, { x: 0.72, y: 0.44 }],
    3: [{ x: 0.50, y: 0.30 }, { x: 0.22, y: 0.54 }, { x: 0.78, y: 0.54 }],
    4: [{ x: 0.28, y: 0.30 }, { x: 0.72, y: 0.30 }, { x: 0.22, y: 0.55 }, { x: 0.78, y: 0.55 }],
    5: [{ x: 0.50, y: 0.22 }, { x: 0.20, y: 0.36 }, { x: 0.80, y: 0.36 }, { x: 0.22, y: 0.56 }, { x: 0.78, y: 0.56 }],
    6: [{ x: 0.18, y: 0.22 }, { x: 0.50, y: 0.20 }, { x: 0.82, y: 0.22 }, { x: 0.18, y: 0.44 }, { x: 0.50, y: 0.46 }, { x: 0.82, y: 0.44 }],
    7: [{ x: 0.14, y: 0.20 }, { x: 0.38, y: 0.17 }, { x: 0.62, y: 0.17 }, { x: 0.86, y: 0.20 }, { x: 0.16, y: 0.42 }, { x: 0.50, y: 0.44 }, { x: 0.84, y: 0.42 }],
};

// Combined field top half: GK at y=0.07, outfield y: 0.19–0.44
// x controls up/down spread in horizontal view (1 - x = horizontal_y); push wings to extremes
const TOP_OUT: Record<number, Pos[]> = {
    0: [],
    1: [{ x: 0.50, y: 0.35 }],
    2: [{ x: 0.22, y: 0.35 }, { x: 0.78, y: 0.35 }],
    3: [{ x: 0.50, y: 0.24 }, { x: 0.14, y: 0.38 }, { x: 0.86, y: 0.38 }],
    4: [{ x: 0.25, y: 0.24 }, { x: 0.75, y: 0.24 }, { x: 0.14, y: 0.40 }, { x: 0.86, y: 0.40 }],
    5: [{ x: 0.50, y: 0.22 }, { x: 0.14, y: 0.30 }, { x: 0.86, y: 0.30 }, { x: 0.15, y: 0.43 }, { x: 0.85, y: 0.43 }],
    6: [{ x: 0.10, y: 0.19 }, { x: 0.50, y: 0.23 }, { x: 0.90, y: 0.19 }, { x: 0.12, y: 0.38 }, { x: 0.50, y: 0.44 }, { x: 0.88, y: 0.38 }],
    7: [{ x: 0.10, y: 0.19 }, { x: 0.33, y: 0.25 }, { x: 0.67, y: 0.25 }, { x: 0.90, y: 0.19 }, { x: 0.12, y: 0.37 }, { x: 0.50, y: 0.44 }, { x: 0.88, y: 0.37 }],
};

function clampTable(tbl: Record<number, Pos[]>, n: number): Pos[] {
    return tbl[Math.min(n, 7)] ?? tbl[7]!;
}

function getMiniPositions(players: FieldPlayer[]): Pos[] {
    const res = new Array<Pos>(players.length).fill({ x: 0.5, y: 0.5 });
    const gkI = players.findIndex(p => p.isGoalkeeper);
    if (gkI >= 0) res[gkI] = { x: 0.50, y: 0.86 };
    const outIs = players.map((_, i) => i).filter(i => i !== gkI);
    const tbl = clampTable(MINI_OUT, outIs.length);
    outIs.forEach((idx, i) => { res[idx] = tbl[Math.min(i, tbl.length - 1)]; });
    return res;
}

function getCombinedPositions(aPlayers: FieldPlayer[], bPlayers: FieldPlayer[]) {
    // frontHighY: for Team A, higher y = closer to opponent → front
    //             for Team B, after flip, lower y = closer to opponent → front (frontHighY=false)
    const buildHalf = (players: FieldPlayer[], gkY: number, flipY: boolean, frontHighY: boolean): Pos[] => {
        const res = new Array<Pos>(players.length).fill({ x: 0.5, y: 0.5 });
        const gkI = players.findIndex(p => p.isGoalkeeper);
        if (gkI >= 0) res[gkI] = { x: 0.50, y: gkY };

        const outIs = players.map((_, i) => i).filter(i => i !== gkI);
        if (outIs.length === 0) return res;

        const tbl = clampTable(TOP_OUT, outIs.length);
        const rawPos: Pos[] = outIs.map((_, i) => {
            const p = tbl[Math.min(i, tbl.length - 1)];
            return flipY ? { x: p.x, y: 1 - p.y } : p;
        });

        const hasRatings = outIs.some(i =>
            players[i].attackRating != null || players[i].defenseRating != null
        );

        if (!hasRatings) {
            outIs.forEach((idx, i) => { res[idx] = rawPos[i]; });
        } else {
            // Sort positions so front-most come first
            const posOrder = rawPos
                .map((pos, i) => ({ pos, i }))
                .sort((a, b) => frontHighY ? b.pos.y - a.pos.y : a.pos.y - b.pos.y)
                .map(e => e.i);

            // Sort players: highest (attack − defense) bias goes to front positions
            const playerOrder = outIs
                .map((idx, localI) => ({ idx, localI, score: (players[idx].attackRating ?? 0) - (players[idx].defenseRating ?? 0) }))
                .sort((a, b) => b.score - a.score)
                .map(e => e.localI);

            // player ranked k (most attacking) → position ranked k (front-most)
            playerOrder.forEach((localI, k) => {
                res[outIs[localI]] = rawPos[posOrder[k]];
            });
        }

        return res;
    };

    return {
        aPos: buildHalf(aPlayers, 0.07, false, true),
        bPos: buildHalf(bPlayers, 0.93, true, false),
    };
}

// ── Field background ──────────────────────────────────────────────────────────

function FieldBg() {
    return (
        <>
            <div
                className="absolute inset-0 opacity-[.11] pointer-events-none"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 36px,rgba(0,0,0,.15) 36px,rgba(0,0,0,.15) 72px)' }}
            />
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 300" preserveAspectRatio="none">
                <rect x="8" y="8" width="184" height="284" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" rx="2" />
                <line x1="8" y1="150" x2="192" y2="150" stroke="rgba(255,255,255,.45)" strokeWidth="1" />
                <circle cx="100" cy="150" r="28" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1" />
                <circle cx="100" cy="150" r="2.5" fill="rgba(255,255,255,.6)" />
                <rect x="52" y="8"   width="96" height="46" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="72" y="8"   width="56" height="20" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="84" y="2"   width="32" height="7"  fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.6)" strokeWidth="1.2" rx="1" />
                <rect x="52" y="246" width="96" height="46" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="72" y="272" width="56" height="20" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="84" y="291" width="32" height="7"  fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.6)" strokeWidth="1.2" rx="1" />
                <circle cx="100" cy="36"  r="2" fill="rgba(255,255,255,.45)" />
                <circle cx="100" cy="264" r="2" fill="rgba(255,255,255,.45)" />
            </svg>
        </>
    );
}

// ── Player pin ────────────────────────────────────────────────────────────────

function FieldPin({
    player, pos, teamColor, selState = 'none', interactive = false, dimmed = false, compact = false, hideLabel = false, onClick,
}: {
    player: FieldPlayer;
    pos: Pos;
    teamColor: string;
    selState?: SelState;
    interactive?: boolean;
    dimmed?: boolean;
    compact?: boolean;
    hideLabel?: boolean;
    onClick?: () => void;
}) {
    const bg =
        selState === 'sel1' ? '#f59e0b' :
        selState === 'sel2' ? '#10b981' :
        teamColor;

    return (
        <button
            type="button"
            disabled={!interactive}
            onClick={interactive ? onClick : undefined}
            className="absolute z-10 flex flex-col items-center group transition-opacity"
            style={{
                left: `${pos.x * 100}%`,
                top:  `${pos.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                opacity:   dimmed ? 0.35 : 1,
                animation: 'fieldPinIn .32s cubic-bezier(.34,1.56,.64,1) both',
            }}
        >
            <div
                className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} rounded-full border-2 border-white shadow-md flex items-center justify-center font-black transition-transform group-hover:scale-110`}
                style={{ backgroundColor: bg }}
            >
                {player.isGoalkeeper
                    ? <span className={compact ? 'text-sm leading-none' : 'text-xl leading-none'}>🧤</span>
                    : <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} text-white`}>{initials(player.name)}</span>}
            </div>
            {!hideLabel && (
                <div className={`mt-0.5 px-1 py-px bg-black/60 rounded text-white font-semibold leading-tight ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
                    {player.name.split(' ')[0]}
                </div>
            )}
        </button>
    );
}

// ── TeamFieldPair ─────────────────────────────────────────────────────────────
// Two half-fields side by side: left = Team A's half (top), right = Team B's half (bottom).
// Each panel renders the full field SVG internally but clips at the midline.

const HALF_W = 205; // px per half-field panel
const HALF_H = 255; // px — each panel is one half of the full field

// Horizontal field: same total width as the pair, 3:2 landscape ratio
const HORIZ_W = HALF_W * 2 + 8;
const HORIZ_H = Math.round(HORIZ_W * 2 / 3);

// Full-field SVG markings embedded inline so we can control dimensions precisely
function HalfFieldBg({ isTop }: { isTop: boolean }) {
    return (
        // This div is 2× the container height, shifted so only the desired half is visible
        <div
            className="absolute inset-x-0 pointer-events-none"
            style={{ top: isTop ? 0 : -HALF_H, height: HALF_H * 2 }}
        >
            {/* Base gradient */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#166534 0%,#15803d 50%,#166534 100%)' }} />
            {/* Grass stripes */}
            <div className="absolute inset-0 opacity-[.11]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 36px,rgba(0,0,0,.15) 36px,rgba(0,0,0,.15) 72px)' }} />
            {/* SVG field markings — same viewBox as FieldBg */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 300" preserveAspectRatio="none">
                <rect x="8" y="8" width="184" height="284" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" rx="2" />
                <line x1="8" y1="150" x2="192" y2="150" stroke="rgba(255,255,255,.45)" strokeWidth="1" />
                <circle cx="100" cy="150" r="28" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1" />
                <circle cx="100" cy="150" r="2.5" fill="rgba(255,255,255,.6)" />
                <rect x="52" y="8"   width="96" height="46" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="72" y="8"   width="56" height="20" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="84" y="2"   width="32" height="7"  fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.6)" strokeWidth="1.2" rx="1" />
                <rect x="52" y="246" width="96" height="46" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="72" y="272" width="56" height="20" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="84" y="291" width="32" height="7"  fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.6)" strokeWidth="1.2" rx="1" />
                <circle cx="100" cy="36"  r="2" fill="rgba(255,255,255,.45)" />
                <circle cx="100" cy="264" r="2" fill="rgba(255,255,255,.45)" />
            </svg>
        </div>
    );
}

export function TeamFieldPair({
    teamAPlayers, teamBPlayers,
    teamAHex, teamBHex,
    teamAName, teamBName,
    sel1Id = null, sel1Team = null, sel2Id = null,
    canInteract = false,
    onPlayerClick,
}: {
    teamAPlayers: FieldPlayer[];
    teamBPlayers: FieldPlayer[];
    teamAHex: string;
    teamBHex: string;
    teamAName: string;
    teamBName: string;
    sel1Id?: string | null;
    sel1Team?: 'A' | 'B' | null;
    sel2Id?: string | null;
    canInteract?: boolean;
    onPlayerClick?: (id: string, team: 'A' | 'B') => void;
}) {
    const aColor = safeColor(teamAHex, '#2563eb');
    const bColor = safeColor(teamBHex, '#dc2626');
    const { aPos, bPos } = getCombinedPositions(teamAPlayers, teamBPlayers);

    // Re-maps a full-field y fraction to a fraction of the half-container height
    const toHalfY = (y: number, isTop: boolean) =>
        isTop ? y * 2 : (y - 0.5) * 2;

    const renderHalf = (
        players: FieldPlayer[],
        positions: Pos[],
        color: string,
        name: string,
        team: 'A' | 'B',
        isTop: boolean,
    ) => {
        const displayName = name?.trim() || (team === 'A' ? 'Time A' : 'Time B');
        return (
        <div className="flex flex-col items-center gap-1">
            {/* Team label — always legible, team color shown as dot */}
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                {displayName}
                <span className="font-normal text-slate-400 dark:text-slate-500">{players.length}j</span>
            </div>

            {/* Half-field clip container */}
            <div
                className="relative overflow-hidden shadow-md"
                style={{
                    width:           HALF_W,
                    height:          HALF_H,
                    background:      '#15803d',
                    borderRadius:    isTop ? '8px 8px 0 0' : '0 0 8px 8px',
                }}
            >
                <HalfFieldBg isTop={isTop} />

                {/* Midline edge indicator */}
                <div
                    className="absolute inset-x-0 z-10 pointer-events-none"
                    style={{
                        [isTop ? 'bottom' : 'top']: 0,
                        height: '2px',
                        background: 'rgba(255,255,255,0.5)',
                    }}
                />

                {/* Players — y remapped to container coordinates */}
                {players.map((p, i) => (
                    <FieldPin
                        key={p.id}
                        player={p}
                        pos={{ x: positions[i].x, y: toHalfY(positions[i].y, isTop) }}
                        teamColor={color}
                        selState={sel1Id === p.id ? 'sel1' : sel2Id === p.id ? 'sel2' : 'none'}
                        interactive={canInteract}
                        compact
                        onClick={() => onPlayerClick?.(p.id, team)}
                    />
                ))}
            </div>
        </div>
        );
    };

    return (
        <>
            <style>{`@keyframes fieldPinIn{from{transform:translate(-50%,-50%) scale(0);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}`}</style>
            <div className="flex gap-2 justify-center">
                {renderHalf(teamAPlayers, aPos, aColor, teamAName, 'A', true)}
                {renderHalf(teamBPlayers, bPos, bColor, teamBName, 'B', false)}
            </div>
        </>
    );
}

// ── HorizontalTeamField ───────────────────────────────────────────────────────
// Single landscape field: Team A on the left, Team B on the right.
// Uses 90° CCW rotation of the vertical field: (x,y) → (y, 1-x)

function HorizontalFieldBg() {
    return (
        <>
            <div
                className="absolute inset-0 opacity-[.11] pointer-events-none"
                style={{ backgroundImage: 'repeating-linear-gradient(90deg,transparent,transparent 36px,rgba(0,0,0,.15) 36px,rgba(0,0,0,.15) 72px)' }}
            />
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 200" preserveAspectRatio="none">
                <rect x="8"   y="8"  width="284" height="184" fill="none" stroke="rgba(255,255,255,.5)"   strokeWidth="1.5" rx="2" />
                <line x1="150" y1="8" x2="150" y2="192"        stroke="rgba(255,255,255,.45)"  strokeWidth="1" />
                <circle cx="150" cy="100" r="28" fill="none"   stroke="rgba(255,255,255,.45)"  strokeWidth="1" />
                <circle cx="150" cy="100" r="2.5" fill="rgba(255,255,255,.6)" />
                {/* Left side — Team A */}
                <rect x="8"   y="52" width="46"  height="96"  fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="8"   y="72" width="20"  height="56"  fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="1"   y="84" width="7"   height="32"  fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.6)" strokeWidth="1.2" rx="1" />
                {/* Right side — Team B */}
                <rect x="246" y="52" width="46"  height="96"  fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="272" y="72" width="20"  height="56"  fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1" />
                <rect x="292" y="84" width="7"   height="32"  fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.6)" strokeWidth="1.2" rx="1" />
                <circle cx="36"  cy="100" r="2" fill="rgba(255,255,255,.45)" />
                <circle cx="264" cy="100" r="2" fill="rgba(255,255,255,.45)" />
            </svg>
        </>
    );
}

export function HorizontalTeamField({
    teamAPlayers, teamBPlayers,
    teamAHex, teamBHex,
    teamAName = 'Time A', teamBName = 'Time B',
    sel1Id = null, sel1Team = null, sel2Id = null,
    canInteract = false,
    hideLabel = false,
    onPlayerClick,
}: {
    teamAPlayers: FieldPlayer[];
    teamBPlayers: FieldPlayer[];
    teamAHex: string;
    teamBHex: string;
    teamAName?: string;
    teamBName?: string;
    sel1Id?: string | null;
    sel1Team?: 'A' | 'B' | null;
    sel2Id?: string | null;
    canInteract?: boolean;
    hideLabel?: boolean;
    onPlayerClick?: (id: string, team: 'A' | 'B') => void;
}) {
    const aColor = safeColor(teamAHex, '#2563eb');
    const bColor = safeColor(teamBHex, '#dc2626');
    const { aPos, bPos } = getCombinedPositions(teamAPlayers, teamBPlayers);

    // 90° CCW rotation: vertical (x,y) → landscape (y, 1−x)
    const toH = (pos: Pos): Pos => ({ x: pos.y, y: 1 - pos.x });

    return (
        <>
            <style>{`@keyframes fieldPinIn{from{transform:translate(-50%,-50%) scale(0);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}`}</style>
            <div
                className="relative w-full rounded-xl overflow-hidden shadow-lg"
                style={{
                    aspectRatio: '3/2',
                    background: 'linear-gradient(90deg,#166534 0%,#15803d 50%,#166534 100%)',
                }}
            >
                <HorizontalFieldBg />

                {/* Team A players */}
                {teamAPlayers.map((p, i) => (
                    <FieldPin
                        key={`a-${p.id}`}
                        player={p}
                        pos={toH(aPos[i])}
                        teamColor={aColor}
                        selState={sel1Id === p.id ? 'sel1' : sel2Id === p.id ? 'sel2' : 'none'}
                        interactive={canInteract}
                        compact
                        hideLabel={hideLabel}
                        onClick={() => onPlayerClick?.(p.id, 'A')}
                    />
                ))}

                {/* Team B players */}
                {teamBPlayers.map((p, i) => (
                    <FieldPin
                        key={`b-${p.id}`}
                        player={p}
                        pos={toH(bPos[i])}
                        teamColor={bColor}
                        selState={sel1Id === p.id ? 'sel1' : sel2Id === p.id ? 'sel2' : 'none'}
                        interactive={canInteract}
                        compact
                        hideLabel={hideLabel}
                        onClick={() => onPlayerClick?.(p.id, 'B')}
                    />
                ))}
            </div>
        </>
    );
}

// ── MatchDayField ─────────────────────────────────────────────────────────────
// Single field: Team A attacks from top, Team B attacks from bottom.

export function MatchDayField({
    teamAPlayers, teamBPlayers,
    teamAHex, teamBHex,
    teamAName, teamBName,
    sel1Id = null, sel1Team = null, sel2Id = null,
    canInteract = false,
    onPlayerClick,
}: {
    teamAPlayers: FieldPlayer[];
    teamBPlayers: FieldPlayer[];
    teamAHex: string;
    teamBHex: string;
    teamAName: string;
    teamBName: string;
    sel1Id?: string | null;
    sel1Team?: 'A' | 'B' | null;
    sel2Id?: string | null;
    canInteract?: boolean;
    onPlayerClick?: (id: string, team: 'A' | 'B') => void;
}) {
    const aColor = safeColor(teamAHex, '#2563eb');
    const bColor = safeColor(teamBHex, '#dc2626');
    const { aPos, bPos } = getCombinedPositions(teamAPlayers, teamBPlayers);

    const hint = canInteract && !sel1Id
        ? 'Toque em um jogador para selecionar'
        : canInteract && sel1Id && !sel2Id
        ? 'Agora toque em outro para trocar ou mova com os botões'
        : null;

    return (
        <>
            <style>{`@keyframes fieldPinIn{from{transform:translate(-50%,-50%) scale(0);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}`}</style>

            <div
                className="relative w-full rounded-2xl overflow-hidden shadow-xl"
                style={{ aspectRatio: '2/3', background: 'linear-gradient(180deg,#166534 0%,#15803d 50%,#166534 100%)' }}
            >
                <FieldBg />

                {/* Team A badge — top */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                    <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-white shadow"
                        style={{ backgroundColor: aColor + 'cc' }}
                    >
                        ▲ {teamAName}
                    </span>
                </div>

                {/* Team B badge — bottom */}
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                    <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-white shadow"
                        style={{ backgroundColor: bColor + 'cc' }}
                    >
                        {teamBName} ▼
                    </span>
                </div>

                {/* Hint overlay */}
                {hint && (
                    <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20 pointer-events-none">
                        <span className="px-2 py-0.5 rounded-full bg-black/50 text-white text-[9px] font-medium">
                            {hint}
                        </span>
                    </div>
                )}

                {/* Team A players */}
                {teamAPlayers.map((p, i) => (
                    <FieldPin
                        key={`a-${p.id}`}
                        player={p}
                        pos={aPos[i]}
                        teamColor={aColor}
                        selState={sel1Id === p.id ? 'sel1' : sel2Id === p.id ? 'sel2' : 'none'}
                        interactive={canInteract}
                        dimmed={p.dimmed}
                        onClick={() => onPlayerClick?.(p.id, 'A')}
                    />
                ))}

                {/* Team B players */}
                {teamBPlayers.map((p, i) => (
                    <FieldPin
                        key={`b-${p.id}`}
                        player={p}
                        pos={bPos[i]}
                        teamColor={bColor}
                        selState={sel1Id === p.id ? 'sel1' : sel2Id === p.id ? 'sel2' : 'none'}
                        interactive={canInteract}
                        dimmed={p.dimmed}
                        onClick={() => onPlayerClick?.(p.id, 'B')}
                    />
                ))}

                {teamAPlayers.length === 0 && teamBPlayers.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-white/30 text-sm">Sem jogadores</span>
                    </div>
                )}
            </div>
        </>
    );
}

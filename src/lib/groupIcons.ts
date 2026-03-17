// ─── Tipos ────────────────────────────────────────────────────────────────────

export type IconCategory = 'goal' | 'goalkeeper' | 'assist' | 'ownGoal' | 'mvp' | 'player';

export interface GroupIconConfig {
    goalIcon:       string | null;
    goalkeeperIcon: string | null;
    assistIcon:     string | null;
    ownGoalIcon:    string | null;
    mvpIcon:        string | null;
    playerIcon:     string | null;
}

export interface IconOption {
    value: string;       // ex: "⚽" ou "lucide:Trophy"
    label: string;       // nome amigável
}

// ─── Defaults (valores quando nenhum ícone foi salvo) ─────────────────────────

export const DEFAULT_ICONS: Record<keyof GroupIconConfig, string> = {
    goalIcon:       '⚽',
    goalkeeperIcon: '🧤',
    assistIcon:     '🤝',
    ownGoalIcon:    '🚩',
    mvpIcon:        'lucide:Trophy',
    playerIcon:     'lucide:User',
};

// ─── Opções disponíveis por categoria ─────────────────────────────────────────

export const GOAL_OPTIONS: IconOption[] = [
    { value: '⚽',           label: 'Bola de futebol' },
    { value: '🥅',           label: 'Goleira / trave' },
    { value: '🎯',           label: 'Alvo' },
    { value: '💥',           label: 'Explosão' },
    { value: '🔥',           label: 'Fogo' },
    { value: '👟',           label: 'Chuteira' },
    { value: '🏹',           label: 'Arco e flecha' },
    { value: '✨',           label: 'Faísca' },
    { value: '🚀',           label: 'Foguete' },
    { value: '⚡',           label: 'Relâmpago' },
    { value: '💣',           label: 'Bomba' },
    { value: '🎉',           label: 'Festa / comemoração' },
    { value: '🥊',           label: 'Luva de boxe' },
    { value: '🔑',           label: 'Chave' },
    { value: 'lucide:Target',     label: 'Mira (Target)' },
    { value: 'lucide:Crosshair',  label: 'Mira cruzada' },
    { value: 'lucide:Zap',        label: 'Raio (Zap)' },
    { value: 'lucide:Flame',      label: 'Chama (Flame)' },
];

export const GOALKEEPER_OPTIONS: IconOption[] = [
    { value: '🧤',           label: 'Luvas de goleiro' },
    { value: '🛡️',          label: 'Escudo' },
    { value: '🙌',           label: 'Mãos levantadas' },
    { value: '🤚',           label: 'Mão parada' },
    { value: '👑',           label: 'Coroa' },
    { value: '🦅',           label: 'Águia' },
    { value: '🐯',           label: 'Tigre' },
    { value: '🏰',           label: 'Castelo / fortaleza' },
    { value: '💪',           label: 'Braço forte' },
    { value: '✊',           label: 'Punho' },
    { value: '🦾',           label: 'Braço mecânico' },
    { value: '⛔',           label: 'Proibido' },
    { value: '🚧',           label: 'Obras / barreira' },
    { value: 'lucide:Shield',      label: 'Escudo (Shield)' },
    { value: 'lucide:ShieldCheck', label: 'Escudo check' },
    { value: 'lucide:ShieldAlert', label: 'Escudo alerta' },
    { value: 'lucide:Hand',        label: 'Mão (Hand)' },
    { value: 'lucide:Lock',        label: 'Cadeado (Lock)' },
];

export const ASSIST_OPTIONS: IconOption[] = [
    { value: '🤝',           label: 'Aperto de mão' },
    { value: '👋',           label: 'Aceno' },
    { value: '🙏',           label: 'Mãos juntas' },
    { value: '💪',           label: 'Braço forte' },
    { value: '🎁',           label: 'Presente' },
    { value: '✋',           label: 'Mão erguida' },
    { value: '🤙',           label: 'Shaka' },
    { value: '🪄',           label: 'Varinha mágica' },
    { value: '👐',           label: 'Mãos abertas' },
    { value: '🫱',           label: 'Mão direita' },
    { value: '💫',           label: 'Estrela girando' },
    { value: '🎯',           label: 'Alvo' },
    { value: 'lucide:Link',          label: 'Corrente (Link)' },
    { value: 'lucide:Share2',        label: 'Compartilhar' },
    { value: 'lucide:ArrowRightLeft',label: 'Setas opostas' },
    { value: 'lucide:GitMerge',      label: 'Merge' },
];

export const OWN_GOAL_OPTIONS: IconOption[] = [
    { value: '🚩',           label: 'Bandeira vermelha' },
    { value: '😅',           label: 'Suado / constrangido' },
    { value: '💀',           label: 'Caveira' },
    { value: '🤦',           label: 'Facepalm' },
    { value: '😬',           label: 'Cringe' },
    { value: '😱',           label: 'Apavorado' },
    { value: '🙈',           label: 'Macaco olhos tapados' },
    { value: '😭',           label: 'Chorando' },
    { value: '❌',           label: 'X vermelho' },
    { value: '⚠️',          label: 'Atenção' },
    { value: '🤯',           label: 'Cabeça explodindo' },
    { value: '🙃',           label: 'De cabeça para baixo' },
    { value: 'lucide:AlertTriangle', label: 'Triângulo alerta' },
    { value: 'lucide:XCircle',       label: 'X circulado' },
    { value: 'lucide:Ban',           label: 'Banido (Ban)' },
];

export const MVP_OPTIONS: IconOption[] = [
    { value: 'lucide:Trophy',  label: 'Troféu (Trophy)' },
    { value: '🏆',            label: 'Troféu emoji' },
    { value: '⭐',            label: 'Estrela' },
    { value: '🌟',            label: 'Estrela brilhando' },
    { value: '🥇',            label: 'Medalha de ouro' },
    { value: '👑',            label: 'Coroa' },
    { value: '💎',            label: 'Diamante' },
    { value: '🦁',            label: 'Leão' },
    { value: '🦸',            label: 'Super-herói' },
    { value: '🎖️',           label: 'Medalha militar' },
    { value: '🏅',            label: 'Medalha esportiva' },
    { value: '🔱',            label: 'Tridente' },
    { value: 'lucide:Award',   label: 'Premiação (Award)' },
    { value: 'lucide:Star',    label: 'Estrela (Star)' },
    { value: 'lucide:Medal',   label: 'Medalha (Medal)' },
    { value: 'lucide:Crown',   label: 'Coroa (Crown)' },
];

export const PLAYER_OPTIONS: IconOption[] = [
    { value: 'lucide:User',           label: 'Pessoa (User)' },
    { value: 'lucide:UserRound',      label: 'Pessoa redonda' },
    { value: 'lucide:Shirt',          label: 'Camisa' },
    { value: 'lucide:Dumbbell',       label: 'Halter / treino' },
    { value: 'lucide:Activity',       label: 'Atividade' },
    { value: 'lucide:Zap',            label: 'Raio / velocidade' },
    { value: 'lucide:Star',           label: 'Estrela' },
    { value: '🏃',                    label: 'Correndo' },
    { value: '👤',                    label: 'Silhueta' },
    { value: '🧑',                    label: 'Pessoa' },
    { value: '🦵',                    label: 'Perna' },
    { value: '👟',                    label: 'Tênis / chuteira' },
    { value: '🎽',                    label: 'Uniforme' },
    { value: '⚡',                    label: 'Relâmpago' },
    { value: '💪',                    label: 'Braço forte' },
    { value: '🏅',                    label: 'Medalha' },
    { value: '⭐',                    label: 'Estrela' },
    { value: '🔥',                    label: 'Fogo' },
];

export const ICON_OPTIONS_BY_CATEGORY: Record<IconCategory, IconOption[]> = {
    goal:       GOAL_OPTIONS,
    goalkeeper: GOALKEEPER_OPTIONS,
    assist:     ASSIST_OPTIONS,
    ownGoal:    OWN_GOAL_OPTIONS,
    mvp:        MVP_OPTIONS,
    player:     PLAYER_OPTIONS,
};

export const CATEGORY_LABELS: Record<IconCategory, string> = {
    goal:       'Gol',
    goalkeeper: 'Goleiro',
    assist:     'Assistência',
    ownGoal:    'Gol contra',
    mvp:        'MVP',
    player:     'Jogador',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna se um valor de ícone representa um ícone Lucide */
export function isLucideIcon(value: string): boolean {
    return value.startsWith('lucide:');
}

/** Extrai o nome do componente Lucide de um valor "lucide:Trophy" → "Trophy" */
export function getLucideName(value: string): string {
    return value.slice(7); // remove "lucide:"
}

/** Resolve o ícone efetivo para uma categoria, caindo no default se null */
export function resolveIcon(config: GroupIconConfig | null, category: IconCategory): string {
    const key = `${category}Icon` as keyof GroupIconConfig;
    const fallback: string = DEFAULT_ICONS[key as keyof typeof DEFAULT_ICONS];
    if (!config) return fallback;
    return config[key] ?? fallback;
}

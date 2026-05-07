// ─── Tipos ────────────────────────────────────────────────────────────────────

export type IconCategory = 'goal' | 'goalkeeper' | 'assist' | 'ownGoal' | 'mvp' | 'player' | 'rank1' | 'rank2' | 'rank3';

export interface GroupIconConfig {
    goalIcon: string | null;
    goalkeeperIcon: string | null;
    assistIcon: string | null;
    ownGoalIcon: string | null;
    mvpIcon: string | null;
    playerIcon: string | null;
    rank1Icon: string | null;
    rank2Icon: string | null;
    rank3Icon: string | null;
}

export interface IconOption {
    value: string;       // ex: "⚽" ou "lucide:Trophy"
    label: string;       // nome amigável
}

// ─── Defaults (valores quando nenhum ícone foi salvo) ─────────────────────────

export const DEFAULT_ICONS: Record<keyof GroupIconConfig, string> = {
    goalIcon: '⚽',
    goalkeeperIcon: '🧤',
    assistIcon: '🤝',
    ownGoalIcon: '🚩',
    mvpIcon: 'lucide:Trophy',
    playerIcon: 'lucide:User',
    rank1Icon: '🥇',
    rank2Icon: '🥈',
    rank3Icon: '🥉',
};

// ─── Opções disponíveis por categoria ─────────────────────────────────────────

export const GOAL_OPTIONS: IconOption[] = [
    { value: '⚽', label: 'Bola de futebol' },   // 1
    { value: '🥅', label: 'Trave / goleira' },   // 2
    { value: '🎯', label: 'Alvo' },              // 3
    { value: 'lucide:Target', label: 'Mira (Target)' },     // 22
    { value: 'lucide:Medal', label: 'Medalha (Medal)' },   // 28
    { value: 'letter:G', label: 'Letra G' },           // 29
];

export const GOALKEEPER_OPTIONS: IconOption[] = [
    { value: '🧤', label: 'Luvas de goleiro' },    // 1
    { value: '🥅', label: 'Trave / goleira' },     // 2
    { value: '🛡️', label: 'Escudo' },              // 3
    { value: '🤲', label: 'Mãos abertas' },        // 6
    { value: 'lucide:ShieldAlert', label: 'Escudo alerta' },       // 24
    { value: 'lucide:Radar', label: 'Radar' },               // 28
    { value: 'letter:GL', label: 'Texto GL' },            // 29
];

export const ASSIST_OPTIONS: IconOption[] = [
    { value: '🤝', label: 'Aperto de mão' },              // 1
    { value: '🎁', label: 'Presente' },                   // 5
    { value: '🪄', label: 'Varinha mágica' },             // 8
    { value: '🔗', label: 'Corrente / link' },            // 14
    { value: '🧠', label: 'Inteligência' },               // 19
    { value: 'lucide:Link', label: 'Corrente (Link)' },            // 20
    { value: 'lucide:Handshake', label: 'Aperto de mão (Handshake)' }, // 24
    { value: 'letter:A', label: 'Letra A' },                    // 27
    { value: 'letter:ASS', label: 'Texto ASS' },                  // 28
];

export const OWN_GOAL_OPTIONS: IconOption[] = [
    { value: '🚩', label: 'Bandeira vermelha' },   // 1
    { value: '😅', label: 'Suado / constrangido' },// 2
    { value: '💀', label: 'Caveira' },             // 3
    { value: '🤦', label: 'Facepalm' },            // 4
    { value: '❌', label: 'X vermelho' },          // 9
    { value: '⚠️', label: 'Atenção' },             // 10
    { value: 'lucide:AlertTriangle', label: 'Triângulo alerta' },    // 22
    { value: 'lucide:Ban', label: 'Banido (Ban)' },        // 24
    { value: 'letter:GC', label: 'Texto GC' },            // 27
    { value: 'letter:OG', label: 'Texto OG' },            // 28
];

export const MVP_OPTIONS: IconOption[] = [
    { value: '🏆', label: 'Troféu' },              // 1
    { value: '⭐', label: 'Estrela' },             // 2
    { value: '🌟', label: 'Estrela brilhando' },   // 3
    { value: '🥇', label: 'Medalha de ouro' },     // 5
    { value: '👑', label: 'Coroa' },               // 6
    { value: 'lucide:Trophy', label: 'Troféu (Trophy)' },     // 19
    { value: 'lucide:Award', label: 'Premiação (Award)' },   // 20
    { value: 'lucide:Medal', label: 'Medalha (Medal)' },     // 22
    { value: 'lucide:Crown', label: 'Coroa (Crown)' },       // 23
    { value: 'letter:MVP', label: 'Texto MVP' },           // 26
    { value: 'letter:M', label: 'Letra M' },             // 27
];

export const PLAYER_OPTIONS: IconOption[] = [
    { value: '🏃', label: 'Correndo' },            // 1
    { value: '👤', label: 'Silhueta' },            // 2
    { value: '👟', label: 'Tênis / chuteira' },    // 5
    { value: '🎽', label: 'Uniforme' },            // 6
    { value: 'lucide:User', label: 'Pessoa (User)' },       // 17
    { value: 'lucide:UserRound', label: 'Pessoa redonda' },      // 18
    { value: 'lucide:Shirt', label: 'Camisa' },              // 19
    { value: 'letter:J', label: 'Letra J' },             // 25
    { value: 'letter:P', label: 'Letra P' },             // 26
];

export const RANK_OPTIONS: IconOption[] = [
    { value: '🥇', label: 'Medalha de ouro' },
    { value: '🥈', label: 'Medalha de prata' },
    { value: '🥉', label: 'Medalha de bronze' },
    { value: '🏆', label: 'Troféu' },
    { value: '⭐', label: 'Estrela' },
    { value: '👑', label: 'Coroa' },
    { value: 'lucide:Medal', label: 'Medalha (Medal)' },
    { value: 'lucide:Trophy', label: 'Troféu (Trophy)' },
    { value: 'lucide:Crown', label: 'Coroa (Crown)' },
    { value: 'lucide:Star', label: 'Estrela (Star)' },
    { value: 'letter:1', label: 'Número 1' },
    { value: 'letter:2', label: 'Número 2' },
    { value: 'letter:3', label: 'Número 3' },
];

export const ICON_OPTIONS_BY_CATEGORY: Record<IconCategory, IconOption[]> = {
    goal: GOAL_OPTIONS,
    goalkeeper: GOALKEEPER_OPTIONS,
    assist: ASSIST_OPTIONS,
    ownGoal: OWN_GOAL_OPTIONS,
    mvp: MVP_OPTIONS,
    player: PLAYER_OPTIONS,
    rank1: RANK_OPTIONS,
    rank2: RANK_OPTIONS,
    rank3: RANK_OPTIONS,
};

export const CATEGORY_LABELS: Record<IconCategory, string> = {
    goal: 'Gol',
    goalkeeper: 'Goleiro',
    assist: 'Assistência',
    ownGoal: 'Gol contra',
    mvp: 'MVP',
    player: 'Jogador',
    rank1: '1º lugar',
    rank2: '2º lugar',
    rank3: '3º lugar',
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

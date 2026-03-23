import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'bratnava-theme';

function getSaved(): Theme {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
        return 'light';
    }
}

interface ThemeState {
    theme: Theme;
    toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
    theme: getSaved(),
    toggle: () => {
        const next: Theme = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: next });
        applyTheme(next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
    },
}));

export function applyTheme(theme: Theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

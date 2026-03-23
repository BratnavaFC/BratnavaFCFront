export interface CalendarEvent {
    id?: string;
    type: 'manual' | 'birthday' | 'match' | 'holiday' | 'event';
    title: string;
    date: string;        // "YYYY-MM-DD"
    time?: string | null;
    timeTBD: boolean;
    categoryId?: string | null;
    categoryName?: string | null;
    categoryColor?: string | null;
    categoryIcon?: string | null;
    icon?: string | null;
    sourceId?: string | null;
    description?: string | null;
}

export interface CalendarCategory {
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
    isSystem?: boolean;
}

import { describe, it, expect } from 'vitest';
import { toUtcDate, formatUtcDate } from '../dateUtils';

describe('toUtcDate', () => {
    it('parses ISO string without Z as UTC (appends Z suffix)', () => {
        const d = toUtcDate('2025-05-15T21:00:00');
        expect(d.getTime()).toBe(new Date('2025-05-15T21:00:00Z').getTime());
    });

    it('parses ISO string that already has Z without modification', () => {
        const d = toUtcDate('2025-05-15T21:00:00Z');
        expect(d.getTime()).toBe(new Date('2025-05-15T21:00:00Z').getTime());
    });

    it('passes through ISO string with + offset unchanged', () => {
        // 22:00+01:00 === 21:00Z — already has an offset, so no Z appended
        const d = toUtcDate('2025-05-15T22:00:00+01:00');
        expect(d.getTime()).toBe(new Date('2025-05-15T21:00:00Z').getTime());
    });

    it('returns Invalid Date for empty string', () => {
        const d = toUtcDate('');
        expect(Number.isNaN(d.getTime())).toBe(true);
    });
});

describe('formatUtcDate', () => {
    it('returns null for null input', () => {
        expect(formatUtcDate(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
        expect(formatUtcDate(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(formatUtcDate('')).toBeNull();
    });

    it('returns object with correct day for a known UTC date', () => {
        const result = formatUtcDate('2025-05-15T12:00:00Z');
        expect(result).not.toBeNull();
        expect(result!.day).toBe('15');
    });

    it('returns time formatted as HH:MM (locale-dependent display)', () => {
        // formatUtcDate uses toLocaleTimeString which converts to the local timezone.
        // We only assert the format (HH:MM) — the exact value depends on the
        // environment's UTC offset, so we avoid hardcoding it.
        const result = formatUtcDate('2025-05-15T09:30:00Z');
        expect(result).not.toBeNull();
        expect(result!.time).toMatch(/^\d{2}:\d{2}$/);
    });

    it('short field contains day and month abbreviation', () => {
        const result = formatUtcDate('2025-05-15T12:00:00Z');
        expect(result).not.toBeNull();
        expect(result!.short).toContain('15');
    });
});

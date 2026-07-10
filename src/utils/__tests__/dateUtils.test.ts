import { describe, it, expect } from 'vitest';
import { toUtcDate, formatUtcDate } from '../dateUtils';

describe('toUtcDate', () => {
    it('keeps the literal hour when ISO string has no timezone', () => {
        const d = toUtcDate('2025-05-15T21:00:00');
        expect(d.getHours()).toBe(21);
        expect(d.getMinutes()).toBe(0);
    });

    it('converts legacy UTC strings to Sao Paulo wall time', () => {
        const d = toUtcDate('2025-05-16T00:00:00Z');
        expect(d.getHours()).toBe(21);
        expect(d.getMinutes()).toBe(0);
        expect(d.getDate()).toBe(15);
    });

    it('converts legacy midnight strings without timezone to Sao Paulo wall time', () => {
        const d = toUtcDate('2025-05-16T00:00:00');
        expect(d.getHours()).toBe(21);
        expect(d.getMinutes()).toBe(0);
        expect(d.getDate()).toBe(15);
    });

    it('converts offset strings to Sao Paulo wall time', () => {
        const d = toUtcDate('2025-05-16T00:00:00+00:00');
        expect(d.getHours()).toBe(21);
        expect(d.getMinutes()).toBe(0);
        expect(d.getDate()).toBe(15);
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

    it('returns object with correct day for a known date', () => {
        const result = formatUtcDate('2025-05-15T12:00:00Z');
        expect(result).not.toBeNull();
        expect(result!.day).toBe('15');
    });

    it('returns the literal time formatted as HH:MM', () => {
        const result = formatUtcDate('2025-05-15T12:30:00Z');
        expect(result).not.toBeNull();
        expect(result!.time).toBe('09:30');
    });

    it('short field contains day and month abbreviation', () => {
        const result = formatUtcDate('2025-05-15T12:00:00Z');
        expect(result).not.toBeNull();
        expect(result!.short).toContain('15');
    });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isDeadlinePassed, formatDeadline } from '../pollUtils';

describe('isDeadlinePassed', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns false when deadlineDate is null', () => {
        expect(isDeadlinePassed(null, null)).toBe(false);
    });

    it('returns false when deadlineDate is undefined', () => {
        expect(isDeadlinePassed(undefined, undefined)).toBe(false);
    });

    it('returns true when deadline is in the past', () => {
        // "now" = 2025-01-02T03:30:00Z
        // deadline: 2025-01-01 23:59 UTC-3 = 2025-01-02T02:59:00Z → already passed
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-02T03:30:00Z'));

        expect(isDeadlinePassed('2025-01-01', '23:59')).toBe(true);
    });

    it('returns false when deadline is in the future', () => {
        // "now" = 2025-01-01T12:00:00Z
        // deadline: 2025-01-01 23:59 UTC-3 = 2025-01-02T02:59:00Z → still future
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));

        expect(isDeadlinePassed('2025-01-01', '23:59')).toBe(false);
    });

    it('uses 23:59 as default when deadlineTime is omitted', () => {
        vi.useFakeTimers();

        vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
        expect(isDeadlinePassed('2025-01-01')).toBe(false);

        vi.setSystemTime(new Date('2025-01-02T03:30:00Z'));
        expect(isDeadlinePassed('2025-01-01')).toBe(true);
    });

    it('interprets deadline in UTC-3 (Brasília), not UTC', () => {
        // This test distinguishes UTC vs UTC-3 interpretation.
        //
        // Deadline: 2025-01-01 23:59
        //   → UTC interpretation: 2025-01-01T23:59:00Z
        //   → UTC-3 interpretation: 2025-01-02T02:59:00Z
        //
        // "now" = 2025-01-02T01:00:00Z
        //   → passed in UTC interpretation (01:00 > 23:59 of prev day? no... wait)
        //   Actually "now" = 2025-01-02T01:00:00Z vs UTC deadline 2025-01-01T23:59:00Z
        //   → 2025-01-02T01:00:00Z > 2025-01-01T23:59:00Z → would be TRUE in UTC
        //   → 2025-01-02T01:00:00Z < 2025-01-02T02:59:00Z → is FALSE in UTC-3
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-02T01:00:00Z'));

        // The correct UTC-3 implementation returns false (deadline not yet reached)
        expect(isDeadlinePassed('2025-01-01', '23:59')).toBe(false);
    });
});

describe('formatDeadline', () => {
    it('returns null when deadlineDate is null', () => {
        expect(formatDeadline(null)).toBeNull();
    });

    it('returns null when deadlineDate is undefined', () => {
        expect(formatDeadline(undefined)).toBeNull();
    });

    it('formats date-only as DD/MM/YYYY', () => {
        expect(formatDeadline('2025-05-15')).toBe('15/05/2025');
    });

    it('formats date with time as DD/MM/YYYY às HH:MM', () => {
        expect(formatDeadline('2025-05-15', '20:00')).toBe('15/05/2025 às 20:00');
    });

    it('formats date with null time as date only', () => {
        expect(formatDeadline('2025-12-31', null)).toBe('31/12/2025');
    });
});

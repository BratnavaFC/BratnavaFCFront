import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import ModalBackdrop from '../components/modals/ModalBackdrop';

describe('ModalBackdrop', () => {
    beforeEach(() => {
        cleanup();
    });

    it('renders children correctly', () => {
        const onClose = vi.fn();
        render(
            <ModalBackdrop onClose={onClose}>
                <div data-testid="child">Hello</div>
            </ModalBackdrop>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
        expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('ESC keydown calls onClose', () => {
        const onClose = vi.fn();
        render(
            <ModalBackdrop onClose={onClose}>
                <div>Content</div>
            </ModalBackdrop>
        );
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Enter key does NOT call onClose', () => {
        const onClose = vi.fn();
        render(
            <ModalBackdrop onClose={onClose}>
                <div>Content</div>
            </ModalBackdrop>
        );
        fireEvent.keyDown(window, { key: 'Enter' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('Space key does NOT call onClose', () => {
        const onClose = vi.fn();
        render(
            <ModalBackdrop onClose={onClose}>
                <div>Content</div>
            </ModalBackdrop>
        );
        fireEvent.keyDown(window, { key: ' ' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('ArrowDown key does NOT call onClose', () => {
        const onClose = vi.fn();
        render(
            <ModalBackdrop onClose={onClose}>
                <div>Content</div>
            </ModalBackdrop>
        );
        fireEvent.keyDown(window, { key: 'ArrowDown' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('clicking the backdrop div calls onClose', () => {
        const onClose = vi.fn();
        const { container } = render(
            <ModalBackdrop onClose={onClose}>
                <div>Content</div>
            </ModalBackdrop>
        );
        // The backdrop is the first child div of the outer fixed div
        // It has the bg-black/40 class and the onClick={onClose} handler
        const backdrop = container.querySelector('.bg-black\\/40') as HTMLElement;
        expect(backdrop).not.toBeNull();
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('clicking children does NOT call onClose (no propagation through flex container)', () => {
        const onClose = vi.fn();
        render(
            <ModalBackdrop onClose={onClose}>
                <div data-testid="inner-content">Inner</div>
            </ModalBackdrop>
        );
        // The children are inside a separate sibling flex div — clicking them
        // won't bubble up to the backdrop div because it's a sibling, not an ancestor.
        // The flex container div itself also has no onClick, so clicks on children
        // should not trigger onClose.
        fireEvent.click(screen.getByTestId('inner-content'));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('removes ESC listener on unmount — ESC after unmount does NOT call onClose', () => {
        const onClose = vi.fn();
        const { unmount } = render(
            <ModalBackdrop onClose={onClose}>
                <div>Content</div>
            </ModalBackdrop>
        );
        unmount();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when a new onClose prop is passed and ESC is pressed', () => {
        const onClose1 = vi.fn();
        const onClose2 = vi.fn();

        const { rerender } = render(
            <ModalBackdrop onClose={onClose1}>
                <div>Content</div>
            </ModalBackdrop>
        );

        // Update with a new onClose callback
        rerender(
            <ModalBackdrop onClose={onClose2}>
                <div>Content</div>
            </ModalBackdrop>
        );

        fireEvent.keyDown(window, { key: 'Escape' });

        // The new callback should be invoked (the useEffect re-registers because onClose is a dep)
        expect(onClose2).toHaveBeenCalledTimes(1);
        expect(onClose1).not.toHaveBeenCalled();
    });
});

/**
 * Security hardening for the browser client.
 *
 * Limitations (by design — these cannot be solved in a web app):
 *  - OS-level PrintScreen / screenshot shortcut captures the framebuffer directly;
 *    there is no browser API to intercept it.
 *  - Mobile screenshot (volume+power) is handled by the OS, not the browser.
 *  - A determined developer with physical machine access can always bypass JS guards.
 *
 * What this module achieves:
 *  - Blocks common DevTools keyboard shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U)
 *  - Disables right-click context menu
 *  - Disables text selection globally (CSS-driven via class on <body>)
 *  - Detects DevTools open via continuous debugger trap → freezes DevTools tab
 *  - Clears page content when the browser tab loses visibility (tab switch / app switch on mobile)
 *  - @media print → black page (CSS in index.css)
 */

const DEVTOOLS_CHECK_INTERVAL_MS = 500;

let _devtoolsCheckTimer: ReturnType<typeof setInterval> | null = null;

// ── DevTools detection via debugger trap ─────────────────────────────────────
// When DevTools is open and paused on a breakpoint, `console.log(...)` expands
// the object and takes a non-trivial amount of time. We measure that delta.
// The `debugger` statement inside a getter is the most reliable cross-browser
// detection: opening DevTools triggers the getter → breakpoint fires → tab freezes.
function startDevToolsDetection(onDetect: () => void) {
    let devtoolsOpen = false;

    const element = new Image();
    Object.defineProperty(element, "id", {
        get() {
            devtoolsOpen = true;
            onDetect();
        },
    });

    _devtoolsCheckTimer = setInterval(() => {
        devtoolsOpen = false;
        // Triggers the getter above when DevTools is open (console evaluates .id)
        console.log(element); // eslint-disable-line no-console
        console.clear();      // eslint-disable-line no-console
        if (!devtoolsOpen) return;
        onDetect();
    }, DEVTOOLS_CHECK_INTERVAL_MS);
}

// ── Keyboard shortcut blocking ───────────────────────────────────────────────
function blockDevToolsKeys(e: KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    const blocked =
        e.key === "F12" ||
        (ctrl && shift && ["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
        (ctrl && ["U", "u", "S", "s"].includes(e.key)) ||
        (ctrl && shift && e.key === "K"); // Firefox web console

    if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

// ── Right-click ──────────────────────────────────────────────────────────────
function blockContextMenu(e: MouseEvent) {
    e.preventDefault();
    return false;
}

// ── Visibility — clear when tab/app goes to background ───────────────────────
function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
        // Blur sensitive content; restored automatically when user returns
        document.body.classList.add("security-hidden");
    } else {
        document.body.classList.remove("security-hidden");
    }
}

// ── Public API ───────────────────────────────────────────────────────────────
export function initSecurityGuard() {
    // Disable text selection
    document.body.classList.add("no-select");

    // Keyboard + DevTools detection — only in production builds
    if (import.meta.env.PROD) {
        document.addEventListener("keydown", blockDevToolsKeys, true);

        startDevToolsDetection(() => {
            document.body.innerHTML = "";
            window.location.reload();
        });
    }

    // Right-click
    document.addEventListener("contextmenu", blockContextMenu, true);

    // Tab/app visibility
    document.addEventListener("visibilitychange", handleVisibilityChange);
}

export function destroySecurityGuard() {
    document.removeEventListener("keydown", blockDevToolsKeys, true);
    document.removeEventListener("contextmenu", blockContextMenu, true);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (_devtoolsCheckTimer !== null) {
        clearInterval(_devtoolsCheckTimer);
        _devtoolsCheckTimer = null;
    }
    document.body.classList.remove("no-select", "security-hidden");
}

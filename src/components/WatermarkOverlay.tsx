import { useEffect, useRef } from "react";
import { useAccountStore } from "../auth/accountStore";

/**
 * Full-page watermark that burns the user's name + ID fragment into every screenshot.
 *
 * Rendered via <canvas> so the text is NOT in the DOM as readable nodes —
 * it cannot be "extracted" by selecting text or inspecting elements.
 * The overlay is pointer-events:none so it doesn't interfere with the UI.
 *
 * Opacity is intentionally low (visible in screenshots, not distracting in normal use).
 */
export default function WatermarkOverlay() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const account = useAccountStore((s) => s.getActive());

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !account) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const label = `${account.name}  ·  ${account.email}  ·  ${account.userId.slice(0, 8).toUpperCase()}`;

        function draw() {
            if (!canvas || !ctx) return;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(-Math.PI / 6); // −30°
            ctx.translate(-canvas.width / 2, -canvas.height / 2);

            ctx.font = "13px 'Inter', 'Segoe UI', Arial, sans-serif";
            ctx.fillStyle = "rgba(100, 100, 100, 0.035)";
            ctx.textAlign = "left";

            const colStep = 320;
            const rowStep = 90;
            const cols = Math.ceil(canvas.width * 1.5 / colStep) + 2;
            const rows = Math.ceil(canvas.height * 1.5 / rowStep) + 4;
            const offsetX = -canvas.width * 0.25;
            const offsetY = -canvas.height * 0.25;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const x = offsetX + col * colStep + (row % 2 === 0 ? 0 : colStep / 2);
                    const y = offsetY + row * rowStep;
                    ctx.fillText(label, x, y);
                }
            }

            ctx.restore();
        }

        draw();

        const observer = new ResizeObserver(draw);
        observer.observe(document.documentElement);

        return () => observer.disconnect();
    }, [account]);

    if (!account) return null;

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 99998,
                userSelect: "none",
            }}
        />
    );
}

import { useEffect, useState } from "react";

export function useIsMobile(breakpointPx = 768) {
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === "undefined") return false;
        return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
    });

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
        const onChange = () => setIsMobile(mql.matches);

        onChange();
        if ((mql as any).addEventListener) (mql as any).addEventListener("change", onChange);
        else (mql as any).addListener(onChange);

        return () => {
            if ((mql as any).removeEventListener) (mql as any).removeEventListener("change", onChange);
            else (mql as any).removeListener(onChange);
        };
    }, [breakpointPx]);

    return isMobile;
}
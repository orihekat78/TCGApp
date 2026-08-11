import { useCallback, useEffect, useRef, useState } from "react";

export type LandscapeStatus = "pending" | "portrait" | "landscape";
export type LandscapeRequestResult = "idle" | "entered" | "rotate" | "denied";

export interface LandscapeExperience {
  status: LandscapeStatus;
  requestResult: LandscapeRequestResult;
  requestLandscape(): Promise<void>;
}

function isLandscape() {
  return window.matchMedia?.("(orientation: landscape)").matches ?? window.innerWidth > window.innerHeight;
}

export function useLandscapeExperience(): LandscapeExperience {
  const [status, setStatus] = useState<LandscapeStatus>("pending");
  const [requestResult, setRequestResult] = useState<LandscapeRequestResult>("idle");
  const mountedRef = useRef(false);
  const requestTokenRef = useRef(0);

  useEffect(() => {
    const media = window.matchMedia?.("(orientation: landscape)");
    const updateStatus = () => setStatus(isLandscape() ? "landscape" : "portrait");

    mountedRef.current = true;
    updateStatus();
    if (media?.addEventListener) {
      media.addEventListener("change", updateStatus);
    } else {
      media?.addListener?.(updateStatus);
    }
    window.addEventListener("resize", updateStatus);
    screen.orientation?.addEventListener?.("change", updateStatus);
    return () => {
      mountedRef.current = false;
      if (media?.removeEventListener) {
        media.removeEventListener("change", updateStatus);
      } else {
        media?.removeListener?.(updateStatus);
      }
      window.removeEventListener("resize", updateStatus);
      screen.orientation?.removeEventListener?.("change", updateStatus);
    };
  }, []);

  const requestLandscape = useCallback(async () => {
    const requestToken = ++requestTokenRef.current;
    const isCurrentRequest = () => mountedRef.current && requestToken === requestTokenRef.current;
    const setCurrentRequestResult = (result: LandscapeRequestResult) => {
      if (isCurrentRequest()) setRequestResult(result);
    };
    const fullscreen = document.documentElement.requestFullscreen;
    const lock = screen.orientation?.lock;

    if (fullscreen) {
      try {
        await fullscreen.call(document.documentElement);
      } catch {
        setCurrentRequestResult("denied");
        return;
      }
    }

    if (!isCurrentRequest()) return;
    if (!lock) {
      setCurrentRequestResult("rotate");
      return;
    }

    try {
      await lock.call(screen.orientation, "landscape");
      setCurrentRequestResult("entered");
    } catch {
      setCurrentRequestResult("rotate");
    }
  }, []);

  return { status, requestResult, requestLandscape };
}

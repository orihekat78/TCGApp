import { useCallback, useEffect, useState } from "react";

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

  useEffect(() => {
    const media = window.matchMedia?.("(orientation: landscape)");
    const updateStatus = () => setStatus(isLandscape() ? "landscape" : "portrait");

    updateStatus();
    media?.addEventListener("change", updateStatus);
    window.addEventListener("resize", updateStatus);
    screen.orientation?.addEventListener?.("change", updateStatus);
    return () => {
      media?.removeEventListener("change", updateStatus);
      window.removeEventListener("resize", updateStatus);
      screen.orientation?.removeEventListener?.("change", updateStatus);
    };
  }, []);

  const requestLandscape = useCallback(async () => {
    const fullscreen = document.documentElement.requestFullscreen;
    const lock = screen.orientation?.lock;

    if (fullscreen) {
      try {
        await fullscreen.call(document.documentElement);
      } catch {
        setRequestResult("denied");
        return;
      }
    }

    if (!lock) {
      setRequestResult("rotate");
      return;
    }

    try {
      await lock.call(screen.orientation, "landscape");
      setRequestResult("entered");
    } catch {
      setRequestResult("rotate");
    }
  }, []);

  return { status, requestResult, requestLandscape };
}

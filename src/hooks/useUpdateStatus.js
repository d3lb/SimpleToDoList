import { useEffect, useState } from "react";

/**
 * Update progress reported by the main process. Always idle outside the
 * packaged app, since there's no updater in the browser or in dev.
 */
export function useUpdateStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const updater = typeof window !== "undefined" ? window.simpleListUpdater : null;
    if (!updater) return;

    return updater.onStatus(setStatus);
  }, []);

  function installUpdate() {
    window.simpleListUpdater?.install();
  }

  return { status, installUpdate };
}

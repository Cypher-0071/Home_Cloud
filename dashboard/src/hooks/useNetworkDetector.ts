import { useState, useEffect } from 'react';

export interface NetworkDetectorResult {
  isLocalLAN: boolean;
  isDirectLocal: boolean;
  serverLocalIp: string | null;
  serverLocalPort: number;
  checking: boolean;
  redirectToLocal: () => void;
}

// Module-level Singleton Cache
let cachedResult: NetworkDetectorResult | null = null;
let inFlightPromise: Promise<NetworkDetectorResult> | null = null;
const listeners = new Set<(state: NetworkDetectorResult) => void>();

function notifyListeners(state: NetworkDetectorResult) {
  listeners.forEach(fn => fn(state));
}

async function runDetectionOnce(): Promise<NetworkDetectorResult> {
  const hostname = window.location.hostname;
  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === 'localhost';

  let localIp: string | null = null;
  let localPort = 3000;

  try {
    const infoRes = await fetch('/api/network/info');
    if (infoRes.ok) {
      const info = await infoRes.json();
      localIp = info.serverLocalIp;
      localPort = info.serverLocalPort || 3000;
    }
  } catch {
    /* fallback */
  }

  const baseResult: NetworkDetectorResult = {
    isLocalLAN: isIpAddress,
    isDirectLocal: isIpAddress,
    serverLocalIp: localIp,
    serverLocalPort: localPort,
    checking: false,
    redirectToLocal: () => {
      if (localIp) {
        window.location.href = `http://${localIp}:${localPort}${window.location.pathname}${window.location.search}`;
      }
    },
  };

  if (isIpAddress) {
    cachedResult = baseResult;
    return baseResult;
  }

  // Micro-ping check if on remote hostname
  if (localIp) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);

    try {
      const pingRes = await fetch(`http://${localIp}:${localPort}/api/health`, {
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(timer);

      if (pingRes.ok) {
        const lanResult: NetworkDetectorResult = {
          ...baseResult,
          isLocalLAN: true,
          isDirectLocal: false,
        };
        cachedResult = lanResult;

        // Auto-redirect to local IP
        window.location.href = `http://${localIp}:${localPort}${window.location.pathname}${window.location.search}`;
        return lanResult;
      }
    } catch {
      /* ping failed -> remote mode */
    }
  }

  cachedResult = baseResult;
  return baseResult;
}

export function useNetworkDetector(): NetworkDetectorResult {
  const [state, setState] = useState<NetworkDetectorResult>(
    cachedResult || {
      isLocalLAN: false,
      isDirectLocal: false,
      serverLocalIp: null,
      serverLocalPort: 3000,
      checking: !cachedResult,
      redirectToLocal: () => {},
    }
  );

  useEffect(() => {
    if (cachedResult) {
      setState(cachedResult);
      return;
    }

    listeners.add(setState);

    if (!inFlightPromise) {
      inFlightPromise = runDetectionOnce().then(res => {
        notifyListeners(res);
        return res;
      });
    }

    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}

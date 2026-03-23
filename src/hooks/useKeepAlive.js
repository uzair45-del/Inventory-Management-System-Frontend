import { useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes (Render spins down after 15 min idle)

/**
 * Pings the backend health endpoint every 14 minutes.
 * Keeps Render's free tier warm so there's no cold-start delay for users.
 */
function useKeepAlive() {
  useEffect(() => {
    const ping = async () => {
      try {
        await fetch(`${BACKEND_URL}/api/health`, { method: 'GET' });
      } catch {
        // silently ignore — don't break UI if backend is temporarily down
      }
    };

    // Ping immediately on mount, then on interval
    ping();
    const id = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}

export default useKeepAlive;

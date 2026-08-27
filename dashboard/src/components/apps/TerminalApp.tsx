import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as TerminalIcon, RefreshCw, Trash2 } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import styles from './terminal.module.css';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export default function TerminalApp() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  const connectSocket = useCallback((term: Terminal) => {
    if (socketRef.current) {
      if (
        socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING
      ) {
        socketRef.current.close();
      }
    }

    setStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/terminal`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('connected');
      term.write(
        '\r\n\x1b[1;37m==> Connected to Home Cloud Shell (bash) <==\x1b[0m\r\n\x1b[90mSession established. Type commands or press Ctrl+L to clear.\x1b[0m\r\n\r\n'
      );
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch {
          // Suppress layout fit errors on initial render
        }
      }
    };

    socket.onmessage = (event) => {
      term.write(event.data);
    };

    socket.onclose = () => {
      setStatus('disconnected');
      term.write('\r\n\x1b[1;31m==> Session Disconnected <==\x1b[0m\r\n');
    };

    socket.onerror = () => {
      setStatus('disconnected');
      term.write('\r\n\x1b[1;31m==> Connection Error <==\x1b[0m\r\n');
    };
  }, []);

  useEffect(() => {
    // 1. Initialize Terminal with Windows 11 Dark / Mica-aligned neutral palette
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      lineHeight: 1.2,
      fontFamily: "'JetBrains Mono', 'Fira Code', var(--mono), monospace",
      letterSpacing: 0,
      theme: {
        background: '#18181b',
        foreground: '#f4f4f5',
        cursor: '#ffffff',
        cursorAccent: '#18181b',
        selectionBackground: 'rgba(255, 255, 255, 0.22)',
        // Clean neutral ANSI palette (no neon oversaturation)
        black: '#27272a',
        red: '#f87171',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#f4f4f5',
        brightBlack: '#52525b',
        brightRed: '#fca5a5',
        brightGreen: '#6ee7b7',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#7dd3fc',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    if (terminalRef.current) {
      term.open(terminalRef.current);
      try {
        fitAddon.fit();
      } catch {
        // Layout safety
      }
    }

    // 2. Setup WebSocket connection
    connectSocket(term);

    // 3. User keystroke handling
    const dataDisposable = term.onData((data) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(data);
      }
    });

    // 4. Container resize observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // Suppress layout errors
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // 5. Cleanup on unmount
    return () => {
      dataDisposable.dispose();
      resizeObserver.disconnect();
      term.dispose();
      if (
        socketRef.current?.readyState === WebSocket.OPEN ||
        socketRef.current?.readyState === WebSocket.CONNECTING
      ) {
        socketRef.current.close();
      }
    };
  }, [connectSocket]);

  const handleReconnect = () => {
    if (xtermRef.current) {
      xtermRef.current.write('\r\n\x1b[90mReconnecting to terminal socket...\x1b[0m\r\n');
      connectSocket(xtermRef.current);
    }
  };

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.focus();
    }
  };

  return (
    <div className={styles.container}>
      {/* Sleek Window Header / Tab Bar */}
      <div className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <div className={styles.tabBadge}>
            <TerminalIcon size={12} style={{ color: '#a1a1aa' }} />
            <span>bash</span>
          </div>

          <div className={styles.statusBadge}>
            <span
              className={`${styles.statusDot} ${
                status === 'connected'
                  ? styles.statusDotConnected
                  : status === 'connecting'
                    ? styles.statusDotConnecting
                    : styles.statusDotDisconnected
              }`}
            />
            <span
              style={{
                color:
                  status === 'connected'
                    ? '#34d399'
                    : status === 'connecting'
                      ? '#fbbf24'
                      : '#f87171',
              }}
            >
              {status === 'connected'
                ? 'Connected'
                : status === 'connecting'
                  ? 'Connecting...'
                  : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className={styles.headerRight}>
          {status === 'disconnected' && (
            <button
              type="button"
              className={styles.reconnectBtn}
              onClick={handleReconnect}
              title="Reconnect to Terminal session"
            >
              <RefreshCw size={11} />
              <span>Reconnect</span>
            </button>
          )}

          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleClear}
            title="Clear Terminal screen"
          >
            <Trash2 size={11} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Terminal Canvas with 8px Window Padding */}
      <div className={styles.terminalWrapper}>
        <div ref={terminalRef} className={styles.terminalCanvas} />
      </div>
    </div>
  );
}

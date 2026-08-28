import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { RefreshCw, Trash2 } from 'lucide-react';
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
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      if (
        socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING
      ) {
        socketRef.current.close();
      }
      socketRef.current = null;
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
          /* ignore fit error during initial mount */
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
    // 1. Initialize Terminal with Vercel pitch-black dark theme
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      lineHeight: 1.25,
      letterSpacing: 0,
      fontFamily: "'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
      customGlyphs: true,
      theme: {
        background: '#000000',
        foreground: '#ededed',
        cursor: '#ededed',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 255, 255, 0.18)',
        black: '#000000',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#ededed',
        brightBlack: '#666666',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
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
        /* ignore fit error during initial mount */
      }
    }

    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        try {
          fitAddon.fit();
        } catch {
          /* ignore fit error during font load */
        }
      });
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
        /* ignore layout error during container resize */
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // 5. Cleanup on unmount
    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        if (
          socketRef.current.readyState === WebSocket.OPEN ||
          socketRef.current.readyState === WebSocket.CONNECTING
        ) {
          socketRef.current.close();
        }
        socketRef.current = null;
      }
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [connectSocket]);

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.focus();
    }
  };

  const handleReconnect = () => {
    if (xtermRef.current) {
      xtermRef.current.write('\r\n\x1b[90m==> Reconnecting to shell... <==\x1b[0m\r\n');
      connectSocket(xtermRef.current);
      xtermRef.current.focus();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerBar}>
        <div className={styles.tabsGroup}>
          <div className={styles.tabBadge}>
            <span
              className={
                status === 'connected'
                  ? styles.statusDotConnected
                  : status === 'connecting'
                    ? styles.statusDotConnecting
                    : styles.statusDotDisconnected
              }
            />
            <span className={styles.tabTitle}>bash</span>
          </div>
        </div>

        <div className={styles.actionsGroup}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleClear}
            title="Clear terminal"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleReconnect}
            title="Reconnect session"
          >
            <RefreshCw size={12} />
            <span>Reconnect</span>
          </button>
        </div>
      </div>

      <div className={styles.terminalWrapper}>
        <div ref={terminalRef} className={styles.terminalCanvas} />
      </div>
    </div>
  );
}

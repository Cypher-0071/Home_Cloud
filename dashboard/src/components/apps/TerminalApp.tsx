import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { RefreshCw, Trash2 } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import styles from './terminal.module.css';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

type InitialStreamState = {
  hasSeenVisible: boolean;
  pending: string;
};

function isLeadingWhitespace(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    char === '\r' ||
    char === '\n' ||
    char === ' ' ||
    char === '\t' ||
    char === '\v' ||
    char === '\f' ||
    code === 0
  );
}

// Drop zsh PROMPT_SP fill, Starship add_newline, and cursor/erase setup so the
// first glyph (~) lands at row 0. Keep SGR colors and mode CSI (h/l).
function cleanInitialStream(raw: string, state: InitialStreamState): string {
  const data = state.pending + raw;
  state.pending = '';
  if (state.hasSeenVisible) return data;

  let result = '';
  let i = 0;
  while (i < data.length) {
    if (state.hasSeenVisible) {
      result += data.slice(i);
      break;
    }

    if (isLeadingWhitespace(data[i])) {
      i++;
      continue;
    }

    if (data.charCodeAt(i) === 0x1b) {
      if (i + 1 >= data.length) {
        state.pending = data.slice(i);
        break;
      }

      const next = data[i + 1];

      if (next === ']') {
        const bel = data.indexOf('\x07', i);
        const st = data.indexOf('\x1b\\', i);
        let end = -1;
        if (bel !== -1 && st !== -1) end = Math.min(bel + 1, st + 2);
        else if (bel !== -1) end = bel + 1;
        else if (st !== -1) end = st + 2;
        if (end === -1) {
          state.pending = data.slice(i);
          break;
        }
        result += data.slice(i, end);
        i = end;
        continue;
      }

      if (next === '[') {
        let j = i + 2;
        while (j < data.length && (data.charCodeAt(j) < 0x40 || data.charCodeAt(j) > 0x7e)) {
          j++;
        }
        if (j >= data.length) {
          state.pending = data.slice(i);
          break;
        }
        const final = data[j];
        if (final === 'm' || final === 'h' || final === 'l') {
          result += data.slice(i, j + 1);
        }
        i = j + 1;
        continue;
      }

      if (next === '(' || next === ')' || next === '*' || next === '+') {
        if (i + 2 >= data.length) {
          state.pending = data.slice(i);
          break;
        }
        i += 3;
        continue;
      }

      i += 2;
      continue;
    }

    state.hasSeenVisible = true;
    result += data[i];
    i++;
  }

  return result;
}

export default function TerminalApp() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  const syncDimensions = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current) {
      try {
        fitAddonRef.current.fit();
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: 'resize',
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            })
          );
        }
      } catch {
        /* ignore layout errors during resize */
      }
    }
  }, []);

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

    const streamState: InitialStreamState = { hasSeenVisible: false, pending: '' };

    socket.onopen = () => {
      setStatus('connected');
      syncDimensions();
    };

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const cleaned = cleanInitialStream(event.data, streamState);
        term.write(cleaned);
      } else {
        term.write(event.data);
      }
    };

    socket.onclose = () => {
      setStatus('disconnected');
    };

    socket.onerror = () => {
      setStatus('disconnected');
    };
  }, [syncDimensions]);

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
        syncDimensions();
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
      syncDimensions();
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
  }, [connectSocket, syncDimensions]);

  const handleClear = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      // Send Ctrl+L to the shell — it will clear the screen and repaint
      // the full prompt (both directory info line and > cursor line).
      // We intentionally do NOT call xterm.clear() because that would
      // wipe the scrollback before the shell has a chance to redraw.
      socketRef.current.send('\x0c');
    }
    if (xtermRef.current) {
      xtermRef.current.focus();
    }
  };

  const handleReconnect = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
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

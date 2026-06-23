import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default function TerminalApp() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    // 1. Initialize Terminal and FitAddon
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'var(--mono)',
      theme: {
        background: '#0b0b0e',
        foreground: '#e4e4e7',
        cursor: '#a855f7',
        selectionBackground: 'rgba(168, 85, 247, 0.3)',
        black: '#000000',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#d4d4d8',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    if (terminalRef.current) {
      term.open(terminalRef.current);
      fitAddon.fit();
    }

    // 2. Setup dynamic websocket connection (wss if https, ws if http)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/terminal`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      term.write('\r\n\x1b[1;35m==> Connected to Home Cloud Secure Shell (bash) <==\x1b[0m\r\n\r\n');
    };

    socket.onmessage = (event) => {
      term.write(event.data);
    };

    socket.onclose = () => {
      term.write('\r\n\x1b[1;31m==> Connection Closed <==\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    // 3. Monitor container size changes to dynamically fit terminal columns
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        // Suppress layout errors
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // 4. Cleanup
    return () => {
      resizeObserver.disconnect();
      term.dispose();
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, []);

  return (
    <div style={{ height: '100%', width: '100%', background: '#0b0b0e', padding: '8px', boxSizing: 'border-box' }}>
      <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

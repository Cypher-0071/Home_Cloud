import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AlertCircle } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import styles from './docker.module.css';

interface ContainerConsoleTabProps {
  containerId: string;
  containerName: string;
  isRunning: boolean;
}

export default function ContainerConsoleTab({ containerId, containerName, isRunning }: ContainerConsoleTabProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!isRunning || !containerId) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12.5,
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace",
      letterSpacing: 0,
      theme: {
        background: '#18181b',
        foreground: '#f4f4f5',
        cursor: '#ffffff',
        cursorAccent: '#18181b',
        selectionBackground: 'rgba(255, 255, 255, 0.22)',
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
        brightMagenta: '#e9d5ff',
        brightCyan: '#a5f3fc',
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
      } catch (e) {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/docker/exec?containerId=${encodeURIComponent(containerId)}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      term.write(`\r\n\x1b[1;37m==> Connected to container console (${containerName}) <==\x1b[0m\r\n\r\n`);
      if (fitAddon && term) {
        try {
          fitAddon.fit();
          socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        } catch (e) {}
      }
    };

    socket.onmessage = (event) => {
      term.write(event.data);
    };

    socket.onclose = () => {
      term.write('\r\n\x1b[1;31m==> Console Connection Closed <==\x1b[0m\r\n');
    };

    socket.onerror = () => {
      term.write('\r\n\x1b[1;31m==> Console Connection Error <==\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        if (fitAddonRef.current && xtermRef.current) {
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
        }
      } catch (e) {}
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, [containerId, isRunning, containerName]);

  if (!isRunning) {
    return (
      <div className={styles.comingSoon}>
        <AlertCircle size={28} style={{ color: 'var(--text-muted)' }} />
        <span className={styles.comingSoonText}>
          Exec console unavailable. Container must be in a running state.
        </span>
      </div>
    );
  }

  return (
    <div className={styles.consoleWrapper}>
      <div ref={terminalRef} className={styles.consoleInner} />
    </div>
  );
}

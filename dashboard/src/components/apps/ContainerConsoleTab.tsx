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
      fontSize: 12,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: '#070708',
        foreground: '#e4e4e7',
        cursor: '#a855f7',
        selectionBackground: 'rgba(168, 85, 247, 0.3)',
        black: '#000000',
        red: '#ef4444',
        green: '#10b981',
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
      try {
        fitAddon.fit();
      } catch (e) {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/docker/exec?containerId=${encodeURIComponent(containerId)}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      term.write(`\r\n\x1b[1;35m==> Connected to exec console (${containerName}) <==\x1b[0m\r\n\r\n`);
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
        <AlertCircle size={28} style={{ color: '#52525b' }} />
        <span className={styles.comingSoonText}>
          Exec console unavailable. Container must be in a running state.
        </span>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', background: '#070708', padding: '6px', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

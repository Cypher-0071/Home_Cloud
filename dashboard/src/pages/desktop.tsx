import { useState, useEffect, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Terminal as TerminalIcon,
  LogOut,
  Folder,
  Box,
  Zap,
} from 'lucide-react';

import OSWindow from '../components/OSWindow';
import SystemMonitorApp from '../components/apps/SystemMonitorApp';
import TerminalApp from '../components/apps/TerminalApp';
import FileExplorer from './files';
import DockerApp from '../components/apps/DockerApp';
import { useNetworkDetector } from '../hooks/useNetworkDetector';

// Error boundary prevents a crashing child from blacking out the whole shell
class ErrorBoundary extends Component<
  { children: React.ReactNode; label?: string },
  { hasError: boolean; error?: string }
> {
  constructor(props: { children: React.ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: '12px',
          color: 'var(--text-secondary)', padding: '24px', textAlign: 'center',
        }}>
          <span style={{ fontSize: '24px' }}>⚠</span>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
            {this.props.label ?? 'App'} crashed
          </p>
          <p style={{ margin: 0, fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
            {this.state.error}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: '8px', padding: '6px 14px', borderRadius: '6px',
              background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
              color: 'var(--accent)', cursor: 'pointer', fontSize: '12px',
              fontFamily: 'var(--sans)',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface WindowState {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export default function Desktop() {
  const navigate = useNavigate();
  const net = useNetworkDetector();
  const [time, setTime] = useState('');
  const [maxZIndex, setMaxZIndex] = useState(10);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTime(
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) +
        '  ' +
        d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      );
    };
    updateTime();
    const id = setInterval(updateTime, 1000);
    return () => clearInterval(id);
  }, []);

  // Deep-link: open window from router path
  useEffect(() => {
    const path = window.location.pathname.replace(/^\//, '');
    const validPaths = ['terminal', 'metrics', 'files', 'docker'];
    if (path && validPaths.includes(path)) {
      const targetId = path;
      const newZ = maxZIndex + 1;
      setMaxZIndex(newZ);
      setWindows(prev =>
        prev.map(w =>
          w.id === targetId ? { ...w, isOpen: true, isMinimized: false, zIndex: newZ } : w,
        ),
      );
      setActiveWindowId(targetId);
    }
  }, []);

  const [windows, setWindows] = useState<WindowState[]>([
    {
      id: 'metrics',
      title: 'Activity Monitor',
      icon: <Activity size={14} />,
      component: <ErrorBoundary label="Activity Monitor"><SystemMonitorApp /></ErrorBoundary>,
      isOpen: true,
      isMinimized: false,
      isMaximized: false,
      x: 60,
      y: 60,
      width: 760,
      height: 520,
      zIndex: 10,
    },
    {
      id: 'files',
      title: 'File Explorer',
      icon: <Folder size={14} />,
      component: <ErrorBoundary label="File Explorer"><FileExplorer /></ErrorBoundary>,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      x: 90,
      y: 75,
      width: 820,
      height: 500,
      zIndex: 2,
    },
    {
      id: 'terminal',
      title: 'Terminal',
      icon: <TerminalIcon size={14} />,
      component: <ErrorBoundary label="Terminal"><TerminalApp /></ErrorBoundary>,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      x: 120,
      y: 90,
      width: 680,
      height: 440,
      zIndex: 1,
    },
    {
      id: 'docker',
      title: 'Docker Manager',
      icon: <Box size={14} />,
      component: <ErrorBoundary label="Docker Manager"><DockerApp /></ErrorBoundary>,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      x: 110,
      y: 70,
      width: 860,
      height: 520,
      zIndex: 3,
    },
  ]);

  // Bring window to front
  const focusWindow = (id: string) => {
    setActiveWindowId(id);
    const newZ = maxZIndex + 1;
    setMaxZIndex(newZ);
    setWindows(prev =>
      prev.map(w => (w.id === id ? { ...w, zIndex: newZ, isMinimized: false } : w)),
    );
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, isOpen: false } : w)));
    if (activeWindowId === id) setActiveWindowId(null);
  };

  const minimizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, isMinimized: true } : w)));
    if (activeWindowId === id) setActiveWindowId(null);
  };

  const maximizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w)));
    focusWindow(id);
  };

  const moveWindow = (id: string, x: number, y: number) => {
    setWindows(prev =>
      prev.map(w => (w.id === id ? { ...w, x, y: Math.max(0, y) } : w)),
    );
  };

  const resizeWindow = (id: string, width: number, height: number) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, width, height } : w)));
  };

  // Taskbar icon click
  const handleDockClick = (id: string) => {
    const win = windows.find(w => w.id === id);
    if (!win) return;

    if (!win.isOpen) {
      setWindows(prev => prev.map(w => (w.id === id ? { ...w, isOpen: true, isMinimized: false } : w)));
      focusWindow(id);
    } else if (win.isMinimized) {
      focusWindow(id);
    } else if (activeWindowId === id) {
      minimizeWindow(id);
    } else {
      focusWindow(id);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) { navigate('/login'); return; }
    } catch {
      /* fall through */
    }
    navigate('/login');
  };

  return (
    <div className="desktop">
      {/* Workspace — windows live here */}
      <div className="desktop-workspace">
        {windows.map(win => (
          <OSWindow
            key={win.id}
            id={win.id}
            title={win.title}
            icon={win.icon}
            isOpen={win.isOpen}
            isMinimized={win.isMinimized}
            isMaximized={win.isMaximized}
            x={win.x}
            y={win.y}
            width={win.width}
            height={win.height}
            zIndex={win.zIndex}
            active={activeWindowId === win.id}
            onFocus={() => focusWindow(win.id)}
            onClose={() => closeWindow(win.id)}
            onMinimize={() => minimizeWindow(win.id)}
            onMaximize={() => maximizeWindow(win.id)}
            onMove={(x, y) => moveWindow(win.id, x, y)}
            onResize={(w, h) => resizeWindow(win.id, w, h)}
          >
            {win.component}
          </OSWindow>
        ))}
      </div>

      {/* Taskbar */}
      <div className="taskbar">
        <div className="taskbar-left" />

        {/* Center: app icons */}
        <div className="taskbar-center">
          {windows.map(win => {
            const isActive = activeWindowId === win.id && win.isOpen && !win.isMinimized;
            return (
              <button
                key={win.id}
                className={`dock-item${isActive ? ' active' : ''}`}
                onClick={() => handleDockClick(win.id)}
                aria-label={win.title}
              >
                {win.icon}
                <span className="dock-tooltip">{win.title}</span>
                {win.isOpen && <span className="dock-item-dot" />}
              </button>
            );
          })}
        </div>

        {/* Right: system tray */}
        <div className="taskbar-right">
          {net.isDirectLocal ? (
            <div
              className="tray-tunnel"
              style={{
                color: 'var(--ok)',
                borderColor: 'oklch(68% 0.18 145 / 0.25)',
                background: 'var(--ok-dim)',
              }}
              title={`Connected directly over Home Wi-Fi LAN (${net.serverLocalIp})`}
            >
              <Zap size={11} fill="currentColor" />
              LAN ({net.serverLocalIp})
            </div>
          ) : (
            <div
              className="tray-tunnel"
              title={
                net.isLocalLAN
                  ? `Redirecting to local Wi-Fi LAN (${net.serverLocalIp})…`
                  : 'Connected over Cloudflare Remote Tunnel'
              }
            >
              <span className="tray-dot" />
              {net.isLocalLAN ? 'Upgrading to LAN…' : 'Tunnel'}
            </div>
          )}
          <span className="tray-time">{time}</span>
          <button
            className="tray-signout"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

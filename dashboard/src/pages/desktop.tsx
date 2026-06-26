import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Terminal as TerminalIcon,
  LogOut,
  Wifi,
  Folder
} from 'lucide-react';

import OSWindow from '../components/OSWindow';
import SystemMonitorApp from '../components/apps/SystemMonitorApp';
import TerminalApp from '../components/apps/TerminalApp';
import FileExplorer from './files';

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
  const [time, setTime] = useState('');
  const [maxZIndex, setMaxZIndex] = useState(10);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  // Live status bar clock
  useEffect(() => {
    const updateTime = () => {
      const date = new Date();
      setTime(
        date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
        '  ' +
        date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Deep-linking from router path to open corresponding OS window
  useEffect(() => {
    const path = window.location.pathname.replace(/^\//, '');
    const validPaths = ['terminal', 'metrics', 'files'];
    if (path && validPaths.includes(path)) {
      const targetId = path === 'metrics' ? 'metrics' : path;
      const newZ = maxZIndex + 1;
      setMaxZIndex(newZ);
      setWindows(prev =>
        prev.map(w =>
          w.id === targetId ? { ...w, isOpen: true, isMinimized: false, zIndex: newZ } : w
        )
      );
      setActiveWindowId(targetId);
    }
  }, []);

  // System windows configurations
  const [windows, setWindows] = useState<WindowState[]>([
    {
      id: 'metrics',
      title: 'Activity Monitor',
      icon: <Activity size={18} />,
      component: <SystemMonitorApp />,
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
      icon: <Folder size={18} />,
      component: <FileExplorer />,
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
      title: 'Secure Shell terminal (bash)',
      icon: <TerminalIcon size={18} />,
      component: <TerminalApp />,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      x: 120,
      y: 90,
      width: 680,
      height: 440,
      zIndex: 1,
    },
  ]);

  // Focus a window (bring to front)
  const focusWindow = (id: string) => {
    setActiveWindowId(id);
    const newZ = maxZIndex + 1;
    setMaxZIndex(newZ);

    setWindows(prev =>
      prev.map(w => (w.id === id ? { ...w, zIndex: newZ, isMinimized: false } : w))
    );
  };

  // Close a window
  const closeWindow = (id: string) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, isOpen: false } : w)));
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  };

  // Minimize a window
  const minimizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, isMinimized: true } : w)));
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  };

  // Maximize a window toggle
  const maximizeWindow = (id: string) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w)));
    focusWindow(id);
  };

  // Move a window
  const moveWindow = (id: string, x: number, y: number) => {
    // Keep window titlebar visible within top boundary
    const boundedY = Math.max(0, y);
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, x, y: boundedY } : w)));
  };

  // Resize a window
  const resizeWindow = (id: string, width: number, height: number) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, width, height } : w)));
  };

  // Dock icon handler
  const handleDockClick = (id: string) => {
    const targetWin = windows.find(w => w.id === id);
    if (!targetWin) return;

    if (!targetWin.isOpen) {
      // Open window
      setWindows(prev => prev.map(w => (w.id === id ? { ...w, isOpen: true, isMinimized: false } : w)));
      focusWindow(id);
    } else if (targetWin.isMinimized) {
      // Restore window
      focusWindow(id);
    } else if (activeWindowId === id) {
      // Minimize if already focused & active (macOS click behaviour)
      minimizeWindow(id);
    } else {
      // Bring to front
      focusWindow(id);
    }
  };

  // Handle system logout
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      if (response.ok) {
        navigate('/login');
      }
    } catch (err) {
      console.error('Logout request failed', err);
      // Fallback
      navigate('/login');
    }
  };

  return (
    <div className="desktop">
      {/* Dynamic desktop glass flows */}
      <div className="desktop-bg-glows">
        <div className="glow-spot glow-1" />
        <div className="glow-spot glow-2" />
        <div className="glow-spot glow-3" />
      </div>

      {/* Top Status Bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="brand-section">
            <span className="brand-status-dot" />
            <span style={{ fontWeight: 700 }}>Home Cloud OS</span>
          </div>
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
            v1.0.0-stable
          </span>
        </div>

        <div className="top-bar-right">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}>
            <Wifi size={14} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '11px' }}>Tunnel Online</span>
          </div>
          <span className="top-bar-time">{time}</span>
          <button className="logout-button" onClick={handleLogout} title="Shutdown System Session">
            <LogOut size={12} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Workspace Area */}
      <div className="desktop-workspace">
        {windows.map(win => (
          <OSWindow
            key={win.id}
            id={win.id}
            title={win.title}
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

      {/* Bottom Dock Menu */}
      <div className="dock-container">
        <div className="dock">
          {windows.map(win => {
            const isActive = activeWindowId === win.id && win.isOpen && !win.isMinimized;
            return (
              <div
                key={win.id}
                className={`dock-item ${isActive ? 'active' : ''}`}
                onClick={() => handleDockClick(win.id)}
              >
                {win.icon}
                <div className="dock-tooltip">{win.title}</div>
                {win.isOpen && <div className="dock-item-dot" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

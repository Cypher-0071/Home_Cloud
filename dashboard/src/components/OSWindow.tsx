import React, { useRef } from 'react';

interface OSWindowProps {
  id: string;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  active: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  children: React.ReactNode;
}

export default function OSWindow({
  id,
  title,
  isOpen,
  isMinimized,
  isMaximized,
  x,
  y,
  width,
  height,
  zIndex,
  active,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onMove,
  onResize,
  children,
}: OSWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleTitleBarMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    onFocus();

    // Check if clicked a window dot control, if so, don't drag
    if ((e.target as HTMLElement).closest('.win-dot')) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = x;
    const initialY = y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      onMove(initialX + deltaX, initialY + deltaY);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onFocus();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialWidth = width;
    const initialHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      // Enforce minimum width/height limits
      onResize(
        Math.max(480, initialWidth + deltaX),
        Math.max(320, initialHeight + deltaY)
      );
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClickTitlebar = () => {
    onMaximize();
  };

  return (
    <div
      ref={windowRef}
      id={`win-${id}`}
      className={`os-window ${active ? 'active' : ''} ${isMaximized ? 'maximized' : ''} ${isMinimized ? 'minimized' : ''}`}
      style={{
        left: isMaximized ? 0 : `${x}px`,
        top: isMaximized ? 0 : `${y}px`,
        width: isMaximized ? '100%' : `${width}px`,
        height: isMaximized ? 'calc(100% - 76px)' : `${height}px`,
        zIndex: zIndex,
      }}
      onClick={onFocus}
    >
      {/* Title bar */}
      <div
        className="window-titlebar"
        onMouseDown={handleTitleBarMouseDown}
        onDoubleClick={handleDoubleClickTitlebar}
      >
        <div className="window-controls">
          <button
            className="win-dot close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close"
          >
            <svg width="6" height="6" viewBox="0 0 10 10">
              <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="win-dot minimize"
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            title="Minimize"
          >
            <svg width="6" height="6" viewBox="0 0 10 10">
              <path d="M1 5 L9 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="win-dot maximize"
            onClick={(e) => {
              e.stopPropagation();
              onMaximize();
            }}
            title={isMaximized ? "Restore Window" : "Maximize"}
          >
            <svg width="6" height="6" viewBox="0 0 10 10">
              <rect x="1" y="1" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
        <div className="window-title">{title}</div>
        <div className="window-actions">
          {/* Subtle decoration/info */}
          <span style={{ opacity: active ? 1 : 0.5, transition: 'opacity 0.2s' }}>
            {active ? '● active' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="window-body">
        {children}
      </div>

      {/* Resize Handle */}
      {!isMaximized && (
        <div className="window-resize-handle" onMouseDown={handleResizeMouseDown} />
      )}
    </div>
  );
}

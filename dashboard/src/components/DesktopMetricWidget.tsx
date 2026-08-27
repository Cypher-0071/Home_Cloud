import { Activity, ArrowDown } from 'lucide-react';
import { useSystemMetrics } from '../hooks/useSystemMetrics';

interface DesktopMetricWidgetProps {
  active?: boolean;
  isOpen?: boolean;
  onClick: () => void;
}

function formatSpeed(bytesPerSec?: number | null): string {
  if (!bytesPerSec || bytesPerSec <= 0 || isNaN(bytesPerSec)) return '0 B/s';
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(bytesPerSec >= 1024 * 100 ? 0 : 1)} KB/s`;
  if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
}

export default function DesktopMetricWidget({
  active = false,
  onClick,
}: DesktopMetricWidgetProps) {
  const { connected, cpuLoad, memUsedPct, rxSec } = useSystemMetrics();

  // Semantic color for CPU load (>90% red, >75% amber, default neutral white)
  const cpuColor =
    cpuLoad > 90
      ? 'var(--error, #f87171)'
      : cpuLoad > 75
        ? 'var(--warn, #fbbf24)'
        : 'var(--text-primary, #ededed)';

  const ramColor =
    memUsedPct > 90
      ? 'var(--error, #f87171)'
      : memUsedPct > 75
        ? 'var(--warn, #fbbf24)'
        : 'var(--text-primary, #ededed)';

  return (
    <button
      className={`desktop-metric-widget${active ? ' active' : ''}`}
      onClick={onClick}
      aria-label="Activity Monitor"
      title="Activity Monitor · Click to toggle"
    >
      {/* Icon */}
      <Activity size={14} className="metric-widget-icon" />

      {/* Metrics Badges */}
      <div className="metric-widget-stats">
        <div className="metric-chip">
          <span className="metric-chip-label">CPU</span>
          <span className="metric-chip-val" style={{ color: cpuColor }}>
            {connected ? `${cpuLoad.toFixed(0)}%` : '—'}
          </span>
        </div>

        <span className="metric-divider" />

        <div className="metric-chip">
          <span className="metric-chip-label">RAM</span>
          <span className="metric-chip-val" style={{ color: ramColor }}>
            {connected ? `${memUsedPct.toFixed(0)}%` : '—'}
          </span>
        </div>

        <span className="metric-divider" />

        <div className="metric-chip">
          <span className="metric-chip-label" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <ArrowDown size={10} style={{ strokeWidth: 2.2 }} />
          </span>
          <span className="metric-chip-val" style={{ color: 'var(--text-primary, #ededed)' }}>
            {connected ? formatSpeed(rxSec) : '—'}
          </span>
        </div>
      </div>
      
      {/* Tooltip */}
      <span className="dock-tooltip">Activity Monitor</span>
    </button>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  ArrowDown,
  ArrowUp,
  Wifi,
  Globe,
  Activity,
} from 'lucide-react';
import { useNetworkDetector } from '../../hooks/useNetworkDetector';

// ─── Telemetry Data Types ───

interface CpuLoad {
  avgLoad?: number;
  currentLoad: number;
  currentLoadUser: number;
  currentLoadSystem: number;
  currentLoadIdle: number;
  cpus?: { load: number }[];
}

interface MemData {
  total: number;
  used: number;
  free: number;
  active?: number;
  available: number;
  swaptotal: number;
  swapused: number;
  swapfree: number;
}

interface DiskPartition {
  fs: string;
  type: string;
  size: number;
  used: number;
  available: number;
  use: number;
  mount: string;
}

interface NetworkInterfaceStats {
  iface: string;
  operstate?: string;
  rx_bytes: number;
  tx_bytes: number;
  rx_sec?: number | null;
  tx_sec?: number | null;
  ms?: number;
}

interface MetricsPayload {
  cpu: CpuLoad;
  mem: MemData;
  disk: DiskPartition[];
  network?: NetworkInterfaceStats[];
}

// ─── Format Helpers ───

function formatBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(1)} ${units[i]}`;
}

function formatRate(bytesPerSec?: number | null): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.min(Math.floor(Math.log(bytesPerSec) / Math.log(1024)), units.length - 1);
  const val = bytesPerSec / Math.pow(1024, i);
  return `${val.toFixed(1)} ${units[i]}`;
}

// ─── UI Primitives ───

/**
 * Clean neutral MeterBar:
 * - Neutral white (#ffffff) for normal load (<= 75%)
 * - Amber (#fbbf24) for warning (> 75%)
 * - Red (#f87171) for critical (> 90%)
 * - Track background: rgba(255, 255, 255, 0.08)
 * - Zero glow / drop shadows
 */
function MeterBar({
  value,
  height = 6,
}: {
  value: number;
  height?: number;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const color =
    clamped > 90
      ? 'var(--error, #f87171)'
      : clamped > 75
        ? 'var(--warn, #fbbf24)'
        : '#ffffff';

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        borderRadius: `${height / 2}px`,
        background: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        position: 'relative',
      }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        style={{
          height: '100%',
          width: `${clamped}%`,
          background: color,
          borderRadius: `${height / 2}px`,
          transition: 'width 400ms var(--ease-out-quart), background-color 300ms',
        }}
      />
    </div>
  );
}

/**
 * Minimalist Sparkline:
 * - Clean neutral white/gray stroke (#e4e4e7)
 * - No gimmicky gradient fills or blue stops
 */
function SparklineChart({
  points,
  height = 42,
}: {
  points: number[];
  height?: number;
}) {
  if (points.length < 2) return null;

  const W = 300;
  const H = height;
  const max = 100;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * W;
    const clampedV = Math.min(100, Math.max(0, v));
    const y = H - (clampedV / max) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div style={{ width: '100%', position: 'relative', height: `${height}px` }}>
      {/* Subtle baseline */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: `${height}px`, display: 'block', overflow: 'visible' }}
        aria-hidden="true"
      >
        <line
          x1="0"
          y1={H - 2}
          x2={W}
          y2={H - 2}
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth="1"
        />
        <polyline
          points={coords.join(' ')}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/** Monospace data metric value */
function Val({
  children,
  muted = false,
  highlight = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--mono)',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '-0.01em',
        color: muted
          ? 'var(--text-muted)'
          : highlight
            ? 'var(--accent-text, #ffffff)'
            : 'var(--text-primary)',
      }}
    >
      {children}
    </span>
  );
}

/** Section label — uppercase, muted, small */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '10px',
        fontFamily: 'var(--sans)',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

/** Stat row: label on left, value on right */
function StatRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string | React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '12px',
        lineHeight: '1.4',
      }}
    >
      <span
        style={{
          fontSize: '11.5px',
          color: muted ? 'var(--text-muted)' : 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--sans)',
        }}
      >
        {label}
      </span>
      {typeof value === 'string' ? <Val muted={muted}>{value}</Val> : value}
    </div>
  );
}

/**
 * Metric card container:
 * Dense Mica dark surface: rgba(255, 255, 255, 0.03),
 * 1px solid rgba(255, 255, 255, 0.08) border, 8px radius
 */
function MetricCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Card header: clean icon chip + title and subtitle badge */
function CardHeader({
  icon,
  title,
  subtitle,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        paddingBottom: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--text-primary)',
            borderRadius: '6px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <p
              style={{
                margin: 0,
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </p>
          </div>
          {subtitle && (
            <p
              style={{
                margin: 0,
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--mono)',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {badge && <div style={{ flexShrink: 0 }}>{badge}</div>}
    </div>
  );
}

// ─── Main System Monitor App Component ───

export default function SystemMonitorApp() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Network context (detects LAN vs Tunnel)
  const netDetector = useNetworkDetector();

  // Rolling 60-point CPU history
  const cpuHistoryRef = useRef<number[]>([]);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);

  useEffect(() => {
    mountedRef.current = true;

    const connect = () => {
      if (!mountedRef.current) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const es = new EventSource('/api/metrics');
      eventSourceRef.current = es;

      es.onopen = () => {
        if (mountedRef.current) setConnected(true);
      };

      es.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const parsed: MetricsPayload = JSON.parse(event.data);
          setData(parsed);
          setConnected(true);

          // Accumulate CPU history (up to 60 points)
          cpuHistoryRef.current = [
            ...cpuHistoryRef.current.slice(-59),
            parsed.cpu.currentLoad,
          ];
          setCpuHistory([...cpuHistoryRef.current]);
        } catch (err) {
          console.error('[SystemMonitor] SSE parse error:', err);
        }
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        es.close();
        eventSourceRef.current = null;
        reconnectTimerRef.current = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // ─── Loading / Connecting View ───
  if (!data) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '14px',
          color: 'var(--text-secondary)',
          background: 'transparent',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid rgba(255, 255, 255, 0.08)',
            }}
          />
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: '#ffffff',
              animation: 'sys-spin 0.75s linear infinite',
            }}
          />
        </div>
        <span
          style={{
            fontSize: '11.5px',
            fontFamily: 'var(--mono)',
            color: 'var(--text-muted)',
            letterSpacing: '-0.01em',
          }}
        >
          Establishing telemetry stream…
        </span>
        <style>{`@keyframes sys-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const { cpu, mem, disk, network } = data;
  const memUsedPct = mem.total > 0 ? (mem.used / mem.total) * 100 : 0;
  const swapUsedPct = mem.swaptotal > 0 ? (mem.swapused / mem.swaptotal) * 100 : 0;

  // Active network interface (filter out virtual/loopback if possible)
  const activeNet =
    network?.find(
      (n) => n.operstate === 'up' && !n.iface.startsWith('lo') && !n.iface.startsWith('veth'),
    ) || network?.[0];

  return (
    <div
      style={{
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowY: 'auto',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* ─── Telemetry Header Status Bar ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          paddingBottom: '2px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: connected ? 'var(--ok, #34d399)' : 'var(--error, #f87171)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--mono)',
            }}
          >
            {connected ? 'Live telemetry · 2s interval' : 'Stream disconnected · retrying…'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'var(--mono)',
            }}
          >
            Host: {netDetector.serverLocalIp || 'localhost'}
          </span>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10.5px',
              fontFamily: 'var(--mono)',
              padding: '2px 6px',
              borderRadius: '4px',
              background: netDetector.isDirectLocal
                ? 'rgba(52, 211, 153, 0.12)'
                : 'rgba(255, 255, 255, 0.06)',
              color: netDetector.isDirectLocal ? 'var(--ok, #34d399)' : 'var(--text-secondary)',
              border: `1px solid ${
                netDetector.isDirectLocal
                  ? 'rgba(52, 211, 153, 0.25)'
                  : 'rgba(255, 255, 255, 0.08)'
              }`,
            }}
          >
            {netDetector.isDirectLocal ? <Wifi size={10} /> : <Globe size={10} />}
            <span>{netDetector.isDirectLocal ? 'Direct LAN' : 'Cloudflare Tunnel'}</span>
          </div>
        </div>
      </div>

      {/* ─── 2x2 Telemetry Grid (CPU, RAM, Storage, Network) ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '12px',
        }}
      >
        {/* ─── Card 1: CPU Telemetry ─── */}
        <MetricCard>
          <CardHeader
            icon={<Cpu size={15} />}
            title="Processor"
            subtitle={`${cpu.cpus?.length ?? '?'} cores active`}
            badge={
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color:
                    cpu.currentLoad > 90
                      ? 'var(--error, #f87171)'
                      : cpu.currentLoad > 75
                        ? 'var(--warn, #fbbf24)'
                        : 'var(--text-primary)',
                }}
              >
                {cpu.currentLoad.toFixed(1)}%
              </span>
            }
          />

          {/* Meter bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <SectionLabel>Total Utilization</SectionLabel>
              <Val muted>{cpu.currentLoad.toFixed(1)}%</Val>
            </div>
            <MeterBar value={cpu.currentLoad} />
          </div>

          {/* Breakdown: User / System / Idle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <StatRow label="User Space" value={`${cpu.currentLoadUser?.toFixed(1)}%`} />
            <StatRow label="System Kernel" value={`${cpu.currentLoadSystem?.toFixed(1)}%`} />
            <StatRow label="Idle Capacity" value={`${cpu.currentLoadIdle?.toFixed(1)}%`} muted />
          </div>

          {/* Per-core mini distribution (if multi-core) */}
          {cpu.cpus && cpu.cpus.length > 1 && (
            <div
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                paddingTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel>Core Distribution</SectionLabel>
                <span style={{ fontSize: '10.5px', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                  {cpu.cpus.length} Threads
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(cpu.cpus.length, 8)}, 1fr)`,
                  gap: '4px',
                  alignItems: 'flex-end',
                  height: '24px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '4px',
                  borderRadius: '4px',
                }}
              >
                {cpu.cpus.map((c, idx) => (
                  <div
                    key={idx}
                    title={`Core ${idx}: ${c.load.toFixed(1)}%`}
                    style={{
                      height: '100%',
                      background: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: '2px',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.min(100, Math.max(0, c.load))}%`,
                        background:
                          c.load > 90
                            ? 'var(--error, #f87171)'
                            : c.load > 75
                              ? 'var(--warn, #fbbf24)'
                              : '#ffffff',
                        borderRadius: '2px',
                        transition: 'height 300ms ease',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Minimalist 60s Sparkline History */}
          {cpuHistory.length > 1 && (
            <div
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                paddingTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel>60s History</SectionLabel>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontFamily: 'var(--mono)',
                    color: 'var(--text-muted)',
                  }}
                >
                  last: {cpu.currentLoad.toFixed(1)}%
                </span>
              </div>
              <SparklineChart points={cpuHistory} height={36} />
            </div>
          )}
        </MetricCard>

        {/* ─── Card 2: Memory & Swap ─── */}
        <MetricCard>
          <CardHeader
            icon={<MemoryStick size={15} />}
            title="Memory"
            subtitle={`${formatBytes(mem.total)} installed`}
            badge={
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color:
                    memUsedPct > 90
                      ? 'var(--error, #f87171)'
                      : memUsedPct > 75
                        ? 'var(--warn, #fbbf24)'
                        : 'var(--text-primary)',
                }}
              >
                {memUsedPct.toFixed(1)}%
              </span>
            }
          />

          {/* RAM utilization */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <SectionLabel>Physical RAM</SectionLabel>
              <Val>
                {formatBytes(mem.used)} / {formatBytes(mem.total)}
              </Val>
            </div>
            <MeterBar value={memUsedPct} />
          </div>

          {/* Breakdown: Used / Free / Available */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <StatRow label="In Use" value={formatBytes(mem.used)} />
            <StatRow label="Available" value={formatBytes(mem.available)} />
            <StatRow label="Unallocated Free" value={formatBytes(mem.free)} muted />
          </div>

          {/* Swap Section */}
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              paddingTop: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <SectionLabel>Virtual Swap</SectionLabel>
              <Val muted={mem.swaptotal === 0}>
                {mem.swaptotal > 0
                  ? `${formatBytes(mem.swapused)} / ${formatBytes(mem.swaptotal)} (${swapUsedPct.toFixed(1)}%)`
                  : 'Inactive'}
              </Val>
            </div>
            <MeterBar value={mem.swaptotal > 0 ? swapUsedPct : 0} />
            {mem.swaptotal > 0 && (
              <div style={{ marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <StatRow label="Swap Used" value={formatBytes(mem.swapused)} />
                <StatRow label="Swap Free" value={formatBytes(mem.swapfree)} muted />
              </div>
            )}
          </div>
        </MetricCard>

        {/* ─── Card 3: Storage Partitions ─── */}
        <MetricCard>
          <CardHeader
            icon={<HardDrive size={15} />}
            title="Storage"
            subtitle={`${disk.length} filesystem${disk.length !== 1 ? 's' : ''}`}
            badge={
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                {disk.reduce((acc, d) => acc + (d.size || 0), 0) > 0
                  ? formatBytes(disk.reduce((acc, d) => acc + (d.size || 0), 0))
                  : ''}
              </span>
            }
          />

          {/* Disk Partitions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {disk.map((d, i) => (
              <div
                key={d.mount}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  paddingTop: i === 0 ? 0 : '8px',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.mount}
                    </span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      {d.type || d.fs}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      {formatBytes(d.used)} of {formatBytes(d.size)}
                    </span>
                    <Val highlight>{d.use.toFixed(1)}%</Val>
                  </div>
                </div>

                <MeterBar value={d.use} height={5} />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10.5px',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  <span>Free: {formatBytes(d.available)}</span>
                  <span>Usage: {d.use > 90 ? 'Critical' : d.use > 75 ? 'Warning' : 'Normal'}</span>
                </div>
              </div>
            ))}
          </div>
        </MetricCard>

        {/* ─── Card 4: Network & Transport Telemetry ─── */}
        <MetricCard>
          <CardHeader
            icon={<Network size={15} />}
            title="Network"
            subtitle={activeNet?.iface ? `Interface: ${activeNet.iface}` : 'Link status'}
            badge={
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--text-secondary)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {activeNet?.operstate ? activeNet.operstate.toUpperCase() : 'ONLINE'}
              </span>
            }
          />

          {/* Network Connection Mode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <StatRow
              label="Routing Mode"
              value={
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11.5px',
                    color: netDetector.isDirectLocal ? 'var(--ok, #34d399)' : 'var(--text-primary)',
                  }}
                >
                  {netDetector.isDirectLocal ? 'Direct Wi-Fi LAN' : 'Cloudflare Tunnel'}
                </span>
              }
            />
            <StatRow
              label="Server Local IP"
              value={netDetector.serverLocalIp ? `${netDetector.serverLocalIp}:${netDetector.serverLocalPort}` : '127.0.0.1:3000'}
            />
            {netDetector.cfDomain && (
              <StatRow label="Remote Domain" value={netDetector.cfDomain} />
            )}
          </div>

          {/* Live Throughput Transfer Rates */}
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              paddingTop: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <SectionLabel>Interface Traffic</SectionLabel>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
              }}
            >
              {/* Inbound / Download */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ArrowDown size={12} style={{ color: 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>
                    RX (In)
                  </span>
                </div>
                <Val>{formatRate(activeNet?.rx_sec)}</Val>
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {activeNet?.rx_bytes ? formatBytes(activeNet.rx_bytes) : '—'}
                </span>
              </div>

              {/* Outbound / Upload */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ArrowUp size={12} style={{ color: 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>
                    TX (Out)
                  </span>
                </div>
                <Val>{formatRate(activeNet?.tx_sec)}</Val>
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {activeNet?.tx_bytes ? formatBytes(activeNet.tx_bytes) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick System Summary */}
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              paddingTop: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Activity size={12} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--sans)' }}>
                Sample Rate
              </span>
            </div>
            <Val muted>2000 ms</Val>
          </div>
        </MetricCard>
      </div>

      {/* CSS Keyframes for spin */}
      <style>{`@keyframes sys-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

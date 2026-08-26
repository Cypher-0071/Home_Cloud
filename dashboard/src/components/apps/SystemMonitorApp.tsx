import { useEffect, useRef, useState } from 'react';
import { Cpu, HardDrive, MemoryStick } from 'lucide-react';

interface CpuLoad {
  avgLoad: number;
  currentLoad: number;
  currentLoadUser: number;
  currentLoadSystem: number;
  currentLoadIdle: number;
  cpus: { load: number }[];
}

interface MemData {
  total: number;
  used: number;
  free: number;
  active: number;
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

interface MetricsPayload {
  cpu: CpuLoad;
  mem: MemData;
  disk: DiskPartition[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/** Horizontal meter bar — 6px pill with smooth glow */
function MeterBar({ value }: { value: number }) {
  const color =
    value > 90
      ? 'var(--error)'
      : value > 75
        ? 'var(--warn)'
        : 'var(--accent)';

  const glowColor =
    value > 90
      ? 'rgba(248, 113, 113, 0.4)'
      : value > 75
        ? 'rgba(251, 191, 36, 0.4)'
        : 'rgba(56, 189, 248, 0.4)';

  return (
    <div style={{
      width: '100%',
      height: '6px',
      borderRadius: '3px',
      background: 'rgba(255, 255, 255, 0.06)',
      border: '1px solid rgba(255, 255, 255, 0.04)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        height: '100%',
        width: `${Math.min(100, Math.max(0, value))}%`,
        background: color,
        borderRadius: '3px',
        boxShadow: `0 0 8px ${glowColor}`,
        transition: 'width 600ms var(--ease-out-quart), background 300ms',
      }} />
    </div>
  );
}

/** Rolling 60-point CPU sparkline — drawn with gradient fill */
function SparklineChart({ points }: { points: number[] }) {
  if (points.length < 2) return null;

  const W = 200;
  const H = 42;
  const max = 100;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - (v / max) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const areaCoords = [
    `0,${H}`,
    ...coords,
    `${W},${H}`,
  ].join(' ');

  const gradId = 'cpu-grad-' + Math.random().toString(36).substring(2, 7);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '42px', display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaCoords} fill={`url(#${gradId})`} />
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Monospace data value */
function Val({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span style={{
      fontFamily: 'var(--mono)',
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      color: muted ? 'var(--text-muted)' : 'var(--text-primary)',
    }}>
      {children}
    </span>
  );
}

/** Section label — uppercase, muted, small */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: '10.5px',
      fontFamily: 'var(--sans)',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

/** Stat row: label on left, value on right */
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</span>
      <Val>{value}</Val>
    </div>
  );
}

/** Metric card container — Acrylic glass */
function MetricCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(22, 28, 42, 0.55)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderTopColor: 'rgba(255, 255, 255, 0.16)',
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.40)',
    }}>
      {children}
    </div>
  );
}

/** Card header: icon chip + title/subtitle */
function CardHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{
        background: 'var(--accent-dim)',
        color: 'var(--accent)',
        borderRadius: '7px',
        width: '30px',
        height: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</p>
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{subtitle}</p>
      </div>
    </div>
  );
}

export default function SystemMonitorApp() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Rolling 60-point CPU history (ref to avoid re-render per tick)
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

          // Accumulate CPU history, cap at 60
          cpuHistoryRef.current = [
            ...cpuHistoryRef.current.slice(-59),
            parsed.cpu.currentLoad,
          ];
          setCpuHistory([...cpuHistoryRef.current]);
        } catch (err) {
          console.error('SSE JSON parsing error', err);
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

  // Loading state
  if (!data) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '14px',
        color: 'var(--text-secondary)',
      }}>
        <div style={{
          position: 'relative',
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid rgba(56, 189, 248, 0.15)',
          }} />
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: 'var(--accent)',
            boxShadow: '0 0 12px var(--accent-glow)',
            animation: 'spin 0.75s linear infinite',
          }} />
        </div>
        <span style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
          Establishing telemetry stream…
        </span>
      </div>
    );
  }

  const { cpu, mem, disk } = data;
  const memUsedPct = mem.total > 0 ? (mem.used / mem.total) * 100 : 0;
  const swapUsedPct = mem.swaptotal > 0 ? (mem.swapused / mem.swaptotal) * 100 : 0;

  return (
    <div style={{
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflowY: 'auto',
      height: '100%',
      boxSizing: 'border-box',
    }}>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: connected ? 'var(--ok)' : 'var(--error)',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
          {connected ? 'Live — streaming every 2s' : 'Disconnected — reconnecting...'}
        </span>
      </div>

      {/* CPU + Memory row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

        {/* CPU */}
        <MetricCard>
          <CardHeader
            icon={<Cpu size={15} />}
            title="CPU"
            subtitle={`${cpu.cpus?.length ?? '?'} cores`}
          />

          {/* Big value + meter */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <SectionLabel>Load</SectionLabel>
              <Val>{cpu.currentLoad.toFixed(1)}%</Val>
            </div>
            <MeterBar value={cpu.currentLoad} />
          </div>

          {/* Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <StatRow label="User" value={`${cpu.currentLoadUser?.toFixed(1)}%`} />
            <StatRow label="System" value={`${cpu.currentLoadSystem?.toFixed(1)}%`} />
            <StatRow label="Idle" value={`${cpu.currentLoadIdle?.toFixed(1)}%`} />
          </div>

          {/* Sparkline */}
          {cpuHistory.length > 1 && (
            <div>
              <div style={{ marginBottom: '4px' }}>
                <SectionLabel>60s history</SectionLabel>
              </div>
              <SparklineChart points={cpuHistory} />
            </div>
          )}
        </MetricCard>

        {/* Memory */}
        <MetricCard>
          <CardHeader
            icon={<MemoryStick size={15} />}
            title="Memory"
            subtitle={formatBytes(mem.total)}
          />

          {/* RAM */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <SectionLabel>RAM</SectionLabel>
              <Val>{formatBytes(mem.used)} / {formatBytes(mem.total)}</Val>
            </div>
            <MeterBar value={memUsedPct} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <StatRow label="Used" value={formatBytes(mem.used)} />
            <StatRow label="Free" value={formatBytes(mem.free)} />
            <StatRow label="Available" value={formatBytes(mem.available)} />
          </div>

          {/* Swap */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <SectionLabel>Swap</SectionLabel>
              <Val muted={mem.swaptotal === 0}>
                {mem.swaptotal > 0 ? `${swapUsedPct.toFixed(1)}%` : 'inactive'}
              </Val>
            </div>
            <MeterBar value={mem.swaptotal > 0 ? swapUsedPct : 0} />
            {mem.swaptotal > 0 && (
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <StatRow label="Used" value={formatBytes(mem.swapused)} />
                <StatRow label="Free" value={formatBytes(mem.swapfree)} />
              </div>
            )}
          </div>
        </MetricCard>
      </div>

      {/* Disk partitions */}
      <MetricCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HardDrive size={14} style={{ color: 'var(--accent)' }} />
          <SectionLabel>Disk Partitions ({disk.length})</SectionLabel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {disk.map((d, i) => (
            <div
              key={d.mount}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 0',
                borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              {/* Mount + fs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '12px',
                  color: 'var(--accent-text)',
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--accent-border)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  display: 'inline-block',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {d.mount}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                  {d.type}
                </span>
              </div>

              {/* Bar + size info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                <MeterBar value={d.use} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                    {formatBytes(d.used)} of {formatBytes(d.size)}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                    {formatBytes(d.available)} free
                  </span>
                </div>
              </div>

              {/* Percentage */}
              <Val>{d.use.toFixed(1)}%</Val>
            </div>
          ))}
        </div>
      </MetricCard>

      {/* CSS keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

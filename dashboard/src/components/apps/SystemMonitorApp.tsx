import { useEffect, useRef, useState } from 'react';
import { Cpu, HardDrive, Cpu as MemIcon, Activity } from 'lucide-react';

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
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

function GaugeRing({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative', width: '110px', height: '110px' }}>
        <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color || 'var(--accent)'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '28px'
        }}>
          <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>
            {Math.round(value)}%
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SystemMonitorApp() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/metrics');
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const parsed: MetricsPayload = JSON.parse(event.data);
        setData(parsed);
        setConnected(true);
      } catch (err) {
        console.error('SSE JSON parsing error', err);
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  if (!data) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '16px',
        padding: '40px',
        color: 'var(--text)'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '2px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ fontSize: '13px' }}>Connecting to system metrics stream...</span>
      </div>
    );
  }

  const { cpu, mem, disk } = data;
  const memUsedPercent = mem.total > 0 ? (mem.used / mem.total) * 100 : 0;
  const swapUsedPercent = mem.swaptotal > 0 ? (mem.swapused / mem.swaptotal) * 100 : 0;

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Connection Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-h)', fontSize: '16px', fontWeight: 600 }}>Activity Monitor</h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: connected ? '#10b981' : '#ef4444',
              boxShadow: connected ? '0 0 6px #10b981' : '0 0 6px #ef4444',
              display: 'inline-block'
            }} />
            {connected ? 'Real-time telemetry stream active' : 'Telemetry disconnected, reconnecting...'}
          </p>
        </div>
      </div>

      {/* Main Stats Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px'
      }}>
        {/* CPU Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(168, 85, 247, 0.1)',
              color: 'var(--accent)',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Cpu size={16} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-h)' }}>Processor (CPU)</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text)' }}>{cpu.cpus?.length || 4} Cores / Logical Units</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <GaugeRing value={cpu.currentLoad} label="Load" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ color: 'var(--text)' }}>User:</span>
                <span style={{ color: 'var(--text-h)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{cpu.currentLoadUser?.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ color: 'var(--text)' }}>System:</span>
                <span style={{ color: 'var(--text-h)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{cpu.currentLoadSystem?.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ color: 'var(--text)' }}>Idle:</span>
                <span style={{ color: 'var(--text-h)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{cpu.currentLoadIdle?.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Memory Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(6, 182, 212, 0.1)',
              color: '#06b6d4',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MemIcon size={16} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-h)' }}>System Memory (RAM)</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text)' }}>{formatBytes(mem.total)} Total physical</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <GaugeRing
              value={memUsedPercent}
              label="Memory"
              color="#06b6d4"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ color: 'var(--text)' }}>Used:</span>
                <span style={{ color: 'var(--text-h)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{formatBytes(mem.used)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ color: 'var(--text)' }}>Free:</span>
                <span style={{ color: 'var(--text-h)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{formatBytes(mem.free)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ color: 'var(--text)' }}>Available:</span>
                <span style={{ color: 'var(--text-h)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{formatBytes(mem.available)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Swap Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(236, 72, 153, 0.1)',
              color: '#ec4899',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={16} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-h)' }}>Virtual Cache (Swap)</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text)' }}>
                {mem.swaptotal > 0 ? `${formatBytes(mem.swaptotal)} configured` : 'Swap inactive/unused'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <GaugeRing
              value={mem.swaptotal > 0 ? swapUsedPercent : 0}
              label="Swap"
              color="#ec4899"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ color: 'var(--text)' }}>Swap Used:</span>
                <span style={{ color: 'var(--text-h)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                  {mem.swaptotal > 0 ? formatBytes(mem.swapused) : '0 B'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ color: 'var(--text)' }}>Swap Free:</span>
                <span style={{ color: 'var(--text-h)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                  {mem.swaptotal > 0 ? formatBytes(mem.swapfree) : '0 B'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disks Table Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.01)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '10px',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <HardDrive size={16} style={{ color: 'var(--accent)' }} />
          <h4 style={{ margin: 0, color: 'var(--text-h)', fontSize: '13px', fontWeight: 600 }}>Mounts & Storage partitions ({disk.length})</h4>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th style={{ padding: '8px 10px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text)', fontWeight: 600 }}>Mount Path</th>
                <th style={{ padding: '8px 10px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text)', fontWeight: 600 }}>Filesystem</th>
                <th style={{ padding: '8px 10px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text)', fontWeight: 600 }}>Capacity</th>
                <th style={{ padding: '8px 10px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text)', fontWeight: 600 }}>Used</th>
                <th style={{ padding: '8px 10px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text)', fontWeight: 600 }}>Available</th>
                <th style={{ padding: '8px 10px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text)', fontWeight: 600 }}>Usage Bar</th>
              </tr>
            </thead>
            <tbody>
              {disk.map((d) => {
                const fillPercent = d.use;
                const barColor = fillPercent > 85 ? '#ef4444' : fillPercent > 70 ? '#eab308' : 'var(--accent)';
                return (
                  <tr key={d.mount} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px', fontSize: '12px' }}>
                      <span style={{
                        background: 'rgba(168, 85, 247, 0.08)',
                        color: 'var(--accent)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontFamily: 'var(--mono)'
                      }}>{d.mount}</span>
                    </td>
                    <td style={{ padding: '10px', fontSize: '12px', color: 'var(--text-h)' }}>{d.fs} ({d.type})</td>
                    <td style={{ padding: '10px', fontSize: '12px', color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>{formatBytes(d.size)}</td>
                    <td style={{ padding: '10px', fontSize: '12px', color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>{formatBytes(d.used)}</td>
                    <td style={{ padding: '10px', fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{formatBytes(d.available)}</td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '80px', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${fillPercent}%`, background: barColor, borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>{fillPercent.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

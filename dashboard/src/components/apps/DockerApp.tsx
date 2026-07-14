import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, RefreshCw, Trash2, Box, AlertCircle, X, Cpu, HardDrive, Terminal } from 'lucide-react';
import styles from './docker.module.css';

/* ─── Types ─── */

interface DockerPort {
  IP?: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

interface Container {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Ports: DockerPort[];
  Created: number;
}

type ActionKind = 'start' | 'stop' | 'restart' | 'delete';

/* ─── Helpers ─── */

function getStatusClass(state: string): string {
  switch (state) {
    case 'running':    return styles.statusRunning;
    case 'exited':     return styles.statusExited;
    case 'paused':     return styles.statusPaused;
    case 'restarting': return styles.statusRestarting;
    default:           return styles.statusDead;
  }
}

function getDotColor(state: string): string {
  switch (state) {
    case 'running':    return '#10b981';
    case 'exited':     return '#3f3f46';
    case 'paused':     return '#eab308';
    case 'restarting': return '#f97316';
    default:           return '#ef4444';
  }
}

function formatPorts(ports: DockerPort[]): string {
  if (!ports?.length) return '—';
  const bound = ports.filter(p => p.PublicPort);
  return bound.length ? bound.map(p => `${p.PublicPort}→${p.PrivatePort}`).join(', ') : '—';
}

function formatAge(unix: number): string {
  const diff = Date.now() / 1000 - unix;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function calculateCpuPercent(stats: any): number {
  if (!stats) return 0;
  const cpuStats = stats.cpu_stats;
  const preCpuStats = stats.precpu_stats;
  if (!cpuStats || !preCpuStats) return 0;

  const cpuDelta = (cpuStats.cpu_usage?.total_usage ?? 0) - (preCpuStats.cpu_usage?.total_usage ?? 0);
  const systemDelta = (cpuStats.system_cpu_usage ?? 0) - (preCpuStats.system_cpu_usage ?? 0);
  const numCpus = cpuStats.online_cpus || (cpuStats.cpu_usage?.percpu_usage ? cpuStats.cpu_usage.percpu_usage.length : 1);

  if (systemDelta > 0 && cpuDelta > 0) {
    return Math.min(100, (cpuDelta / systemDelta) * numCpus * 100.0);
  }
  return 0;
}

function getMemoryUsage(stats: any) {
  if (!stats || !stats.memory_stats) return { usage: 0, limit: 0, percent: 0 };
  const usage = stats.memory_stats.usage ?? 0;
  const limit = stats.memory_stats.limit ?? 0;
  const percent = limit > 0 ? (usage / limit) * 100 : 0;
  return { usage, limit, percent };
}

function getNetworkIO(stats: any) {
  if (!stats || !stats.networks) return { rx: 0, tx: 0 };
  let rx = 0;
  let tx = 0;
  Object.values(stats.networks).forEach((net: any) => {
    rx += net.rx_bytes ?? 0;
    tx += net.tx_bytes ?? 0;
  });
  return { rx, tx };
}

function getBlockIO(stats: any) {
  if (!stats || !stats.blkio_stats) return { read: 0, write: 0 };
  let read = 0;
  let write = 0;
  const entries = stats.blkio_stats.io_service_bytes_recursive;
  if (Array.isArray(entries)) {
    entries.forEach((entry: any) => {
      const op = entry.op?.toLowerCase();
      if (op === 'read') read += entry.value ?? 0;
      if (op === 'write') write += entry.value ?? 0;
    });
  }
  return { read, write };
}

/* ─── Component ─── */

export default function DockerApp() {
  const [containers, setContainers]           = useState<Container[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [actionLoading, setActionLoading]     = useState<string | null>(null);
  const [actionError, setActionError]         = useState<{ id: string; msg: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lastSynced, setLastSynced]           = useState('');

  // Selected container details pane
  const [selectedId, setSelectedId]           = useState<string | null>(null);
  const [activeTab, setActiveTab]             = useState<'stats' | 'inspect' | 'logs' | 'console'>('stats');

  // Live stats state
  const [statsData, setStatsData]             = useState<any | null>(null);
  const [statsLoading, setStatsLoading]       = useState(false);
  const [statsError, setStatsError]           = useState<string | null>(null);

  // Inspect state
  const [inspectData, setInspectData]         = useState<any | null>(null);
  const [inspectLoading, setInspectLoading]   = useState(false);
  const [inspectError, setInspectError]       = useState<string | null>(null);

  // Live Logs state
  interface LogLine {
    timestamp: string | null;
    text: string;
  }
  const [logLines, setLogLines]               = useState<LogLine[]>([]);
  const [logsLoading, setLogsLoading]         = useState(false);
  const [logsError, setLogsError]             = useState<string | null>(null);
  const [showTimestamps, setShowTimestamps]   = useState(true);
  const [isLogPaused, setIsLogPaused]         = useState(false);

  // Refs for tracking pause status and buffering logs without triggering stale effect closures
  const isLogPausedRef = useRef(isLogPaused);
  const logBufferRef = useRef<LogLine[]>([]);
  const logsTerminalRef = useRef<HTMLDivElement>(null);

  // Sync ref with state
  useEffect(() => {
    isLogPausedRef.current = isLogPaused;
    if (!isLogPaused && logBufferRef.current.length > 0) {
      setLogLines((prev) => [...prev, ...logBufferRef.current].slice(-1000));
      logBufferRef.current = [];
    }
  }, [isLogPaused]);

  // Helper to parse Docker logs' timestamp prefix and convert to local timezone
  const parseLogLine = (rawLine: string): LogLine => {
    // Format: YYYY-MM-DDTHH:mm:ss.sssssssssZ <log message>
    const firstSpace = rawLine.indexOf(' ');
    if (firstSpace > 0) {
      const possibleTs = rawLine.substring(0, firstSpace);
      if (possibleTs.includes('T') && possibleTs.endsWith('Z')) {
        let localTimestamp = possibleTs;
        try {
          const date = new Date(possibleTs);
          if (!isNaN(date.getTime())) {
            localTimestamp = date.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
          }
        } catch (e) {
          console.error('[logs] Timestamp conversion failed', e);
        }
        return {
          timestamp: localTimestamp,
          text: rawLine.substring(firstSpace + 1)
        };
      }
    }
    return { timestamp: null, text: rawLine };
  };

  // Ref so stats polling can always read the latest container state
  // without containers being a useEffect dependency (which caused flicker)
  const containersRef = useRef<Container[]>([]);
  useEffect(() => { containersRef.current = containers; }, [containers]);

  const fetchContainers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch('/api/docker/containers');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { containers: list } = await res.json();
      setContainers(list ?? []);
      setLastSynced(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        })
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchContainers();
    const id = setInterval(() => fetchContainers(true), 5000);
    return () => clearInterval(id);
  }, [fetchContainers]);

  // Handle active tab defaults on selection change
  useEffect(() => {
    if (!selectedId) {
      setStatsData(null);
      setInspectData(null);
      setLogLines([]);
      return;
    }
    const container = containers.find(c => c.Id === selectedId);
    if (container && container.State !== 'running') {
      setActiveTab('inspect');
    } else {
      setActiveTab('stats');
    }
  }, [selectedId]);

  // Stream stats via SSE — EventSource keeps one persistent connection open.
  // Docker pushes data every ~1s. No setInterval needed.
  // Cleanup calls es.close() → triggers req.on('close') on backend → statsStream.destroy().
  useEffect(() => {
    if (!selectedId || activeTab !== 'stats') return;

    // If container isn't running, nothing to stream.
    const initial = containersRef.current.find(c => c.Id === selectedId);
    if (!initial || initial.State !== 'running') {
      setStatsData(null);
      return;
    }

    setStatsLoading(true);
    setStatsError(null);

    const es = new EventSource(`/api/docker/containers/${selectedId}/stats`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatsData(data);
        setStatsError(null);
        setStatsLoading(false); // clears loading on first message
      } catch (e) {
        console.error('[stats] JSON parse error', e);
      }
    };

    es.onerror = () => {
      setStatsError('Stats stream disconnected');
      setStatsLoading(false);
      es.close();
    };

    return () => {
      es.close(); // tells backend to destroy the Docker stats stream
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeTab]);

  // Fetch inspect data
  useEffect(() => {
    if (!selectedId || activeTab !== 'inspect') return;

    let active = true;
    const fetchInspect = async () => {
      setInspectLoading(true);
      setInspectError(null);
      try {
        const res = await fetch(`/api/docker/containers/${selectedId}/inspect`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { data } = await res.json();
        if (active) {
          setInspectData(data);
        }
      } catch (err: any) {
        if (active) setInspectError(err.message);
      } finally {
        if (active) setInspectLoading(false);
      }
    };

    fetchInspect();
    return () => {
      active = false;
    };
  }, [selectedId, activeTab]);

  // Stream logs via SSE - EventSource keeps connection open.
  useEffect(() => {
    if (!selectedId || activeTab !== 'logs') return;

    setLogsLoading(true);
    setLogsError(null);
    setLogLines([]);
    logBufferRef.current = [];

    const es = new EventSource(`/api/docker/containers/${selectedId}/logs`);

    es.onmessage = (event) => {
      setLogsLoading(false);
      const chunk = event.data;
      if (!chunk) return;

      const newLines = chunk.split('\n');
      const parsed = newLines
        .filter((l: string) => l.trim() !== '')
        .map(parseLogLine);

      setLogLines((prev) => {
        if (isLogPausedRef.current) {
          logBufferRef.current = [...logBufferRef.current, ...parsed].slice(-1000);
          return prev;
        }
        return [...prev, ...parsed].slice(-1000);
      });
    };

    es.onerror = () => {
      setLogsError('Logs stream disconnected');
      setLogsLoading(false);
      es.close();
    };

    return () => {
      es.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeTab]);

  // Auto-scroll logs terminal to bottom on new logs
  useEffect(() => {
    if (logsTerminalRef.current && !isLogPaused) {
      logsTerminalRef.current.scrollTop = logsTerminalRef.current.scrollHeight;
    }
  }, [logLines, isLogPaused, activeTab]);

  const doAction = async (containerId: string, action: ActionKind) => {
    setActionLoading(`${containerId}-${action}`);
    setActionError(null);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/docker/containers/${containerId}/${action}`, {
        method: action === 'delete' ? 'DELETE' : 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? `Action failed (${res.status})`;
        setActionError({ id: containerId, msg });
        // Auto-dismiss after 3s
        setTimeout(() => setActionError(null), 3000);
        return;
      }
      await fetchContainers(true);
    } catch (e) {
      console.error('Docker action failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const selectedContainer = containers.find(c => c.Id === selectedId);
  const runningCount = containers.filter(c => c.State === 'running').length;
  const stoppedCount = containers.filter(c => c.State === 'exited').length;

  /* ─── Detail Panels Content Renders ─── */

  const renderStatsContent = () => {
    if (selectedContainer?.State !== 'running') {
      return (
        <div className={styles.comingSoon}>
          <AlertCircle size={28} style={{ color: '#52525b' }} />
          <span className={styles.comingSoonText}>
            Telemetry unavailable. Real-time stats are only available for running containers.
          </span>
        </div>
      );
    }

    if (statsLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '10px' }}>
          <div className={styles.spinner} style={{ width: '20px', height: '20px' }} />
          <span style={{ fontSize: '11px', color: '#71717a' }}>Querying container telemetry…</span>
        </div>
      );
    }

    if (statsError) {
      return (
        <div style={{ padding: '12px', color: '#f87171', fontSize: '11px' }}>
          Error fetching stats: {statsError}
        </div>
      );
    }

    if (!statsData) return null;

    const cpuPercent = calculateCpuPercent(statsData);
    const memInfo = getMemoryUsage(statsData);
    const netIO = getNetworkIO(statsData);
    const diskIO = getBlockIO(statsData);

    return (
      <>
        {/* CPU Card */}
        <div className={styles.statsCard}>
          <div className={styles.statsHeader}>
            <span>Processor (CPU)</span>
            <Cpu size={12} style={{ color: '#a855f7' }} />
          </div>
          <div className={styles.statsVal}>{cpuPercent.toFixed(1)}%</div>
          <div className={styles.statsProgress}>
            <div className={styles.statsProgressFill} style={{ width: `${cpuPercent}%`, background: '#a855f7' }} />
          </div>
        </div>

        {/* Memory Card */}
        <div className={styles.statsCard}>
          <div className={styles.statsHeader}>
            <span>Memory (RAM)</span>
            <HardDrive size={12} style={{ color: '#06b6d4' }} />
          </div>
          <div className={styles.statsVal}>{memInfo.percent.toFixed(1)}%</div>
          <div style={{ fontSize: '10px', color: '#71717a', fontFamily: 'monospace' }}>
            {formatBytes(memInfo.usage)} / {formatBytes(memInfo.limit)}
          </div>
          <div className={styles.statsProgress}>
            <div className={styles.statsProgressFill} style={{ width: `${memInfo.percent}%`, background: '#06b6d4' }} />
          </div>
        </div>

        {/* Network & Disk */}
        <div className={styles.statsGrid}>
          <div className={styles.statsCard}>
            <div className={styles.statsHeader}>Network I/O</div>
            <div style={{ fontSize: '11px', color: '#d4d4d8', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span>▼ In: {formatBytes(netIO.rx)}</span>
              <span>▲ Out: {formatBytes(netIO.tx)}</span>
            </div>
          </div>
          <div className={styles.statsCard}>
            <div className={styles.statsHeader}>Disk I/O</div>
            <div style={{ fontSize: '11px', color: '#d4d4d8', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span>Read: {formatBytes(diskIO.read)}</span>
              <span>Write: {formatBytes(diskIO.write)}</span>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderInspectContent = () => {
    if (inspectLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '10px' }}>
          <div className={styles.spinner} style={{ width: '20px', height: '20px' }} />
          <span style={{ fontSize: '11px', color: '#71717a' }}>Querying configuration…</span>
        </div>
      );
    }

    if (inspectError) {
      return (
        <div style={{ padding: '12px', color: '#f87171', fontSize: '11px' }}>
          Error fetching metadata: {inspectError}
        </div>
      );
    }

    if (!inspectData) return null;

    const envVars = inspectData.Config?.Env ?? [];
    const mounts = inspectData.Mounts ?? [];
    const gateway = inspectData.NetworkSettings?.Gateway || inspectData.NetworkSettings?.Networks?.bridge?.Gateway || '—';
    const ipAddress = inspectData.NetworkSettings?.IPAddress || inspectData.NetworkSettings?.Networks?.bridge?.IPAddress || '—';

    return (
      <>
        {/* Info card */}
        <div className={styles.inspectGroup}>
          <span className={styles.inspectTitle}>System Configuration</span>
          <div className={styles.inspectCard}>
            <table className={styles.inspectTable}>
              <tbody>
                <tr className={styles.inspectTr}>
                  <td className={styles.inspectTdLabel}>Image ID</td>
                  <td className={styles.inspectTdValue}>{inspectData.Image?.replace('sha256:', '').substring(0, 12)}</td>
                </tr>
                <tr className={styles.inspectTr}>
                  <td className={styles.inspectTdLabel}>Path</td>
                  <td className={styles.inspectTdValue}>{inspectData.Path}</td>
                </tr>
                <tr className={styles.inspectTr}>
                  <td className={styles.inspectTdLabel}>Restart Policy</td>
                  <td className={styles.inspectTdValue}>{inspectData.HostConfig?.RestartPolicy?.Name || 'no'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Network card */}
        <div className={styles.inspectGroup}>
          <span className={styles.inspectTitle}>Network Setup</span>
          <div className={styles.inspectCard}>
            <table className={styles.inspectTable}>
              <tbody>
                <tr className={styles.inspectTr}>
                  <td className={styles.inspectTdLabel}>IP Address</td>
                  <td className={styles.inspectTdValue}>{ipAddress}</td>
                </tr>
                <tr className={styles.inspectTr}>
                  <td className={styles.inspectTdLabel}>Gateway</td>
                  <td className={styles.inspectTdValue}>{gateway}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Env vars */}
        {envVars.length > 0 && (
          <div className={styles.inspectGroup}>
            <span className={styles.inspectTitle}>Environment variables ({envVars.length})</span>
            <div className={styles.inspectCard} style={{ maxHeight: '180px', overflowY: 'auto' }}>
              <table className={styles.inspectTable}>
                <tbody>
                  {envVars.map((env: string, idx: number) => {
                    const eqIndex = env.indexOf('=');
                    const k = eqIndex > -1 ? env.substring(0, eqIndex) : env;
                    const v = eqIndex > -1 ? env.substring(eqIndex + 1) : '';
                    return (
                      <tr key={idx} className={styles.inspectTr}>
                        <td className={styles.inspectTdLabel} style={{ width: '45%' }}>{k}</td>
                        <td className={styles.inspectTdValue} style={{ color: '#a1a1aa' }}>{v}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mounts */}
        {mounts.length > 0 && (
          <div className={styles.inspectGroup}>
            <span className={styles.inspectTitle}>Volumes / Mounts ({mounts.length})</span>
            {mounts.map((m: any, idx: number) => (
              <div key={idx} className={styles.inspectCard} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#71717a' }}>
                  <span>{m.Type?.toUpperCase()}</span>
                  <span>{m.RW ? 'READ/WRITE' : 'READ-ONLY'}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#e4e4e7', wordBreak: 'break-all' }}>
                  <span style={{ color: '#52525b' }}>Host:</span> {m.Source}
                </div>
                <div style={{ fontSize: '11px', color: '#e4e4e7', wordBreak: 'break-all' }}>
                  <span style={{ color: '#52525b' }}>Container:</span> {m.Destination}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  const renderLogsContent = () => {
    if (logsLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '10px' }}>
          <div className={styles.spinner} style={{ width: '20px', height: '20px' }} />
          <span style={{ fontSize: '11px', color: '#71717a' }}>Connecting to logs stream…</span>
        </div>
      );
    }

    if (logsError) {
      return (
        <div style={{ padding: '12px', color: '#f87171', fontSize: '11px' }}>
          Error streaming logs: {logsError}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px', overflow: 'hidden' }}>
        {/* Logs controls toolbar */}
        <div className={styles.logsToolbar}>
          <button
            className={`${styles.logsControlBtn} ${showTimestamps ? styles.logsControlBtnActive : ''}`}
            onClick={() => setShowTimestamps(!showTimestamps)}
            title="Toggle Timestamps"
          >
            Timestamps
          </button>
          <button
            className={`${styles.logsControlBtn} ${isLogPaused ? styles.logsControlBtnActive : ''}`}
            onClick={() => setIsLogPaused(!isLogPaused)}
            title={isLogPaused ? "Resume log stream" : "Pause log stream"}
          >
            {isLogPaused ? "Resume" : "Pause"}
          </button>
          <button
            className={styles.logsControlBtn}
            onClick={() => setLogLines([])}
            title="Clear current screen logs"
          >
            Clear
          </button>
          <a
            href={`/api/docker/containers/${selectedId}/logs/download`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.logsControlBtn}
            title="Download full container logs file"
            style={{ textDecoration: 'none' }}
          >
            Download
          </a>
        </div>

        {/* Live log lines container */}
        <div className={styles.logsTerminal} ref={logsTerminalRef}>
          {logLines.length === 0 ? (
            <span style={{ color: '#52525b', fontStyle: 'italic' }}>No logs generated yet.</span>
          ) : (
            logLines.map((line, idx) => (
              <div key={idx} className={styles.logsLine}>
                {showTimestamps && line.timestamp && (
                  <span className={styles.logsTimestamp}>
                    [{line.timestamp}]
                  </span>
                )}
                <span className={styles.logsText}>{line.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderConsolePlaceholder = () => (
    <div className={styles.comingSoon}>
      <Terminal size={28} style={{ color: '#52525b' }} />
      <span style={{ fontWeight: 600, color: '#e4e4e7', fontSize: '13px' }}>Interactive Exec Console</span>
      <span className={styles.comingSoonText}>
        Secure terminal execution into the container is coming soon in Phase 2c.
      </span>
    </div>
  );

  /* ── Loading ── */
  if (loading) return (
    <div className={styles.loadingState}>
      <div className={styles.spinner} />
      <span className={styles.loadingText}>Connecting to Docker engine…</span>
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div className={styles.errorState}>
      <AlertCircle size={32} style={{ color: '#ef4444', opacity: 0.7 }} />
      <p className={styles.errorTitle}>Docker Engine Unavailable</p>
      <span className={styles.errorCode}>{error}</span>
      <button className={styles.retryBtn} onClick={() => fetchContainers()}>
        Retry Connection
      </button>
    </div>
  );

  /* ── Main view ── */
  return (
    <div className={styles.container}>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <p className={styles.toolbarTitle}>Docker Containers</p>
          <p className={styles.toolbarSub}>
            <span className={styles.liveDot} />
            {containers.length} total · {runningCount} running · {stoppedCount} stopped
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={() => fetchContainers(true)}>
          <RefreshCw size={12} className={refreshing ? styles.spinning : ''} />
          Refresh
        </button>
      </div>

      {/* Stat badges */}
      <div className={styles.statsRow}>
        <div className={`${styles.statBadge} ${styles.statRunning}`}>
          <span className={styles.statDot} style={{ background: '#10b981', boxShadow: '0 0 5px #10b981' }} />
          {runningCount} Running
        </div>
        <div className={`${styles.statBadge} ${styles.statStopped}`}>
          <span className={styles.statDot} style={{ background: '#6b7280' }} />
          {stoppedCount} Stopped
        </div>
        <div className={`${styles.statBadge} ${styles.statTotal}`}>
          <Box size={10} />
          {containers.length} Total
        </div>
      </div>

      {/* Workspace */}
      <div className={styles.workspace}>
        {/* Table area */}
        <div className={styles.tableArea}>
          {containers.length === 0 ? (
            <div className={styles.emptyState}>
              <Box size={32} style={{ opacity: 0.15 }} />
              <p className={styles.emptyTitle}>No containers found</p>
              <p className={styles.emptySubtext}>Containers you run will appear here automatically</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead className={styles.thead}>
                <tr className={styles.theadRow}>
                  {['Container', 'Image', 'Status', 'Ports', 'Age', 'Actions'].map(col => (
                    <th key={col} className={styles.th}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {containers.map(c => {
                  const name      = (c.Names[0] ?? c.Id).replace(/^\//, '');
                  const shortId   = c.Id.substring(0, 12);
                  const isRunning = c.State === 'running';
                  const busy      = (suf: string) => actionLoading === `${c.Id}-${suf}`;
                  const anyBusy   = ['start', 'stop', 'restart', 'delete'].some(busy);
                  const isConfirm = confirmDeleteId === c.Id;
                  const isSelected = selectedId === c.Id;

                  return (
                    <tr
                      key={c.Id}
                      className={`${styles.tr} ${isConfirm ? styles.trConfirm : ''} ${isSelected ? styles.trSelected : ''}`}
                      onClick={() => setSelectedId(c.Id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Name */}
                      <td className={styles.td}>
                        <div className={styles.nameCell}>
                          <span
                            className={styles.containerDot}
                            style={{
                              background: getDotColor(c.State),
                              boxShadow: isRunning ? `0 0 6px ${getDotColor(c.State)}` : 'none',
                            }}
                          />
                          <div className={styles.nameInfo}>
                            <span className={styles.nameText}>{name}</span>
                            <span className={styles.idText}>{shortId}</span>
                          </div>
                        </div>
                      </td>

                      {/* Image */}
                      <td className={styles.td}>
                        <span className={styles.imageBadge}>{c.Image}</span>
                      </td>

                      {/* Status */}
                      <td className={styles.td}>
                        <span className={`${styles.statusBadge} ${getStatusClass(c.State)}`}>
                          {c.Status}
                        </span>
                      </td>

                      {/* Ports */}
                      <td className={styles.td}>
                        <span className={styles.mono}>{formatPorts(c.Ports)}</span>
                      </td>

                      {/* Age */}
                      <td className={styles.td}>
                        <span className={styles.dimText}>{formatAge(c.Created)}</span>
                      </td>

                      {/* Actions */}
                      <td className={styles.td} onClick={e => e.stopPropagation()}>
                        {isConfirm ? (
                          <div className={styles.deleteConfirm}>
                            <span className={styles.deleteConfirmText}>Delete?</span>
                            <button className={styles.confirmBtn} onClick={() => doAction(c.Id, 'delete')}>
                              Yes
                            </button>
                            <button className={styles.cancelBtn} onClick={() => setConfirmDeleteId(null)}>
                              No
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            <div className={styles.actionsCell}>
                              {isRunning ? (
                                <>
                                  <button
                                    className={`${styles.actionBtn} ${styles.btnStop}`}
                                    title="Stop container"
                                    disabled={anyBusy}
                                    onClick={() => doAction(c.Id, 'stop')}
                                  >
                                    <Square size={11} fill="currentColor" />
                                  </button>
                                  <button
                                    className={`${styles.actionBtn} ${styles.btnRestart}`}
                                    title="Restart container"
                                    disabled={anyBusy}
                                    onClick={() => doAction(c.Id, 'restart')}
                                  >
                                    <RefreshCw size={11} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  className={`${styles.actionBtn} ${styles.btnStart}`}
                                  title="Start container"
                                  disabled={anyBusy}
                                  onClick={() => doAction(c.Id, 'start')}
                                >
                                  <Play size={11} fill="currentColor" />
                                </button>
                              )}
                              <button
                                className={`${styles.actionBtn} ${styles.btnDelete}`}
                                title="Delete container"
                                disabled={anyBusy}
                                onClick={() => setConfirmDeleteId(c.Id)}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                            {actionError?.id === c.Id && (
                              <span style={{ fontSize: '10px', color: '#f87171', whiteSpace: 'nowrap' }}>
                                ⚠ {actionError.msg}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Selected container Detail Pane */}
        {selectedId && selectedContainer && (
          <div className={styles.detailPane}>
            {/* Detail Header */}
            <div className={styles.detailHeader}>
              <span className={styles.detailHeaderTitle} title={selectedContainer.Names[0]?.replace(/^\//, '')}>
                {selectedContainer.Names[0]?.replace(/^\//, '')}
              </span>
              <button className={styles.detailCloseBtn} onClick={() => setSelectedId(null)} title="Close pane">
                <X size={14} />
              </button>
            </div>

            {/* Detail Tabs */}
            <div className={styles.detailTabs}>
              <button
                className={`${styles.detailTab} ${activeTab === 'stats' ? styles.detailTabActive : ''}`}
                onClick={() => setActiveTab('stats')}
              >
                Stats
              </button>
              <button
                className={`${styles.detailTab} ${activeTab === 'inspect' ? styles.detailTabActive : ''}`}
                onClick={() => setActiveTab('inspect')}
              >
                Inspect
              </button>
              <button
                className={`${styles.detailTab} ${activeTab === 'logs' ? styles.detailTabActive : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                Logs
              </button>
              <button
                className={`${styles.detailTab} ${activeTab === 'console' ? styles.detailTabActive : ''}`}
                onClick={() => setActiveTab('console')}
              >
                Console
              </button>
            </div>

            {/* Tab content */}
            <div className={styles.detailContent}>
              {activeTab === 'stats' && renderStatsContent()}
              {activeTab === 'inspect' && renderInspectContent()}
              {activeTab === 'logs' && renderLogsContent()}
              {activeTab === 'console' && renderConsolePlaceholder()}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className={styles.statusBar}>
        <span>{containers.length} container{containers.length !== 1 ? 's' : ''}</span>
        {lastSynced && <span>Last synced {lastSynced}</span>}
      </div>
    </div>
  );
}

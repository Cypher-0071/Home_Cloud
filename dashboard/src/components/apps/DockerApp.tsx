import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, RefreshCw, Trash2, Box, AlertCircle, X, Cpu, HardDrive, Plus } from 'lucide-react';
import ContainerConsoleTab from './ContainerConsoleTab';
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

interface DockerImage {
  Id: string;
  RepoTags: string[] | null;
  Size: number;
  Created: number;
}

interface PullLayer {
  id: string;
  status: string;
  progress: string;
  current: number;
  total: number;
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
  // Top Level Window Navigation
  const [activeWindowTab, setActiveWindowTab] = useState<'containers' | 'images'>('containers');

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

  // Images state
  const [images, setImages]                   = useState<DockerImage[]>([]);
  const [imagesLoading, setImagesLoading]     = useState(true);
  const [imagesError, setImagesError]         = useState<string | null>(null);
  const [imageInput, setImageInput]           = useState('');
  const [pullingImage, setPullingImage]       = useState<string | null>(null);
  const [pullLayers, setPullLayers]           = useState<{ [id: string]: PullLayer }>({});
  const [pullError, setPullError]             = useState<string | null>(null);
  const [pullSuccess, setPullSuccess]         = useState(false);
  const [imageActionLoading, setImageActionLoading] = useState<string | null>(null);
  const [imageActionError, setImageActionError]     = useState<{ id: string; msg: string } | null>(null);
  const [confirmDeleteImageId, setConfirmDeleteImageId] = useState<string | null>(null);

  // Run Container Modal state
  const [runModalImage, setRunModalImage]           = useState<string | null>(null);
  const [runContainerName, setRunContainerName]     = useState('');
  const [runPorts, setRunPorts]                     = useState<{ hostPort: string; containerPort: string }[]>([]);
  const [runEnvs, setRunEnvs]                       = useState<{ key: string; value: string }[]>([]);
  const [runVolumes, setRunVolumes]                 = useState<{ hostPath: string; containerPath: string }[]>([]);
  const [runRestartPolicy, setRunRestartPolicy]     = useState<string>('no');
  const [runSubmitting, setRunSubmitting]           = useState(false);
  const [runError, setRunError]                     = useState<string | null>(null);

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

  const fetchImages = useCallback(async (silent = false) => {
    if (!silent) setImagesLoading(true);
    try {
      const res = await fetch('/api/docker/images');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { images: list } = await res.json();
      setImages(list ?? []);
      setImagesError(null);
    } catch (e: any) {
      setImagesError(e.message);
    } finally {
      if (!silent) setImagesLoading(false);
    }
  }, []);

  // Combined polling for containers and images
  useEffect(() => {
    fetchContainers();
    fetchImages();
    const id = setInterval(() => {
      fetchContainers(true);
      fetchImages(true);
    }, 5000);
    return () => clearInterval(id);
  }, [fetchContainers, fetchImages]);

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

  /* ─── Image Actions ─── */

  const handlePullImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageInput.trim()) return;

    const imageName = imageInput.trim();
    setPullingImage(imageName);
    setPullLayers({});
    setPullError(null);
    setPullSuccess(false);
    setImageInput('');

    const es = new EventSource(`/api/docker/images/pull?image=${encodeURIComponent(imageName)}`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          setPullError(data.error);
          es.close();
          setTimeout(() => {
            setPullingImage(null);
            setPullError(null);
          }, 5000);
          return;
        }

        if (data.status === 'success') {
          setPullSuccess(true);
          es.close();
          fetchImages(true);
          // Reset progress card after 3s
          setTimeout(() => {
            setPullingImage(null);
            setPullSuccess(false);
          }, 3000);
          return;
        }

        // Layer progress updates
        if (data.id) {
          setPullLayers((prev) => {
            const currentLayer = prev[data.id] || { id: data.id, status: '', progress: '', current: 0, total: 0 };
            return {
              ...prev,
              [data.id]: {
                ...currentLayer,
                status: data.status,
                progress: data.progress || '',
                current: data.progressDetail?.current || 0,
                total: data.progressDetail?.total || 0,
              }
            };
          });
        }
      } catch (err) {
        console.error('[pull] Parse error', err);
      }
    };

    es.onerror = () => {
      setPullError('Image pull failed or repository does not exist');
      es.close();
      setTimeout(() => {
        setPullingImage(null);
        setPullError(null);
      }, 5000);
    };
  };

  const deleteImage = async (imageId: string) => {
    setImageActionLoading(imageId);
    setImageActionError(null);
    setConfirmDeleteImageId(null);
    try {
      const res = await fetch(`/api/docker/images/${encodeURIComponent(imageId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? `Deletion failed (${res.status})`;
        setImageActionError({ id: imageId, msg });
        setTimeout(() => setImageActionError(null), 4000);
        return;
      }
      await fetchImages(true);
    } catch (e: any) {
      console.error('Delete image failed:', e);
    } finally {
      setImageActionLoading(null);
    }
  };

  const pruneImages = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/docker/images/prune', { method: 'POST' });
      if (res.ok) {
        await fetchImages(true);
      }
    } catch (e) {
      console.error('Prune images failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  /* ─── Run Container Modal Handlers ─── */

  const openRunModal = (repoTag: string) => {
    setRunModalImage(repoTag);
    setRunContainerName('');
    setRunPorts([{ hostPort: '', containerPort: '' }]);
    setRunEnvs([]);
    setRunVolumes([]);
    setRunRestartPolicy('no');
    setRunError(null);
  };

  const addPortRow = () => setRunPorts(prev => [...prev, { hostPort: '', containerPort: '' }]);
  const removePortRow = (idx: number) => setRunPorts(prev => prev.filter((_, i) => i !== idx));

  const addEnvRow = () => setRunEnvs(prev => [...prev, { key: '', value: '' }]);
  const removeEnvRow = (idx: number) => setRunEnvs(prev => prev.filter((_, i) => i !== idx));

  const addVolumeRow = () => setRunVolumes(prev => [...prev, { hostPath: '', containerPath: '' }]);
  const removeVolumeRow = (idx: number) => setRunVolumes(prev => prev.filter((_, i) => i !== idx));

  const handleCreateContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runModalImage) return;

    setRunSubmitting(true);
    setRunError(null);

    const payload = {
      image: runModalImage,
      name: runContainerName.trim() || undefined,
      ports: runPorts.filter(p => p.hostPort.trim() && p.containerPort.trim()),
      env: runEnvs.filter(ev => ev.key.trim()).map(ev => `${ev.key.trim()}=${ev.value}`),
      volumes: runVolumes.filter(v => v.hostPath.trim() && v.containerPath.trim()),
      restartPolicy: runRestartPolicy,
    };

    try {
      const res = await fetch('/api/docker/containers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to create container (${res.status})`);
      }

      // Success: close modal, switch tab to containers, refresh container list
      setRunModalImage(null);
      setActiveWindowTab('containers');
      fetchContainers(true);
    } catch (err: any) {
      setRunError(err.message);
    } finally {
      setRunSubmitting(false);
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

      {/* Top Level App Navigation Header */}
      <div className={styles.tabHeader}>
        <button
          className={`${styles.tabBtn} ${activeWindowTab === 'containers' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveWindowTab('containers')}
        >
          Containers
        </button>
        <button
          className={`${styles.tabBtn} ${activeWindowTab === 'images' ? styles.tabBtnActive : ''}`}
          onClick={() => {
            setActiveWindowTab('images');
            fetchImages(true);
          }}
        >
          Images
        </button>
      </div>

      {activeWindowTab === 'containers' ? (
        <>
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
                  <div style={{ display: activeTab === 'console' ? 'block' : 'none', height: '100%', width: '100%' }}>
                    <ContainerConsoleTab
                      key={selectedContainer.Id}
                      containerId={selectedContainer.Id}
                      containerName={selectedContainer.Names[0]?.replace(/^\//, '') ?? selectedContainer.Id}
                      isRunning={selectedContainer.State === 'running'}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status bar */}
          <div className={styles.statusBar}>
            <span>{containers.length} container{containers.length !== 1 ? 's' : ''}</span>
            {lastSynced && <span>Last synced {lastSynced}</span>}
          </div>
        </>
      ) : (
        /* ───── Images Tab UI Workspace ───── */
        <>
          {/* Toolbar */}
          <div className={styles.toolbar}>
            <form className={styles.pullForm} onSubmit={handlePullImage}>
              <input
                className={styles.pullInput}
                type="text"
                value={imageInput}
                onChange={e => setImageInput(e.target.value)}
                placeholder="e.g. redis:alpine, nginx:latest, python:3.11"
                disabled={!!pullingImage}
              />
              <button
                className={styles.pullBtn}
                type="submit"
                disabled={!!pullingImage || !imageInput.trim()}
              >
                {pullingImage ? 'Pulling…' : 'Pull Image'}
              </button>
            </form>
            <button
              className={styles.refreshBtn}
              onClick={() => fetchImages()}
              disabled={imagesLoading || !!pullingImage}
              title="Refresh local images list"
            >
              <RefreshCw size={12} className={imagesLoading ? styles.spinning : ''} />
              Refresh
            </button>
            <button
              className={styles.refreshBtn}
              onClick={pruneImages}
              disabled={refreshing || !!pullingImage}
              title="Remove dangling, untagged images"
            >
              Prune Unused
            </button>
          </div>

          {/* Pulling Progress Layer-by-Layer Card */}
          {pullingImage && (
            <div className={styles.pullProgressCard}>
              <div className={styles.pullProgressTitle}>
                <span>Downloading {pullingImage}</span>
                {pullSuccess && <span style={{ color: '#10b981' }}>Success!</span>}
                {pullError && <span style={{ color: '#f87171' }}>Failed</span>}
              </div>

              {pullError && (
                <div style={{ color: '#f87171', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                  ⚠ {pullError}
                </div>
              )}

              {Object.keys(pullLayers).length === 0 && !pullError && !pullSuccess && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px', color: '#71717a' }}>
                  <div className={styles.spinner} style={{ width: '12px', height: '12px', borderWidth: '1.5px' }} />
                  <span>Connecting to Docker registry…</span>
                </div>
              )}

              <div className={styles.pullProgressLayers}>
                {Object.values(pullLayers).map((layer) => {
                  const pct = layer.total > 0 ? (layer.current / layer.total) * 100 : 0;
                  return (
                    <div key={layer.id} className={styles.pullProgressLayer}>
                      <div className={styles.pullProgressLayerHeader}>
                        <span>{layer.id}</span>
                        <span>{layer.status} {layer.progress && `(${layer.progress})`}</span>
                      </div>
                      {layer.total > 0 && (
                        <div className={styles.pullProgressLayerBar}>
                          <div className={styles.pullProgressLayerBarFill} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Images Table list */}
          <div className={styles.tableWrapper}>
            {imagesLoading && images.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '10px', color: '#71717a' }}>
                <div className={styles.spinner} style={{ width: '20px', height: '20px' }} />
                <span>Loading local images…</span>
              </div>
            ) : imagesError ? (
              <div style={{ padding: '20px', color: '#f87171', fontSize: '12px' }}>
                Error listing images: {imagesError}
              </div>
            ) : images.length === 0 ? (
              <div className={styles.emptyState}>
                <Box size={32} style={{ opacity: 0.15 }} />
                <p className={styles.emptyTitle}>No Docker images found</p>
                <p className={styles.emptySubtext}>Pulled images will list here. Try pulling an image above!</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead className={styles.thead}>
                  <tr className={styles.theadRow}>
                    {['Repository / Name', 'Tag', 'Image ID', 'Size', 'Created', 'Actions'].map(col => (
                      <th key={col} className={styles.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {images.map((img) => {
                    const idShort = img.Id.replace('sha256:', '').substring(0, 12);
                    const tagString = img.RepoTags?.[0] ?? '<none>:<none>';
                    const separatorIndex = tagString.lastIndexOf(':');
                    const repoName = separatorIndex > -1 ? tagString.substring(0, separatorIndex) : tagString;
                    const tag = separatorIndex > -1 ? tagString.substring(separatorIndex + 1) : '';

                    const isDangling = repoName === '<none>';
                    const isBusy = imageActionLoading === img.Id;
                    const isConfirm = confirmDeleteImageId === img.Id;

                    return (
                      <tr key={img.Id} className={styles.tr}>
                        {/* Name */}
                        <td className={styles.td}>
                          <span style={{
                            color: isDangling ? '#71717a' : '#f4f4f5',
                            fontWeight: isDangling ? 'normal' : '500',
                            fontFamily: isDangling ? 'inherit' : 'monospace',
                            fontSize: '12px'
                          }}>
                            {repoName}
                          </span>
                        </td>

                        {/* Tag */}
                        <td className={styles.td}>
                          <span className={styles.imageBadge} style={{
                            background: isDangling ? '#1a1a1e' : '#141c2c',
                            borderColor: isDangling ? '#27272a' : '#1d2c4c',
                            color: isDangling ? '#71717a' : '#60a5fa'
                          }}>
                            {tag}
                          </span>
                        </td>

                        {/* ID */}
                        <td className={styles.td}>
                          <span className={styles.mono}>{idShort}</span>
                        </td>

                        {/* Size */}
                        <td className={styles.td}>
                          <span className={styles.dimText}>{formatBytes(img.Size)}</span>
                        </td>

                        {/* Created */}
                        <td className={styles.td}>
                          <span className={styles.dimText}>{formatAge(img.Created)}</span>
                        </td>

                        {/* Actions */}
                        <td className={styles.td}>
                          {isConfirm ? (
                            <div className={styles.deleteConfirm}>
                              <span className={styles.deleteConfirmText}>Delete?</span>
                              <button className={styles.confirmBtn} onClick={() => deleteImage(img.Id)}>
                                Yes
                              </button>
                              <button className={styles.cancelBtn} onClick={() => setConfirmDeleteImageId(null)}>
                                No
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  className={`${styles.actionBtn} ${styles.btnStart}`}
                                  title="Run container from image"
                                  disabled={isDangling || isBusy || !!pullingImage}
                                  onClick={() => openRunModal(tagString)}
                                >
                                  <Play size={11} fill="currentColor" />
                                </button>
                                <button
                                  className={`${styles.actionBtn} ${styles.btnDelete}`}
                                  title="Delete image"
                                  disabled={isBusy || !!pullingImage}
                                  onClick={() => setConfirmDeleteImageId(img.Id)}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                              {imageActionError?.id === img.Id && (
                                <span style={{
                                  fontSize: '10px',
                                  color: '#f87171',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '200px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }} title={imageActionError.msg}>
                                  ⚠ {imageActionError.msg}
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

          {/* Status bar */}
          <div className={styles.statusBar}>
            <span>{images.length} image{images.length !== 1 ? 's' : ''}</span>
            <span>Total local size: {formatBytes(images.reduce((acc, img) => acc + img.Size, 0))}</span>
          </div>
        </>
      )}

      {/* ───── Run Container Modal ───── */}
      {runModalImage && (
        <div className={styles.modalOverlay} onClick={() => setRunModalImage(null)}>
          <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                <Play size={14} style={{ color: '#a855f7' }} fill="currentColor" />
                Run Container
              </span>
              <button
                className={styles.detailCloseBtn}
                onClick={() => setRunModalImage(null)}
                title="Close modal"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateContainer} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className={styles.modalBody}>
                {runError && (
                  <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', color: '#f87171', fontSize: '11px' }}>
                    ⚠ {runError}
                  </div>
                )}

                {/* Target Image */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Image</label>
                  <input
                    className={styles.fieldInput}
                    type="text"
                    value={runModalImage}
                    readOnly
                    style={{ opacity: 0.8, background: '#121214' }}
                  />
                </div>

                {/* Container Name */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Container Name (optional)</label>
                  <input
                    className={styles.fieldInput}
                    type="text"
                    value={runContainerName}
                    onChange={e => setRunContainerName(e.target.value)}
                    placeholder="e.g. my-redis-db"
                  />
                </div>

                {/* Ports Section */}
                <div>
                  <div className={styles.modalSectionTitle}>
                    <span>Port Mappings</span>
                    <button type="button" className={styles.iconAddBtn} onClick={addPortRow}>
                      <Plus size={10} /> Add Port
                    </button>
                  </div>
                  {runPorts.length === 0 ? (
                    <span style={{ fontSize: '11px', color: '#52525b', fontStyle: 'italic' }}>No port mappings configured</span>
                  ) : (
                    <div className={styles.dynamicList}>
                      {runPorts.map((p, idx) => (
                        <div key={idx} className={styles.dynamicRow}>
                          <input
                            className={styles.fieldInput}
                            type="text"
                            placeholder="Host Port (e.g. 8080)"
                            value={p.hostPort}
                            onChange={e => {
                              const val = e.target.value;
                              setRunPorts(prev => prev.map((item, i) => i === idx ? { ...item, hostPort: val } : item));
                            }}
                          />
                          <span style={{ color: '#71717a', fontSize: '12px' }}>→</span>
                          <input
                            className={styles.fieldInput}
                            type="text"
                            placeholder="Container Port (e.g. 80)"
                            value={p.containerPort}
                            onChange={e => {
                              const val = e.target.value;
                              setRunPorts(prev => prev.map((item, i) => i === idx ? { ...item, containerPort: val } : item));
                            }}
                          />
                          <button type="button" className={styles.iconRemoveBtn} onClick={() => removePortRow(idx)}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Environment Variables */}
                <div>
                  <div className={styles.modalSectionTitle}>
                    <span>Environment Variables</span>
                    <button type="button" className={styles.iconAddBtn} onClick={addEnvRow}>
                      <Plus size={10} /> Add Var
                    </button>
                  </div>
                  {runEnvs.length === 0 ? (
                    <span style={{ fontSize: '11px', color: '#52525b', fontStyle: 'italic' }}>No environment variables configured</span>
                  ) : (
                    <div className={styles.dynamicList}>
                      {runEnvs.map((ev, idx) => (
                        <div key={idx} className={styles.dynamicRow}>
                          <input
                            className={styles.fieldInput}
                            type="text"
                            placeholder="KEY (e.g. PORT)"
                            value={ev.key}
                            onChange={e => {
                              const val = e.target.value;
                              setRunEnvs(prev => prev.map((item, i) => i === idx ? { ...item, key: val } : item));
                            }}
                          />
                          <span style={{ color: '#71717a', fontSize: '12px' }}>=</span>
                          <input
                            className={styles.fieldInput}
                            type="text"
                            placeholder="VALUE (e.g. 8080)"
                            value={ev.value}
                            onChange={e => {
                              const val = e.target.value;
                              setRunEnvs(prev => prev.map((item, i) => i === idx ? { ...item, value: val } : item));
                            }}
                          />
                          <button type="button" className={styles.iconRemoveBtn} onClick={() => removeEnvRow(idx)}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Volume Mounts */}
                <div>
                  <div className={styles.modalSectionTitle}>
                    <span>Volume Mounts</span>
                    <button type="button" className={styles.iconAddBtn} onClick={addVolumeRow}>
                      <Plus size={10} /> Add Volume
                    </button>
                  </div>
                  {runVolumes.length === 0 ? (
                    <span style={{ fontSize: '11px', color: '#52525b', fontStyle: 'italic' }}>No volume mounts configured</span>
                  ) : (
                    <div className={styles.dynamicList}>
                      {runVolumes.map((v, idx) => (
                        <div key={idx} className={styles.dynamicRow}>
                          <input
                            className={styles.fieldInput}
                            type="text"
                            placeholder="Host Path (e.g. /home/user/data)"
                            value={v.hostPath}
                            onChange={e => {
                              const val = e.target.value;
                              setRunVolumes(prev => prev.map((item, i) => i === idx ? { ...item, hostPath: val } : item));
                            }}
                          />
                          <span style={{ color: '#71717a', fontSize: '12px' }}>→</span>
                          <input
                            className={styles.fieldInput}
                            type="text"
                            placeholder="Container Path (e.g. /data)"
                            value={v.containerPath}
                            onChange={e => {
                              const val = e.target.value;
                              setRunVolumes(prev => prev.map((item, i) => i === idx ? { ...item, containerPath: val } : item));
                            }}
                          />
                          <button type="button" className={styles.iconRemoveBtn} onClick={() => removeVolumeRow(idx)}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Restart Policy */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Restart Policy</label>
                  <select
                    className={styles.selectInput}
                    value={runRestartPolicy}
                    onChange={e => setRunRestartPolicy(e.target.value)}
                  >
                    <option value="no">Never restart (no)</option>
                    <option value="unless-stopped">Unless stopped (unless-stopped)</option>
                    <option value="always">Always restart (always)</option>
                    <option value="on-failure">On failure only (on-failure)</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setRunModalImage(null)}
                  disabled={runSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={runSubmitting}
                >
                  {runSubmitting ? 'Starting…' : 'Run Container'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

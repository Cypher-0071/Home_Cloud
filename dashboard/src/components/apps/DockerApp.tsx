import { useState, useEffect, useCallback } from 'react';
import { Play, Square, RefreshCw, Trash2, Box, AlertCircle } from 'lucide-react';
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

/* ─── Component ─── */

export default function DockerApp() {
  const [containers, setContainers]         = useState<Container[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [actionLoading, setActionLoading]   = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lastSynced, setLastSynced]         = useState('');

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

  const doAction = async (containerId: string, action: ActionKind) => {
    setActionLoading(`${containerId}-${action}`);
    setConfirmDeleteId(null);
    try {
      await fetch(`/api/docker/containers/${containerId}/${action}`, {
        method: action === 'delete' ? 'DELETE' : 'POST',
      });
      await fetchContainers(true);
    } catch (e) {
      console.error('Docker action failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const runningCount = containers.filter(c => c.State === 'running').length;
  const stoppedCount = containers.filter(c => c.State === 'exited').length;

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

      {/* Table */}
      <div className={styles.tableWrapper}>
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

                return (
                  <tr
                    key={c.Id}
                    className={`${styles.tr} ${isConfirm ? styles.trConfirm : ''}`}
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
                    <td className={styles.td}>
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
        <span>{containers.length} container{containers.length !== 1 ? 's' : ''}</span>
        {lastSynced && <span>Last synced {lastSynced}</span>}
      </div>
    </div>
  );
}

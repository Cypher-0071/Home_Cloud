import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RefreshCw,
  Search,
  Plus,
  Copy,
  Clipboard,
  Trash2,
  Edit2,
  Folder,
  FileText,
  Image,
  HardDrive,
  ChevronRight,
  X,
  Upload,
  Loader2,
  AlertTriangle,
  Eye,
  Download,
} from 'lucide-react';
import styles from './files.module.css';
import axios from 'axios';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DriveInfo {
  fs: string;
  type: string;
  size: number;
  used: number;
  available: number;
  use: number;
  mount: string;
}

interface FileItem {
  name: string;
  type: 'folder' | 'file';
  size: string;
  sizeRaw: number;
  modified: string;
  ext?: string;
  mimeType?: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_PATH = '/home/rudra-unix';

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
const TEXT_EXTS  = [
  'txt', 'md', 'markdown', 'log', 'csv', 'json', 'yaml', 'yml',
  'toml', 'ini', 'cfg', 'conf', 'env', 'sh', 'bash', 'zsh', 'fish',
  'js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'c', 'cpp',
  'h', 'hpp', 'css', 'html', 'xml', 'sql', 'dockerfile', 'gitignore',
];
const PDF_EXTS   = ['pdf'];
const VIDEO_EXTS = ['mp4', 'webm', 'ogg', 'mkv'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'aac'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(raw: string | Date): string {
  const d = new Date(raw);
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function getExt(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function viewerTypeFor(ext: string): 'image' | 'text' | 'pdf' | 'video' | 'audio' | 'unsupported' {
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (TEXT_EXTS.includes(ext))  return 'text';
  if (PDF_EXTS.includes(ext))   return 'pdf';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  return 'unsupported';
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const fetchDrives = async (): Promise<DriveInfo[]> => {
  try {
    const response = await axios.get<DriveInfo[]>('/api/files/drives');
    return Array.isArray(response.data) ? response.data : [];
  } catch {
    return [];
  }
};

const fetchFiles = async (dirPath: string): Promise<FileItem[]> => {
  const response = await axios.get('/api/files', { params: { path: dirPath } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.data.files.map((f: any): FileItem => ({
    name: f.name,
    type: f.isDirectory ? 'folder' : 'file',
    size: f.isDirectory ? '--' : formatBytes(f.size),
    sizeRaw: f.size ?? 0,
    modified: formatDate(f.modified),
    ext: f.isDirectory ? undefined : getExt(f.name),
    mimeType: f.mimeType ?? null,
  }));
};

// Build the URL for the /view endpoint
function viewUrl(filePath: string): string {
  return `/api/files/view?path=${encodeURIComponent(filePath)}`;
}

// ─── File Viewer Modal ────────────────────────────────────────────────────────

interface ViewerProps {
  filePath: string;   // full absolute path
  fileName: string;
  ext: string;
  onClose: () => void;
}

function FileViewer({ filePath, fileName, ext, onClose }: ViewerProps) {
  const kind = viewerTypeFor(ext);
  const url  = viewUrl(filePath);

  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError, setTextError]     = useState<string | null>(null);

  // Fetch raw text for text files
  useEffect(() => {
    if (kind !== 'text') return;
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.text();
      })
      .then(setTextContent)
      .catch(e => setTextError(e.message));
  }, [url, kind]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column',
        backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: '#0a0a0c', borderBottom: '1px solid #1c1c1f',
          flexShrink: 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={16} style={{ color: '#a855f7' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>{fileName}</span>
          <span style={{
            fontSize: '11px', color: '#71717a',
            background: '#1c1c1f', padding: '2px 6px', borderRadius: '4px',
          }}>{ext.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href={`/api/files/download?path=${encodeURIComponent(filePath)}`}
            download={fileName}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 10px', borderRadius: '6px',
              background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)',
              color: '#a855f7', fontSize: '12px', textDecoration: 'none', cursor: 'pointer',
            }}
            onClick={e => e.stopPropagation()}
          >
            <Download size={13} /> Download
          </a>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '28px', height: '28px', borderRadius: '6px',
              background: 'transparent', border: '1px solid #27272a',
              color: '#a1a1aa', cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        onClick={e => e.stopPropagation()}
      >
        {kind === 'image' && (
          <img
            src={url}
            alt={fileName}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
          />
        )}

        {kind === 'pdf' && (
          <iframe
            src={url}
            title={fileName}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
          />
        )}

        {kind === 'video' && (
          <video controls style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
            <source src={url} />
            Your browser does not support video playback.
          </video>
        )}

        {kind === 'audio' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ fontSize: '64px' }}>🎵</div>
            <span style={{ color: '#d4d4d8', fontSize: '15px', fontWeight: 500 }}>{fileName}</span>
            <audio controls style={{ width: '380px' }}>
              <source src={url} />
              Your browser does not support audio playback.
            </audio>
          </div>
        )}

        {kind === 'text' && (
          <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
            {textContent === null && textError === null && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', color: '#71717a' }}>
                <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
                <span>Loading file...</span>
              </div>
            )}
            {textError && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', color: '#f87171' }}>
                <AlertTriangle size={18} /> {textError}
              </div>
            )}
            {textContent !== null && (
              <pre style={{
                margin: 0,
                padding: '16px',
                fontSize: '13px',
                lineHeight: '1.6',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                color: '#d4d4d8',
                background: '#070708',
                borderRadius: '8px',
                border: '1px solid #1c1c1f',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                minHeight: '100%',
              }}>
                {textContent}
              </pre>
            )}
          </div>
        )}

        {kind === 'unsupported' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: '#71717a' }}>
            <FileText size={56} style={{ opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: '14px' }}>No preview available for <strong style={{ color: '#a1a1aa' }}>.{ext}</strong> files</p>
            <a
              href={`/api/files/download?path=${encodeURIComponent(filePath)}`}
              download={fileName}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px',
                background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)',
                color: '#a855f7', fontSize: '13px', textDecoration: 'none',
              }}
            >
              <Download size={14} /> Download instead
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FileExplorer() {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [currentPath, setCurrentPath] = useState<string>(BASE_PATH);
  const [history, setHistory] = useState<string[]>([BASE_PATH]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);

  const [currentFiles, setCurrentFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Viewer state
  const [viewingFile, setViewingFile] = useState<{ path: string; name: string; ext: string } | null>(null);

  const [clipboard, setClipboard] = useState<{ item: FileItem; sourcePath: string } | null>(null);
  const [renamingItem, setRenamingItem] = useState<{ oldName: string; newName: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string>('');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FileItem;
  } | null>(null);

  // Close context menu on any click outside
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, []);

  // ─── Load directory ───
  const loadDirectory = useCallback(async (dirPath: string) => {
    setLoading(true);
    setLoadError(null);
    setSelectedItemName(null);
    try {
      const files = await fetchFiles(dirPath);
      setCurrentFiles(files);
    } catch {
      setLoadError('Could not read directory. Check permissions.');
      setCurrentFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDirectory(currentPath); }, [currentPath, loadDirectory]);
  useEffect(() => { fetchDrives().then(setDrives); }, []);

  // ─── Derived ───
  const currentFolderTitle = currentPath.split('/').pop() || currentPath;
  const filteredFiles = currentFiles.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedItem = currentFiles.find(item => item.name === selectedItemName) || null;

  // ─── Navigation ───
  const navigateToPath = (newPath: string) => {
    setRenamingItem(null);
    const cleanPath = newPath.replace(/\/$/, '');
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(cleanPath);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentPath(cleanPath);
    setSearchQuery('');
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentPath(history[newIndex]);
      setSearchQuery('');
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentPath(history[newIndex]);
      setSearchQuery('');
    }
  };

  const handleUp = () => {
    if (currentPath !== BASE_PATH) {
      const parts = currentPath.split('/');
      parts.pop();
      navigateToPath(parts.join('/'));
    }
  };

  // ─── Double-click handler ───
  const handleItemDoubleClick = (item: FileItem) => {
    if (item.type === 'folder') {
      navigateToPath(`${currentPath}/${item.name}`);
    } else {
      // Open viewer
      setViewingFile({
        path: `${currentPath}/${item.name}`,
        name: item.name,
        ext: item.ext || '',
      });
    }
  };

  // ─── Icons ───
  const getFileIcon = (item: FileItem) => {
    if (item.type === 'folder') return <Folder className={styles.iconFolder} size={16} fill="#fbbf24" />;
    const ext = item.ext?.toLowerCase() || '';
    if (IMAGE_EXTS.includes(ext)) return <Image className={styles.iconImage} size={16} />;
    return <FileText className={styles.iconDoc} size={16} />;
  };

  // ─── Operations ───
  const handleCreateNew = (type: 'folder' | 'file') => console.log(`Create new ${type} in ${currentPath}`);

  const handleDelete = async (itemName?: string) => {
    const target = itemName ?? selectedItemName;
    if (!target) return;
    const confirmed = window.confirm(`Delete "${target}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await axios.delete('/api/files/delete', {
        params: { path: `${currentPath}/${target}` },
      });
      setSelectedItemName(null);
      loadDirectory(currentPath);
    } catch {
      alert(`Failed to delete "${target}".`);
    }
  };

  const handleStartRename = (itemName?: string) => {
    const target = itemName
      ? currentFiles.find(f => f.name === itemName) ?? null
      : selectedItem;
    if (target) setRenamingItem({ oldName: target.name, newName: target.name });
  };
  const handleFinishRename = () => { console.log(`Rename: ${renamingItem?.oldName} → ${renamingItem?.newName}`); setRenamingItem(null); };
  const handleCopy  = () => { if (selectedItem) setClipboard({ item: selectedItem, sourcePath: currentPath }); };
  const handlePaste = () => console.log(`Paste ${clipboard?.item.name} to ${currentPath}`);

  // ─── Context menu ───
  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedItemName(item.name);
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFileName(file.name);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post('/api/files/upload', formData, {
        params: { path: currentPath },
        onUploadProgress: (pe) => {
          if (pe.total) setUploadProgress(Math.round((pe.loaded * 100) / pe.total));
        },
      });
      setUploadProgress(null);
      setUploadingFileName('');
      loadDirectory(currentPath);
    } catch {
      alert('Upload failed');
      setUploadProgress(null);
      setUploadingFileName('');
    }
  };

  // ─── Breadcrumbs ───
  const pathSegments   = currentPath.split('/').filter(Boolean);
  const buildPathUpTo  = (index: number) => '/' + pathSegments.slice(0, index + 1).join('/');

  // ─── Render ───
  return (
    <div className={styles.container}>
      {/* ─── Address Bar ─── */}
      <div className={styles.addressBarArea}>
        <button className={styles.navButton} onClick={handleBack} disabled={historyIndex <= 0} title="Back"><ArrowLeft size={16} /></button>
        <button className={styles.navButton} onClick={handleForward} disabled={historyIndex >= history.length - 1} title="Forward"><ArrowRight size={16} /></button>
        <button className={styles.navButton} onClick={handleUp} disabled={currentPath === BASE_PATH} title="Up"><ArrowUp size={16} /></button>
        <button className={styles.navButton} onClick={() => loadDirectory(currentPath)} title="Refresh"><RefreshCw size={14} /></button>

        <div className={styles.addressInputWrapper}>
          {pathSegments.map((segment, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
              <span className={styles.breadcrumbSegment} onClick={() => navigateToPath(buildPathUpTo(index))}>
                {segment}
              </span>
              {index < pathSegments.length - 1 && <ChevronRight size={12} className={styles.breadcrumbDivider} />}
            </div>
          ))}
        </div>

        <div className={styles.searchWrapper}>
          <Search size={14} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder={`Search ${currentFolderTitle}`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }} onClick={() => setSearchQuery('')}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Command Ribbon ─── */}
      <div className={styles.commandBar}>
        <div className={styles.commandGroup}>
          <button className={`${styles.commandButton} ${styles.accentButton}`} onClick={() => handleCreateNew('folder')}><Plus size={14} /><span>New Folder</span></button>
          <button className={styles.commandButton} onClick={() => handleCreateNew('file')}><Plus size={14} /><span>New File</span></button>
          <button className={styles.commandButton} onClick={() => fileInputRef.current?.click()}><Upload size={14} /><span>Upload</span></button>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleUpload} />

          <div className={styles.commandDivider} />

          <button className={styles.commandButton} onClick={handleCopy} disabled={!selectedItem}><Copy size={13} /><span>Copy</span></button>
          <button className={styles.commandButton} onClick={handlePaste} disabled={!clipboard}><Clipboard size={13} /><span>Paste</span></button>
          <button className={styles.commandButton} onClick={() => handleStartRename()} disabled={!selectedItem}><Edit2 size={13} /><span>Rename</span></button>
          <button className={styles.commandButton} onClick={() => handleDelete()} disabled={!selectedItem} style={{ color: selectedItem ? '#f87171' : '' }}><Trash2 size={13} /><span>Delete</span></button>

          <div className={styles.commandDivider} />

          {/* View button — enabled when a file is selected */}
          <button
            className={styles.commandButton}
            disabled={!selectedItem || selectedItem.type === 'folder'}
            onClick={() => {
              if (selectedItem && selectedItem.type === 'file') {
                setViewingFile({ path: `${currentPath}/${selectedItem.name}`, name: selectedItem.name, ext: selectedItem.ext || '' });
              }
            }}
          >
            <Eye size={13} /><span>View</span>
          </button>
        </div>
      </div>

      {/* ─── Sidebar + Content ─── */}
      <div className={styles.workspace}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarSectionTitle}>Devices</div>
          {Array.isArray(drives) && drives.length > 0 ? (
            drives.map((drive, index) => {
              const driveName = drive.mount === '/' ? 'System Root (/)' : (drive.mount || drive.fs || `Drive ${index + 1}`);
              const isActive = currentPath === BASE_PATH && drive.mount === '/';
              return (
                <div
                  key={drive.fs || index}
                  className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                  onClick={() => navigateToPath(BASE_PATH)}
                  title={`${drive.fs} (${drive.type})`}
                >
                  <HardDrive size={16} style={{ color: '#3b82f6' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{driveName}</span>
                </div>
              );
            })
          ) : (
            <div className={`${styles.sidebarItem} ${currentPath === BASE_PATH ? styles.sidebarItemActive : ''}`} onClick={() => navigateToPath(BASE_PATH)}>
              <HardDrive size={16} style={{ color: '#3b82f6' }} /><span>Home</span>
            </div>
          )}

          {Array.isArray(drives) && drives.length > 0 && drives[0] && (
            <div className={styles.storageIndicator}>
              <div className={styles.storageTitle}>
                <span>Storage</span>
                <span>{Math.round(drives[0].use || 0)}%</span>
              </div>
              <div className={styles.storageBar}>
                <div className={styles.storageProgress} style={{ width: `${Math.min(100, Math.max(0, drives[0].use || 0))}%` }} />
              </div>
              <div className={styles.storageText}>
                {((drives[0].used || 0) / (1024 ** 3)).toFixed(1)} GB used of{' '}
                {((drives[0].size || 0) / (1024 ** 3)).toFixed(1)} GB
              </div>
            </div>
          )}
        </div>

        {/* File area */}
        <div className={styles.contentArea} onClick={() => { setSelectedItemName(null); setRenamingItem(null); }}>
          {loading && (
            <div className={styles.emptyState}>
              <Loader2 size={32} style={{ opacity: 0.4, animation: 'spin 0.8s linear infinite' }} />
              <div className={styles.emptyStateText}>Loading...</div>
            </div>
          )}

          {!loading && loadError && (
            <div className={styles.emptyState}>
              <AlertTriangle size={36} style={{ opacity: 0.4, color: '#f87171' }} />
              <div className={styles.emptyStateText}>{loadError}</div>
            </div>
          )}

          {!loading && !loadError && filteredFiles.length === 0 && (
            <div className={styles.emptyState}>
              <Folder size={48} style={{ opacity: 0.15 }} />
              <div className={styles.emptyStateText}>This folder is empty.</div>
            </div>
          )}

          {!loading && !loadError && filteredFiles.length > 0 && (
            <>
              <div className={styles.fileListHeader} onClick={e => e.stopPropagation()}>
                <div className={styles.fileListHeaderCol}>Name</div>
                <div className={styles.fileListHeaderCol}>Size</div>
                <div className={styles.fileListHeaderCol}>Date Modified</div>
              </div>
              <div className={styles.fileItemsContainer}>
                {filteredFiles.map(item => {
                  const isSelected    = selectedItemName === item.name;
                  const isRenamingThis = renamingItem && renamingItem.oldName === item.name;
                  return (
                    <div
                      key={item.name}
                      className={`${styles.fileItemRow} ${isSelected ? styles.fileItemRowSelected : ''}`}
                      onClick={e => { e.stopPropagation(); setContextMenu(null); setSelectedItemName(item.name); if (!isRenamingThis) setRenamingItem(null); }}
                      onDoubleClick={e => { e.stopPropagation(); handleItemDoubleClick(item); }}
                      onContextMenu={e => handleContextMenu(e, item)}
                    >
                      <div className={styles.fileNameCell}>
                        <div className={styles.fileIcon}>{getFileIcon(item)}</div>
                        {isRenamingThis ? (
                          <input
                            type="text"
                            value={renamingItem.newName}
                            onChange={e => setRenamingItem({ ...renamingItem, newName: e.target.value })}
                            onBlur={handleFinishRename}
                            onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setRenamingItem(null); }}
                            autoFocus
                            onClick={e => e.stopPropagation()}
                            style={{ background: '#141416', border: '1px solid #a855f7', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontSize: '13px', width: '80%', outline: 'none' }}
                          />
                        ) : (
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                        )}
                      </div>
                      <div className={styles.fileSizeCell}>{item.size}</div>
                      <div className={styles.fileModifiedCell}>{item.modified}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Upload progress */}
        {uploadProgress !== null && (
          <div className={styles.uploadProgressCard}>
            <div className={styles.uploadHeader}>
              <span className={styles.uploadTitle}>Uploading...</span>
              <span className={styles.uploadPercent}>{uploadProgress}%</span>
            </div>
            <div className={styles.uploadFileName} title={uploadingFileName}>{uploadingFileName}</div>
            <div className={styles.progressBarContainer}>
              <div className={styles.progressBarFill} style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* ─── File Viewer overlay ─── */}
        {viewingFile && (
          <FileViewer
            filePath={viewingFile.path}
            fileName={viewingFile.name}
            ext={viewingFile.ext}
            onClose={() => setViewingFile(null)}
          />
        )}

        {/* ─── Right-click Context Menu ─── */}
        {contextMenu && (
          <div
            className={styles.contextMenu}
            style={{
              position: 'fixed',
              top: contextMenu.y,
              // Flip left if near the right edge of the viewport
              left: contextMenu.x + 180 > window.innerWidth
                ? contextMenu.x - 180
                : contextMenu.x,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* View / Open — depends on type */}
            {contextMenu.item.type === 'file' && (
              <div
                className={styles.contextMenuItem}
                onClick={() => {
                  setViewingFile({ path: `${currentPath}/${contextMenu.item.name}`, name: contextMenu.item.name, ext: contextMenu.item.ext || '' });
                  setContextMenu(null);
                }}
              >
                <Eye size={13} /> View
              </div>
            )}
            {contextMenu.item.type === 'folder' && (
              <div
                className={styles.contextMenuItem}
                onClick={() => { navigateToPath(`${currentPath}/${contextMenu.item.name}`); setContextMenu(null); }}
              >
                <Folder size={13} /> Open
              </div>
            )}

            <div className={styles.contextMenuDivider} />

            <div
              className={styles.contextMenuItem}
              onClick={() => { handleStartRename(contextMenu.item.name); setContextMenu(null); }}
            >
              <Edit2 size={13} /> Rename
            </div>
            <div
              className={styles.contextMenuItem}
              onClick={() => { handleCopy(); setContextMenu(null); }}
            >
              <Copy size={13} /> Copy
            </div>

            {/* Download — files only */}
            {contextMenu.item.type === 'file' && (
              <a
                className={styles.contextMenuItem}
                href={`/api/files/download?path=${encodeURIComponent(`${currentPath}/${contextMenu.item.name}`)}`}
                download={contextMenu.item.name}
                style={{ textDecoration: 'none' }}
                onClick={() => setContextMenu(null)}
              >
                <Download size={13} /> Download
              </a>
            )}

            <div className={styles.contextMenuDivider} />

            <div
              className={styles.contextMenuItem}
              style={{ color: '#f87171' }}
              onClick={() => { handleDelete(contextMenu.item.name); setContextMenu(null); }}
            >
              <Trash2 size={13} /> Delete
            </div>
          </div>
        )}
      </div>

      {/* ─── Status Bar ─── */}
      <div className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <span>{filteredFiles.length} items</span>
          {selectedItemName && (
            <>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#71717a' }} />
              <span>1 item selected {selectedItem && selectedItem.size !== '--' && `(${selectedItem.size})`}</span>
            </>
          )}
        </div>
        <div className={styles.statusRight}>
          <span>{currentPath}</span>
        </div>
      </div>
    </div>
  );
}

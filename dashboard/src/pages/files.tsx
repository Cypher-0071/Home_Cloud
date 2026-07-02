import React, { useState, useRef, useEffect } from 'react';
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
  Upload
} from 'lucide-react';
import styles from './files.module.css';
import axios from 'axios';

interface MockItem {
  name: string;
  type: 'folder' | 'file';
  size: string;
  modified: string;
  ext?: string;
}

export interface DriveInfo {
  fs: string;
  type: string;
  size: number;
  used: number;
  available: number;
  use: number;
  mount: string;
}

export const fetchDrives = async (): Promise<DriveInfo[]> => {
  try {
    const response = await axios.get<DriveInfo[]>('/api/files/drives');
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Error fetching drives:', error);
    return [];
  }
};

const INITIAL_FS: Record<string, MockItem[]> = {
  'Drive': [
    { name: 'Documents', type: 'folder', size: '--', modified: '2026-06-26 11:15 AM' },
    { name: 'Notes.txt', type: 'file', size: '1.2 KB', modified: '2026-06-26 01:10 PM', ext: 'txt' },
  ],
  'Drive/Documents': [
    { name: 'Project_Spec.pdf', type: 'file', size: '250 KB', modified: '2026-06-26 02:40 PM', ext: 'pdf' },
  ]
};

export default function FileExplorer() {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [fs] = useState<Record<string, MockItem[]>>(INITIAL_FS);
  const [currentPath, setCurrentPath] = useState<string>('Drive');
  const [history, setHistory] = useState<string[]>(['Drive']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);

  useEffect(() => {
    fetchDrives().then(data => {
      setDrives(data);
    });
  }, []);

  // Clipboard state for mock Copy/Paste
  const [clipboard, setClipboard] = useState<{
    item: MockItem;
    sourcePath: string;
  } | null>(null);

  // Inline rename state
  const [renamingItem, setRenamingItem] = useState<{
    oldName: string;
    newName: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string>('');

    const currentFolderTitle = currentPath.split('/').pop() || currentPath;
  const currentFiles = fs[currentPath] || [];

  const filteredFiles = currentFiles.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedItem = currentFiles.find(
    (item) => item.name === selectedItemName
  ) || null;

  // ─── Navigation Handlers ───
  const navigateToPath = (newPath: string) => {
    setRenamingItem(null);
    const cleanPath = newPath.replace(/\/$/, '');

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(cleanPath);

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentPath(cleanPath);
    setSelectedItemName(null);
    setSearchQuery('');
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const targetPath = history[newIndex];
      setHistoryIndex(newIndex);
      setCurrentPath(targetPath);
      setSelectedItemName(null);
      setSearchQuery('');
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const targetPath = history[newIndex];
      setHistoryIndex(newIndex);
      setCurrentPath(targetPath);
      setSelectedItemName(null);
      setSearchQuery('');
    }
  };

  const handleUp = () => {
    const parts = currentPath.split('/');
    if (parts.length > 1) {
      parts.pop();
      navigateToPath(parts.join('/'));
    }
  };

  const getFileIcon = (item: MockItem) => {
    if (item.type === 'folder') {
      return <Folder className={styles.iconFolder} size={16} fill="#fbbf24" />;
    }
    const ext = item.ext?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg'].includes(ext)) {
      return <Image className={styles.iconImage} size={16} />;
    }
    return <FileText className={styles.iconDoc} size={16} />;
  };

  // ─── File Operations (Boilerplate Placeholders) ───
  const handleCreateNew = (type: 'folder' | 'file') => {
    // TODO: Implement file/folder creation logic (e.g. show dialog, add to state, or API call)
    console.log(`Create new ${type} in ${currentPath}`);
  };

  const handleDelete = () => {
    // TODO: Implement delete logic (e.g. API call, update state)
    console.log(`Delete ${selectedItemName} from ${currentPath}`);
    setSelectedItemName(null);
  };

  const handleStartRename = () => {
    if (selectedItem) {
      setRenamingItem({ oldName: selectedItem.name, newName: selectedItem.name });
    }
  };

  const handleFinishRename = () => {
    // TODO: Implement rename persistence/validation (e.g. API call)
    console.log(`Rename finished. Old: ${renamingItem?.oldName}, New: ${renamingItem?.newName}`);
    setRenamingItem(null);
  };

  const handleCopy = () => {
    // TODO: Implement copy to clipboard logic
    if (selectedItem) {
      setClipboard({
        item: selectedItem,
        sourcePath: currentPath,
      });
    }
  };

  const handlePaste = () => {
    // TODO: Implement paste logic (e.g. duplicate files, API call)
    console.log(`Paste ${clipboard?.item.name} from ${clipboard?.sourcePath} to ${currentPath}`);
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
        params: {
          path: currentPath,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        },
      });

      // Clear upload progress status on success
      setUploadProgress(null);
      setUploadingFileName('');
      
      // fetchFiles(currentPath);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed');
      setUploadProgress(null);
      setUploadingFileName('');
    }
  };

  const pathSegments = currentPath.split('/');

  return (
    <div className={styles.container}>
      {/* ─── Address / Navigation Bar Area ─── */}
      <div className={styles.addressBarArea}>
        <button
          className={styles.navButton}
          onClick={handleBack}
          disabled={historyIndex <= 0}
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className={styles.navButton}
          onClick={handleForward}
          disabled={historyIndex >= history.length - 1}
          title="Forward"
        >
          <ArrowRight size={16} />
        </button>
        <button
          className={styles.navButton}
          onClick={handleUp}
          disabled={pathSegments.length <= 1}
          title="Up"
        >
          <ArrowUp size={16} />
        </button>
        <button
          className={styles.navButton}
          onClick={() => navigateToPath(currentPath)}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>

        {/* Breadcrumbs */}
        <div className={styles.addressInputWrapper}>
          {pathSegments.map((segment, index) => {
            const reconstructedPath = pathSegments.slice(0, index + 1).join('/');
            return (
              <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                <span
                  className={styles.breadcrumbSegment}
                  onClick={() => navigateToPath(reconstructedPath)}
                >
                  {segment}
                </span>
                {index < pathSegments.length - 1 && (
                  <ChevronRight size={12} className={styles.breadcrumbDivider} />
                )}
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div className={styles.searchWrapper}>
          <Search size={14} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder={`Search ${currentFolderTitle}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Command Ribbon Bar ─── */}
      <div className={styles.commandBar}>
        <div className={styles.commandGroup}>
          <button
            className={`${styles.commandButton} ${styles.accentButton}`}
            onClick={() => handleCreateNew('folder')}
          >
            <Plus size={14} />
            <span>New Folder</span>
          </button>
          <button
            className={styles.commandButton}
            onClick={() => handleCreateNew('file')}
          >
            <Plus size={14} />
            <span>New File</span>
          </button>

          <button
            className={styles.commandButton}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            <span>Upload</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleUpload}
          />

          <div className={styles.commandDivider} />

          <button
            className={styles.commandButton}
            onClick={handleCopy}
            disabled={!selectedItem}
          >
            <Copy size={13} />
            <span>Copy</span>
          </button>
          <button
            className={styles.commandButton}
            onClick={handlePaste}
            disabled={!clipboard}
          >
            <Clipboard size={13} />
            <span>Paste</span>
          </button>
          <button
            className={styles.commandButton}
            onClick={handleStartRename}
            disabled={!selectedItem}
          >
            <Edit2 size={13} />
            <span>Rename</span>
          </button>
          <button
            className={styles.commandButton}
            onClick={handleDelete}
            disabled={!selectedItem}
            style={{ color: selectedItem ? '#f87171' : '' }}
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* ─── Main Sidebar & Files Workspace ─── */}
      <div className={styles.workspace}>
        {/* Left Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarSectionTitle}>Devices</div>
          {Array.isArray(drives) && drives.length > 0 ? (
            drives.map((drive, index) => {
              const driveName = drive.mount === '/' ? 'System Root (/)' : (drive.mount || drive.fs || `Drive ${index + 1}`);
              const isActive = currentPath === 'Drive' || currentPath === drive.mount;
              return (
                <div
                  key={drive.fs || index}
                  className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                  onClick={() => navigateToPath('Drive')}
                  title={`${drive.fs} (${drive.type})`}
                >
                  <HardDrive size={16} style={{ color: '#3b82f6' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {driveName}
                  </span>
                </div>
              );
            })
          ) : (
            <div
              className={`${styles.sidebarItem} ${currentPath.startsWith('Drive') ? styles.sidebarItemActive : ''}`}
              onClick={() => navigateToPath('Drive')}
            >
              <HardDrive size={16} style={{ color: '#3b82f6' }} />
              <span>Drive</span>
            </div>
          )}

          {Array.isArray(drives) && drives.length > 0 && drives[0] && (
            <div className={styles.storageIndicator}>
              <div className={styles.storageTitle}>
                <span>Storage</span>
                <span>{Math.round(drives[0].use || 0)}%</span>
              </div>
              <div className={styles.storageBar}>
                <div
                  className={styles.storageProgress}
                  style={{ width: `${Math.min(100, Math.max(0, drives[0].use || 0))}%` }}
                />
              </div>
              <div className={styles.storageText}>
                {((drives[0].used || 0) / (1024 * 1024 * 1024)).toFixed(1)} GB used of {((drives[0].size || 0) / (1024 * 1024 * 1024)).toFixed(1)} GB
              </div>
            </div>
          )}
        </div>

        {/* Files View Area */}
        <div
          className={styles.contentArea}
          onClick={() => {
            setSelectedItemName(null);
            setRenamingItem(null);
          }}
        >
          {filteredFiles.length === 0 ? (
            <div className={styles.emptyState}>
              <Folder size={48} style={{ opacity: 0.15 }} />
              <div className={styles.emptyStateText}>This folder is empty.</div>
            </div>
          ) : (
            <>
              <div className={styles.fileListHeader} onClick={(e) => e.stopPropagation()}>
                <div className={styles.fileListHeaderCol}>Name</div>
                <div className={styles.fileListHeaderCol}>Size</div>
                <div className={styles.fileListHeaderCol}>Date Modified</div>
              </div>

              <div className={styles.fileItemsContainer}>
                {filteredFiles.map((item) => {
                  const isSelected = selectedItemName === item.name;
                  const isRenamingThis = renamingItem && renamingItem.oldName === item.name;

                  return (
                    <div
                      key={item.name}
                      className={`${styles.fileItemRow} ${isSelected ? styles.fileItemRowSelected : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItemName(item.name);
                        if (!isRenamingThis) setRenamingItem(null);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (item.type === 'folder') {
                          navigateToPath(`${currentPath}/${item.name}`);
                        }
                      }}
                    >
                      <div className={styles.fileNameCell}>
                        <div className={styles.fileIcon}>{getFileIcon(item)}</div>
                        {isRenamingThis ? (
                          <input
                            type="text"
                            value={renamingItem.newName}
                            onChange={(e) => setRenamingItem({ ...renamingItem, newName: e.target.value })}
                            onBlur={handleFinishRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleFinishRename();
                              if (e.key === 'Escape') setRenamingItem(null);
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              background: '#141416',
                              border: '1px solid #a855f7',
                              color: '#fff',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '13px',
                              width: '80%',
                              outline: 'none'
                            }}
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

        {/* Upload Progress Overlay */}
        {uploadProgress !== null && (
          <div className={styles.uploadProgressCard}>
            <div className={styles.uploadHeader}>
              <span className={styles.uploadTitle}>Uploading...</span>
              <span className={styles.uploadPercent}>{uploadProgress}%</span>
            </div>
            <div className={styles.uploadFileName} title={uploadingFileName}>
              {uploadingFileName}
            </div>
            <div className={styles.progressBarContainer}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${uploadProgress}%` }}
              />
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
          <span>Connected</span>
        </div>
      </div>
    </div>
  );
}

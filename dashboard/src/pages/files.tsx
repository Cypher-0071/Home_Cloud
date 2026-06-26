import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RefreshCw,
  Search,
  Plus,
  Scissors,
  Copy,
  Clipboard,
  Trash2,
  Edit2,
  LayoutGrid,
  List,
  Info,
  Folder,
  File,
  FileText,
  Image,
  Video,
  FileCode,
  HardDrive,
  Network,
  ChevronRight,
  X,
  Star,
  Clock,
  Download,
  FolderClosed
} from 'lucide-react';
import styles from './files.module.css';

interface MockItem {
  name: string;
  type: 'folder' | 'file';
  size: string;
  modified: string;
  ext?: string;
}

const INITIAL_FS: Record<string, MockItem[]> = {
  'Home': [
    { name: 'Desktop', type: 'folder', size: '--', modified: '2026-06-25 10:24 AM' },
    { name: 'Documents', type: 'folder', size: '--', modified: '2026-06-26 11:15 AM' },
    { name: 'Downloads', type: 'folder', size: '--', modified: '2026-06-26 04:30 PM' },
    { name: 'Pictures', type: 'folder', size: '--', modified: '2026-06-24 09:05 AM' },
    { name: 'Videos', type: 'folder', size: '--', modified: '2026-06-20 02:40 PM' },
    { name: 'Project_Spec.docx', type: 'file', size: '1.2 MB', modified: '2026-06-26 01:10 PM', ext: 'docx' },
    { name: 'Backup_Config.json', type: 'file', size: '4.5 KB', modified: '2026-06-25 08:15 PM', ext: 'json' },
  ],
  'Home/Desktop': [
    { name: 'home_cloud_architecture.png', type: 'file', size: '2.4 MB', modified: '2026-06-25 03:50 PM', ext: 'png' },
    { name: 'Readme_First.md', type: 'file', size: '1.8 KB', modified: '2026-06-26 12:00 PM', ext: 'md' },
  ],
  'Home/Documents': [
    { name: 'Invoices', type: 'folder', size: '--', modified: '2026-06-22 11:00 AM' },
    { name: 'Server_Setup.md', type: 'file', size: '12.4 KB', modified: '2026-06-26 08:30 AM', ext: 'md' },
    { name: 'docker-compose.yml', type: 'file', size: '2.1 KB', modified: '2026-06-25 06:12 PM', ext: 'yml' },
    { name: 'Cloud_DB_Backup.sql', type: 'file', size: '48.9 MB', modified: '2026-06-24 11:55 PM', ext: 'sql' },
  ],
  'Home/Documents/Invoices': [
    { name: 'Invoice_2026_01.pdf', type: 'file', size: '142 KB', modified: '2026-02-01 10:00 AM', ext: 'pdf' },
    { name: 'Invoice_2026_02.pdf', type: 'file', size: '155 KB', modified: '2026-03-01 10:30 AM', ext: 'pdf' },
    { name: 'Invoice_2026_03.pdf', type: 'file', size: '164 KB', modified: '2026-04-01 09:15 AM', ext: 'pdf' },
  ],
  'Home/Downloads': [
    { name: 'node-v24.16.0-linux-x64.tar.xz', type: 'file', size: '42.3 MB', modified: '2026-06-26 03:00 PM', ext: 'xz' },
    { name: 'ubuntu-24.04-desktop-amd64.iso', type: 'file', size: '4.1 GB', modified: '2026-06-24 05:22 PM', ext: 'iso' },
    { name: 'resume_draft.pdf', type: 'file', size: '280 KB', modified: '2026-06-26 04:12 PM', ext: 'pdf' },
  ],
  'Home/Pictures': [
    { name: 'wallpapers', type: 'folder', size: '--', modified: '2026-06-24 09:12 AM' },
    { name: 'profile_pic.jpg', type: 'file', size: '1.8 MB', modified: '2026-06-23 05:40 PM', ext: 'jpg' },
    { name: 'server_rack.jpg', type: 'file', size: '3.5 MB', modified: '2026-06-24 10:15 AM', ext: 'jpg' },
  ],
  'Home/Pictures/wallpapers': [
    { name: 'neon_grid.png', type: 'file', size: '4.2 MB', modified: '2026-06-24 09:15 AM', ext: 'png' },
    { name: 'deep_space.jpg', type: 'file', size: '8.7 MB', modified: '2026-06-24 09:18 AM', ext: 'jpg' },
  ],
  'Home/Videos': [
    { name: 'Screencast_2026_06.mp4', type: 'file', size: '124 MB', modified: '2026-06-20 02:40 PM', ext: 'mp4' },
    { name: 'HomeCloud_Intro.mp4', type: 'file', size: '45 MB', modified: '2026-06-18 11:20 AM', ext: 'mp4' },
  ],
  'Cloud Disk (C:)': [
    { name: 'Home', type: 'folder', size: '--', modified: '2026-06-25 10:24 AM' },
    { name: 'etc', type: 'folder', size: '--', modified: '2026-06-20 08:30 AM' },
    { name: 'var', type: 'folder', size: '--', modified: '2026-06-20 08:30 AM' },
    { name: 'usr', type: 'folder', size: '--', modified: '2026-06-20 08:30 AM' },
    { name: 'tmp', type: 'folder', size: '--', modified: '2026-06-26 05:00 PM' },
    { name: 'docker-compose.yml', type: 'file', size: '1.8 KB', modified: '2026-06-26 12:44 PM', ext: 'yml' },
  ],
  'Cloud Disk (C:)/etc': [
    { name: 'nginx', type: 'folder', size: '--', modified: '2026-06-20 08:32 AM' },
    { name: 'hosts', type: 'file', size: '1.2 KB', modified: '2026-06-20 08:30 AM', ext: 'conf' },
    { name: 'resolv.conf', type: 'file', size: '0.8 KB', modified: '2026-06-20 08:30 AM', ext: 'conf' },
  ],
  'Cloud Disk (C:)/etc/nginx': [
    { name: 'nginx.conf', type: 'file', size: '3.4 KB', modified: '2026-06-20 08:32 AM', ext: 'conf' },
  ],
  'Network Share': [
    { name: 'NAS-Backup', type: 'folder', size: '--', modified: '2026-06-25 04:00 AM' },
    { name: 'MediaServer', type: 'folder', size: '--', modified: '2026-06-26 01:22 PM' },
    { name: 'SharedDocs', type: 'folder', size: '--', modified: '2026-06-26 10:15 AM' },
  ],
};

export default function FileExplorer() {
  // Filesystem state
  const [fs, setFs] = useState<Record<string, MockItem[]>>(INITIAL_FS);

  // Single tab / pane navigation states
  const [currentPath, setCurrentPath] = useState<string>('Home');
  const [history, setHistory] = useState<string[]>(['Home']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);

  // Clipboard state for mock Copy, Cut, Paste
  const [clipboard, setClipboard] = useState<{
    item: MockItem;
    sourcePath: string;
    operation: 'copy' | 'cut';
  } | null>(null);

  // Details panel toggle
  const [showDetailPane, setShowDetailPane] = useState(true);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: MockItem | null;
  } | null>(null);

  // Inline rename state
  const [renamingItem, setRenamingItem] = useState<{
    oldName: string;
    newName: string;
  } | null>(null);

  // Quick Access & Storage items configuration
  const sidebarNavigation = {
    favorites: [
      { name: 'Home', path: 'Home', icon: <Star size={16} style={{ color: '#f59e0b' }} /> },
      { name: 'Desktop', path: 'Home/Desktop', icon: <Clock size={16} style={{ color: '#a855f7' }} /> },
      { name: 'Downloads', path: 'Home/Downloads', icon: <Download size={16} style={{ color: '#10b981' }} /> },
    ],
    drives: [
      { name: 'Cloud Disk (C:)', path: 'Cloud Disk (C:)', icon: <HardDrive size={16} style={{ color: '#3b82f6' }} /> },
      { name: 'Network Share', path: 'Network Share', icon: <Network size={16} style={{ color: '#06b6d4' }} /> },
    ],
    folders: [
      { name: 'Documents', path: 'Home/Documents', icon: <Folder size={16} style={{ color: '#fbbf24' }} /> },
      { name: 'Pictures', path: 'Home/Pictures', icon: <Folder size={16} style={{ color: '#fbbf24' }} /> },
      { name: 'Videos', path: 'Home/Videos', icon: <Folder size={16} style={{ color: '#fbbf24' }} /> },
    ],
  };

  const currentFolderTitle = currentPath.split('/').pop() || currentPath;

  // Navigation logic
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

  // Get file icon based on category/ext
  const getFileIcon = (item: MockItem, isBig = false) => {
    const size = isBig ? 40 : 16;
    if (item.type === 'folder') {
      return <Folder className={styles.iconFolder} size={size} fill="#fbbf24" />;
    }
    const ext = item.ext?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) {
      return <Image className={styles.iconImage} size={size} />;
    }
    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) {
      return <Video className={styles.iconVideo} size={size} />;
    }
    if (['json', 'yml', 'yaml', 'sql', 'js', 'ts', 'tsx', 'html', 'css'].includes(ext)) {
      return <FileCode className={styles.iconCode} size={size} />;
    }
    if (['docx', 'doc', 'pdf', 'md', 'txt'].includes(ext)) {
      return <FileText className={styles.iconDoc} size={size} />;
    }
    if (['zip', 'rar', 'tar', 'gz', 'xz'].includes(ext)) {
      return <FolderClosed className={styles.iconZip} size={size} />;
    }
    return <File className={styles.iconFile} size={size} />;
  };

  const currentFiles = fs[currentPath] || [];

  const filteredFiles = currentFiles.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedItem = currentFiles.find(
    (item) => item.name === selectedItemName
  ) || null;

  // File operation controls
  const handleCreateNew = (type: 'folder' | 'file') => {
    const baseName = type === 'folder' ? 'New Folder' : 'New File.txt';
    let newName = baseName;
    let counter = 1;

    while (currentFiles.some((f) => f.name.toLowerCase() === newName.toLowerCase())) {
      if (type === 'folder') {
        newName = `New Folder (${counter})`;
      } else {
        newName = `New File (${counter}).txt`;
      }
      counter++;
    }

    const newItem: MockItem = {
      name: newName,
      type,
      size: type === 'folder' ? '--' : '0 KB',
      modified: new Date().toLocaleDateString('en-US') + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      ext: type === 'file' ? 'txt' : undefined,
    };

    const updatedFiles = [...currentFiles, newItem];
    setFs((prev) => ({
      ...prev,
      [currentPath]: updatedFiles,
      ...(type === 'folder' ? { [`${currentPath}/${newName}`]: [] } : {}),
    }));

    setSelectedItemName(newName);
    setRenamingItem({ oldName: newName, newName });
  };

  const handleDelete = (nameToDelete = selectedItemName) => {
    if (!nameToDelete) return;
    const targetItem = currentFiles.find((f) => f.name === nameToDelete);
    if (!targetItem) return;

    const updatedFiles = currentFiles.filter((f) => f.name !== nameToDelete);

    setFs((prev) => {
      const nextFs = { ...prev, [currentPath]: updatedFiles };
      if (targetItem.type === 'folder') {
        const fullPathToDelete = `${currentPath}/${nameToDelete}`;
        Object.keys(nextFs).forEach((k) => {
          if (k === fullPathToDelete || k.startsWith(fullPathToDelete + '/')) {
            delete nextFs[k];
          }
        });
      }
      return nextFs;
    });

    if (selectedItemName === nameToDelete) {
      setSelectedItemName(null);
    }
  };

  const handleStartRename = () => {
    if (selectedItem) {
      setRenamingItem({ oldName: selectedItem.name, newName: selectedItem.name });
    }
  };

  const handleFinishRename = () => {
    if (!renamingItem) return;
    const { oldName, newName } = renamingItem;

    if (!newName.trim() || oldName === newName) {
      setRenamingItem(null);
      return;
    }

    if (currentFiles.some((f) => f.name.toLowerCase() === newName.toLowerCase() && f.name !== oldName)) {
      alert('A file or folder with this name already exists.');
      return;
    }

    const targetItem = currentFiles.find((f) => f.name === oldName);
    if (!targetItem) return;

    const updatedFiles = currentFiles.map((f) => {
      if (f.name === oldName) {
        const newExt = f.type === 'file' ? newName.split('.').pop() : undefined;
        return { ...f, name: newName, ext: newExt };
      }
      return f;
    });

    setFs((prev) => {
      const nextFs = { ...prev, [currentPath]: updatedFiles };
      if (targetItem.type === 'folder') {
        const oldSubPath = `${currentPath}/${oldName}`;
        const newSubPath = `${currentPath}/${newName}`;

        Object.keys(prev).forEach((key) => {
          if (key === oldSubPath) {
            nextFs[newSubPath] = prev[oldSubPath];
            delete nextFs[oldSubPath];
          } else if (key.startsWith(oldSubPath + '/')) {
            const nestedRelative = key.slice(oldSubPath.length);
            nextFs[newSubPath + nestedRelative] = prev[key];
            delete nextFs[key];
          }
        });
      }
      return nextFs;
    });

    setSelectedItemName(newName);
    setRenamingItem(null);
  };

  const handleCopy = () => {
    if (selectedItem) {
      setClipboard({
        item: selectedItem,
        sourcePath: currentPath,
        operation: 'copy',
      });
    }
    setContextMenu(null);
  };

  const handleCut = () => {
    if (selectedItem) {
      setClipboard({
        item: selectedItem,
        sourcePath: currentPath,
        operation: 'cut',
      });
    }
    setContextMenu(null);
  };

  const handlePaste = () => {
    if (!clipboard) return;

    const { item, sourcePath, operation } = clipboard;
    let pastedName = item.name;

    if (sourcePath === currentPath && operation === 'copy') {
      const parts = item.name.split('.');
      if (item.type === 'file' && parts.length > 1) {
        const ext = parts.pop();
        pastedName = `${parts.join('.')}_Copy.${ext}`;
      } else {
        pastedName = `${item.name}_Copy`;
      }
    }

    let counter = 1;
    while (currentFiles.some((f) => f.name.toLowerCase() === pastedName.toLowerCase())) {
      const parts = item.name.split('.');
      if (item.type === 'file' && parts.length > 1) {
        const ext = parts.pop();
        pastedName = `${parts.join('.')}_Copy_${counter}.${ext}`;
      } else {
        pastedName = `${item.name}_Copy_${counter}`;
      }
      counter++;
    }

    const pastedItem: MockItem = {
      ...item,
      name: pastedName,
      modified: new Date().toLocaleDateString('en-US') + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setFs((prev) => {
      const nextFs = {
        ...prev,
        [currentPath]: [...(prev[currentPath] || []), pastedItem],
      };

      if (item.type === 'folder') {
        const originalFolderPath = `${sourcePath}/${item.name}`;
        const newFolderPath = `${currentPath}/${pastedName}`;

        Object.keys(prev).forEach((k) => {
          if (k === originalFolderPath) {
            nextFs[newFolderPath] = prev[originalFolderPath];
          } else if (k.startsWith(originalFolderPath + '/')) {
            const relative = k.slice(originalFolderPath.length);
            nextFs[newFolderPath + relative] = prev[k];
          }
        });
      }

      if (operation === 'cut') {
        nextFs[sourcePath] = (nextFs[sourcePath] || []).filter(
          (f) => f.name !== item.name
        );
        if (item.type === 'folder') {
          const folderToDelete = `${sourcePath}/${item.name}`;
          Object.keys(nextFs).forEach((k) => {
            if (k === folderToDelete || k.startsWith(folderToDelete + '/')) {
              delete nextFs[k];
            }
          });
        }
      }
      return nextFs;
    });

    if (operation === 'cut') {
      setClipboard(null);
    }

    setSelectedItemName(pastedName);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, item: MockItem | null) => {
    e.preventDefault();
    e.stopPropagation();

    if (item) {
      setSelectedItemName(item.name);
    } else {
      setSelectedItemName(null);
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
    });
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
            title="Create a new folder"
          >
            <Plus size={14} />
            <span>New Folder</span>
          </button>
          <button
            className={styles.commandButton}
            onClick={() => handleCreateNew('file')}
            title="Create a new file"
          >
            <Plus size={14} />
            <span>New File</span>
          </button>

          <div className={styles.commandDivider} />

          <button
            className={styles.commandButton}
            onClick={handleCut}
            disabled={!selectedItem}
            title="Cut selected item"
          >
            <Scissors size={13} />
            <span>Cut</span>
          </button>
          <button
            className={styles.commandButton}
            onClick={handleCopy}
            disabled={!selectedItem}
            title="Copy selected item"
          >
            <Copy size={13} />
            <span>Copy</span>
          </button>
          <button
            className={styles.commandButton}
            onClick={handlePaste}
            disabled={!clipboard}
            title="Paste item from clipboard"
          >
            <Clipboard size={13} />
            <span>Paste</span>
          </button>
          <button
            className={styles.commandButton}
            onClick={handleStartRename}
            disabled={!selectedItem}
            title="Rename selected item"
          >
            <Edit2 size={13} />
            <span>Rename</span>
          </button>
          <button
            className={styles.commandButton}
            onClick={() => handleDelete()}
            disabled={!selectedItem}
            title="Delete selected item"
            style={{ color: selectedItem ? '#f87171' : '' }}
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>

        <div className={styles.commandGroup}>
          <button
            className={`${styles.commandButton} ${viewMode === 'list' ? styles.statusViewToggleActive : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List size={14} />
          </button>
          <button
            className={`${styles.commandButton} ${viewMode === 'grid' ? styles.statusViewToggleActive : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <LayoutGrid size={14} />
          </button>
          <div className={styles.commandDivider} />
          <button
            className={`${styles.commandButton} ${showDetailPane ? styles.statusViewToggleActive : ''}`}
            onClick={() => setShowDetailPane(!showDetailPane)}
            title="Toggle Details Pane"
          >
            <Info size={14} />
            <span>Details</span>
          </button>
        </div>
      </div>

      {/* ─── Main Sidebar & Files Workspace ─── */}
      <div className={styles.workspace}>
        {/* Left Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarSectionTitle}>Quick Access</div>
          {sidebarNavigation.favorites.map((item) => (
            <div
              key={item.name}
              className={`${styles.sidebarItem} ${currentPath === item.path ? styles.sidebarItemActive : ''}`}
              onClick={() => navigateToPath(item.path)}
            >
              {item.icon}
              <span>{item.name}</span>
            </div>
          ))}

          <div className={styles.sidebarSectionTitle}>Cloud Directories</div>
          {sidebarNavigation.folders.map((item) => (
            <div
              key={item.name}
              className={`${styles.sidebarItem} ${currentPath === item.path ? styles.sidebarItemActive : ''}`}
              onClick={() => navigateToPath(item.path)}
            >
              {item.icon}
              <span>{item.name}</span>
            </div>
          ))}

          <div className={styles.sidebarSectionTitle}>System Devices</div>
          {sidebarNavigation.drives.map((item) => (
            <div
              key={item.name}
              className={`${styles.sidebarItem} ${currentPath === item.path ? styles.sidebarItemActive : ''}`}
              onClick={() => navigateToPath(item.path)}
            >
              {item.icon}
              <span>{item.name}</span>
            </div>
          ))}

          {/* Drive usage meter */}
          <div className={styles.storageIndicator}>
            <div className={styles.storageTitle}>
              <span>Cloud Storage</span>
              <span>75% Full</span>
            </div>
            <div className={styles.storageBar}>
              <div className={styles.storageProgress} style={{ width: '75%' }} />
            </div>
            <div className={styles.storageText}>
              384 GB used of 512 GB
            </div>
          </div>
        </div>

        {/* Middle Files View Area */}
        <div
          className={styles.contentArea}
          onContextMenu={(e) => handleContextMenu(e, null)}
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
          ) : viewMode === 'list' ? (
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
                      onContextMenu={(e) => handleContextMenu(e, item)}
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
          ) : (
            /* Grid View */
            <div className={styles.fileItemsContainer}>
              <div className={styles.gridContainer}>
                {filteredFiles.map((item) => {
                  const isSelected = selectedItemName === item.name;
                  const isRenamingThis = renamingItem && renamingItem.oldName === item.name;

                  return (
                    <div
                      key={item.name}
                      className={`${styles.gridCard} ${isSelected ? styles.gridCardSelected : ''}`}
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
                      onContextMenu={(e) => handleContextMenu(e, item)}
                    >
                      <div className={styles.gridIcon}>
                        {getFileIcon(item, true)}
                      </div>
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
                            padding: '2px 4px',
                            fontSize: '11px',
                            width: '90%',
                            textAlign: 'center',
                            outline: 'none'
                          }}
                        />
                      ) : (
                        <span className={styles.gridName}>{item.name}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Details Pane */}
        {showDetailPane && (
          <div className={styles.detailPane}>
            <div className={styles.detailHeader}>
              <span className={styles.detailHeaderTitle}>Details</span>
              <button
                className={styles.detailCloseBtn}
                onClick={() => setShowDetailPane(false)}
              >
                <X size={14} />
              </button>
            </div>

            {selectedItem ? (
              <>
                <div className={styles.previewContainer}>
                  <div className={styles.previewIcon}>
                    {getFileIcon(selectedItem, true)}
                  </div>
                  <div className={styles.previewName}>{selectedItem.name}</div>
                  <span className={styles.previewType}>
                    {selectedItem.type === 'folder' ? 'Folder' : `${selectedItem.ext?.toUpperCase() || 'Unknown'} File`}
                  </span>
                </div>

                <div className={styles.infoSection}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Path</span>
                    <span className={styles.infoValue}>
                      {currentPath}/{selectedItem.name}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Size</span>
                    <span className={styles.infoValue}>{selectedItem.size}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Modified</span>
                    <span className={styles.infoValue}>{selectedItem.modified}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Owner</span>
                    <span className={styles.infoValue}>rudra-unix</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Permissions</span>
                    <span className={styles.infoValue}>drwxr-xr-x (755)</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.previewContainer}>
                  <div className={styles.previewIcon}>
                    <Folder size={64} className={styles.iconFolder} fill="#fbbf24" />
                  </div>
                  <div className={styles.previewName}>{currentFolderTitle}</div>
                  <span className={styles.previewType}>System Folder</span>
                </div>

                <div className={styles.infoSection}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Type</span>
                    <span className={styles.infoValue}>Directory</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Contains</span>
                    <span className={styles.infoValue}>
                      {currentFiles.filter((f) => f.type === 'folder').length} folders,{' '}
                      {currentFiles.filter((f) => f.type === 'file').length} files
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Path</span>
                    <span className={styles.infoValue}>{currentPath}</span>
                  </div>
                </div>
              </>
            )}
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
          {clipboard && (
            <span style={{ fontSize: '10px', color: '#a855f7', background: '#231530', padding: '2px 8px', borderRadius: '4px', border: '1px solid #58208c' }}>
              Clipboard: {clipboard.operation === 'copy' ? 'Copying' : 'Cutting'} "{clipboard.item.name}"
            </span>
          )}
          <span>Connected</span>
        </div>
      </div>

      {/* ─── Context Menu ─── */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.item ? (
            <>
              <div
                className={styles.contextMenuItem}
                onClick={() => {
                  if (contextMenu.item?.type === 'folder') {
                    navigateToPath(`${currentPath}/${contextMenu.item.name}`);
                  }
                  setContextMenu(null);
                }}
              >
                <Folder size={14} />
                <span>Open</span>
              </div>
              <div className={styles.contextMenuDivider} />
              <div className={styles.contextMenuItem} onClick={handleCopy}>
                <Copy size={14} />
                <span>Copy</span>
              </div>
              <div className={styles.contextMenuItem} onClick={handleCut}>
                <Scissors size={14} />
                <span>Cut</span>
              </div>
              <div className={styles.contextMenuItem} onClick={handleStartRename}>
                <Edit2 size={14} />
                <span>Rename</span>
              </div>
              <div className={styles.contextMenuDivider} />
              <div
                className={styles.contextMenuItem}
                style={{ color: '#f87171' }}
                onClick={() => {
                  handleDelete(contextMenu.item?.name);
                  setContextMenu(null);
                }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.contextMenuItem} onClick={() => { handleCreateNew('folder'); setContextMenu(null); }}>
                <Plus size={14} />
                <span>New Folder</span>
              </div>
              <div className={styles.contextMenuItem} onClick={() => { handleCreateNew('file'); setContextMenu(null); }}>
                <Plus size={14} />
                <span>New Text File</span>
              </div>
              <div className={styles.contextMenuDivider} />
              <div
                className={styles.contextMenuItem}
                style={{ opacity: clipboard ? 1 : 0.5, pointerEvents: clipboard ? 'auto' : 'none' }}
                onClick={handlePaste}
              >
                <Clipboard size={14} />
                <span>Paste</span>
              </div>
              <div className={styles.contextMenuDivider} />
              <div className={styles.contextMenuItem} onClick={() => { navigateToPath(currentPath); setContextMenu(null); }}>
                <RefreshCw size={14} />
                <span>Refresh</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

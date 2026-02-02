'use client';

import { useState, useRef, useCallback } from 'react';
import { Download, Upload, Check, AlertTriangle, X } from 'lucide-react';
import { Forum, KeywordAlert, Bookmark } from '@/types';

interface ExportData {
  version: 1;
  exportedAt: string;
  forums: Forum[];
  alerts: KeywordAlert[];
  bookmarks: Bookmark[];
}

interface ConfigExportImportProps {
  forums: Forum[];
  alerts: KeywordAlert[];
  bookmarks: Bookmark[];
  onImport: (data: { forums?: Forum[]; alerts?: KeywordAlert[]; bookmarks?: Bookmark[] }) => void;
}

type ImportStatus = 'idle' | 'success' | 'error';

export function ConfigExportImport({
  forums,
  alerts,
  bookmarks,
  onImport,
}: ConfigExportImportProps) {
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importMessage, setImportMessage] = useState<string>('');
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [pendingImport, setPendingImport] = useState<ExportData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const exportData: ExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      forums,
      alerts,
      bookmarks,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gov-watch-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [forums, alerts, bookmarks]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as ExportData;

        // Validate structure
        if (!data.version || !data.exportedAt) {
          throw new Error('Invalid configuration file format');
        }

        // Validate arrays exist
        if (!Array.isArray(data.forums) && !Array.isArray(data.alerts) && !Array.isArray(data.bookmarks)) {
          throw new Error('No valid data found in configuration file');
        }

        setPendingImport(data);
        setShowImportPreview(true);
        setImportStatus('idle');
        setImportMessage('');
      } catch (err) {
        setImportStatus('error');
        setImportMessage(err instanceof Error ? err.message : 'Failed to parse configuration file');
      }
    };
    reader.onerror = () => {
      setImportStatus('error');
      setImportMessage('Failed to read file');
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleImportConfirm = useCallback((mergeExisting: boolean) => {
    if (!pendingImport) return;

    try {
      if (mergeExisting) {
        // Merge: add new items that don't exist
        const existingForumUrls = new Set(forums.map((f) => f.discourseForum.url));
        const existingAlertKeywords = new Set(alerts.map((a) => a.keyword.toLowerCase()));
        const existingBookmarkRefs = new Set(bookmarks.map((b) => b.topicRefId));

        const newForums = pendingImport.forums?.filter(
          (f) => !existingForumUrls.has(f.discourseForum.url)
        );
        const newAlerts = pendingImport.alerts?.filter(
          (a) => !existingAlertKeywords.has(a.keyword.toLowerCase())
        );
        const newBookmarks = pendingImport.bookmarks?.filter(
          (b) => !existingBookmarkRefs.has(b.topicRefId)
        );

        onImport({
          forums: newForums,
          alerts: newAlerts,
          bookmarks: newBookmarks,
        });

        const added = (newForums?.length || 0) + (newAlerts?.length || 0) + (newBookmarks?.length || 0);
        setImportMessage(`Merged ${added} new item${added !== 1 ? 's' : ''}`);
      } else {
        // Replace: use imported data
        onImport({
          forums: pendingImport.forums,
          alerts: pendingImport.alerts,
          bookmarks: pendingImport.bookmarks,
        });
        const total =
          (pendingImport.forums?.length || 0) +
          (pendingImport.alerts?.length || 0) +
          (pendingImport.bookmarks?.length || 0);
        setImportMessage(`Imported ${total} item${total !== 1 ? 's' : ''}`);
      }

      setImportStatus('success');
      setShowImportPreview(false);
      setPendingImport(null);
    } catch (err) {
      setImportStatus('error');
      setImportMessage(err instanceof Error ? err.message : 'Failed to import configuration');
    }
  }, [pendingImport, forums, alerts, bookmarks, onImport]);

  const handleCancelImport = useCallback(() => {
    setShowImportPreview(false);
    setPendingImport(null);
    setImportStatus('idle');
    setImportMessage('');
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Download className="w-4 h-4" />
          Export Configuration
        </button>

        <label className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500">
          <Upload className="w-4 h-4" />
          Import Configuration
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="sr-only"
          />
        </label>
      </div>

      {/* Status message */}
      {importStatus !== 'idle' && !showImportPreview && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            importStatus === 'success'
              ? 'bg-green-900/20 text-green-400'
              : 'bg-indigo-900/20 text-indigo-400'
          }`}
        >
          {importStatus === 'success' ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {importMessage}
        </div>
      )}

      {/* Import preview modal */}
      {showImportPreview && pendingImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-xl shadow-xl p-6"
            style={{ backgroundColor: 'var(--card-bg)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-dialog-title"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 id="import-dialog-title" className="text-lg font-semibold text-white">
                Import Configuration
              </h3>
              <button
                onClick={handleCancelImport}
                className="p-1 text-gray-400 hover:text-white rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Cancel import"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-gray-400 text-sm">
                This file contains:
              </p>
              <ul className="space-y-1 text-sm">
                {pendingImport.forums && pendingImport.forums.length > 0 && (
                  <li className="text-white">
                    {pendingImport.forums.length} forum{pendingImport.forums.length !== 1 ? 's' : ''}
                  </li>
                )}
                {pendingImport.alerts && pendingImport.alerts.length > 0 && (
                  <li className="text-white">
                    {pendingImport.alerts.length} keyword alert{pendingImport.alerts.length !== 1 ? 's' : ''}
                  </li>
                )}
                {pendingImport.bookmarks && pendingImport.bookmarks.length > 0 && (
                  <li className="text-white">
                    {pendingImport.bookmarks.length} bookmark{pendingImport.bookmarks.length !== 1 ? 's' : ''}
                  </li>
                )}
              </ul>
              <p className="text-gray-500 text-xs">
                Exported on {new Date(pendingImport.exportedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleImportConfirm(true)}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                Merge with existing data
              </button>
              <button
                onClick={() => handleImportConfirm(false)}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Replace all data
              </button>
              <button
                onClick={handleCancelImport}
                className="w-full px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-gray-500 text-xs">
        Export your forums, keyword alerts, and bookmarks to a JSON file. You can import this file on another device or browser to restore your configuration.
      </p>
    </div>
  );
}

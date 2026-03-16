import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  importChromeBookmarks,
  importFromHTML,
  importFromJSON,
  exportToJSON,
  exportToHTML,
} from '../../services/importExport';
import { toast } from '../../components/Toast';
import { Package, X, Upload, Download, Globe, FileText, Compass, AlertCircle } from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportExportModal({ isOpen, onClose, onImportComplete }: ImportExportModalProps) {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const safariFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImportChrome = async () => {
    setPermissionDenied(false);
    setIsProcessing(true);
    try {
      const result = await importChromeBookmarks();
      toast.success(t('import.success', { imported: result.imported, skipped: result.skipped }));
      onImportComplete();
      onClose();
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('permission denied') || msg.includes('Permission denied')) {
        setPermissionDenied(true);
      } else {
        toast.error(t('import.error') + ': ' + msg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>, source: 'generic' | 'safari' = 'generic') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const content = await file.text();
      let result;

      if (file.name.endsWith('.json')) {
        result = await importFromJSON(content);
      } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        result = await importFromHTML(content);
      } else {
        throw new Error(t('import.unsupportedFormat'));
      }

      toast.success(t('import.success', { imported: result.imported, skipped: result.skipped }));
      onImportComplete();
      onClose();
    } catch (error) {
      toast.error(t('import.error') + ': ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
      if (source === 'safari' && safariFileInputRef.current) {
        safariFileInputRef.current.value = '';
      } else if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = async (format: 'json' | 'html') => {
    setIsProcessing(true);
    try {
      const content = format === 'json' ? await exportToJSON() : await exportToHTML();
      const blob = new Blob([content], {
        type: format === 'json' ? 'application/json' : 'text/html',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-bookmarks-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('export.success'));
    } catch (error) {
      toast.error(t('export.error') + ': ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="sb-card w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sb-divider">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-violet-500" />
            {t('importExport.title')}
          </h2>
          <button
            onClick={onClose}
            className="sb-button w-8 h-8 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b sb-divider">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'text-violet-500 border-b-2 border-violet-400 bg-violet-500/10'
                : 'sb-muted hover:text-[var(--text-primary)]'
            }`}
          >
            <Upload className="w-4 h-4" /> {t('importExport.import')}
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-violet-500 border-b-2 border-violet-400 bg-violet-500/10'
                : 'sb-muted hover:text-[var(--text-primary)]'
            }`}
          >
            <Download className="w-4 h-4" /> {t('importExport.export')}
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === 'import' ? (
            <div className="space-y-4">
              {/* Import from Chrome */}
              <button
                onClick={handleImportChrome}
                disabled={isProcessing}
                className="w-full p-4 sb-card sb-card-hover rounded-xl transition-all text-left group disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-2xl">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold group-hover:text-violet-400 transition-colors">
                      {t('import.fromChrome')}
                    </h3>
                    <p className="text-sm sb-muted">{t('import.fromChromeDesc')}</p>
                  </div>
                  <span className="sb-muted group-hover:text-violet-400 transition-colors">→</span>
                </div>
              </button>

              {/* Permission Denied Guidance */}
              {permissionDenied && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-300 mb-1">{t('import.permissionDeniedTitle')}</h4>
                      <p className="text-sm sb-secondary mb-2">{t('import.permissionDeniedDesc')}</p>
                      <ol className="text-sm sb-muted space-y-1 list-decimal list-inside">
                        <li>{t('import.permissionStep1')}</li>
                        <li>{t('import.permissionStep2')}</li>
                        <li>{t('import.permissionStep3')}</li>
                      </ol>
                      <button
                        onClick={handleImportChrome}
                        disabled={isProcessing}
                        className="mt-3 px-4 py-1.5 text-sm bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                      >
                        {t('import.retryPermission')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Import from Safari */}
              <div className="relative">
                <input
                  ref={safariFileInputRef}
                  type="file"
                  accept=".html,.htm"
                  onChange={(e) => handleFileImport(e, 'safari')}
                  disabled={isProcessing}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="p-4 sb-card sb-card-hover rounded-xl transition-all text-left group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-2xl">
                      <Compass className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold group-hover:text-violet-400 transition-colors">
                        {t('import.fromSafari')}
                      </h3>
                      <p className="text-sm sb-muted">{t('import.fromSafariDesc')}</p>
                    </div>
                    <span className="sb-muted group-hover:text-violet-400 transition-colors">→</span>
                  </div>
                </div>
              </div>

              {/* Import from File */}
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".html,.htm,.json"
                  onChange={handleFileImport}
                  disabled={isProcessing}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="p-4 sb-card sb-card-hover rounded-xl border border-dashed transition-all text-left group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-2xl">
                    <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold group-hover:text-violet-400 transition-colors">
                        {t('import.fromFile')}
                      </h3>
                      <p className="text-sm sb-muted">{t('import.fromFileDesc')}</p>
                    </div>
                    <span className="sb-muted group-hover:text-violet-400 transition-colors">+</span>
                  </div>
                </div>
              </div>

              {isProcessing && (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent"></div>
                  <p className="mt-2 text-sm sb-muted">{t('import.processing')}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Export as JSON */}
              <button
                onClick={() => handleExport('json')}
                disabled={isProcessing}
                className="w-full p-4 sb-card sb-card-hover rounded-xl transition-all text-left group disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold group-hover:text-violet-400 transition-colors">
                      {t('export.asJSON')}
                    </h3>
                    <p className="text-sm sb-muted">{t('export.asJSONDesc')}</p>
                  </div>
                  <span className="sb-muted group-hover:text-violet-400 transition-colors">↓</span>
                </div>
              </button>

              {/* Export as HTML */}
              <button
                onClick={() => handleExport('html')}
                disabled={isProcessing}
                className="w-full p-4 sb-card sb-card-hover rounded-xl transition-all text-left group disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-2xl">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold group-hover:text-violet-400 transition-colors">
                      {t('export.asHTML')}
                    </h3>
                    <p className="text-sm sb-muted">{t('export.asHTMLDesc')}</p>
                  </div>
                  <span className="sb-muted group-hover:text-violet-400 transition-colors">↓</span>
                </div>
              </button>

              {isProcessing && (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent"></div>
                  <p className="mt-2 text-sm sb-muted">{t('export.processing')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t sb-divider text-xs sb-muted text-center">
          {activeTab === 'import'
            ? t('import.hint')
            : t('export.hint')}
        </div>
      </div>
    </div>
  );
}

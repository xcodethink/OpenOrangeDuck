import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { backupService, type BackupInfo } from '../../services/backup';
import {
  X,
  Cloud,
  CloudUpload,
  Download,
  Trash2,
  Loader2,
  Lock,
  AlertCircle,
  Check,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
}

export default function CloudBackupModal({ isOpen, onClose, isLoggedIn }: Props) {
  const { t } = useTranslation();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && isLoggedIn) {
      loadBackups();
    }
  }, [isOpen, isLoggedIn]);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const list = await backupService.listBackups();
      setBackups(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!password) {
      setError(t('backup.passwordRequired'));
      return;
    }
    setActionLoading('create');
    setError('');
    try {
      await backupService.createBackup(password, hint || undefined);
      setSuccess(t('backup.createSuccess'));
      await loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (backupId: string) => {
    if (!password) {
      setError(t('backup.passwordRequired'));
      return;
    }
    setActionLoading(backupId);
    setError('');
    setSuccess('');
    try {
      const result = await backupService.restoreBackup(backupId, password);
      setSuccess(t('backup.restoreSuccess', { count: result.bookmarks }));
      await loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (backupId: string) => {
    setActionLoading(`del-${backupId}`);
    setError('');
    try {
      await backupService.deleteBackup(backupId);
      setBackups(prev => prev.filter(b => b.id !== backupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg sb-card p-6 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Cloud className="w-5 h-5 text-violet-400" />
            {t('backup.title')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg sb-card-hover">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isLoggedIn ? (
          <div className="text-center py-8">
            <Lock className="w-12 h-12 mx-auto mb-4 sb-muted" />
            <p className="sb-muted mb-4">{t('backup.loginRequired')}</p>
            <button
              onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/auth/index.html') })}
              className="px-4 py-2 sb-button-primary rounded-lg"
            >
              {t('auth.signIn')}
            </button>
          </div>
        ) : (
          <>
            {/* Messages */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                {success}
              </div>
            )}

            {/* Password Input */}
            <div className="mb-4">
              <label className="block text-sm sb-muted mb-2 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                {t('backup.encryptionPassword')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('backup.passwordPlaceholder')}
                className="w-full sb-input px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              <p className="text-xs sb-muted mt-1">{t('backup.passwordReminder')}</p>
            </div>

            {/* Password Hint */}
            <div className="mb-4">
              <label className="block text-sm sb-muted mb-2">
                {t('backup.hintLabel')}
              </label>
              <input
                type="text"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder={t('backup.hintPlaceholder')}
                maxLength={200}
                className="w-full sb-input px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              <p className="text-xs sb-muted mt-1">{t('backup.hintDesc')}</p>
            </div>

            {/* Create Backup */}
            <button
              onClick={handleCreateBackup}
              disabled={actionLoading !== null || !password}
              className="w-full py-3 mb-6 rounded-xl font-medium sb-button-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {actionLoading === 'create' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CloudUpload className="w-4 h-4" />
              )}
              {t('backup.createBackup')}
            </button>

            {/* Backup List */}
            <div>
              <h3 className="text-sm font-medium mb-3 sb-secondary">
                {t('backup.existingBackups')} ({backups.length}/5)
              </h3>

              {loading ? (
                <div className="text-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto sb-muted" />
                </div>
              ) : backups.length === 0 ? (
                <p className="text-center py-6 text-sm sb-muted">
                  {t('backup.noBackups')}
                </p>
              ) : (
                <div className="space-y-2">
                  {backups.map((backup) => (
                    <div key={backup.id} className="p-3 sb-card rounded-lg flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">
                          {new Date(backup.created_at).toLocaleDateString()} {new Date(backup.created_at).toLocaleTimeString()}
                        </div>
                        <div className="text-xs sb-muted">
                          {backup.bookmark_count} bookmarks · {backup.folder_count} folders · {formatSize(backup.size_bytes)}
                        </div>
                        {backup.hint && (
                          <div className="text-xs text-amber-400/80 mt-0.5">
                            💡 {t('backup.hintPrefix')}: {backup.hint}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRestore(backup.id)}
                          disabled={actionLoading !== null || !password}
                          className="p-2 rounded-lg sb-card-hover text-blue-400 hover:text-blue-300 disabled:opacity-50"
                          title={t('backup.restore')}
                        >
                          {actionLoading === backup.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(backup.id)}
                          disabled={actionLoading !== null}
                          className="p-2 rounded-lg sb-card-hover text-red-400 hover:text-red-300 disabled:opacity-50"
                          title={t('common.delete')}
                        >
                          {actionLoading === `del-${backup.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

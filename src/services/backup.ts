/**
 * Cloud Backup Service
 *
 * Handles creating, listing, restoring, and deleting cloud backups.
 * Data is encrypted client-side before uploading.
 */

import { apiClient } from './apiClient';
import { encrypt, decrypt, sha256 } from './encryption';
import { bookmarkService, folderService } from './database';
import { storageService } from './storage';
import type { Bookmark, Folder } from '../types';

export interface BackupInfo {
  id: string;
  size_bytes: number;
  bookmark_count: number;
  folder_count: number;
  checksum: string;
  hint?: string;
  created_at: string;
}

interface ExportData {
  version: string;
  exportedAt: string;
  bookmarks: Bookmark[];
  folders: Folder[];
}

export const backupService = {
  /**
   * Create a cloud backup: export all data → encrypt → upload.
   */
  async createBackup(password: string, hint?: string): Promise<BackupInfo> {
    // Export all data
    const bookmarks = await bookmarkService.getAll();
    const folders = await folderService.getAll();

    const exportData: ExportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      bookmarks,
      folders,
    };

    const jsonStr = JSON.stringify(exportData);
    const checksum = await sha256(jsonStr);

    // Encrypt
    const encryptedData = await encrypt(jsonStr, password);

    // Upload
    const result = await apiClient.post<{
      success: boolean;
      backup: BackupInfo;
    }>('/backup', {
      data: encryptedData,
      bookmarkCount: bookmarks.length,
      folderCount: folders.length,
      checksum,
      hint: hint || undefined,
    });

    // Update last backup time
    await storageService.saveSettings({
      lastBackupAt: new Date().toISOString(),
    });

    return result.backup;
  },

  /**
   * List all cloud backups for the current user.
   */
  async listBackups(): Promise<BackupInfo[]> {
    const result = await apiClient.get<{ backups: BackupInfo[] }>('/backup/list');
    return result.backups;
  },

  /**
   * Restore a cloud backup: download → decrypt → import.
   * Returns the number of imported bookmarks.
   */
  async restoreBackup(
    backupId: string,
    password: string
  ): Promise<{ bookmarks: number; folders: number }> {
    // Download
    const result = await apiClient.get<{ success: boolean; data: string }>(
      `/backup/${backupId}`
    );

    if (!result.data) {
      throw new Error('Backup data is empty');
    }

    // Decrypt
    let jsonStr: string;
    try {
      jsonStr = await decrypt(result.data, password);
    } catch {
      throw new Error('Wrong password or corrupted backup');
    }

    // Parse
    const exportData: ExportData = JSON.parse(jsonStr);

    if (!exportData.bookmarks || !exportData.folders) {
      throw new Error('Invalid backup format');
    }

    // Import folders first
    for (const folder of exportData.folders) {
      const existing = await folderService.getById(folder.id);
      if (!existing) {
        await folderService.create(folder);
      }
    }

    // Import bookmarks (skip duplicates by normalizedUrl)
    let importedCount = 0;
    for (const bookmark of exportData.bookmarks) {
      const existing = await bookmarkService.getByNormalizedUrl(bookmark.normalizedUrl);
      if (!existing) {
        await bookmarkService.create(bookmark);
        importedCount++;
      }
    }

    return {
      bookmarks: importedCount,
      folders: exportData.folders.length,
    };
  },

  /**
   * Delete a cloud backup.
   */
  async deleteBackup(backupId: string): Promise<void> {
    await apiClient.delete(`/backup/${backupId}`);
  },
};

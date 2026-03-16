import type { SnapshotLevel } from '../types';

/**
 * Snapshot levels (L1/L2/L3) are free format choices.
 * Token costs only apply to AI features and anti-fraud analysis.
 */
export const snapshotService = {
  canUseLevel(_level: SnapshotLevel, _isLoggedIn: boolean): boolean {
    return true;
  },

  getCost(_level: SnapshotLevel): number {
    return 0;
  },

  async canUseLevelFromSettings(_level: SnapshotLevel): Promise<boolean> {
    return true;
  },

  async resolveLevel(requestedLevel: SnapshotLevel): Promise<SnapshotLevel> {
    return requestedLevel;
  },
};

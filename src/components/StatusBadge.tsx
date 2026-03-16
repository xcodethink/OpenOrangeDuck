import { useTranslation } from 'react-i18next';
import type { BookmarkStatus } from '../types';
import { Check, Camera, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatusBadgeProps {
  status: BookmarkStatus;
  onClick?: () => void;
}

export default function StatusBadge({ status, onClick }: StatusBadgeProps) {
  const { t } = useTranslation();

  const config: Record<string, { Icon: LucideIcon; color: string; label: string; spin?: boolean }> = {
    healthy: { Icon: Check, color: 'emerald', label: t('status.healthy') },
    dead: { Icon: Camera, color: 'blue', label: t('status.dead') },
    checking: { Icon: Loader2, color: 'amber', label: t('status.checking'), spin: true },
  };

  const c = config[status] || config.healthy;

  const bgColors: Record<string, string> = {
    emerald: 'bg-emerald-500/30',
    blue: 'bg-blue-500/30',
    amber: 'bg-amber-500/30',
  };

  const textColors: Record<string, string> = {
    emerald: 'text-emerald-300',
    blue: 'text-blue-300',
    amber: 'text-amber-300',
  };

  return (
    <span
      onClick={(e) => {
        if (status === 'dead' && onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bgColors[c.color]} ${textColors[c.color]} ${
        status === 'dead' && onClick ? 'cursor-pointer hover:brightness-110' : ''
      }`}
    >
      <c.Icon className={`w-3 h-3 ${c.spin ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}

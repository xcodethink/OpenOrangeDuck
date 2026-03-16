import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Check, X, AlertTriangle, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Toast 类型
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Toast Store
interface ToastStore {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    return id;
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// 便捷方法
export const toast = {
  success: (message: string, duration = 3000): string => {
    return useToastStore.getState().addToast({ type: 'success', message, duration });
  },
  error: (message: string, duration = 5000): string => {
    return useToastStore.getState().addToast({ type: 'error', message, duration });
  },
  warning: (message: string, duration = 4000): string => {
    return useToastStore.getState().addToast({ type: 'warning', message, duration });
  },
  info: (message: string, duration = 3000): string => {
    return useToastStore.getState().addToast({ type: 'info', message, duration });
  },
  dismiss: (id?: string) => {
    if (id) {
      useToastStore.getState().removeToast(id);
    } else {
      // Clear all
      const { toasts } = useToastStore.getState();
      toasts.forEach(t => useToastStore.getState().removeToast(t.id));
    }
  },
};

// 单个 Toast 组件
function ToastItemComponent({ item }: { item: ToastItem }) {
  const { removeToast } = useToastStore();
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => removeToast(item.id), 300);
    }, item.duration || 3000);

    return () => clearTimeout(timer);
  }, [item.id, item.duration, removeToast]);

  const icons: Record<ToastType, LucideIcon> = {
    success: Check,
    error: X,
    warning: AlertTriangle,
    info: Info,
  };

  const colors: Record<ToastType, string> = {
    success: 'bg-emerald-500/90 border-emerald-400',
    error: 'bg-red-500/90 border-red-400',
    warning: 'bg-amber-500/90 border-amber-400',
    info: 'bg-blue-500/90 border-blue-400',
  };

  const Icon = icons[item.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 ${colors[item.type]} ${
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
      }`}
    >
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-white">
        <Icon className="w-3 h-3" />
      </span>
      <span className="text-white text-sm font-medium">{item.message}</span>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => removeToast(item.id), 300);
        }}
        className="ml-auto text-white/70 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Toast 容器
export function ToastContainer() {
  const { toasts } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItemComponent key={t.id} item={t} />
      ))}
    </div>
  );
}

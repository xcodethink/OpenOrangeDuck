// 骨架屏组件

// 基础骨架元素
export function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[var(--border-secondary)] rounded ${className}`} />
  );
}

// 书签卡片骨架
export function BookmarkCardSkeleton() {
  return (
    <div className="sb-card rounded-xl p-4">
      <div className="flex items-start gap-3">
        <SkeletonBox className="w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <SkeletonBox className="h-4 w-3/4" />
          <SkeletonBox className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <SkeletonBox className="h-3 w-full" />
        <SkeletonBox className="h-3 w-5/6" />
      </div>
      <div className="mt-3 flex gap-2">
        <SkeletonBox className="h-5 w-14 rounded-full" />
        <SkeletonBox className="h-5 w-16 rounded-full" />
        <SkeletonBox className="h-5 w-12 rounded-full" />
      </div>
    </div>
  );
}

// 书签列表骨架
export function BookmarkListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <BookmarkCardSkeleton key={i} />
      ))}
    </div>
  );
}

// 文件夹列表骨架
export function FolderListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2">
          <SkeletonBox className="w-5 h-5 rounded" />
          <SkeletonBox className="h-4 flex-1" />
          <SkeletonBox className="w-6 h-4 rounded" />
        </div>
      ))}
    </div>
  );
}

// 详情面板骨架
export function DetailPanelSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SkeletonBox className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-5 w-3/4" />
          <SkeletonBox className="h-3 w-1/2" />
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2 pt-4">
        <SkeletonBox className="h-4 w-24" />
        <SkeletonBox className="h-3 w-full" />
        <SkeletonBox className="h-3 w-full" />
        <SkeletonBox className="h-3 w-4/5" />
      </div>

      {/* Tags */}
      <div className="flex gap-2 pt-4">
        <SkeletonBox className="h-6 w-16 rounded-full" />
        <SkeletonBox className="h-6 w-20 rounded-full" />
        <SkeletonBox className="h-6 w-14 rounded-full" />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <SkeletonBox className="h-10 flex-1 rounded-lg" />
        <SkeletonBox className="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

// 时间轴骨架
export function TimelineSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="relative pl-10 space-y-6">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--border-secondary)]" />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          {/* Month Header */}
          <div className="flex items-center gap-2">
            <SkeletonBox className="w-5 h-5 rounded-full absolute left-2" />
            <SkeletonBox className="h-5 w-24" />
          </div>
          {/* Items */}
          <div className="space-y-2 ml-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 p-3 sb-card rounded-lg">
                <SkeletonBox className="w-6 h-6 rounded" />
                <div className="flex-1 space-y-1">
                  <SkeletonBox className="h-4 w-3/4" />
                  <SkeletonBox className="h-3 w-1/2" />
                </div>
                <SkeletonBox className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// 全屏加载
export function FullScreenLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-violet-500 border-t-transparent mb-4" />
        {message && <p className="sb-muted">{message}</p>}
      </div>
    </div>
  );
}

import React from "react";
import { useInView } from "react-intersection-observer";
import { Loader2 } from "lucide-react";
import { VideoThumbnailCard } from "./VideoThumbnailCard.js";
import type { CardAction } from "./VideoThumbnailCard.js";
import type { CreatorVideo } from "../../shared/types.js";

type VideoGridProps = {
  videos: CreatorVideo[];
  onVideoClick: (video: CreatorVideo) => void;
  onVideoAction?: (video: CreatorVideo, action: CardAction) => void;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  selectionMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number, shiftKey?: boolean) => void;
};

const SkeletonCard: React.FC = () => (
  <div className="w-full">
    <div className="aspect-video bg-slate-200 animate-pulse rounded-2xl" />
    <div className="mt-3 space-y-2 px-1">
      <div className="h-4 bg-slate-200 rounded animate-pulse w-5/6" />
      <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
      <div className="h-2.5 bg-slate-100 rounded animate-pulse w-1/3" />
    </div>
  </div>
);

export const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  onVideoClick,
  onVideoAction,
  isLoading,
  emptyState,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  selectionMode,
  selectedIds,
  onToggleSelect,
}) => {
  const { ref: sentinelRef } = useInView({
    threshold: 0,
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage && onLoadMore) {
        onLoadMore();
      }
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (videos.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <VideoThumbnailCard
            key={video.id}
            thumbnailUrl={video.thumbnailUrl}
            videoUrl={video.videoUrl}
            title={video.videoTitle || `@${video.creatorHandle} video`}
            subtitle={video.creatorHandle}
            platform={video.platform}
            views={typeof video.views === "number" ? video.views : undefined}
            outlierScore={video.outlierScoreX100 ? video.outlierScoreX100 / 100 : undefined}
            durationSeconds={video.durationSeconds ?? undefined}
            createdAt={video.createdAt}
            status={video.status}
            onClick={() => onVideoClick(video)}
            onAction={onVideoAction ? (action) => onVideoAction(video, action) : undefined}
            selectable={selectionMode}
            selected={selectedIds?.has(video.id)}
            onSelect={(shiftKey) => onToggleSelect?.(video.id, shiftKey)}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      {hasNextPage && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {isFetchingNextPage && (
            <Loader2 size={24} className="text-slate-400 animate-spin" />
          )}
        </div>
      )}
    </div>
  );
};

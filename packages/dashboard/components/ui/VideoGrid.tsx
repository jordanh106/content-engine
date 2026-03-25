import React from "react";
import { VideoThumbnailCard } from "./VideoThumbnailCard.js";
import type { CardAction } from "./VideoThumbnailCard.js";
import type { CreatorVideo } from "../../shared/types.js";

type VideoGridProps = {
  videos: CreatorVideo[];
  onVideoClick: (video: CreatorVideo) => void;
  onVideoAction?: (video: CreatorVideo, action: CardAction) => void;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
};

const SkeletonCard: React.FC = () => (
  <div className="w-full">
    <div className="aspect-video bg-slate-200 animate-pulse rounded-xl" />
    <div className="mt-2 space-y-1.5">
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
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {videos.map((video) => (
        <VideoThumbnailCard
          key={video.id}
          thumbnailUrl={video.thumbnailUrl}
          videoUrl={video.videoUrl}
          title={video.videoTitle || `@${video.creatorHandle} video`}
          subtitle={`@${video.creatorHandle}`}
          platform={video.platform}
          views={typeof video.views === "number" ? video.views : undefined}
          outlierScore={video.outlierScoreX100 ? video.outlierScoreX100 / 100 : undefined}
          durationSeconds={video.durationSeconds ?? undefined}
          createdAt={video.createdAt}
          status={video.status}
          onClick={() => onVideoClick(video)}
          onAction={onVideoAction ? (action) => onVideoAction(video, action) : undefined}
        />
      ))}
    </div>
  );
};

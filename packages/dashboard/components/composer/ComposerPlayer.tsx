import React, { useCallback, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { ComposerComposition } from "./ComposerComposition.js";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
} from "lucide-react";

type ComposerPlayerProps = {
  componentType: string;
  componentProps: Record<string, unknown>;
  durationInSeconds: number;
};

const FPS = 30;

export const ComposerPlayer: React.FC<ComposerPlayerProps> = ({
  componentType,
  componentProps,
  durationInSeconds,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  const totalFrames = Math.round(durationInSeconds * FPS);

  const handlePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying]);

  const handleSeekStart = useCallback(() => {
    playerRef.current?.seekTo(0);
  }, []);

  const handleSeekEnd = useCallback(() => {
    playerRef.current?.seekTo(totalFrames - 1);
  }, [totalFrames]);

  const handleRestart = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(0);
    player.play();
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Player container with 9:16 aspect ratio */}
      <div
        className="w-full bg-slate-900 rounded-xl overflow-hidden shadow-lg"
        style={{ aspectRatio: "9 / 16", maxHeight: "calc(100vh - 200px)" }}
      >
        <Player
          ref={playerRef}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          component={ComposerComposition as any}
          inputProps={{
            componentType,
            componentProps,
          }}
          durationInFrames={Math.max(1, totalFrames)}
          fps={FPS}
          compositionWidth={1080}
          compositionHeight={1920}
          style={{ width: "100%", height: "100%" }}
          renderLoading={() => (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#1a1a2e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#666",
              }}
            >
              Loading preview...
            </div>
          )}
        />
      </div>

      {/* Custom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSeekStart}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          title="Go to start"
        >
          <SkipBack size={16} />
        </button>

        <button
          onClick={handlePlayPause}
          className="p-2.5 rounded-full bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>

        <button
          onClick={handleSeekEnd}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          title="Go to end"
        >
          <SkipForward size={16} />
        </button>

        <button
          onClick={handleRestart}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          title="Restart"
        >
          <RotateCcw size={16} />
        </button>

        <span className="text-xs text-slate-400 font-mono ml-2">
          {durationInSeconds}s ({totalFrames}f)
        </span>
      </div>
    </div>
  );
};

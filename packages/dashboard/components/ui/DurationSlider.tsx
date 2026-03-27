import React from "react";
import { Clock } from "lucide-react";

type DurationSliderProps = {
  seconds: number;
  onChange: (seconds: number) => void;
  min?: number;
  max?: number;
};

const WORDS_PER_SECOND = 2.5; // ~150 wpm speaking rate

export const DurationSlider: React.FC<DurationSliderProps> = ({
  seconds,
  onChange,
  min = 15,
  max = 300,
}) => {
  const words = Math.round(seconds * WORDS_PER_SECOND);

  return (
    <div className="bg-surface-elevated border border-themed rounded-2xl p-5 space-y-4">
      <div className="text-center space-y-1">
        <p className="text-lg font-bold text-themed">{seconds} seconds</p>
        <p className="text-sm text-themed-muted">Approximately {words} words</p>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={5}
        value={seconds}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-surface-hover rounded-full appearance-none cursor-pointer accent-blue-500
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
      />

      <div className="flex justify-between text-[10px] text-themed-muted font-medium">
        <span>{min}s</span>
        <span className="flex items-center gap-1"><Clock size={10} /> {max}s</span>
      </div>
    </div>
  );
};

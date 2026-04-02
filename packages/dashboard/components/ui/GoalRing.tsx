import React, { useState, useEffect } from "react";

type GoalRingProps = {
  current: number;
  goal: number;
  label?: string;
  color?: string;
  size?: number;
  onGoalChange?: (newGoal: number) => void;
};

export const GoalRing: React.FC<GoalRingProps> = ({
  current,
  goal,
  label = "views this month",
  color = "#0d9488",
  size = 100,
  onGoalChange,
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(goal));

  const progress = goal > 0 ? Math.min(current / goal, 1) : 0;
  const pct = Math.round(progress * 100);

  // Animate on mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 100);
    return () => clearTimeout(timer);
  }, [progress]);

  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - animatedProgress);

  const formatNum = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  const handleSave = () => {
    const parsed = parseInt(editValue.replace(/[^\d]/g, ""), 10);
    if (parsed > 0 && onGoalChange) onGoalChange(parsed);
    setEditing(false);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="currentColor" strokeWidth={strokeWidth}
            className="text-slate-100"
          />
          {/* Progress ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-slate-800">{pct}%</span>
        </div>
      </div>
      {/* Label */}
      <div className="text-center">
        <p className="text-[11px] font-semibold text-slate-600">
          {formatNum(current)} / {editing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              className="w-14 text-center text-[11px] font-semibold bg-teal-50 border border-teal-300 rounded px-1 py-0 inline"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setEditValue(String(goal)); setEditing(true); }}
              className="hover:text-teal-600 transition-colors underline decoration-dashed underline-offset-2"
            >
              {formatNum(goal)}
            </button>
          )}
        </p>
        <p className="text-[9px] text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
};

import React from "react";
import { Eye, Bookmark, Heart, Share2, MessageCircle } from "lucide-react";

type MetricType = "views" | "saves" | "engagement" | "shares" | "comments";

const METRIC_CONFIG: Record<MetricType, { icon: React.ReactNode; color: string; suffix?: string }> = {
  views: { icon: <Eye size={10} />, color: "bg-blue-500/20 text-blue-400" },
  saves: { icon: <Bookmark size={10} />, color: "bg-emerald-500/20 text-emerald-400" },
  engagement: { icon: <Heart size={10} />, color: "bg-pink-500/20 text-pink-400", suffix: "%" },
  shares: { icon: <Share2 size={10} />, color: "bg-orange-500/20 text-orange-400" },
  comments: { icon: <MessageCircle size={10} />, color: "bg-slate-500/20 text-slate-400" },
};

function formatValue(value: number, suffix?: string): string {
  if (suffix === "%") return `${value.toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

type MetricBadgeProps = {
  type: MetricType;
  value: number;
  className?: string;
};

export const MetricBadge: React.FC<MetricBadgeProps> = ({ type, value, className = "" }) => {
  const config = METRIC_CONFIG[type];
  if (value <= 0 && type !== "engagement") return null;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${config.color} ${className}`}>
      {config.icon}
      {formatValue(value, config.suffix)}
    </span>
  );
};

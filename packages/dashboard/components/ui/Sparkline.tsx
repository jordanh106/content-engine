import React, { useState, useRef } from "react";

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  className?: string;
  labels?: string[];
};

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 80,
  height = 24,
  color = "var(--accent)",
  fillOpacity = 0.15,
  className = "",
  labels,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 1;

  const pointCoords = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = padding + (1 - (v - min) / range) * (height - 2 * padding);
    return { x, y, value: v };
  });

  const points = pointCoords.map((p) => `${p.x},${p.y}`);
  const linePath = `M ${points.join(" L ")}`;
  const fillPath = `${linePath} L ${width - padding},${height} L ${padding},${height} Z`;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const scaleX = width / rect.width;
    const svgX = mouseX * scaleX;
    // Find closest data point
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < pointCoords.length; i++) {
      const dist = Math.abs(pointCoords[i].x - svgX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    setHoverIndex(closest);
  };

  const hovered = hoverIndex !== null ? pointCoords[hoverIndex] : null;

  return (
    <div className={`relative ${className}`} style={{ width, height: height + 4 }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
        style={{ cursor: "crosshair" }}
      >
        {/* Gradient fill */}
        <defs>
          <linearGradient id={`spark-grad-${width}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity * 2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#spark-grad-${width})`} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* End dot */}
        <circle
          cx={pointCoords[pointCoords.length - 1].x}
          cy={pointCoords[pointCoords.length - 1].y}
          r={2}
          fill={color}
        />
        {/* Hover dot + vertical line */}
        {hovered && (
          <>
            <line
              x1={hovered.x} y1={0} x2={hovered.x} y2={height}
              stroke={color} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.5}
            />
            <circle cx={hovered.x} cy={hovered.y} r={3} fill={color} stroke="white" strokeWidth={1.5} />
          </>
        )}
      </svg>
      {/* Tooltip */}
      {hovered && hoverIndex !== null && (
        <div
          className="absolute -top-7 pointer-events-none z-20 bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap"
          style={{ left: Math.min(Math.max(hovered.x - 20, 0), width - 50) }}
        >
          {labels?.[hoverIndex] ? `${labels[hoverIndex]}: ` : ""}{hovered.value.toLocaleString()}
        </div>
      )}
    </div>
  );
};

import React from "react";

type ShortcutDef = {
  key: string;
  label: string;
  accent?: boolean;
};

type ShortcutBarProps = {
  shortcuts: ShortcutDef[];
  className?: string;
};

export const ShortcutBar: React.FC<ShortcutBarProps> = ({ shortcuts, className = "" }) => {
  return (
    <div className={`flex items-center gap-3 text-[10px] ${className}`}>
      {shortcuts.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <kbd className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md font-mono font-bold border ${
            s.accent
              ? "bg-blue-600 text-white border-blue-500"
              : "bg-surface-hover text-themed-muted border-themed"
          }`}>
            {s.key}
          </kbd>
          <span className="text-themed-muted font-medium">{s.label}</span>
        </span>
      ))}
    </div>
  );
};

// Pre-defined shortcut sets
export const DISCOVER_SHORTCUTS: ShortcutDef[] = [
  { key: "Esc", label: "Close" },
  { key: "\u2191", label: "" },
  { key: "\u2193", label: "" },
  { key: "F", label: "Favorite" },
  { key: "D", label: "Discard" },
  { key: "A", label: "Go to Analysis" },
  { key: "C", label: "Create script", accent: true },
];

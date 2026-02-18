import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "../../utils/cn.js";

type CopyButtonProps = {
  text: string;
  className?: string;
  label?: string;
};

export const CopyButton: React.FC<CopyButtonProps> = ({ text, className, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[44px]",
        copied
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300",
        className,
      )}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {label || (copied ? "Copied" : "Copy")}
    </button>
  );
};

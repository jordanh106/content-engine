import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../../utils/cn.js";

type SkillButtonProps = {
  skill: string;
  args?: string;
  label: string;
  icon: React.ReactNode;
  variant?: "primary" | "secondary";
};

export const SkillButton: React.FC<SkillButtonProps> = ({
  skill,
  args,
  label,
  icon,
  variant = "primary",
}) => {
  const [copied, setCopied] = useState(false);

  const command = args ? `${skill} ${args}` : skill;

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement("textarea");
      textarea.value = command;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all",
        variant === "primary"
          ? "bg-slate-900 text-white hover:bg-slate-800"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200",
        copied && "bg-emerald-600 text-white hover:bg-emerald-600",
      )}
    >
      {copied ? <Check size={14} /> : icon}
      {copied ? "Copied!" : label}
      {!copied && <Copy size={10} className="opacity-40" />}
    </button>
  );
};

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import type { QualityGateData, ProductionChecklistItem } from "../../shared/types.js";
import { cn } from "../../utils/cn.js";

type QualityGateModalProps = {
  videoCode: string;
  fromStatus: string;
  toStatus: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const QualityGateModal: React.FC<QualityGateModalProps> = ({
  videoCode,
  fromStatus,
  toStatus,
  onConfirm,
  onCancel,
}) => {
  const queryClient = useQueryClient();

  const { data: gateData } = useQuery<QualityGateData>({
    queryKey: ["quality-gate", videoCode, toStatus],
    queryFn: () =>
      fetch(`/api/pipeline/${videoCode}/quality-gate?targetStatus=${toStatus}`).then((r) =>
        r.json(),
      ),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      itemKey,
      completed,
    }: {
      itemKey: string;
      completed: boolean;
    }) => {
      const r = await fetch(`/api/pipeline/${videoCode}/quality-gate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemKey,
          completed,
          stageTransition: `${fromStatus}->${toStatus}`,
        }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["quality-gate", videoCode, toStatus],
      });
    },
  });

  const items = gateData?.items || [];
  const completedCount = items.filter((i) => i.completed).length;
  const pct =
    items.length > 0 ? Math.round((completedCount / items.length) * 100) : 100;

  // If no gate items for this transition, auto-confirm
  useEffect(() => {
    if (gateData && items.length === 0) {
      onConfirm();
    }
  }, [gateData, items.length, onConfirm]);

  if (!gateData || items.length === 0) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onCancel} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[420px] bg-white rounded-2xl shadow-xl z-[61] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-teal-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Quality Check</h3>
              <p className="text-[10px] text-slate-400">
                {fromStatus} → {toStatus}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  pct === 100 ? "bg-emerald-500" : "bg-teal-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              className={cn(
                "text-[10px] font-bold",
                pct === 100 ? "text-emerald-600" : "text-slate-400",
              )}
            >
              {completedCount}/{items.length}
            </span>
          </div>
        </div>

        {/* Checklist */}
        <div className="px-4 pb-3 space-y-1">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() =>
                toggleMutation.mutate({
                  itemKey: item.key,
                  completed: !item.completed,
                })
              }
              className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
            >
              <div
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                  item.completed
                    ? "bg-teal-600 border-teal-600"
                    : item.critical
                      ? "border-amber-400"
                      : "border-slate-300",
                )}
              >
                {item.completed && (
                  <Check size={12} className="text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "text-sm",
                    item.completed
                      ? "text-slate-400 line-through"
                      : "text-slate-700",
                  )}
                >
                  {item.label}
                </span>
                {item.critical && !item.completed && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-500 uppercase">
                    <AlertTriangle size={8} /> Critical
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 p-4 border-t border-slate-100">
          <button
            onClick={onConfirm}
            className="flex-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-colors",
              pct === 100
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-teal-600 text-white hover:bg-teal-700",
            )}
          >
            {pct === 100 ? "Advance" : "Advance Anyway"}
          </button>
        </div>
      </div>
    </>
  );
};

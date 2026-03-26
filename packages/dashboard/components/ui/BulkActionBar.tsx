import React, { useState } from "react";
import { Star, Bookmark, Archive, Trash2, X, CheckSquare, Square } from "lucide-react";

type BulkActionBarProps = {
  selectedCount: number;
  totalCount: number;
  onAction: (action: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isPending?: boolean;
};

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalCount,
  onAction,
  onSelectAll,
  onDeselectAll,
  isPending,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const allSelected = selectedCount === totalCount;

  const handleDelete = () => {
    if (confirmDelete) {
      onAction("delete");
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
        {/* Count */}
        <span className="text-[12px] font-bold text-slate-700 tabular-nums whitespace-nowrap">
          {selectedCount} selected
        </span>

        <div className="w-px h-6 bg-slate-200" />

        {/* Select All / Deselect */}
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          title={allSelected ? "Deselect all" : "Select all"}
        >
          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>

        <div className="w-px h-6 bg-slate-200" />

        {/* Actions */}
        <button
          onClick={() => onAction("starred")}
          disabled={isPending}
          className="p-2 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors disabled:opacity-50"
          title="Star selected"
        >
          <Star size={16} />
        </button>
        <button
          onClick={() => onAction("saved")}
          disabled={isPending}
          className="p-2 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors disabled:opacity-50"
          title="Save selected"
        >
          <Bookmark size={16} />
        </button>
        <button
          onClick={() => onAction("archived")}
          disabled={isPending}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50"
          title="Archive selected"
        >
          <Archive size={16} />
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className={`p-2 rounded-lg transition-all disabled:opacity-50 ${
            confirmDelete
              ? "bg-rose-100 text-rose-700 ring-2 ring-rose-300"
              : "hover:bg-rose-50 text-rose-500"
          }`}
          title={confirmDelete ? "Click again to confirm delete" : "Delete selected"}
        >
          <Trash2 size={16} />
        </button>

        <div className="w-px h-6 bg-slate-200" />

        {/* Cancel */}
        <button
          onClick={onDeselectAll}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title="Cancel selection"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

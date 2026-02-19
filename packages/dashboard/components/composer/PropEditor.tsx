import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { FieldDefinition } from "./component-registry.js";
import { cn } from "../../utils/cn.js";

type PropEditorProps = {
  fields: FieldDefinition[];
  values: Record<string, unknown>;
  durationInSeconds: number;
  onChange: (updated: Record<string, unknown>) => void;
  onDurationChange: (duration: number) => void;
};

export const PropEditor: React.FC<PropEditorProps> = ({
  fields,
  values,
  durationInSeconds,
  onChange,
  onDurationChange,
}) => {
  const updateField = (name: string, value: unknown) => {
    onChange({ ...values, [name]: value });
  };

  return (
    <div className="space-y-4">
      {/* Duration slider - always present */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">
          Duration
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={2}
            max={15}
            step={1}
            value={durationInSeconds}
            onChange={(e) => onDurationChange(parseInt(e.target.value, 10))}
            className="flex-1 accent-teal-600"
          />
          <span className="text-sm font-mono text-slate-700 w-8 text-right">
            {durationInSeconds}s
          </span>
        </div>
      </div>

      {/* Dynamic fields */}
      {fields.map((field) => (
        <FieldRenderer
          key={field.name}
          field={field}
          value={values[field.name]}
          onChange={(v) => updateField(field.name, v)}
        />
      ))}
    </div>
  );
};

// ============================================
// Field renderer
// ============================================

type FieldRendererProps = {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
};

const FieldRenderer: React.FC<FieldRendererProps> = ({ field, value, onChange }) => {
  switch (field.type) {
    case "text":
      return (
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">
            {field.label}
            {field.optional && <span className="text-slate-300 ml-1">(optional)</span>}
          </label>
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          />
        </div>
      );

    case "textarea":
      return (
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">
            {field.label}
          </label>
          <textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 resize-y focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          />
        </div>
      );

    case "number":
      return (
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">
            {field.label}
          </label>
          <input
            type="number"
            value={(value as number) ?? 0}
            min={field.min}
            max={field.max}
            onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
            className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          />
        </div>
      );

    case "select":
      return (
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">
            {field.label}
          </label>
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          >
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );

    case "color":
      return (
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">
            {field.label}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={(value as string) ?? "#000000"}
              onChange={(e) => onChange(e.target.value)}
              className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
            />
            <input
              type="text"
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />
          </div>
        </div>
      );

    case "array":
      return (
        <ArrayFieldRenderer
          field={field}
          value={value as Record<string, unknown>[] | undefined}
          onChange={onChange}
        />
      );

    default:
      return null;
  }
};

// ============================================
// Array field renderer (for checklist items, chart bars)
// ============================================

type ArrayFieldRendererProps = {
  field: FieldDefinition;
  value: Record<string, unknown>[] | undefined;
  onChange: (value: unknown) => void;
};

const ArrayFieldRenderer: React.FC<ArrayFieldRendererProps> = ({
  field,
  value,
  onChange,
}) => {
  const items = Array.isArray(value) ? value : [];
  const subFields = field.arrayFields || [];

  const addItem = () => {
    const newItem: Record<string, unknown> = {};
    for (const sf of subFields) {
      if (sf.type === "number") {
        newItem[sf.name] = sf.name === "number" ? items.length + 1 : 0;
      } else {
        newItem[sf.name] = "";
      }
    }
    onChange([...items, newItem]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, fieldName: string, fieldValue: unknown) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [fieldName]: fieldValue } : item,
    );
    onChange(updated);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          {field.label}
        </label>
        <button
          onClick={addItem}
          className="flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-700 uppercase tracking-wider"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100"
          >
            <div className="flex-1 space-y-2">
              {subFields.map((sf) => (
                <div key={sf.name} className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase w-12 flex-shrink-0">
                    {sf.label}
                  </span>
                  {sf.type === "number" ? (
                    <input
                      type="number"
                      value={(item[sf.name] as number) ?? 0}
                      min={sf.min}
                      max={sf.max}
                      onChange={(e) =>
                        updateItem(i, sf.name, parseInt(e.target.value, 10) || 0)
                      }
                      className="w-16 px-2 py-1 rounded border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                    />
                  ) : (
                    <input
                      type="text"
                      value={(item[sf.name] as string) ?? ""}
                      onChange={(e) => updateItem(i, sf.name, e.target.value)}
                      className="flex-1 px-2 py-1 rounded border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => removeItem(i)}
              className="p-1 text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0 mt-1"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

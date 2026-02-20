import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import type { VibeMotionComponent } from "../../shared/types.js";
import { cn } from "../../utils/cn.js";

// ============================================
// Component type color badges
// ============================================

const COMPONENT_TYPE_COLORS: Record<string, string> = {
  TitleCard: "bg-violet-100 text-violet-700",
  StatCard: "bg-blue-100 text-blue-700",
  SectionCard: "bg-teal-100 text-teal-700",
  HookText: "bg-amber-100 text-amber-700",
  ChecklistOverlay: "bg-emerald-100 text-emerald-700",
  MythTruthReveal: "bg-rose-100 text-rose-700",
  StepIndicator: "bg-indigo-100 text-indigo-700",
  FrequencyCard: "bg-cyan-100 text-cyan-700",
  CallToAction: "bg-orange-100 text-orange-700",
  ChartCard: "bg-sky-100 text-sky-700",
  QuoteCard: "bg-pink-100 text-pink-700",
  KineticText: "bg-fuchsia-100 text-fuchsia-700",
};

// ============================================
// Main list component
// ============================================

type ComponentListProps = {
  components: VibeMotionComponent[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onReorder: (components: VibeMotionComponent[]) => void;
  onRemove: (index: number) => void;
};

export const ComponentList: React.FC<ComponentListProps> = ({
  components,
  selectedIndex,
  onSelect,
  onReorder,
  onRemove,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = components.findIndex((c) => c.id === active.id);
    const newIndex = components.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(components, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={components.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1.5">
          {components.map((comp, index) => (
            <SortableItem
              key={comp.id}
              component={comp}
              index={index}
              isSelected={selectedIndex === index}
              onSelect={() => onSelect(index)}
              onRemove={() => onRemove(index)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

// ============================================
// Sortable item
// ============================================

type SortableItemProps = {
  component: VibeMotionComponent;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
};

const SortableItem: React.FC<SortableItemProps> = ({
  component,
  index,
  isSelected,
  onSelect,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: component.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const typeColor =
    COMPONENT_TYPE_COLORS[component.componentType] || "bg-slate-100 text-slate-700";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors",
        isSelected
          ? "border-teal-400 bg-teal-50/60 ring-1 ring-teal-400/30"
          : "border-slate-200 bg-white hover:border-slate-300",
        isDragging && "opacity-50",
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </button>

      {/* Component info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
              typeColor,
            )}
          >
            {component.componentType}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {component.durationInSeconds}s
          </span>
        </div>
        <p className="text-[11px] text-slate-500 truncate mt-0.5">
          {component.label}
        </p>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0"
        title="Remove component"
      >
        <X size={14} />
      </button>
    </div>
  );
};

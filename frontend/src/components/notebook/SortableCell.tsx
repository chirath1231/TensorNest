"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function SortableCell({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group/drag relative">
      <button
        {...attributes}
        {...listeners}
        className="absolute -left-6 top-3 hidden cursor-grab touch-none text-[#e6c163] transition hover:text-[#e6c163] group-hover/drag:block active:cursor-grabbing dark:text-[#e6c163] dark:hover:text-[#e6c163]"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

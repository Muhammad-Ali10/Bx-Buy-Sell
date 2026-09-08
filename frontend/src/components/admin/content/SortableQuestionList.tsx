import { ReactNode } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

/**
 * Drag-to-arrange for a step's questions.
 *
 * The order used to be whatever the database happened to return, so the list
 * looked arranged and could not be arranged. Dropping a question writes the
 * whole step's order at once; the seller's form reads the same order, so
 * moving a question here moves it there.
 *
 * A grip, not the whole row: the row carries Edit and Delete, and a card that
 * drags from anywhere makes those two easy to trigger by accident.
 */
export const SortableQuestionList = ({
  items,
  onReorder,
  children,
}: {
  items: { id: string }[];
  onReorder: (ordered: { id: string }[]) => void;
  children: ReactNode;
}) => {
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on Edit stays a
    // click rather than becoming a very short drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;

    const ordered = [...items];
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    onReorder(ordered);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
};

/** One row, with the grip that moves it. */
export const SortableQuestionRow = ({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Lifted while it moves, so it is not painted under its neighbours.
        zIndex: isDragging ? 20 : undefined,
        position: isDragging ? "relative" : undefined,
        opacity: isDragging ? 0.9 : undefined,
      }}
      className="flex items-stretch gap-2"
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="flex w-7 flex-shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

"use client";

import { useRef, type ReactNode } from "react";
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ProductGrid } from "@/features/storefront/ProductGrid";
import { ShopIcon } from "./ShopIcon";

type Item = { id: string; name: string };

// A press shorter than this is still a click on the card, its links and its buttons;
// holding still past it picks the card up. Moving first scrolls the page instead.
const MOUSE_HOLD = { delay: 200, tolerance: 5 };
const TOUCH_HOLD = { delay: 250, tolerance: 8 };

const ANNOUNCEMENTS_TH = {
  onDragStart: () => "หยิบสินค้าแล้ว ใช้ปุ่มลูกศรเพื่อย้าย กด Space เพื่อวาง หรือ Escape เพื่อยกเลิก",
  onDragOver: ({ over }: { over: { id: string | number } | null }) => over ? "ย้ายสินค้าแล้ว" : "ไม่ได้อยู่บนตำแหน่งใด",
  onDragEnd: ({ over }: { over: { id: string | number } | null }) => over ? "วางสินค้าแล้ว" : "วางสินค้าแล้ว ลำดับไม่เปลี่ยน",
  onDragCancel: () => "ยกเลิกการย้าย ลำดับไม่เปลี่ยน",
};

export function SortableProducts<T extends Item>({ items, sortable, onMove, children }: {
  items: T[];
  sortable: boolean;
  onMove: (activeId: string, overId: string) => void;
  children: (item: T) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: MOUSE_HOLD }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_HOLD }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // The pointer is released over the card it carried; that release must not open the card.
  const justDragged = useRef(false);

  if (!sortable) return <ProductGrid>{items.map((item) => <div key={item.id} role="listitem" className="relative min-w-0">{children(item)}</div>)}</ProductGrid>;

  function handleDragEnd({ active, over }: DragEndEvent) {
    window.setTimeout(() => { justDragged.current = false; }, 0);
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} accessibility={{ announcements: ANNOUNCEMENTS_TH, screenReaderInstructions: { draggable: "กด Space เพื่อหยิบสินค้า แล้วใช้ปุ่มลูกศรเพื่อเลื่อนตำแหน่ง" } }}
      onDragStart={() => { justDragged.current = true; }} onDragEnd={handleDragEnd} onDragCancel={() => window.setTimeout(() => { justDragged.current = false; }, 0)}>
      <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
        <div onClickCapture={(event) => { if (justDragged.current) { event.preventDefault(); event.stopPropagation(); } }}>
          <ProductGrid>{items.map((item) => <SortableProduct key={item.id} item={item}>{children(item)}</SortableProduct>)}</ProductGrid>
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableProduct({ item, children }: { item: Item; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} role="listitem" {...listeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Long-pressing a link or picture would otherwise open the phone's menu or start a native drag.
      onDragStart={(event) => event.preventDefault()}
      className={`relative min-w-0 touch-manipulation select-none [-webkit-touch-callout:none] ${isDragging ? "z-20 cursor-grabbing rounded-2xl bg-paper opacity-90 shadow-lift-4 ring-2 ring-ink/10" : ""}`}>
      {children}
      <button type="button" ref={setActivatorNodeRef} {...attributes}
        aria-label={`ย้ายตำแหน่ง ${item.name}`} title="กดค้างแล้วลากเพื่อย้ายตำแหน่ง"
        className="absolute left-1/2 top-2 inline-flex h-7 w-11 -translate-x-1/2 cursor-grab items-center justify-center rounded-full bg-paper/90 text-muted shadow-lift-1 transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <span className="rotate-90"><ShopIcon name="grip" /></span>
      </button>
    </div>
  );
}

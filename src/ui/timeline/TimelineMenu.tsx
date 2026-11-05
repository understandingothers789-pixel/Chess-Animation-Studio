import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export type MenuAction = {
  label: string;
  run: () => void;
  disabled?: boolean;
  danger?: boolean;
};
export function TimelineMenu({
  x,
  y,
  title,
  actions,
  close,
}: {
  x: number;
  y: number;
  title: string;
  actions: MenuAction[];
  close: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = host.current!;
    const r = node.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(x, innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, innerHeight - r.height - 8)),
    });
    node.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const outside = (e: PointerEvent) => {
      if (!node.contains(e.target as Node)) close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    const dismiss = () => close();
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", dismiss);
      if (
        document.activeElement === document.body ||
        node.contains(document.activeElement)
      )
        previous?.focus();
    };
  }, [x, y]);
  return createPortal(
    <div
      ref={host}
      className="timeline-context-menu"
      role="menu"
      aria-label={title}
      style={position}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        const buttons = Array.from(
          host.current!.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        );
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                  buttons.length;
          buttons[next]?.focus();
        }
        if (e.key === "Tab") close();
      }}
    >
      <div className="context-menu-title">{title}</div>
      {actions.map((a) => (
        <button
          role="menuitem"
          key={a.label}
          disabled={a.disabled}
          className={a.danger ? "danger" : ""}
          onClick={() => {
            close();
            a.run();
          }}
        >
          {a.label}
        </button>
      ))}
      <small>↑ ↓ Navigate · Enter Choose · Esc Close</small>
    </div>,
    document.body,
  );
}

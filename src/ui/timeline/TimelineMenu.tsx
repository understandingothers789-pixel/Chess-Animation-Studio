import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export type MenuAction = {
  label: string;
  id?: string;
  run?: () => void;
  children?: MenuAction[];
  checked?: boolean;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
};
export function TimelineMenu({
  x,
  y,
  title,
  actions,
  close,
  execute,
}: {
  x: number;
  y: number;
  title: string;
  actions: MenuAction[];
  close: () => void;
  execute?: (run: () => void) => void;
}) {
  const [path, setPath] = useState<MenuAction[]>([]);
  const visible = path.length ? path[path.length - 1].children! : actions;
  const scale =
    Number(
      getComputedStyle(
        document.querySelector(".workspace") || document.body,
      ).getPropertyValue("--ui-scale"),
    ) || 1;
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
  useLayoutEffect(() => {
    const r = host.current!.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(x, innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, innerHeight - r.height - 8)),
    });
    host.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
  }, [path]);
  return createPortal(
    <div
      ref={host}
      className="timeline-context-menu"
      role="menu"
      aria-label={title}
      style={{ ...position, width: 280 * scale, fontSize: 13 * scale }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" && path.length) {
          e.preventDefault();
          setPath((p) => p.slice(0, -1));
          return;
        }
        if (e.key === "ArrowRight") {
          const b = (e.target as HTMLElement).closest("button");
          const a = visible.find((a) => a.label === b?.dataset.command);
          if (a?.children) {
            e.preventDefault();
            setPath((p) => [...p, a]);
          }
          return;
        }
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
      <div className="context-menu-title">
        {title}
        {path.length ? " / " + path[path.length - 1].label : ""}
      </div>
      {path.length > 0 && (
        <button role="menuitem" onClick={() => setPath((p) => p.slice(0, -1))}>
          ← Back
        </button>
      )}
      {visible.map((a) => (
        <button
          aria-label={a.label}
          data-command={a.label}
          role={a.checked === undefined ? "menuitem" : "menuitemcheckbox"}
          aria-checked={a.checked}
          aria-haspopup={a.children ? "menu" : undefined}
          key={a.label}
          disabled={a.disabled}
          className={a.danger ? "danger" : ""}
          onClick={() => {
            if (a.children) setPath((p) => [...p, a]);
            else {
              close();
              if (a.run) {
                if (execute) execute(a.run);
                else a.run();
              }
            }
          }}
        >
          <span>
            {a.checked === undefined ? "" : a.checked ? "✓ " : "○ "}
            {a.label}
          </span>
          <small>{a.children ? "›" : a.shortcut}</small>
        </button>
      ))}
      <small>↑ ↓ Navigate · Enter Choose · Esc Close</small>
    </div>,
    document.body,
  );
}

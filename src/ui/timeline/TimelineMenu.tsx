import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { aimsAtMenu, placeMenus, type Point } from "./menuGeometry";
export type MenuAction = {
  label: string;
  id?: string;
  separatorBefore?: boolean;
  icon?: string;
  run?: () => void;
  children?: MenuAction[];
  checked?: boolean;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
};
type Command = MenuAction & { key: string; children?: Command[] };
// Tree addresses are the fallback identity for legacy factories; labels are never keys.
const commands = (items: MenuAction[], parent = "root"): Command[] =>
  items.map((a, i) => {
    const key = `${parent}/${a.id ?? i}`;
    return {
      ...a,
      key,
      children: a.children ? commands(a.children, key) : undefined,
    };
  });
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
  const uid = useId().replace(/:/g, ""),
    host = useRef<HTMLDivElement>(null);
  const panels = useRef<(HTMLDivElement | null)[]>([]),
    rows = useRef(new Map<string, HTMLButtonElement>());
  const [path, setPath] = useState<string[]>([]),
    [revision, refresh] = useState(0);
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null),
    leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef<Point>({ x, y }),
    focusNext = useRef<{ depth: number; key?: string } | null>(null);
  const previous = useRef<HTMLElement | null>(null),
    closeRef = useRef(close);
  closeRef.current = close;
  const scale =
    Number(
      getComputedStyle(
        document.querySelector(".workspace") || document.body,
      ).getPropertyValue("--ui-scale"),
    ) || 1;
  const contentKey = JSON.stringify(actions);
  const tree = commands(actions),
    levels: { title: string; items: Command[]; parent?: Command }[] = [
      { title, items: tree },
    ];
  for (const key of path) {
    const parent = levels[levels.length - 1].items.find(
      (a) => a.key === key && !a.disabled,
    );
    if (!parent?.children) break;
    levels.push({ title: parent.label, items: parent.children, parent });
  }
  const [layout, setLayout] = useState<ReturnType<typeof placeMenus>>({
    boxes: [],
    start: 0,
    direction: 1,
  });
  const cancelHover = () => {
    if (hover.current) clearTimeout(hover.current);
    hover.current = null;
  };
  const cancelLeave = () => {
    if (leave.current) clearTimeout(leave.current);
    leave.current = null;
  };
  const open = (depth: number, a: Command, keyboard: boolean) => {
    cancelHover();
    cancelLeave();
    if (a.disabled) return;
    if (keyboard && a.children) focusNext.current = { depth: depth + 1 };
    setPath((p) =>
      a.children ? [...p.slice(0, depth), a.key] : p.slice(0, depth),
    );
    if (keyboard && a.children)
      requestAnimationFrame(() => {
        const panel = panels.current[depth + 1];
        (
          panel?.querySelector<HTMLButtonElement>("button:not(:disabled)") ??
          panel
        )?.focus();
      });
  };
  const back = (depth: number) => {
    cancelHover();
    cancelLeave();
    const key = path[depth - 1];
    focusNext.current = { depth: depth - 1, key };
    setPath((p) => p.slice(0, depth - 1));
  };
  useLayoutEffect(() => {
    previous.current = document.activeElement as HTMLElement | null;
    panels.current[0]
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const outside = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) closeRef.current();
    };
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      }
    };
    const update = () => refresh((n) => n + 1);
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", keyboard, true);
    window.addEventListener("resize", update);
    document.addEventListener("fullscreenchange", update);
    const workspace = document.querySelector(".workspace"),
      observer = new MutationObserver(update);
    if (workspace)
      observer.observe(workspace, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    return () => {
      cancelHover();
      cancelLeave();
      observer.disconnect();
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", keyboard, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("fullscreenchange", update);
      if (
        document.activeElement === document.body ||
        host.current?.contains(document.activeElement)
      ) {
        const target = previous.current;
        if (target?.isConnected && target.getClientRects().length)
          target.focus({ preventScroll: true });
        else
          document
            .querySelector<HTMLElement>(".track-labels button:not([hidden])")
            ?.focus({ preventScroll: true });
      }
    };
  }, []);
  useLayoutEffect(() => {
    const measure = () => {
      const heights = levels.map(
        (_, d) => panels.current[d]?.getBoundingClientRect().height || 100,
      );
      const offsets = path.map((key, d) => {
        const panel = panels.current[d],
          row = rows.current.get(key);
        return panel && row
          ? row.getBoundingClientRect().top - panel.getBoundingClientRect().top
          : 0;
      });
      const next = placeMenus(x, y, 292 * scale, heights, offsets, {
        width: innerWidth,
        height: innerHeight,
      });
      setLayout((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    panels.current.forEach((p) => {
      if (p) observer.observe(p);
    });
    const next = focusNext.current;
    if (next) {
      const target = next.key
        ? rows.current.get(next.key)
        : (panels.current[next.depth]?.querySelector<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? panels.current[next.depth]);
      if (target && getComputedStyle(target).visibility !== "hidden") {
        target.focus({ preventScroll: true });
        focusNext.current = null;
      }
    }
    return () => observer.disconnect();
  }, [x, y, path, scale, revision, contentKey, layout.start]);
  return createPortal(
    <div
      ref={host}
      className="menu-hierarchy"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerEnter={cancelLeave}
      onPointerLeave={(e) => {
        if (
          e.relatedTarget instanceof Node &&
          host.current?.contains(e.relatedTarget)
        )
          return;
        cancelHover();
        cancelLeave();
        leave.current = setTimeout(() => {
          if (
            host.current?.contains(document.activeElement) &&
            !panels.current[0]?.contains(document.activeElement)
          )
            focusNext.current = { depth: 0, key: path[0] };
          setPath([]);
        }, 320);
      }}
    >
      {levels.map((level, depth) => {
        const box = layout.boxes[depth - layout.start],
          compact = depth === layout.start && depth > 0;
        return (
          <div
            key={level.parent?.key ?? "root"}
            ref={(node) => {
              panels.current[depth] = node;
            }}
            id={`${uid}-panel-${depth}`}
            className="timeline-context-menu"
            role="menu"
            tabIndex={-1}
            aria-label={level.title}
            data-menu-depth={depth}
            data-direction={layout.direction === 1 ? "right" : "left"}
            data-compact={compact || undefined}
            style={{
              left: box?.left ?? x,
              top: box?.top ?? y,
              width: 292 * scale,
              fontSize: 13 * scale,
              visibility: depth < layout.start ? "hidden" : undefined,
              pointerEvents: depth < layout.start ? "none" : undefined,
            }}
            onPointerEnter={cancelHover}
            onPointerMove={(e) => {
              pointer.current = { x: e.clientX, y: e.clientY };
            }}
            onScroll={() => {
              cancelHover();
              refresh((n) => n + 1);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              cancelHover();
              const buttons = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>(
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
                      : (index +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          buttons.length) %
                        buttons.length;
                buttons[next]?.focus();
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                const a = level.items.find(
                  (a) => rows.current.get(a.key) === document.activeElement,
                );
                if (a?.children) open(depth, a, true);
              } else if (e.key === "ArrowLeft" && depth > 0) {
                e.preventDefault();
                back(depth);
              } else if (e.key === "Tab") closeRef.current();
            }}
          >
            <div className="context-menu-title">
              {compact ? `${title} · ${level.title}` : level.title}
            </div>
            {compact && (
              <button role="menuitem" onClick={() => back(depth)}>
                ← Back
              </button>
            )}
            {level.items.map((a) => (
              <button
                key={a.key}
                ref={(node) => {
                  if (node) rows.current.set(a.key, node);
                  else rows.current.delete(a.key);
                }}
                id={`${uid}-${a.key.replace(/[^\w-]/g, "-")}`}
                data-command={a.label}
                data-command-id={a.key}
                role={a.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-label={a.label}
                aria-checked={a.checked}
                aria-haspopup={a.children ? "menu" : undefined}
                aria-expanded={a.children ? path[depth] === a.key : undefined}
                aria-controls={
                  a.children && path[depth] === a.key
                    ? `${uid}-panel-${depth + 1}`
                    : undefined
                }
                disabled={a.disabled}
                tabIndex={-1}
                className={[
                  a.danger ? "danger" : "",
                  a.separatorBefore ? "menu-separator" : "",
                  path[depth] === a.key ? "submenu-active" : "",
                ].join(" ")}
                onPointerEnter={(e) => {
                  cancelHover();
                  cancelLeave();
                  if (a.disabled) return;
                  const child = layout.boxes[depth + 1 - layout.start];
                  const delay =
                    child &&
                    path[depth] !== a.key &&
                    aimsAtMenu(
                      pointer.current,
                      { x: e.clientX, y: e.clientY },
                      child,
                    )
                      ? 300
                      : 125;
                  hover.current = setTimeout(
                    () => open(depth, a, false),
                    delay,
                  );
                }}
                onClick={() => {
                  if (a.disabled) return;
                  if (a.children) open(depth, a, true);
                  else {
                    cancelHover();
                    cancelLeave();
                    closeRef.current();
                    if (a.run) {
                      if (execute) execute(a.run);
                      else a.run();
                    }
                  }
                }}
              >
                <span>
                  {a.checked === undefined ? "" : a.checked ? "✓ " : "○ "}
                  {a.icon && <span aria-hidden="true">{a.icon} </span>}
                  {a.label}
                </span>
                <small aria-hidden="true">
                  {a.children ? "›" : a.shortcut}
                </small>
              </button>
            ))}
            {depth === 0 && (
              <small className="menu-hint">
                ↑↓ Navigate · →← Submenus · Esc Close
              </small>
            )}
          </div>
        );
      })}
    </div>,
    document.fullscreenElement || document.body,
  );
}

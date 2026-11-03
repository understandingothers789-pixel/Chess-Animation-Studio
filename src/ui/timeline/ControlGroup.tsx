import { useEffect, useRef, useState, type ReactNode } from "react";
export function ControlGroup({
  label,
  name,
  className = "",
  children,
}: {
  label: string;
  name: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <div
      ref={host}
      className={`timeline-group ${className}`}
      role="group"
      aria-label={name}
      data-open={open}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          host.current?.querySelector("button")?.focus();
        }
      }}
    >
      <button
        className="timeline-group-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label} ▾
      </button>
      <div className="timeline-menu">{children}</div>
    </div>
  );
}

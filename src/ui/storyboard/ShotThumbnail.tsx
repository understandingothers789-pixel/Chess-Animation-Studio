import { useEffect, useRef, useState } from "react";
import type { Project, StoryboardShot } from "../../core/project";
import { compileStoryboard } from "../../core/storyboard";
import type { StoryThumbnails } from "./thumbnails";
const pieces: Record<string, string> = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};
export function ShotThumbnail({
  p,
  shot,
  service,
  playing,
}: {
  p: Project;
  shot: StoryboardShot;
  service?: StoryThumbnails;
  playing: boolean;
}) {
  const [image, setImage] = useState<string | null>(null),
    [visible, setVisible] = useState(false),
    host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) =>
      setVisible(entries.some((e) => e.isIntersecting)),
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let live = true;
    if (visible && !playing && service) {
      void service.request(p, shot.id).then((image) => {
        if (live) setImage(image);
      });
    }
    return () => {
      live = false;
    };
  }, [p, shot.id, visible, playing, service]);
  const c = compileStoryboard(p).shots.find((e) => e.shot.id === shot.id),
    board =
      shot.kind === "position-hold"
        ? c?.game.initial
        : c?.game.steps[0]?.before;
  return (
    <div ref={host} className="shot-thumbnail">
      {image ? (
        <img src={image} alt={`${shot.name} rendered thumbnail`} />
      ) : shot.kind === "title-card" ? (
        <div className="title-thumb">{shot.name}</div>
      ) : (
        <svg viewBox="0 0 80 80" aria-label={`${shot.name} source position`}>
          {Array.from({ length: 64 }, (_, i) => (
            <rect
              key={i}
              x={(i % 8) * 10}
              y={Math.floor(i / 8) * 10}
              width="10"
              height="10"
              fill={(i + Math.floor(i / 8)) % 2 ? p.style.dark : p.style.light}
            />
          ))}
          {board?.map((piece) => {
            const f = piece.square.charCodeAt(0) - 97,
              r = +piece.square[1] - 1,
              black = p.style.orientation === "black";
            return (
              <text
                key={piece.id}
                x={(black ? 7 - f : f) * 10 + 5}
                y={(black ? r : 7 - r) * 10 + 8.5}
                textAnchor="middle"
                fontSize="11"
                fill={piece.color === "w" ? "#fff" : "#111"}
                stroke={piece.color === "w" ? "#222" : "none"}
                strokeWidth=".25"
              >
                {pieces[piece.color + piece.type]}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}

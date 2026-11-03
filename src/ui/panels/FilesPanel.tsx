import { settingHelp } from "../help";
import { useState } from "react";
import {
  effect,
  cinematicPresets,
  rainbowDefaults,
  blank,
  presets,
  formats,
  badgeNames,
  type Project,
  type Asset,
  type Preset,
  type Effect,
} from "../../core/project";
import { selectLine } from "../../core/chess";
import { align, syncMarkers } from "../../core/audio";
import { badge, segments } from "../../core/timeline";
import {
  Section,
  Range,
  Toggle,
  Color,
  Select,
  ScrubNumber,
  clock,
} from "../controls";
import { presetLabels } from "../presets/catalog";
import type { Edit } from "../state";
import type { Settings } from "../../bridge";
import type { PanelProps } from "./types";
import { BadgeArtworkPanel } from "./BadgeArtworkPanel";
export function FilesPanel(q: PanelProps) {
  const p = q.project,
    [token, setToken] = useState("");
  return (
    <>
      <Section title="Share project settings">
        <p className="hint">
          Save a readable report of move animations, cameras, music and scene
          settings. Share it when you need help identifying an effect. Media
          files are not included.
        </p>
        <button
          onClick={() =>
            q.run(async () => {
              const file = await window.studio.projectReport(p);
              if (file) q.message("Project settings report saved.");
            })
          }
        >
          Export settings report
        </button>
      </Section>
      <Section title="Local tools">
        <button
          title="Choose your local FFmpeg executable to enable MP4 export. The app does not bundle an encoder."
          className="wide"
          onClick={() =>
            q.run(async () => q.setSettings(await window.studio.tool("ffmpeg")))
          }
        >
          Choose FFmpeg executable…
        </button>
        <p className="path">
          {q.settings.ffmpeg || "FFmpeg is required for MP4 export."}
        </p>
        <button
          title="Choose a local Stockfish executable for optional engine analysis and move-badge suggestions."
          className="wide"
          onClick={() =>
            q.run(async () =>
              q.setSettings(await window.studio.tool("stockfish")),
            )
          }
        >
          Choose Stockfish executable…
        </button>
        <p className="path">
          {q.settings.stockfish || "Stockfish is optional."}
        </p>
        <Select
          label="Video encoder"
          value={q.settings.encoder}
          options={[
            ["auto", "Probe hardware, fall back to software"],
            ["software", "Software H.264 (libx264)"],
          ]}
          onChange={(v) =>
            q.run(async () => {
              await window.studio.setEncoder(v);
              q.setSettings({ ...q.settings, encoder: v });
            })
          }
        />
        <p className="hint">
          Get FFmpeg from ffmpeg.org/download.html and Stockfish from
          stockfishchess.org/download. Executables are configured locally and
          not bundled.
        </p>
      </Section>
      <Section title="Masters token (optional)">
        <p className="hint">
          The current Masters API may require authentication. Enter a token
          locally if needed. It is encrypted using Windows credential protection
          and excluded from projects and logs.
        </p>
        <input
          title={settingHelp("Masters token")}
          aria-description={settingHelp("Masters token")}
          aria-label="Masters token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button
          className="wide"
          onClick={() =>
            q.run(async () => {
              await window.studio.token(token);
              setToken("");
              q.setSettings(await window.studio.settings());
              q.message("Credential setting updated.");
            })
          }
        >
          {token ? "Store token securely" : "Remove saved token"}
        </button>
        <small>
          {q.settings.tokenPresent
            ? "A token is stored."
            : "No token is stored."}
        </small>
      </Section>
      <Section title="Project & recovery">
        <p className="path">{q.path ?? "Unsaved composition"}</p>
        <button
          className="wide"
          onClick={() =>
            q.run(async () => {
              const result = await window.studio.collect(p);
              if (result) {
                q.replace(result.project);
                q.message("Portable project collected: " + result.path);
              }
            })
          }
        >
          Collect assets into portable project
        </button>
        <button
          className="wide"
          onClick={() => q.run(() => window.studio.logs())}
        >
          Open activity logs
        </button>
        {q.recent.map((f) => (
          <button
            className="wide recent"
            key={f}
            onClick={() => q.openRecent(f)}
          >
            {f.split(/[\\/]/).at(-1)}
          </button>
        ))}
      </Section>
      <BadgeArtworkPanel {...q} />
      <Section title="Local asset references">
        {p.assets.map((a) => (
          <div className="asset-card" key={a.id}>
            <strong>{a.name}</strong>
            <small className={q.missing.has(a.id) ? "danger" : "muted"}>
              {q.missing.has(a.id) ? "Missing — relink to restore" : a.kind}
            </small>
            <label className="text-field">
              Name
              <input
                title={settingHelp("Asset name")}
                aria-description={settingHelp("Asset name")}
                aria-label={"Asset name"}
                value={a.name}
                onChange={(e) =>
                  q.edit("Asset name", (p) => {
                    p.assets.find((x) => x.id === a.id)!.name = e.target.value;
                  })
                }
              />
            </label>
            <p className="path">{a.path}</p>
            <small>{a.source}</small>
            {a.guidance && <p className="hint">{a.guidance}</p>}
            <div className="button-row">
              <button
                onClick={() =>
                  q.run(async () => {
                    const replacement = await window.studio.importAsset(a.kind);
                    if (replacement)
                      q.edit("Relink asset", (p) => {
                        const old = p.assets.find((v) => v.id === a.id)!;
                        Object.assign(old, {
                          ...replacement,
                          id: replacement.id,
                          source: a.source,
                          guidance: a.guidance,
                        });
                        if (p.music.asset === a.id)
                          p.music.asset = replacement.id;
                        for (const c of p.cues)
                          if (c.asset === a.id) c.asset = replacement.id;
                        for (const key of Object.keys(p.badgeAssets))
                          if (p.badgeAssets[key] === a.id)
                            p.badgeAssets[key] = replacement.id;
                        for (const f of formats)
                          if (p.layouts[f].image === a.id)
                            p.layouts[f].image = replacement.id;
                      });
                  })
                }
              >
                Relink…
              </button>
              <button
                onClick={() =>
                  q.edit("Remove asset", (p) => {
                    p.assets = p.assets.filter((v) => v.id !== a.id);
                    if (p.music.asset === a.id) p.music.asset = null;
                    p.cues = p.cues.filter((c) => c.asset !== a.id);
                    for (const key of Object.keys(p.badgeAssets))
                      if (p.badgeAssets[key] === a.id)
                        delete p.badgeAssets[key];
                    for (const f of formats)
                      if (p.layouts[f].image === a.id)
                        p.layouts[f].image = null;
                  })
                }
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}

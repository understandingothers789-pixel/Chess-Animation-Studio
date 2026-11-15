import { useEffect, useMemo, useRef, useState } from "react";
import type { Project, PlaybackMode } from "../../core/project";
import type { Settings } from "../../bridge";
import type { Edit } from "../state";
import type { Transcript, TimedWord } from "../../core/transcriptModel";
import { timedWordSchema } from "../../core/transcriptModel";
import {
  parseTranscript,
  captionPhrases,
  replaceTranscript,
  generateTranscriptCaptions,
} from "../../core/transcripts";
import { presentationDuration } from "../../core/storyboard";
import "./transcript.css";
const stamp = (n: number) =>
  `${Math.floor(Math.max(0, n) / 60)}:${(Math.max(0, n) % 60).toFixed(2).padStart(5, "0")}`;
export function TranscriptPanel({
  p,
  mode,
  time,
  playing,
  edit,
  settings,
  setSettings,
  seek,
  toggle,
  addCaption,
  importAudio,
  close,
}: {
  p: Project;
  mode: PlaybackMode;
  time: number;
  playing: boolean;
  edit: Edit;
  settings: Settings;
  setSettings: (s: Settings) => void;
  seek: (n: number) => void;
  toggle: () => void;
  addCaption: () => void;
  importAudio: () => Promise<void>;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    alive = useRef(true),
    inFlight = useRef(false);
  const [paste, setPaste] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [task, setTask] = useState(""),
    [size, setSize] = useState(5),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [follow, setFollow] = useState(true),
    [draft, setDraft] = useState<TimedWord | null>(null);
  const t = p.transcripts?.find((t) => t.mode === mode),
    end = presentationDuration(p, mode);
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    return () => {
      alive.current = false;
      if (inFlight.current) void window.studio.cancelTranscription();
    };
  }, []);
  const perform = (fn: () => void | Promise<void>) => {
    setError("");
    setNotice("");
    Promise.resolve()
      .then(fn)
      .catch((e) => {
        if (alive.current)
          setError(
            (e.issues?.[0]?.message ?? (e as Error).message).slice(0, 600),
          );
      });
  };
  const importText = (text: string, name: string) =>
    perform(() => {
      const imported = parseTranscript(text, name, mode);
      edit("Import transcript", (d) => replaceTranscript(d, imported));
      setPage(0);
      setDraft(null);
      setNotice(
        `Imported ${imported.words.length} timed words. Generate captions when ready.`,
      );
    });
  const filtered = useMemo(
    () =>
      t?.words.filter(
        (w) =>
          !query ||
          w.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      ) ?? [],
    [t?.words, query],
  );
  let active = -1;
  if (t) {
    let lo = 0,
      hi = t.words.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (t.words[mid].start + t.offset <= time) lo = mid + 1;
      else hi = mid;
    }
    active = lo - 1;
  }
  useEffect(() => {
    if (follow && !query && active >= 0) setPage(Math.floor(active / 250));
  }, [active, follow, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 250)),
    currentPage = Math.min(page, pageCount - 1),
    visible = filtered.slice(currentPage * 250, (currentPage + 1) * 250);
  const phraseResult = useMemo(() => {
    try {
      return { phrases: t ? captionPhrases(t, size) : [], error: "" };
    } catch (e) {
      return { phrases: [], error: (e as Error).message };
    }
  }, [t, size]);
  const phrases = phraseResult.phrases;
  const cues = t?.words.some((w) => w.timing === "cue"),
    outside =
      t?.words.filter((w) => w.end + t.offset <= 0 || w.start + t.offset >= end)
        .length ?? 0;
  const dismiss = () => {
    if (inFlight.current) void window.studio.cancelTranscription();
    close();
  };
  return (
    <dialog
      ref={dialog}
      className="transcript-dialog"
      aria-label="Captions and transcript"
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header className="transcript-heading">
        <div>
          <h2>Captions & transcript</h2>
          <p>
            {mode === "storyboard" ? "Storyboard output" : "Full Game source"}{" "}
            timeline · {stamp(time)} / {stamp(end)}
          </p>
        </div>
        <button onClick={dismiss}>Close captions</button>
      </header>
      <div className="transcript-actions">
        <button
          className="primary"
          disabled={busy || end < 0.05}
          onClick={() => {
            addCaption();
            close();
          }}
        >
          Add caption at playhead
        </button>
        <button
          disabled={busy}
          onClick={() =>
            perform(async () => {
              const file = await window.studio.chooseTranscript();
              if (file) await importText(file.text, file.name);
            })
          }
        >
          Import transcript
        </button>
        <button onClick={toggle}>
          {playing ? "Pause transcript playback" : "Play transcript playback"}
        </button>
      </div>
      <p className="hint">
        Click a word to go to its time. Generate short phrases, then edit their
        text, appearance and position using the normal caption inspector.
      </p>
      <details>
        <summary>
          Paste timed transcript · SRT, WebVTT or word-timed JSON
        </summary>
        <textarea
          aria-label="Timed transcript text"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={
            "1\n00:00:00,000 --> 00:00:02,000\nFind the winning move"
          }
        />
        <button
          disabled={busy || !paste.trim()}
          onClick={() => importText(paste, "Pasted transcript")}
        >
          Use pasted transcript
        </button>
      </details>
      <details>
        <summary>Automatic transcription · local Whisper (optional)</summary>
        <p>
          On Windows x64, one-time setup downloads the small English model and
          executable (about 80 MB) from GitHub, verifies their hashes, and keeps
          recognition offline afterward.
        </p>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            perform(async () => {
              setBusy(true);
              setTask(
                "Downloading and verifying local Whisper… one-time setup is about 80 MB.",
              );
              inFlight.current = true;
              try {
                const configured = await window.studio.whisperInstall();
                if (alive.current) {
                  setSettings(configured);
                  setNotice(
                    "Local transcription is ready. Import narration and click Transcribe soundtrack locally.",
                  );
                }
              } finally {
                inFlight.current = false;
                if (alive.current) setBusy(false);
              }
            })
          }
        >
          Set up local transcription
        </button>

        <p>
          Or use an existing installation: choose a{" "}
          <strong>whisper.cpp whisper-cli</strong> executable and a GGML model
          once. A Python whisper command is a different program. No audio is
          uploaded.
        </p>
        <div className="transcript-actions">
          <button
            disabled={busy}
            onClick={() =>
              perform(async () =>
                setSettings(await window.studio.whisperTool("binary")),
              )
            }
          >
            Choose Whisper executable
          </button>
          <button
            disabled={busy}
            onClick={() =>
              perform(async () =>
                setSettings(await window.studio.whisperTool("model")),
              )
            }
          >
            Choose Whisper model
          </button>
          <button onClick={() => perform(() => window.studio.whisperSetup())}>
            Whisper setup on GitHub
          </button>
        </div>
        <p className="hint">
          {settings.whisper ? "Executable selected" : "No executable selected"}{" "}
          · {settings.whisperModel ? "Model selected" : "No model selected"}
        </p>
        <p>
          Use a soundtrack containing narration. Importing narration here
          replaces the current soundtrack. Captions align using its current trim
          and output offset; regenerate after changing alignment.
        </p>
        <div className="transcript-actions">
          <button disabled={busy} onClick={() => perform(importAudio)}>
            Import narration soundtrack
          </button>
          <button
            disabled={
              busy ||
              !settings.whisper ||
              !settings.whisperModel ||
              !p.music.asset
            }
            onClick={() =>
              perform(async () => {
                const asset = p.assets.find((a) => a.id === p.music.asset);
                if (!asset)
                  throw Error("Relink the narration soundtrack first.");
                setBusy(true);
                setTask(
                  "Transcribing locally… long recordings can take several minutes.",
                );
                inFlight.current = true;
                try {
                  const imported = await window.studio.transcribe(asset, mode);
                  if (!alive.current) return;
                  imported.offset = p.music.offset - p.music.trimStart;
                  edit("Transcribe soundtrack", (d) =>
                    replaceTranscript(d, imported),
                  );
                  setPage(0);
                  setNotice(
                    "Transcription ready. Review the words, then generate captions.",
                  );
                } finally {
                  inFlight.current = false;
                  if (alive.current) setBusy(false);
                }
              })
            }
          >
            Transcribe soundtrack locally
          </button>
          {busy && (
            <button
              onClick={() => perform(() => window.studio.cancelTranscription())}
            >
              Cancel transcription
            </button>
          )}
        </div>
        {busy && <p role="status">{task}</p>}
      </details>
      {error && (
        <p className="danger" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {t && (
        <>
          <div className="transcript-actions">
            <strong>
              {t.name} · {t.words.length} words
            </strong>
            <label>
              Transcript offset (seconds)
              <input
                type="number"
                aria-label="Transcript offset"
                step="0.05"
                min="-86400"
                max="86400"
                value={t.offset}
                onChange={(e) => {
                  const n = +e.target.value;
                  if (Number.isFinite(n) && Math.abs(n) <= 86400)
                    edit("Align transcript", (d) => {
                      const target = d.transcripts?.find((v) => v.id === t.id);
                      if (target) target.offset = n;
                    });
                }}
              />
            </label>
            <label>
              Words per caption
              <select
                aria-label="Words per caption"
                value={size}
                onChange={(e) => setSize(+e.target.value)}
              >
                {[3, 4, 5, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              disabled={busy || !!phraseResult.error}
              onClick={() =>
                perform(() => {
                  let count = 0;
                  edit.begin();
                  try {
                    edit("Generate transcript captions", (d) => {
                      count = generateTranscriptCaptions(d, t, size).count;
                    });
                  } finally {
                    edit.end();
                  }
                  setNotice(
                    `Generated ${count} captions. Undo restores the previous caption set.`,
                  );
                })
              }
            >
              Generate short captions
            </button>
          </div>
          <p className="hint">
            Regeneration replaces this transcript’s generated captions,
            including manual edits to those captions. Other text layers are
            kept. {phrases.length} phrases planned.
          </p>
          {phraseResult.error && (
            <p role="alert" className="danger">
              {phraseResult.error}
            </p>
          )}
          {cues && (
            <p className="transcript-warning">
              Some words have cue-level timing (SRT/VTT). Clicking them seeks to
              the cue start; short phrase timing within a cue is estimated.
              Import word-timed JSON or use Whisper for individual word timing.
            </p>
          )}
          {outside > 0 && (
            <p className="transcript-warning">
              {outside} words are outside this timeline. Adjust the offset or
              video length. Generated captions are clipped to the output.
            </p>
          )}
          <div className="transcript-actions">
            <label>
              Find words
              <input
                type="search"
                aria-label="Find transcript words"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
              />
              Follow playhead
            </label>
            <button
              disabled={currentPage === 0}
              onClick={() => {
                setFollow(false);
                setPage(currentPage - 1);
              }}
            >
              Previous words
            </button>
            <span>
              Page {currentPage + 1} / {pageCount}
            </span>
            <button
              disabled={currentPage + 1 >= pageCount}
              onClick={() => {
                setFollow(false);
                setPage(currentPage + 1);
              }}
            >
              Next words
            </button>
          </div>
          <div className="transcript-words" aria-label="Clickable transcript">
            {visible.map((w) => {
              const at = w.start + t.offset,
                inRange = at >= 0 && at < end;
              return (
                <button
                  key={w.id}
                  className={
                    time >= at && time < w.end + t.offset ? "word-active" : ""
                  }
                  aria-current={
                    time >= at && time < w.end + t.offset ? "true" : undefined
                  }
                  title={`${stamp(at)}–${stamp(w.end + t.offset)}${w.timing === "cue" ? " · cue timing" : ""}`}
                  aria-label={`Seek word ${w.text} at ${at.toFixed(2)} seconds`}
                  disabled={!inRange}
                  onClick={() => {
                    seek(at);
                    setDraft({ ...w });
                  }}
                >
                  {w.text}
                </button>
              );
            })}
          </div>
          {draft && (
            <div className="transcript-word-editor">
              <h3>Edit selected word</h3>
              <label>
                Word
                <input
                  aria-label="Transcript word text"
                  value={draft.text}
                  maxLength={500}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                />
              </label>
              <label>
                Start
                <input
                  aria-label="Transcript word start"
                  type="number"
                  step="0.01"
                  value={draft.start}
                  onChange={(e) =>
                    setDraft({ ...draft, start: +e.target.value })
                  }
                />
              </label>
              <label>
                End
                <input
                  aria-label="Transcript word end"
                  type="number"
                  step="0.01"
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: +e.target.value })}
                />
              </label>
              <button
                onClick={() =>
                  perform(() => {
                    const value = timedWordSchema.parse({
                      ...draft,
                      text: draft.text.trim(),
                    });
                    edit("Edit transcript word", (d) => {
                      const target = d.transcripts?.find((v) => v.id === t.id);
                      if (target) {
                        target.words = target.words
                          .map((w) => (w.id === value.id ? value : w))
                          .sort((a, b) => a.start - b.start);
                      }
                    });
                    setNotice(
                      "Transcript updated. Regenerate captions to use the change.",
                    );
                  })
                }
              >
                Save word edit
              </button>
            </div>
          )}
        </>
      )}
    </dialog>
  );
}

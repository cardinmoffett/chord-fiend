import {
  APPLIED_FUNCTIONS,
  APPLIED_FUNCTION_LABELS,
  BLOCK_MODE_NAMES,
  DROP_NAMES,
  DURATION_MODIFIER_NAMES,
  DURATION_NAMES,
  EXTENSION_NAMES,
  FREE_QUALITIES,
  MASTER_MODE_NAMES,
  SUS_NAMES,
  buildChord,
  degreeLabels,
  noteChoiceLabel,
} from "../../../../engine/src/engine.js";
import type { Block, Song } from "./song";

const OCTAVES = [-2, -1, 0, 1, 2];
const SOURCES = [
  { value: "diatonic", label: "Diatonic" },
  { value: "applied", label: "Applied" },
  { value: "free", label: "Free" },
] as const;
const QUALITY_LABELS: Record<string, string> = { major: "Major", minor: "Minor", dominant: "Dominant" };

/** The editor for the selected block: every setting a block has, as in the app's editor panel. */
export function Inspector({
  block,
  song,
  canRemove,
  isFirst,
  isLast,
  onChange,
  onReset,
  onMove,
  onRemove,
}: {
  block: Block;
  song: Song;
  canRemove: boolean;
  isFirst: boolean;
  isLast: boolean;
  onChange: (change: Partial<Block>) => void;
  onReset: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const chord = buildChord(block, song.rootIndex, song.modeIndex);
  const homeLabels = degreeLabels(MASTER_MODE_NAMES[song.modeIndex]);
  const degreeMode = block.blockModeIndex ? BLOCK_MODE_NAMES[block.blockModeIndex] : MASTER_MODE_NAMES[song.modeIndex];
  const fifth = block.aug ? 2 : block.flat5 ? 1 : 0;
  const isLeadingTone = block.chordSource === "applied" && block.appliedFunction === "leadingTone";

  return (
    <div className="inspector">
      <div className="inspector-grid">
        <Field label="Chord" wide>
          <Segmented
            options={SOURCES.map((x) => x.label)}
            value={SOURCES.findIndex((x) => x.value === block.chordSource)}
            onChange={(i) => onChange({ chordSource: SOURCES[i].value })}
          />
        </Field>

        {block.chordSource === "diatonic" && (
          <>
            <Field label="Degree">
              <Select value={block.degreeIndex} options={degreeLabels(degreeMode)} onChange={(v) => onChange({ degreeIndex: v })} />
            </Field>
            <Field label="Mode">
              <Select value={block.blockModeIndex} options={BLOCK_MODE_NAMES.map((m, i) => (i === 0 ? "Thru (the key's mode)" : m))} onChange={(v) => onChange({ blockModeIndex: v })} />
            </Field>
          </>
        )}
        {block.chordSource === "applied" && (
          <>
            <Field label="Function">
              <Select
                value={Math.max(0, APPLIED_FUNCTIONS.indexOf(block.appliedFunction))}
                options={APPLIED_FUNCTIONS.map((f) => APPLIED_FUNCTION_LABELS[f])}
                onChange={(v) => onChange({ appliedFunction: APPLIED_FUNCTIONS[v] as Block["appliedFunction"] })}
              />
            </Field>
            <Field label="Target">
              <Select value={block.appliedTargetIndex} options={homeLabels} onChange={(v) => onChange({ appliedTargetIndex: v })} />
            </Field>
          </>
        )}
        {block.chordSource === "free" && (
          <>
            <Field label="Root">
              <Select value={block.freeRoot ?? 0} options={Array.from({ length: 12 }, (_, i) => noteChoiceLabel(i))} onChange={(v) => onChange({ freeRoot: v })} />
            </Field>
            <Field label="Quality">
              <Select
                value={Math.max(0, FREE_QUALITIES.indexOf(block.freeQuality ?? "major"))}
                options={FREE_QUALITIES.map((q) => QUALITY_LABELS[q])}
                onChange={(v) => onChange({ freeQuality: FREE_QUALITIES[v] })}
              />
            </Field>
          </>
        )}

        <Field label="Extension">
          <Select value={block.extensionIndex} options={EXTENSION_NAMES} disabled={isLeadingTone} onChange={(v) => onChange({ extensionIndex: v })} />
        </Field>
        <Field label="Sus">
          <Select value={block.susIndex} options={SUS_NAMES} disabled={isLeadingTone} onChange={(v) => onChange({ susIndex: v })} />
        </Field>
        <Field label="Fifth">
          <Segmented
            options={["5", "♭5", "♯5"]}
            value={fifth}
            disabled={isLeadingTone}
            onChange={(i) => onChange({ aug: i === 2 ? 1 : 0, flat5: i === 1 ? 1 : 0 })}
          />
        </Field>
        <Field label="Inversion">
          <Select value={chord.inversion} options={chord.toneLabels} onChange={(v) => onChange({ inversion: v })} />
        </Field>
        <Field label="Drop">
          <Select value={block.dropIndex} options={DROP_NAMES} onChange={(v) => onChange({ dropIndex: v })} />
        </Field>
        <Field label="Octave">
          <Select value={OCTAVES.indexOf(block.octave)} options={OCTAVES.map((o) => (o > 0 ? "+" + o : String(o)))} onChange={(v) => onChange({ octave: OCTAVES[v] })} />
        </Field>
        <Field label="Duration">
          <Select value={block.durationIndex} options={DURATION_NAMES} onChange={(v) => onChange({ durationIndex: v })} />
        </Field>
        <Field label="Feel" wide>
          <Segmented options={DURATION_MODIFIER_NAMES} value={block.durationModifier} onChange={(i) => onChange({ durationModifier: i })} />
        </Field>
      </div>

      <div className="inspector-actions">
        <button title="Back to the key's I chord" onClick={onReset}>
          ↺
        </button>
        <button title="Move left" disabled={isFirst} onClick={() => onMove(-1)}>
          ←
        </button>
        <button title="Move right" disabled={isLast} onClick={() => onMove(1)}>
          →
        </button>
        <button title="Remove" className="danger" disabled={!canRemove} onClick={onRemove}>
          ✕
        </button>
      </div>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, options, onChange, disabled }: { value: number; options: readonly string[]; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))}>
      {options.map((o, i) => (
        <option key={i} value={i}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function Segmented({ options, value, onChange, disabled }: { options: readonly string[]; value: number; onChange: (i: number) => void; disabled?: boolean }) {
  return (
    <span className="segmented">
      {options.map((o, i) => (
        <button key={i} type="button" disabled={disabled} className={i === value ? "on" : ""} onClick={() => onChange(i)}>
          {o}
        </button>
      ))}
    </span>
  );
}

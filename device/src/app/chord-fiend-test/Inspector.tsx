import {
  APPLIED_FUNCTIONS,
  APPLIED_FUNCTION_LABELS,
  BLOCK_MODE_NAMES,
  DROP_NAMES,
  DURATION_MODIFIER_NAMES,
  DURATION_NAMES,
  EXTENSION_NAMES,
  MASTER_MODE_NAMES,
  SHAPE_ORDER,
  alterChange,
  alterFitToShape,
  alterRows,
  buildChord,
  degreeLabels,
  stepNumeral,
} from "../../../../engine/src/engine.js";
import { IndexDropdown } from "./Dropdown";
import type { Block, Song } from "./song";

const OCTAVES = [-2, -1, 0, 1, 2];
const SOURCES = [
  { value: "diatonic", label: "Diatonic" },
  { value: "applied", label: "Applied" },
  { value: "free", label: "Free" },
] as const;
const SHAPE_LABELS: Record<string, string> = { triad: "Triad", add9: "add9", "6": "6", "6/9": "6/9", "7": "7", "9": "9", "11": "11", "13": "13" };
/** A new root or kind (category, degree, mode, function, target, free root) starts with no alterations. */
const CLEAR_ALTER: Partial<Block> = {
  third: undefined, fifth: undefined, seventh: undefined, ninth: undefined, eleventh: undefined, thirteenth: undefined,
  aug: 0, flat5: 0, susIndex: 0,
};

/** The editor for the selected block: every setting a block has, as in the app's editor panel. */
export function Inspector({
  block,
  song,
  canRemove,
  locked,
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
  /** A linked part: its settings are shown, but cannot be changed. */
  locked?: boolean;
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
  const isLeadingTone = block.chordSource === "applied" && block.appliedFunction === "leadingTone";
  // Alter: one row per tone the chord has (the engine's alterRows decides which), showing
  // the chord as it is (a V7: 3, 5, \u266D7). Choosing the key's own value clears the change.
  const rows = alterRows(block, song.rootIndex, song.modeIndex);
  const rootChange = (change: Partial<Block>) => onChange({ ...change, ...CLEAR_ALTER });

  return (
    // A disabled fieldset disables every control inside it, buttons and menus alike.
    <fieldset className={locked ? "inspector locked" : "inspector"} disabled={locked}>
      <div className="inspector-grid">
        <Field label="Chord" wide>
          <Segmented
            options={SOURCES.map((x) => x.label)}
            value={SOURCES.findIndex((x) => x.value === block.chordSource)}
            onChange={(i) => {
              // Free keeps the root you have; a free chord starts as a major triad (\u266D7 with a 7th).
              const toFree = SOURCES[i].value === "free" && block.chordSource !== "free";
              rootChange({
                chordSource: SOURCES[i].value,
                ...(toFree ? { freeRoot: (((chord.chordRootPitch - song.rootIndex) % 12) + 12) % 12 } : {}),
              });
            }}
          />
        </Field>

        {block.chordSource === "diatonic" && (
          <>
            <Field label="Degree">
              <Select value={block.degreeIndex} options={degreeLabels(degreeMode)} onChange={(v) => rootChange({ degreeIndex: v })} />
            </Field>
            <Field label="Mode">
              <Select
                value={block.blockModeIndex}
                options={BLOCK_MODE_NAMES.map((m, i) => (i === 0 ? "Thru (the key's mode)" : m))}
                onChange={(v) => rootChange({ blockModeIndex: v })}
              />
            </Field>
          </>
        )}
        {block.chordSource === "applied" && (
          <>
            <Field label="Function">
              <Select
                value={Math.max(0, APPLIED_FUNCTIONS.indexOf(block.appliedFunction))}
                options={APPLIED_FUNCTIONS.map((f) => APPLIED_FUNCTION_LABELS[f])}
                onChange={(v) => rootChange({ appliedFunction: APPLIED_FUNCTIONS[v] as Block["appliedFunction"] })}
              />
            </Field>
            <Field label="Target">
              <Select value={block.appliedTargetIndex} options={homeLabels} onChange={(v) => rootChange({ appliedTargetIndex: v })} />
            </Field>
          </>
        )}
        {block.chordSource === "free" && (
          <>
            <Field label="Root">
              <Select
                value={block.freeRoot ?? 0}
                options={Array.from({ length: 12 }, (_, step) => stepNumeral(step, chord.offsets[1] === 3 && chord.offsets[2] === 6))}
                onChange={(v) => rootChange({ freeRoot: v })}
              />
            </Field>
          </>
        )}

        <Field label="Shape">
          <Select
            value={Math.max(0, SHAPE_ORDER.indexOf(block.extensionIndex))}
            options={SHAPE_ORDER.map((i) => SHAPE_LABELS[EXTENSION_NAMES[i]])}
            disabled={isLeadingTone}
            onChange={(v) => {
              // A new shape keeps only the alterations it still has tones for.
              const fitted = alterFitToShape({ ...block, extensionIndex: SHAPE_ORDER[v] });
              onChange({ extensionIndex: SHAPE_ORDER[v], seventh: fitted.seventh, ninth: fitted.ninth, eleventh: fitted.eleventh, thirteenth: fitted.thirteenth });
            }}
          />
        </Field>
        {rows.map((row) => (
          <Field key={row.field} label={row.label} altered={row.value !== row.keyValue}>
            <Segmented
              options={row.choices.map((c) => c.label)}
              value={row.choices.findIndex((c) => c.value === row.value)}
              home={row.choices.findIndex((c) => c.value === row.keyValue)}
              onChange={(i) => onChange(alterChange(block, row.field, row.choices[i].value, song.rootIndex, song.modeIndex))}
            />
          </Field>
        ))}
        <Field label="Inversion">
          <Select value={chord.inversion} options={chord.toneLabels} onChange={(v) => onChange({ inversion: v })} />
        </Field>
        <Field label="Drop">
          <Select value={block.dropIndex} options={DROP_NAMES} onChange={(v) => onChange({ dropIndex: v })} />
        </Field>
        <Field label="Octave">
          <Select
            value={OCTAVES.indexOf(block.octave)}
            options={OCTAVES.map((o) => (o > 0 ? "+" + o : String(o)))}
            onChange={(v) => onChange({ octave: OCTAVES[v] })}
          />
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
    </fieldset>
  );
}

function Field({ label, wide, altered, children }: { label: string; wide?: boolean; altered?: boolean; children: React.ReactNode }) {
  return (
    <div className={"field" + (wide ? " wide" : "") + (altered ? " altered" : "")}>
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
  disabled,
}: {
  value: number;
  options: readonly string[];
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return <IndexDropdown value={value} options={options} onChange={onChange} disabled={disabled} />;
}

export function Segmented({
  options,
  value,
  onChange,
  disabled,
  home,
}: {
  options: readonly string[];
  value: number;
  onChange: (i: number) => void;
  disabled?: boolean;
  /** The unaltered choice, outlined when another one is picked. */
  home?: number;
}) {
  return (
    <span className="segmented">
      {options.map((o, i) => (
        <button key={i} type="button" disabled={disabled} className={(i === value ? "on" : "") + (i === home ? " home" : "")} onClick={() => onChange(i)}>
          {o}
        </button>
      ))}
    </span>
  );
}

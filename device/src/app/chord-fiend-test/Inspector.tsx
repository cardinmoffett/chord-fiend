import {
  BLOCK_MODE_NAMES,
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
  getChordSymbol,
  positionLabel,
  positionStep,
  stepNumeral,
  withoutAlter,
} from "../../../../engine/src/engine.js";
import { IndexDropdown } from "./Dropdown";
import type { Block, Song } from "./song";

/** The kinds: the key's own degrees, the three applied functions (sharing the degree list as their target), and Free. */
const KINDS = [
  { value: "key", label: "Key" },
  { value: "dominant", label: "V/" },
  { value: "tritoneSub", label: "subV/" },
  { value: "leadingTone", label: "vii\u00B0/" },
  { value: "free", label: "Free" },
] as const;
/** Length buttons run shortest to longest (DURATION_NAMES is stored longest first). */
const DURATION_ORDER = [6, 5, 4, 3, 2, 1, 0];
/** Straight, dotted, triplet: one button that cycles. */
const FEEL_SYMBOLS = ["\u2669", "\u2669.", "\u2669\u00B3"];
const SHAPE_LABELS: Record<string, string> = { triad: "Triad", add9: "add9", "6": "6", "6/9": "6/9", "7": "7", "9": "9", "11": "11", "13": "13" };
/** A new root or kind (category, degree, mode, function, target, free root) starts with no alterations. */
const CLEAR_ALTER: Partial<Block> = {
  third: undefined, fifth: undefined, seventh: undefined, ninth: undefined, eleventh: undefined, thirteenth: undefined,
  aug: 0, flat5: 0, susIndex: 0,
};
const DROP_SHORT = ["Close", "Drop 2", "Drop 3", "Drop 2+4"];

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
  const kind = block.chordSource === "free" ? "free" : block.chordSource === "applied" ? block.appliedFunction : "key";
  const up = positionStep(block, chord, 1);
  const down = positionStep(block, chord, -1);
  // Borrow from, listed by result ("Dorian \u2192 F7"), each shown without alterations
  // (picking one clears them).
  const borrowLabels = BLOCK_MODE_NAMES.map((m, i) => {
    const c = buildChord({ ...withoutAlter(block), blockModeIndex: i }, song.rootIndex, song.modeIndex);
    return (i === 0 ? "Key" : m) + " \u2192 " + getChordSymbol(c, song.rootIndex).replace(/ \(.*\)$/, "");
  });

  return (
    // A disabled fieldset disables every control inside it, buttons and menus alike.
    <fieldset className={locked ? "inspector locked" : "inspector"} disabled={locked}>
      <div className="inspector-grid">
        {/* 1. Kind + root. Key ii -> V/ is V/ii: the degree carries over as the target. */}
        <Field label="Chord" wide>
          <Segmented
            options={KINDS.map((k) => k.label)}
            value={KINDS.findIndex((k) => k.value === kind)}
            onChange={(i) => {
              const next = KINDS[i].value;
              const degree = block.chordSource === "applied" ? block.appliedTargetIndex : block.chordSource === "free" ? null : block.degreeIndex;
              if (next === "free") {
                // Free keeps the root you have; a free chord starts as a major triad (\u266D7 with a 7th).
                rootChange({
                  chordSource: "free",
                  blockModeIndex: 0,
                  ...(block.chordSource !== "free" ? { freeRoot: (((chord.chordRootPitch - song.rootIndex) % 12) + 12) % 12 } : {}),
                });
              } else if (next === "key") {
                rootChange({ chordSource: "diatonic", blockModeIndex: 0, ...(degree !== null ? { degreeIndex: degree } : {}) });
              } else {
                rootChange({ chordSource: "applied", appliedFunction: next, blockModeIndex: 0, ...(degree !== null ? { appliedTargetIndex: degree } : {}) });
              }
            }}
          />
        </Field>
        {block.chordSource === "diatonic" && (
          <Field label="Degree">
            <Select value={block.degreeIndex} options={degreeLabels(degreeMode)} onChange={(v) => rootChange({ degreeIndex: v, blockModeIndex: block.blockModeIndex })} />
          </Field>
        )}
        {block.chordSource === "applied" && (
          <Field label="Of">
            <Select value={block.appliedTargetIndex} options={homeLabels} onChange={(v) => rootChange({ appliedTargetIndex: v })} />
          </Field>
        )}
        {block.chordSource === "free" && (
          <Field label="Root">
            <Select
              value={block.freeRoot ?? 0}
              options={Array.from({ length: 12 }, (_, step) => stepNumeral(step, chord.offsets[1] === 3 && chord.offsets[2] === 6))}
              onChange={(v) => rootChange({ freeRoot: v })}
            />
          </Field>
        )}

        {/* 2. Length, one click, with the feel cycling straight / dotted / triplet. */}
        <Field label="Length" wide>
          <span className="length-inline">
            <Segmented
              options={DURATION_ORDER.map((i) => DURATION_NAMES[i].replace(/\/1$/, ""))}
              value={DURATION_ORDER.indexOf(block.durationIndex)}
              onChange={(i) => onChange({ durationIndex: DURATION_ORDER[i] })}
            />
            <button
              type="button"
              className={block.durationModifier ? "feel on" : "feel"}
              title={DURATION_MODIFIER_NAMES[block.durationModifier || 0] + " (click to change)"}
              onClick={() => onChange({ durationModifier: ((block.durationModifier || 0) + 1) % 3 })}
            >
              {FEEL_SYMBOLS[block.durationModifier || 0]}
            </button>
          </span>
        </Field>

        {/* 3. Shape and Position (inversion + octave, a note at a time). */}
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
        <Field label="Position">
          <span className="stepper">
            <button type="button" title="Top note to the bottom" disabled={!down} onClick={() => down && onChange(down)}>
              ▼
            </button>
            <span>{positionLabel(block, chord)}</span>
            <button type="button" title="Bottom note to the top" disabled={!up} onClick={() => up && onChange(up)}>
              ▲
            </button>
          </span>
        </Field>
        <Field label="Drop">
          <Select value={block.dropIndex} options={DROP_SHORT} onChange={(v) => onChange({ dropIndex: v })} />
        </Field>

        {/* 4. Alter: Borrow from (Key chords), then a row per chord tone. */}
        {block.chordSource === "diatonic" && (
          <Field label="Borrow from" altered={!!block.blockModeIndex}>
            <Select value={block.blockModeIndex} options={borrowLabels} onChange={(v) => rootChange({ blockModeIndex: v })} />
          </Field>
        )}
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

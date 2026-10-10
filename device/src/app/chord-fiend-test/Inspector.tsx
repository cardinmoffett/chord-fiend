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
  SHAPE_ORDER,
  SUS_NAMES,
  buildChord,
  degreeLabels,
  stepNumeral,
  withoutAlter,
} from "../../../../engine/src/engine.js";
import { IndexDropdown } from "./Dropdown";
import type { Block, Song } from "./song";

const OCTAVES = [-2, -1, 0, 1, 2];
const SOURCES = [
  { value: "diatonic", label: "Diatonic" },
  { value: "applied", label: "Applied" },
  { value: "free", label: "Free" },
] as const;
const QUALITY_LABELS: Record<string, string> = {
  major: "Major", minor: "Minor", dominant: "Dominant", diminished: "Diminished", augmented: "Augmented", halfDiminished: "Half-diminished",
};
const SHAPE_LABELS: Record<string, string> = { triad: "Triad", add9: "add9", "6": "6", "6/9": "6/9", "7": "7", "9": "9", "11": "11", "13": "13" };
/** The tensions a shape has room for: 9ths for 9/11/13, #11 for 11/13, b13 for 13. */
function tensionChoices(extensionIndex: number): string[] {
  const ext = EXTENSION_NAMES[extensionIndex];
  const list: string[] = [];
  if (ext === "9" || ext === "11" || ext === "13") list.push("b9", "#9");
  if (ext === "11" || ext === "13") list.push("#11");
  if (ext === "13") list.push("b13");
  return list;
}
const pretty = (t: string) => t.replace(/b(?=\d)/, "\u266D").replace("#", "\u266F");

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
  // Alter (every chord but the fixed leading-tone dim7): step off what the key gives --
  // 3rd, 5th, 7th, tension. Unset = the key's; the block's number shows any change.
  const canAlter = !isLeadingTone;
  const tensions = tensionChoices(block.extensionIndex);
  const ext = EXTENSION_NAMES[block.extensionIndex];
  const hasSeventh = ext === "7" || ext === "9" || ext === "11" || ext === "13";
  // Alter shows the chord as it is (a V7: Major, 5, \u266D7); choosing the key's own value
  // (keyChord, the block with no Alter) clears the change.
  const keyChord = buildChord(withoutAlter(block), song.rootIndex, song.modeIndex);

  return (
    // A disabled fieldset disables every control inside it, buttons and menus alike.
    <fieldset className={locked ? "inspector locked" : "inspector"} disabled={locked}>
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
              <Select
                value={block.blockModeIndex}
                options={BLOCK_MODE_NAMES.map((m, i) => (i === 0 ? "Thru (the key's mode)" : m))}
                onChange={(v) => onChange({ blockModeIndex: v })}
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
              <Select
                value={block.freeRoot ?? 0}
                options={Array.from({ length: 12 }, (_, step) => stepNumeral(step, block.freeQuality === "diminished" || block.freeQuality === "halfDiminished"))}
                onChange={(v) => onChange({ freeRoot: v })}
              />
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

        <Field label="Shape">
          <Select
            value={Math.max(0, SHAPE_ORDER.indexOf(block.extensionIndex))}
            options={SHAPE_ORDER.map((i) => SHAPE_LABELS[EXTENSION_NAMES[i]])}
            disabled={isLeadingTone}
            onChange={(v) => onChange({ extensionIndex: SHAPE_ORDER[v] })}
          />
        </Field>
        <Field label="Sus">
          <Select value={block.susIndex} options={SUS_NAMES} disabled={isLeadingTone} onChange={(v) => onChange({ susIndex: v })} />
        </Field>
        {canAlter && chord.sus === "none" && (
          <Field label="3rd">
            <Segmented
              options={["Major", "Minor"]}
              value={[4, 3].indexOf(chord.offsets[1])}
              onChange={(i) => {
                const v = [4, 3][i];
                onChange({ third: v === keyChord.offsets[1] ? undefined : v === 4 ? "major" : "minor" });
              }}
            />
          </Field>
        )}
        {canAlter && (
          <Field label="5th">
            <Segmented
              options={["\u266D5", "5", "\u266F5"]}
              value={[6, 7, 8].indexOf(chord.offsets[2])}
              onChange={(i) => {
                const v = [6, 7, 8][i];
                onChange({ aug: 0, flat5: 0, fifth: v === keyChord.offsets[2] ? undefined : (["b5", "5", "#5"] as const)[i] });
              }}
            />
          </Field>
        )}
        {canAlter && hasSeventh && chord.offsets.length >= 4 && (
          <Field label="7th">
            <Segmented
              options={["maj7", "\u266D7", "\u00B07"]}
              value={[11, 10, 9].indexOf(chord.offsets[3])}
              onChange={(i) => {
                const v = [11, 10, 9][i];
                onChange({ seventh: v === keyChord.offsets[3] ? undefined : (["maj", "min", "dim"] as const)[i] });
              }}
            />
          </Field>
        )}
        {canAlter && tensions.length > 0 && (
          <Field label="Tension">
            <Select
              value={Math.max(0, tensions.indexOf(block.tension ?? "") + 1)}
              options={["Natural", ...tensions.map(pretty)]}
              onChange={(v) => onChange({ tension: v === 0 ? undefined : tensions[v - 1] })}
            />
          </Field>
        )}
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

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "field wide" : "field"}>
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
}: {
  options: readonly string[];
  value: number;
  onChange: (i: number) => void;
  disabled?: boolean;
}) {
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

import {
  APPLIED_FUNCTIONS,
  MEDIANTS,
  mediantNumeral,
  BLOCK_MODE_NAMES,
  EXTENSION_NAMES,
  LENGTH_BASES,
  LENGTH_MOD_LABELS,
  MASTER_MODE_NAMES,
  MODES,
  SHAPE_ORDER,
  alterChange,
  alterFitToShape,
  alterRows,
  blockLabel as engineBlockLabel,
  buildChord,
  degreeLabels,
  getChordSymbol,
  lengthChange,
  lengthParts,
  positionLabel,
  positionStep,
  stepNumeral,
  withoutAlter,
} from "../../../../engine/src/engine.js";
import type { LengthMod } from "../../../../engine/src/engine.js";
import { IndexDropdown } from "./Dropdown";
import { blockColor } from "./song";
import type { Block, Song } from "./song";

const TABS = [
  { value: "diatonic", label: "Diatonic" },
  { value: "applied", label: "Applied" },
  { value: "free", label: "Free" },
] as const;
const FUNCTION_NAMES: Record<string, string> = {
  dominant: "Dominant", supertonic: "Applied ii", tritoneSub: "Tritone sub", backdoor: "Backdoor",
  leadingTone: "Leading tone", commonTone: "Common-tone dim", mediant: "Mediants",
};
const FUNCTION_PREFIX: Record<string, string> = {
  dominant: "V/", supertonic: "ii/", tritoneSub: "subV/", backdoor: "\u266DVII/", leadingTone: "vii\u00B0/", commonTone: "ct\u00B0/",
};
/** The Length menu: feels, then multipliers that tie copies together, then splits. */
const LENGTH_MENU: LengthMod[] = ["straight", "dotted", "triplet", "x2", "x3", "x4", "x1/2", "x1/4"];
const NOTE_LABELS: Record<string, string> = { quarter: "\u2669", half: "\u{1D15E}", whole: "\u{1D15D}", double: "\u{1D15C}" };
const SHAPE_LABELS: Record<string, string> = { triad: "Triad", add9: "add9", "6": "6", "6/9": "6/9", "7": "7", "9": "9", "11": "11", "13": "13" };
/** A new root or kind (tab, degree, function, target, free root, borrowed mode) starts with no alterations. */
const CLEAR_ALTER: Partial<Block> = {
  third: undefined, fifth: undefined, seventh: undefined, ninth: undefined, eleventh: undefined, thirteenth: undefined,
  aug: 0, flat5: 0, susIndex: 0,
};
const SPREAD_NAMES = ["Close", "Drop 2", "Drop 3", "Drop 2+4"];
/** A free pad's color: grey, with a little of the degree's hue for steps in the key. */
function freePadColor(degreeColor: string | null): string {
  const hue = degreeColor ? Number((degreeColor.match(/hsl\((\d+)/) || [])[1] || 220) : 220;
  return `hsl(${hue} ${degreeColor ? 24 : 6}% 72%)`;
}

/**
 * The editor for the selected block, laid out like the phone app's drawer: tabs (where the
 * root comes from), colored chord pads, Length, Shape / Inversion / Spread, then Alter.
 * It never restates the chord; the selected block does.
 */
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
  const root = song.rootIndex;
  const mode = song.modeIndex;
  const chord = buildChord(block, root, mode);
  const tab = block.chordSource;
  // The leading-tone and common-tone chords are always a dim7, so Shape doesn't apply.
  const isLeadingTone = tab === "applied" && (block.appliedFunction === "leadingTone" || block.appliedFunction === "commonTone");
  const isMediant = tab === "applied" && block.appliedFunction === "mediant";
  const rows = alterRows(block, root, mode);
  const rootChange = (change: Partial<Block>) => onChange({ ...change, ...CLEAR_ALTER });
  const up = positionStep(block, chord, 1);
  const down = positionStep(block, chord, -1);
  const parts = lengthParts(block);
  const plain = withoutAlter(block);
  const nameOf = (b: Block) => getChordSymbol(buildChord(b, root, mode), root).replace(/ \(.*\)$/, "");

  // Switching tabs keeps the root where it can: a degree becomes the applied target (and
  // back), and Free starts on the chord's own root.
  const switchTab = (next: Block["chordSource"]) => {
    if (next === tab) return;
    const change: Partial<Block> = { chordSource: next, blockModeIndex: 0 };
    if (next === "free") change.freeRoot = (((chord.chordRootPitch - root) % 12) + 12) % 12;
    else if (next === "applied" && tab === "diatonic") {
      // A degree becomes a target, so arrive on a function that has one.
      change.appliedTargetIndex = block.degreeIndex;
      if (block.appliedFunction === "mediant") change.appliedFunction = "dominant";
    } else if (next === "diatonic" && tab === "applied") change.degreeIndex = isMediant ? chord.chordDegreeIndex : block.appliedTargetIndex;
    rootChange(change);
  };

  // Pads: the key's seven chords (the selected one shows what the block really is, borrowed
  // mode included), the seven targets of the chosen applied function (I included), or all
  // twelve free steps (the key's own tones keep their color).
  let pads: { top?: string; main: string; sub: string; color?: string; on: boolean; pick: () => void }[];
  if (tab === "free") {
    const scale = MODES[MASTER_MODE_NAMES[mode]];
    pads = Array.from({ length: 12 }, (_, step) => {
      const cand: Block = { ...plain, chordSource: "free", freeRoot: step, blockModeIndex: 0 };
      const degree = scale.indexOf(step);
      return {
        main: stepNumeral(step),
        sub: engineBlockLabel(cand, root, mode).name,
        // All greyish (none is the key's own chord); key steps keep a little of their color.
        color: freePadColor(degree >= 0 ? blockColor({ ...plain, chordSource: "diatonic", degreeIndex: degree, blockModeIndex: 0 }) : null),
        on: (block.freeRoot ?? 0) === step,
        pick: () => rootChange({ freeRoot: step }),
      };
    });
  } else if (isMediant) {
    // Mediants aren't aimed at a target: one pad per chromatic mediant of the key.
    pads = MEDIANTS.map((_, i) => {
      const cand: Block = { ...plain, chordSource: "applied", appliedFunction: "mediant", appliedTargetIndex: i, blockModeIndex: 0 };
      return { main: mediantNumeral(cand), sub: nameOf(cand), color: blockColor(cand), on: block.appliedTargetIndex === i, pick: () => rootChange({ appliedTargetIndex: i }) };
    });
  } else if (tab === "applied") {
    pads = degreeLabels(MASTER_MODE_NAMES[mode]).map((target, i) => {
      const cand: Block = { ...plain, chordSource: "applied", appliedTargetIndex: i, blockModeIndex: 0 };
      return { top: FUNCTION_PREFIX[block.appliedFunction], main: target, sub: nameOf(cand), color: blockColor(cand), on: block.appliedTargetIndex === i, pick: () => rootChange({ appliedTargetIndex: i }) };
    });
  } else {
    pads = Array.from({ length: 7 }, (_, d) => {
      const on = block.degreeIndex === d;
      const cand: Block = { ...plain, chordSource: "diatonic", degreeIndex: d, blockModeIndex: on ? block.blockModeIndex : 0 };
      const lbl = engineBlockLabel(cand, root, mode);
      // A degree change keeps the borrowed mode.
      return { main: lbl.degree.replace(/^([\u266D\u266F]*[IVXivx]+[\u00B0\u00F8+]?).*$/, "$1"), sub: lbl.name, color: blockColor(cand), on, pick: () => rootChange({ degreeIndex: d, blockModeIndex: block.blockModeIndex }) };
    });
  }

  // Borrow (Diatonic only): the same degree in another mode, listed by result.
  const borrowLabels = BLOCK_MODE_NAMES.map((m, i) => {
    const c = buildChord({ ...plain, blockModeIndex: i }, root, mode);
    return (i === 0 ? "Key" : m) + " \u2192 " + getChordSymbol(c, root).replace(/ \(.*\)$/, "");
  });
  // A fixed layout: every Alter row is always shown; the ones that don't apply are greyed out.
  const alterOrder = ["borrow", "fifth", "third", "seventh", "ninth", "eleventh", "thirteenth"];

  return (
    // A disabled fieldset disables every control inside it, buttons and menus alike.
    <fieldset className={locked ? "inspector locked" : "inspector"} disabled={locked}>
      <div className="drawer-stack">
        <Segmented options={TABS.map((t) => t.label)} value={TABS.findIndex((t) => t.value === tab)} onChange={(i) => switchTab(TABS[i].value)} />
        {tab === "applied" && (
          <IndexDropdown
            options={APPLIED_FUNCTIONS.map((f) => FUNCTION_NAMES[f])}
            value={Math.max(0, APPLIED_FUNCTIONS.indexOf(block.appliedFunction))}
            onChange={(i) => {
              const fn = APPLIED_FUNCTIONS[i] as Block["appliedFunction"];
              rootChange({ appliedFunction: fn, appliedTargetIndex: Math.min(block.appliedTargetIndex, fn === "mediant" ? MEDIANTS.length - 1 : 6) });
            }}
          />
        )}
        <div className={tab === "free" ? "pads free" : isMediant ? "pads six" : "pads"}>
          {pads.map((p, i) => (
            <button key={i} type="button" className={(p.on ? "pad on" : "pad") + (p.color ? "" : " out")} style={p.color ? { background: p.color } : undefined} onClick={p.pick}>
              {p.top && <em>{p.top}</em>}
              <b>{p.main}</b>
              <small>{p.sub}</small>
            </button>
          ))}
        </div>

        <div className="inspector-grid">
          <Field label="Length" wide>
            <span className="length-inline">
              <Segmented
                options={LENGTH_BASES.map((b) => NOTE_LABELS[b])}
                value={LENGTH_BASES.indexOf(parts.base)}
                onChange={(i) => onChange(lengthChange(LENGTH_BASES[i], parts.mod))}
              />
              <Select
                value={LENGTH_MENU.indexOf(parts.mod)}
                options={LENGTH_MENU.map((m) => LENGTH_MOD_LABELS[m])}
                onChange={(v) => onChange(lengthChange(parts.base, LENGTH_MENU[v]))}
              />
            </span>
          </Field>
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
          <Field label="Inversion">
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
          <Field label="Spread">
            <Select value={block.dropIndex} options={SPREAD_NAMES} onChange={(v) => onChange({ dropIndex: v })} />
          </Field>
        </div>

        <div className="alter-grid">
          {alterOrder.map((key) => {
            if (key === "borrow") {
              return (
                <Field key="borrow" label="Borrow" altered={tab === "diatonic" && !!block.blockModeIndex} disabled={tab !== "diatonic"}>
                  <Select value={tab === "diatonic" ? block.blockModeIndex : 0} options={borrowLabels} disabled={tab !== "diatonic"} onChange={(v) => rootChange({ blockModeIndex: v })} />
                </Field>
              );
            }
            const row = rows.find((r) => r.field === key);
            if (!row) return null;
            return (
              <Field key={row.field} label={row.label} altered={!row.disabled && row.value !== row.keyValue} disabled={row.disabled}>
                <Segmented
                  disabled={row.disabled}
                  options={row.choices.map((c) => c.label)}
                  value={row.choices.findIndex((c) => c.value === row.value)}
                  home={row.choices.findIndex((c) => c.value === row.keyValue)}
                  onChange={(i) => onChange(alterChange(block, row.field, row.choices[i].value, root, mode))}
                />
              </Field>
            );
          })}
        </div>
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

function Field({ label, wide, altered, disabled, children }: { label: string; wide?: boolean; altered?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div className={"field" + (wide ? " wide" : "") + (altered ? " altered" : "") + (disabled ? " disabled" : "")}>
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

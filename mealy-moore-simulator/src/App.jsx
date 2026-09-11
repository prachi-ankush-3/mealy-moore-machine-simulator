import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Home, GitBranch, Play, ArrowRightLeft, Scale, Database, BookOpen, Info,
  Plus, Trash2, Save, Download, Upload, Copy, X, Check, AlertCircle,
  AlertTriangle, CheckCircle2, SkipForward, SkipBack, RotateCcw, Pause,
  Edit3, ChevronRight, Menu, FlagTriangleRight, Flag, Circle, Zap,
  FileJson, ClipboardCopy, ArrowRight, Layers, Activity, Clock, Hash,
} from "lucide-react";

/* ============================================================================
   CONSTANTS & THEME
   ========================================================================== */

const COLORS = {
  bg: "#0D1117",
  surface: "#12181f",
  surface2: "#161b22",
  border: "#2a313c",
  borderSoft: "#232a33",
  text: "#e6edf3",
  textDim: "#8b96a5",
  accent: "#2dd4bf",
  accent2: "#34d399",
  danger: "#f87171",
  warn: "#fbbf24",
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "builder", label: "Machine Builder", icon: GitBranch },
  { id: "simulator", label: "Simulator", icon: Play },
  { id: "conversion", label: "Conversion Lab", icon: ArrowRightLeft },
  { id: "compare", label: "Compare Machines", icon: Scale },
  { id: "saved", label: "Saved Machines", icon: Database },
  { id: "docs", label: "Documentation", icon: BookOpen },
  { id: "about", label: "About", icon: Info },
];

/* ============================================================================
   ID / UTIL HELPERS
   ========================================================================== */

let idCounter = 1;
const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function nowISO() {
  return new Date().toISOString();
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/* ============================================================================
   MACHINE MODEL
   Machine = {
     id, name, description, type: 'mealy' | 'moore',
     inputAlphabet: string[], outputAlphabet: string[],
     states: [{ id, name, x, y, isInitial, isFinal, output }],
     transitions: [{ id, from, to, input, output }],  // output used only for mealy
     createdAt, updatedAt
   }
   ========================================================================== */

function createEmptyMachine(type = "mealy") {
  const s0 = { id: uid("s"), name: "q0", x: 260, y: 200, isInitial: true, isFinal: false, output: type === "moore" ? "0" : "" };
  return {
    id: uid("m"),
    name: type === "mealy" ? "Untitled Mealy Machine" : "Untitled Moore Machine",
    description: "",
    type,
    inputAlphabet: ["0", "1"],
    outputAlphabet: ["0", "1"],
    states: [s0],
    transitions: [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

function getInitialState(machine) {
  return machine.states.find((s) => s.isInitial) || null;
}

function findState(machine, id) {
  return machine.states.find((s) => s.id === id) || null;
}

/* ---- Validation ---- */

function validateMachine(machine) {
  const errors = [];
  const warnings = [];

  if (!machine.states.length) {
    errors.push("Add at least one state before this machine can be simulated.");
    return { errors, warnings, isValid: false };
  }

  const initials = machine.states.filter((s) => s.isInitial);
  if (initials.length === 0) errors.push("No initial state is set. Mark one state as initial.");
  if (initials.length > 1) warnings.push(`${initials.length} states are marked initial — only "${initials[0].name}" will be used.`);

  // duplicate state names
  const nameCounts = {};
  machine.states.forEach((s) => (nameCounts[s.name] = (nameCounts[s.name] || 0) + 1));
  Object.entries(nameCounts).forEach(([name, count]) => {
    if (count > 1) errors.push(`State name "${name}" is used ${count} times. State names must be unique.`);
  });

  // determinism + completeness
  machine.states.forEach((s) => {
    machine.inputAlphabet.forEach((sym) => {
      const matches = machine.transitions.filter((t) => t.from === s.id && t.input === sym);
      if (matches.length === 0) {
        warnings.push(`State "${s.name}" has no transition defined for input "${sym}".`);
      } else if (matches.length > 1) {
        errors.push(`State "${s.name}" has ${matches.length} conflicting transitions on input "${sym}" (not deterministic).`);
      }
    });
  });

  // transitions referencing missing states / symbols outside alphabet
  machine.transitions.forEach((t) => {
    if (!findState(machine, t.from) || !findState(machine, t.to)) {
      errors.push(`A transition references a state that no longer exists.`);
    }
    if (!machine.inputAlphabet.includes(t.input)) {
      warnings.push(`Transition uses input "${t.input}" which is not in the declared input alphabet.`);
    }
    if (machine.type === "mealy" && machine.outputAlphabet.length && !machine.outputAlphabet.includes(t.output)) {
      warnings.push(`Transition output "${t.output}" is not in the declared output alphabet.`);
    }
  });

  if (machine.type === "moore") {
    machine.states.forEach((s) => {
      if (s.output === "" || s.output === undefined || s.output === null) {
        warnings.push(`State "${s.name}" has no output defined.`);
      } else if (machine.outputAlphabet.length && !machine.outputAlphabet.includes(s.output)) {
        warnings.push(`State "${s.name}" output "${s.output}" is not in the declared output alphabet.`);
      }
    });
  }

  // reachability
  const init = getInitialState(machine);
  if (init) {
    const seen = new Set([init.id]);
    const queue = [init.id];
    while (queue.length) {
      const cur = queue.shift();
      machine.transitions.filter((t) => t.from === cur).forEach((t) => {
        if (!seen.has(t.to)) {
          seen.add(t.to);
          queue.push(t.to);
        }
      });
    }
    machine.states.forEach((s) => {
      if (!seen.has(s.id)) warnings.push(`State "${s.name}" is unreachable from the initial state.`);
    });
  }

  return { errors, warnings, isValid: errors.length === 0 };
}

/* ---- Simulation ---- */

function simulateMachine(machine, inputString) {
  const init = getInitialState(machine);
  if (!init) return { error: "Machine has no initial state set." };
  if (!inputString.length) return { error: "Enter an input string to simulate." };

  const chars = inputString.split("");
  for (const ch of chars) {
    if (!machine.inputAlphabet.includes(ch)) {
      return { error: `Symbol "${ch}" is not part of the declared input alphabet (${machine.inputAlphabet.join(", ")}).` };
    }
  }

  const steps = [];
  let current = init;

  if (machine.type === "moore") {
    steps.push({ step: 0, input: null, fromName: null, toName: current.name, toId: current.id, transitionId: null, output: current.output ?? "" });
  } else {
    steps.push({ step: 0, input: null, fromName: null, toName: current.name, toId: current.id, transitionId: null, output: null });
  }

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const t = machine.transitions.find((tr) => tr.from === current.id && tr.input === ch);
    if (!t) {
      return {
        error: `No transition defined from state "${current.name}" on input "${ch}" (step ${i + 1}).`,
        partialSteps: steps,
      };
    }
    const next = findState(machine, t.to);
    if (!next) return { error: `Transition target state is missing.` };

    const output = machine.type === "mealy" ? t.output ?? "" : next.output ?? "";
    steps.push({
      step: i + 1,
      input: ch,
      fromName: current.name,
      toName: next.name,
      toId: next.id,
      transitionId: t.id,
      output,
    });
    current = next;
  }

  const outputSteps = steps.filter((s) => s.step > 0 || machine.type === "moore");
  const outputString =
    machine.type === "mealy"
      ? steps.filter((s) => s.step > 0).map((s) => s.output).join("")
      : steps.map((s) => s.output).join("");

  const visited = new Set(steps.map((s) => s.toId));
  const transitionsUsed = new Set(steps.filter((s) => s.transitionId).map((s) => s.transitionId));

  return {
    steps,
    outputString,
    statesVisited: visited.size,
    transitionsUsed: transitionsUsed.size,
    finalState: current,
    inputLength: chars.length,
    outputLength: outputString.length,
  };
}

/* ---- Conversion: Mealy -> Moore ---- */

function convertMealyToMoore(machine) {
  const log = [];
  const init = getInitialState(machine);
  if (!init) return { error: "Source machine has no initial state." };

  // For each state, collect the set of distinct outputs on its INCOMING edges.
  const incomingOutputs = {}; // stateId -> Set(output)
  machine.states.forEach((s) => (incomingOutputs[s.id] = new Set()));
  machine.transitions.forEach((t) => {
    incomingOutputs[t.to]?.add(t.output ?? "");
  });

  const START_TAG = "\u2205"; // synthetic "no output yet" tag for the very first state
  // Build split keys: (stateId, outputTag) -> new moore state
  const splitKey = (stateId, tag) => `${stateId}::${tag}`;
  const created = new Map(); // key -> { id, name, output, sourceStateId }

  function ensureSplit(stateId, tag) {
    const key = splitKey(stateId, tag);
    if (created.has(key)) return created.get(key);
    const src = findState(machine, stateId);
    const outVal = tag === START_TAG ? (machine.outputAlphabet[0] ?? "0") : tag;
    const node = { id: uid("ms"), name: `${src.name}/${outVal}`, output: outVal, sourceStateId: stateId };
    created.set(key, node);
    log.push(`Created Moore state "${node.name}" — copy of Mealy state "${src.name}" carrying output "${outVal}".`);
    return node;
  }

  // Always create the dedicated start copy for the initial state (it has no output on entry).
  const startNode = ensureSplit(init.id, START_TAG);
  log.push(`"${startNode.name}" is designated the initial state (Mealy machines produce no output before consuming input).`);

  // Create a split for every (state, incoming output) combination reachable via a transition.
  machine.transitions.forEach((t) => {
    ensureSplit(t.to, t.output ?? "");
  });

  // Now wire transitions: for every split copy of a source state, and every original mealy
  // transition out of that source state, connect to the split copy of the destination
  // tagged with THIS transition's output.
  const mooreTransitions = [];
  const splitsByState = {};
  created.forEach((node, key) => {
    const [stateId] = key.split("::");
    (splitsByState[stateId] = splitsByState[stateId] || []).push(node);
  });

  Object.keys(splitsByState).forEach((stateId) => {
    const outgoing = machine.transitions.filter((t) => t.from === stateId);
    splitsByState[stateId].forEach((sourceNode) => {
      outgoing.forEach((t) => {
        const targetNode = ensureSplit(t.to, t.output ?? "");
        mooreTransitions.push({
          id: uid("mt"),
          from: sourceNode.id,
          to: targetNode.id,
          input: t.input,
        });
        log.push(`"${sourceNode.name}" --${t.input}--> "${targetNode.name}" (from Mealy edge ${findState(machine, stateId).name} --${t.input}/${t.output}--> ${findState(machine, t.to).name}).`);
      });
    });
  });

  const mooreStates = [];
  let i = 0;
  created.forEach((node) => {
    const col = i % 4, row = Math.floor(i / 4);
    mooreStates.push({
      id: node.id,
      name: node.name,
      x: 160 + col * 190,
      y: 140 + row * 160,
      isInitial: node.id === startNode.id,
      isFinal: false,
      output: node.output,
    });
    i++;
  });

  const newMachine = {
    id: uid("m"),
    name: `${machine.name} (Moore)`,
    description: `Auto-converted from Mealy machine "${machine.name}".`,
    type: "moore",
    inputAlphabet: [...machine.inputAlphabet],
    outputAlphabet: [...new Set(mooreStates.map((s) => s.output))],
    states: mooreStates,
    transitions: mooreTransitions,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  return { machine: newMachine, log };
}

/* ---- Conversion: Moore -> Mealy ---- */

function convertMooreToMealy(machine) {
  const log = [];
  const init = getInitialState(machine);
  if (!init) return { error: "Source machine has no initial state." };

  const newStates = machine.states.map((s) => ({
    id: uid("s"),
    origId: s.id,
    name: s.name,
    x: s.x,
    y: s.y,
    isInitial: s.isInitial,
    isFinal: s.isFinal,
    output: "",
  }));
  const idMap = {};
  machine.states.forEach((s, i) => (idMap[s.id] = newStates[i].id));

  const newTransitions = machine.transitions.map((t) => {
    const destState = findState(machine, t.to);
    const output = destState.output ?? "";
    log.push(`Mealy edge "${findState(machine, t.from).name}" --${t.input}/${output}--> "${destState.name}" (output taken from destination state "${destState.name}").`);
    return { id: uid("mt"), from: idMap[t.from], to: idMap[t.to], input: t.input, output };
  });

  const newMachine = {
    id: uid("m"),
    name: `${machine.name} (Mealy)`,
    description: `Auto-converted from Moore machine "${machine.name}".`,
    type: "mealy",
    inputAlphabet: [...machine.inputAlphabet],
    outputAlphabet: [...machine.outputAlphabet],
    states: newStates.map(({ origId, ...rest }) => rest),
    transitions: newTransitions,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  return { machine: newMachine, log };
}

/* ============================================================================
   PREBUILT EXAMPLES
   ========================================================================== */

function buildExample(def) {
  const stateIds = {};
  def.states.forEach((s) => (stateIds[s.name] = uid("s")));
  return {
    id: uid("m"),
    name: def.name,
    description: def.description,
    type: def.type,
    inputAlphabet: def.inputAlphabet,
    outputAlphabet: def.outputAlphabet,
    states: def.states.map((s) => ({
      id: stateIds[s.name],
      name: s.name,
      x: s.x,
      y: s.y,
      isInitial: !!s.isInitial,
      isFinal: !!s.isFinal,
      output: s.output ?? "",
    })),
    transitions: def.transitions.map((t) => ({
      id: uid("t"),
      from: stateIds[t.from],
      to: stateIds[t.to],
      input: t.input,
      output: t.output ?? "",
    })),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

const EXAMPLE_DEFS = [
  {
    name: "101 Sequence Detector",
    type: "mealy",
    description: "Outputs 1 the moment the substring \"101\" is completed, else 0. Overlapping matches allowed.",
    inputAlphabet: ["0", "1"],
    outputAlphabet: ["0", "1"],
    states: [
      { name: "q0", x: 140, y: 220, isInitial: true },
      { name: "q1", x: 340, y: 120 },
      { name: "q2", x: 540, y: 220 },
    ],
    transitions: [
      { from: "q0", to: "q0", input: "0", output: "0" },
      { from: "q0", to: "q1", input: "1", output: "0" },
      { from: "q1", to: "q2", input: "0", output: "0" },
      { from: "q1", to: "q1", input: "1", output: "0" },
      { from: "q2", to: "q0", input: "0", output: "0" },
      { from: "q2", to: "q1", input: "1", output: "1" },
    ],
  },
  {
    name: "Binary Parity Checker",
    type: "moore",
    description: "Tracks whether the number of 1s seen so far is even or odd. Output 0 = even, 1 = odd.",
    inputAlphabet: ["0", "1"],
    outputAlphabet: ["0", "1"],
    states: [
      { name: "Even", x: 200, y: 200, isInitial: true, output: "0" },
      { name: "Odd", x: 460, y: 200, output: "1" },
    ],
    transitions: [
      { from: "Even", to: "Even", input: "0" },
      { from: "Even", to: "Odd", input: "1" },
      { from: "Odd", to: "Odd", input: "0" },
      { from: "Odd", to: "Even", input: "1" },
    ],
  },
  {
    name: "Odd Number of 1s",
    type: "mealy",
    description: "Outputs 1 on every input symbol that makes the running count of 1s odd, else 0.",
    inputAlphabet: ["0", "1"],
    outputAlphabet: ["0", "1"],
    states: [
      { name: "E", x: 200, y: 200, isInitial: true },
      { name: "O", x: 460, y: 200 },
    ],
    transitions: [
      { from: "E", to: "E", input: "0", output: "0" },
      { from: "E", to: "O", input: "1", output: "1" },
      { from: "O", to: "O", input: "0", output: "0" },
      { from: "O", to: "E", input: "1", output: "0" },
    ],
  },
  {
    name: "110 Sequence Detector",
    type: "mealy",
    description: "Outputs 1 the moment the substring \"110\" is completed, else 0.",
    inputAlphabet: ["0", "1"],
    outputAlphabet: ["0", "1"],
    states: [
      { name: "q0", x: 140, y: 220, isInitial: true },
      { name: "q1", x: 340, y: 120 },
      { name: "q2", x: 540, y: 220 },
    ],
    transitions: [
      { from: "q0", to: "q0", input: "0", output: "0" },
      { from: "q0", to: "q1", input: "1", output: "0" },
      { from: "q1", to: "q2", input: "1", output: "0" },
      { from: "q1", to: "q1", input: "1", output: "0" },
      { from: "q2", to: "q0", input: "1", output: "0" },
      { from: "q2", to: "q0", input: "0", output: "1" },
    ],
  },
  {
    name: "Simple Vending Machine",
    type: "moore",
    description: "Accepts 5 and 10 rupee coins ('5','A' for ten). Dispenses ('D') once 15 or more is reached, then resets.",
    inputAlphabet: ["5", "A"],
    outputAlphabet: ["-", "D"],
    states: [
      { name: "S0", x: 140, y: 220, isInitial: true, output: "-" },
      { name: "S5", x: 340, y: 120, output: "-" },
      { name: "S10", x: 340, y: 320, output: "-" },
      { name: "Dispense", x: 560, y: 220, output: "D" },
    ],
    transitions: [
      { from: "S0", to: "S5", input: "5" },
      { from: "S0", to: "S10", input: "A" },
      { from: "S5", to: "S10", input: "5" },
      { from: "S5", to: "Dispense", input: "A" },
      { from: "S10", to: "Dispense", input: "5" },
      { from: "S10", to: "Dispense", input: "A" },
      { from: "Dispense", to: "S0", input: "5" },
      { from: "Dispense", to: "S0", input: "A" },
    ],
  },
  {
    name: "Traffic Light Controller",
    type: "moore",
    description: "A timer pulse ('T') cycles the light; output shows the active color.",
    inputAlphabet: ["T"],
    outputAlphabet: ["RED", "GREEN", "YELLOW"],
    states: [
      { name: "Red", x: 180, y: 220, isInitial: true, output: "RED" },
      { name: "Green", x: 420, y: 120, output: "GREEN" },
      { name: "Yellow", x: 660, y: 220, output: "YELLOW" },
    ],
    transitions: [
      { from: "Red", to: "Green", input: "T" },
      { from: "Green", to: "Yellow", input: "T" },
      { from: "Yellow", to: "Red", input: "T" },
    ],
  },
];

/* ============================================================================
   STORAGE HELPERS (persistent, per-user via window.storage)
   ========================================================================== */

async function loadMachinesFromStorage() {
  try {
    const res = await window.storage.get("machines-v1", false);
    return res ? JSON.parse(res.value) : [];
  } catch {
    return [];
  }
}
async function saveMachinesToStorage(machines) {
  try {
    await window.storage.set("machines-v1", JSON.stringify(machines), false);
  } catch (e) {
    console.error("Storage save failed", e);
  }
}

/* ============================================================================
   SMALL SHARED UI PRIMITIVES
   ========================================================================== */

function Btn({ children, onClick, variant = "default", size = "md", icon: Icon, disabled, title, active }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 7,
    fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent", transition: "all .15s ease", whiteSpace: "nowrap",
    opacity: disabled ? 0.5 : 1,
  };
  const sizes = {
    sm: { padding: "5px 10px", fontSize: 12.5 },
    md: { padding: "8px 14px", fontSize: 13.5 },
  };
  const variants = {
    default: { background: COLORS.surface2, color: COLORS.text, borderColor: COLORS.border },
    accent: { background: COLORS.accent, color: "#04211d", borderColor: COLORS.accent },
    ghost: { background: active ? "rgba(45,212,191,0.12)" : "transparent", color: active ? COLORS.accent : COLORS.textDim, borderColor: active ? "rgba(45,212,191,0.35)" : "transparent" },
    danger: { background: "transparent", color: COLORS.danger, borderColor: "rgba(248,113,113,0.35)" },
    outline: { background: "transparent", color: COLORS.text, borderColor: COLORS.border },
  };
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...sizes[size], ...variants[variant] }}
      onMouseEnter={(e) => { if (!disabled && variant === "default") e.currentTarget.style.borderColor = COLORS.accent; if(!disabled && variant==='accent') e.currentTarget.style.filter='brightness(1.08)'; }}
      onMouseLeave={(e) => { if (!disabled && variant === "default") e.currentTarget.style.borderColor = COLORS.border; if(!disabled && variant==='accent') e.currentTarget.style.filter='none';}}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

function Panel({ title, right, children, style, bodyStyle }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", ...style }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${COLORS.borderSoft}`, background: COLORS.surface2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textDim, letterSpacing: 0.3 }}>{title}</span>
          {right}
        </div>
      )}
      <div style={{ padding: 14, ...bodyStyle }}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, color: COLORS.textDim, marginBottom: 5, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "#0b1016", border: `1px solid ${COLORS.border}`, borderRadius: 6,
  color: COLORS.text, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box",
  fontFamily: "inherit",
};

function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} onFocus={(e) => (e.target.style.borderColor = COLORS.accent)} onBlur={(e) => (e.target.style.borderColor = COLORS.border)} />;
}

function Chip({ children, onRemove, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: color || "rgba(45,212,191,0.1)", color: COLORS.accent, border: `1px solid rgba(45,212,191,0.3)`, borderRadius: 5, padding: "2px 7px", fontSize: 12, fontFamily: "monospace", marginRight: 5, marginBottom: 5 }}>
      {children}
      {onRemove && (
        <X size={11} style={{ cursor: "pointer" }} onClick={onRemove} />
      )}
    </span>
  );
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: { bg: "rgba(139,150,165,0.12)", fg: COLORS.textDim },
    accent: { bg: "rgba(45,212,191,0.12)", fg: COLORS.accent },
    danger: { bg: "rgba(248,113,113,0.12)", fg: COLORS.danger },
    warn: { bg: "rgba(251,191,36,0.12)", fg: COLORS.warn },
  };
  const t = tones[tone];
  return <span style={{ background: t.bg, color: t.fg, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, letterSpacing: 0.3 }}>{children}</span>;
}

/* ============================================================================
   STATE GRAPH (custom SVG canvas — no external graph library required)
   ========================================================================== */

function groupTransitions(transitions) {
  const groups = {};
  transitions.forEach((t) => {
    const key = `${t.from}=>${t.to}`;
    (groups[key] = groups[key] || []).push(t);
  });
  return groups;
}

function StateGraph({
  machine, selectedStateId, selectedTransId, onSelectState, onSelectTransition,
  onMoveState, onCanvasClick, pendingFrom, height = 460,
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = Math.max(40, Math.min(rect.width - 40, e.clientX - rect.left));
      const y = Math.max(40, Math.min(height - 40, e.clientY - rect.top));
      onMoveState(dragRef.current, x, y);
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onMoveState, height]);

  const groups = useMemo(() => groupTransitions(machine.transitions), [machine.transitions]);
  const R = 34;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={height}
      style={{ background: `radial-gradient(circle, ${COLORS.borderSoft} 1px, transparent 1px)`, backgroundSize: "22px 22px", backgroundColor: "#0b0f15", borderRadius: 8, cursor: pendingFrom ? "crosshair" : "default" }}
      onClick={(e) => { if (e.target === svgRef.current) onCanvasClick && onCanvasClick(); }}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={COLORS.textDim} />
        </marker>
        <marker id="arrowActive" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={COLORS.accent} />
        </marker>
      </defs>

      {Object.entries(groups).map(([key, ts]) => {
        const from = findState(machine, ts[0].from);
        const to = findState(machine, ts[0].to);
        if (!from || !to) return null;
        const isActive = ts.some((t) => t.id === selectedTransId);
        const labelText = ts.map((t) => (machine.type === "mealy" ? `${t.input}/${t.output}` : `${t.input}`)).join(", ");
        const stroke = isActive ? COLORS.accent : COLORS.textDim;

        if (from.id === to.id) {
          // self loop
          const lx = from.x, ly = from.y - R;
          const path = `M ${lx - 18} ${ly + 6} C ${lx - 26} ${ly - 40}, ${lx + 26} ${ly - 40}, ${lx + 18} ${ly + 6}`;
          return (
            <g key={key} onClick={(e) => { e.stopPropagation(); onSelectTransition(ts[0].id); }} style={{ cursor: "pointer" }}>
              <path d={path} fill="none" stroke={stroke} strokeWidth={isActive ? 2.2 : 1.6} markerEnd={isActive ? "url(#arrowActive)" : "url(#arrow)"} />
              <rect x={lx - labelText.length * 3.6 - 4} y={ly - 62} width={labelText.length * 7.2 + 8} height={16} rx={4} fill={COLORS.surface2} stroke={COLORS.border} />
              <text x={lx} y={ly - 50} fill={isActive ? COLORS.accent : COLORS.text} fontSize="11" fontFamily="monospace" textAnchor="middle">{labelText}</text>
            </g>
          );
        }

        const reverseExists = !!groups[`${to.id}=>${from.id}`];
        const dx = to.x - from.x, dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / dist, uy = dy / dist;
        const sx = from.x + ux * R, sy = from.y + uy * R;
        const ex = to.x - ux * R, ey = to.y - uy * R;
        const mx = (sx + ex) / 2, my = (sy + ey) / 2;
        const perpX = -uy, perpY = ux;
        const curve = reverseExists ? 26 : 0;
        const cx = mx + perpX * curve, cy = my + perpY * curve;
        const path = curve ? `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}` : `M ${sx} ${sy} L ${ex} ${ey}`;
        const labelX = curve ? cx : mx;
        const labelY = curve ? cy : my;

        return (
          <g key={key} onClick={(e) => { e.stopPropagation(); onSelectTransition(ts[0].id); }} style={{ cursor: "pointer" }}>
            <path d={path} fill="none" stroke={stroke} strokeWidth={isActive ? 2.2 : 1.6} markerEnd={isActive ? "url(#arrowActive)" : "url(#arrow)"} />
            <rect x={labelX - labelText.length * 3.6 - 4} y={labelY - 9} width={labelText.length * 7.2 + 8} height={16} rx={4} fill={COLORS.surface2} stroke={COLORS.border} />
            <text x={labelX} y={labelY + 3} fill={isActive ? COLORS.accent : COLORS.text} fontSize="11" fontFamily="monospace" textAnchor="middle">{labelText}</text>
          </g>
        );
      })}

      {machine.states.map((s) => {
        const isSel = s.id === selectedStateId;
        const isPending = s.id === pendingFrom;
        const label = machine.type === "moore" ? `${s.name}/${s.output || "-"}` : s.name;
        return (
          <g
            key={s.id}
            transform={`translate(${s.x},${s.y})`}
            style={{ cursor: "grab" }}
            onMouseDown={(e) => { e.stopPropagation(); dragRef.current = s.id; }}
            onClick={(e) => { e.stopPropagation(); onSelectState(s.id); }}
          >
            {s.isFinal && <circle r={R + 4} fill="none" stroke={isSel ? COLORS.accent : COLORS.textDim} strokeWidth={1.3} />}
            <circle
              r={R}
              fill={isPending ? "rgba(45,212,191,0.25)" : isSel ? "rgba(45,212,191,0.16)" : COLORS.surface2}
              stroke={isSel || isPending ? COLORS.accent : COLORS.border}
              strokeWidth={isSel || isPending ? 2.2 : 1.4}
            />
            <text y={4} textAnchor="middle" fill={COLORS.text} fontSize={label.length > 8 ? 10.5 : 12.5} fontFamily="monospace" fontWeight="700">{label}</text>
            {s.isInitial && (
              <>
                <line x1={-R - 26} y1={0} x2={-R - 2} y2={0} stroke={COLORS.accent} strokeWidth={1.8} markerEnd="url(#arrowActive)" />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================================
   NAVBAR + SIDEBAR
   ========================================================================== */

function Sidebar({ page, setPage, collapsed, setCollapsed }) {
  return (
    <div style={{ width: collapsed ? 60 : 220, flexShrink: 0, background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", transition: "width .18s ease", height: "100%" }}>
      <div style={{ padding: "14px 12px", display: "flex", alignItems: "center", gap: 9, borderBottom: `1px solid ${COLORS.borderSoft}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: `linear-gradient(135deg, ${COLORS.accent}, #0ea5a0)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <GitBranch size={16} color="#04211d" />
        </div>
        {!collapsed && <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.text, lineHeight: 1.1 }}>M&M<br /><span style={{ fontWeight: 500, color: COLORS.textDim, fontSize: 10 }}>Simulator</span></div>}
      </div>
      <div style={{ flex: 1, padding: 8, overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setPage(item.id)}
              title={item.label}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 7, marginBottom: 3, cursor: "pointer",
                background: active ? "rgba(45,212,191,0.12)" : "transparent", color: active ? COLORS.accent : COLORS.textDim,
                fontSize: 13, fontWeight: active ? 700 : 500, transition: "all .12s ease",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = COLORS.surface2; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{item.label}</span>}
            </div>
          );
        })}
      </div>
      <div style={{ padding: 10, borderTop: `1px solid ${COLORS.borderSoft}` }}>
        <div onClick={() => setCollapsed(!collapsed)} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 7, cursor: "pointer", color: COLORS.textDim, fontSize: 12 }}>
          <Menu size={15} />
          {!collapsed && "Collapse"}
        </div>
      </div>
    </div>
  );
}

function Navbar({ currentMachine, onSave, onExport, page }) {
  return (
    <div style={{ height: 54, flexShrink: 0, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", background: COLORS.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, textTransform: "capitalize" }}>{NAV_ITEMS.find((n) => n.id === page)?.label || "Dashboard"}</span>
        {currentMachine && (
          <>
            <ChevronRight size={13} color={COLORS.textDim} />
            <span style={{ fontSize: 13, color: COLORS.textDim, fontFamily: "monospace" }}>{currentMachine.name}</span>
            <Badge tone="accent">{currentMachine.type.toUpperCase()}</Badge>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {currentMachine && (
          <>
            <Btn size="sm" icon={Save} onClick={onSave}>Save</Btn>
            <Btn size="sm" icon={Download} onClick={onExport}>Export</Btn>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   DASHBOARD
   ========================================================================== */

function StatCard({ label, value, icon: Icon }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16, flex: 1, minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, color: COLORS.textDim, fontWeight: 700 }}>{label}</span>
        <Icon size={15} color={COLORS.accent} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.text, marginTop: 8, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

function Dashboard({ machines, simHistory, onCreate, onOpen, goPage }) {
  const mealyCount = machines.filter((m) => m.type === "mealy").length;
  const mooreCount = machines.filter((m) => m.type === "moore").length;
  return (
    <div style={{ padding: 24, maxWidth: 1150, margin: "0 auto" }}>
      <div style={{ padding: "34px 30px", borderRadius: 14, background: `linear-gradient(120deg, rgba(45,212,191,0.08), rgba(13,17,23,0))`, border: `1px solid ${COLORS.border}`, marginBottom: 22 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>Design. Simulate. Understand.</div>
        <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 20, maxWidth: 520 }}>An interactive simulator for Mealy and Moore finite-state machines — build a graph, run real input through it, and watch every transition and output resolve step by step.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="accent" icon={Plus} onClick={() => onCreate("mealy")}>Create Mealy Machine</Btn>
          <Btn variant="outline" icon={Plus} onClick={() => onCreate("moore")}>Create Moore Machine</Btn>
          <Btn variant="ghost" icon={Play} onClick={() => goPage("simulator")}>Open Simulator</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard label="Total Machines" value={machines.length} icon={Layers} />
        <StatCard label="Mealy Machines" value={mealyCount} icon={GitBranch} />
        <StatCard label="Moore Machines" value={mooreCount} icon={GitBranch} />
        <StatCard label="Simulations Run" value={simHistory.length} icon={Activity} />
        <StatCard label="Saved Machines" value={machines.length} icon={Database} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <Panel title="RECENT MACHINES">
          {machines.length === 0 ? (
            <div style={{ color: COLORS.textDim, fontSize: 13, padding: "18px 4px" }}>No machines yet — create one above to get started.</div>
          ) : (
            [...machines].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5).map((m) => (
              <div key={m.id} onClick={() => onOpen(m)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 8px", borderRadius: 7, cursor: "pointer", borderBottom: `1px solid ${COLORS.borderSoft}` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surface2)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, fontFamily: "monospace" }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim }}>{m.states.length} states · {m.transitions.length} transitions · updated {fmtDate(m.updatedAt)}</div>
                </div>
                <Badge tone={m.type === "mealy" ? "accent" : "warn"}>{m.type}</Badge>
              </div>
            ))
          )}
        </Panel>

        <Panel title="QUICK START GUIDE">
          {[
            "Create a Mealy or Moore machine from the Dashboard.",
            "Add states and transitions in the Machine Builder canvas.",
            "Mark one state as initial (arrow) and any as final (double ring).",
            "Enter an input string in the Simulator and step through it.",
            "Try Conversion Lab to see Mealy ⇄ Moore transformations.",
          ].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 12.5, color: COLORS.textDim, alignItems: "flex-start" }}>
              <span style={{ color: COLORS.accent, fontFamily: "monospace", fontWeight: 700 }}>{i + 1}.</span>
              <span>{t}</span>
            </div>
          ))}
        </Panel>
      </div>

      {simHistory.length > 0 && (
        <Panel title="RECENT SIMULATIONS" style={{ marginTop: 16 }}>
          {simHistory.slice(0, 4).map((h, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px", borderBottom: `1px solid ${COLORS.borderSoft}`, fontSize: 12.5 }}>
              <span style={{ color: COLORS.text, fontFamily: "monospace" }}>{h.machineName}</span>
              <span style={{ color: COLORS.textDim }}>in: {h.input} → out: {h.output}</span>
              <span style={{ color: COLORS.textDim }}>{fmtDate(h.time)}</span>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}

/* ============================================================================
   MACHINE BUILDER
   ========================================================================== */

function MachineBuilder({ machine, setMachine, onLoadExample }) {
  const [selectedStateId, setSelectedStateId] = useState(null);
  const [selectedTransId, setSelectedTransId] = useState(null);
  const [pendingFrom, setPendingFrom] = useState(null);
  const [transDraft, setTransDraft] = useState(null); // { from, to }
  const [newSymbol, setNewSymbol] = useState("");
  const [newOutSymbol, setNewOutSymbol] = useState("");

  const validation = useMemo(() => validateMachine(machine), [machine]);

  function update(fn) {
    setMachine((m) => {
      const copy = deepClone(m);
      fn(copy);
      copy.updatedAt = nowISO();
      return copy;
    });
  }

  function addState() {
    update((m) => {
      const n = m.states.length;
      m.states.push({ id: uid("s"), name: `q${n}`, x: 150 + (n % 4) * 160, y: 120 + Math.floor(n / 4) * 160, isInitial: n === 0, isFinal: false, output: m.type === "moore" ? (m.outputAlphabet[0] || "0") : "" });
    });
  }

  function deleteState(id) {
    update((m) => {
      m.states = m.states.filter((s) => s.id !== id);
      m.transitions = m.transitions.filter((t) => t.from !== id && t.to !== id);
    });
    setSelectedStateId(null);
  }

  function renameState(id, name) {
    update((m) => { const s = m.states.find((x) => x.id === id); if (s) s.name = name; });
  }

  function toggleInitial(id) {
    update((m) => { m.states.forEach((s) => (s.isInitial = s.id === id)); });
  }

  function toggleFinal(id) {
    update((m) => { const s = m.states.find((x) => x.id === id); if (s) s.isFinal = !s.isFinal; });
  }

  function setStateOutput(id, output) {
    update((m) => { const s = m.states.find((x) => x.id === id); if (s) s.output = output; });
  }

  function moveState(id, x, y) {
    setMachine((m) => {
      const copy = { ...m, states: m.states.map((s) => (s.id === id ? { ...s, x, y } : s)) };
      return copy;
    });
  }

  function handleCanvasSelectState(id) {
    if (pendingFrom) {
      setTransDraft({ from: pendingFrom, to: id });
      setPendingFrom(null);
      return;
    }
    setSelectedStateId(id);
    setSelectedTransId(null);
  }

  function startAddTransition() {
    if (!machine.states.length) return;
    setPendingFrom(selectedStateId || machine.states[0].id);
    setSelectedTransId(null);
  }

  function commitTransition(input, output) {
    if (!transDraft) return;
    update((m) => {
      m.transitions.push({ id: uid("t"), from: transDraft.from, to: transDraft.to, input, output: m.type === "mealy" ? output : "" });
    });
    setTransDraft(null);
  }

  function deleteTransition(id) {
    update((m) => { m.transitions = m.transitions.filter((t) => t.id !== id); });
    setSelectedTransId(null);
  }

  function updateTransition(id, patch) {
    update((m) => { const t = m.transitions.find((x) => x.id === id); if (t) Object.assign(t, patch); });
  }

  function addAlphabetSymbol(kind) {
    const val = kind === "in" ? newSymbol.trim() : newOutSymbol.trim();
    if (!val) return;
    update((m) => {
      const key = kind === "in" ? "inputAlphabet" : "outputAlphabet";
      if (!m[key].includes(val)) m[key].push(val);
    });
    if (kind === "in") setNewSymbol(""); else setNewOutSymbol("");
  }

  function removeAlphabetSymbol(kind, sym) {
    update((m) => {
      const key = kind === "in" ? "inputAlphabet" : "outputAlphabet";
      m[key] = m[key].filter((s) => s !== sym);
    });
  }

  const selectedState = selectedStateId ? findState(machine, selectedStateId) : null;
  const selectedTrans = selectedTransId ? machine.transitions.find((t) => t.id === selectedTransId) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 280px", gap: 14, padding: 18, height: "100%", boxSizing: "border-box" }}>
      {/* LEFT: config panel */}
      <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <Panel title="MACHINE TYPE">
          <div style={{ display: "flex", gap: 6 }}>
            <Btn size="sm" variant={machine.type === "mealy" ? "accent" : "outline"} onClick={() => update((m) => { m.type = "mealy"; })}>MEALY</Btn>
            <Btn size="sm" variant={machine.type === "moore" ? "accent" : "outline"} onClick={() => update((m) => { m.type = "moore"; m.states.forEach((s) => { if (!s.output) s.output = m.outputAlphabet[0] || "0"; }); })}>MOORE</Btn>
          </div>
        </Panel>

        <Panel title="MACHINE INFO">
          <Field label="NAME"><TextInput value={machine.name} onChange={(e) => update((m) => { m.name = e.target.value; })} /></Field>
          <Field label="DESCRIPTION"><TextInput as="textarea" value={machine.description} onChange={(e) => update((m) => { m.description = e.target.value; })} placeholder="What does this machine do?" /></Field>
        </Panel>

        <Panel title="INPUT ALPHABET (Σ)">
          <div style={{ marginBottom: 8 }}>{machine.inputAlphabet.map((s) => <Chip key={s} onRemove={() => removeAlphabetSymbol("in", s)}>{s}</Chip>)}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="e.g. 0" onKeyDown={(e) => e.key === "Enter" && addAlphabetSymbol("in")} />
            <Btn size="sm" icon={Plus} onClick={() => addAlphabetSymbol("in")}>Add</Btn>
          </div>
        </Panel>

        <Panel title="OUTPUT ALPHABET (Γ)">
          <div style={{ marginBottom: 8 }}>{machine.outputAlphabet.map((s) => <Chip key={s} onRemove={() => removeAlphabetSymbol("out", s)}>{s}</Chip>)}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <TextInput value={newOutSymbol} onChange={(e) => setNewOutSymbol(e.target.value)} placeholder="e.g. 1" onKeyDown={(e) => e.key === "Enter" && addAlphabetSymbol("out")} />
            <Btn size="sm" icon={Plus} onClick={() => addAlphabetSymbol("out")}>Add</Btn>
          </div>
        </Panel>

        <Panel title="EXAMPLES">
          <select
            onChange={(e) => { if (e.target.value) { onLoadExample(e.target.value); e.target.value = ""; } }}
            style={{ ...inputStyle }}
            defaultValue=""
          >
            <option value="" disabled>Load a prebuilt example…</option>
            {EXAMPLE_DEFS.map((ex, i) => <option key={i} value={i}>{ex.name} ({ex.type})</option>)}
          </select>
        </Panel>
      </div>

      {/* CENTER: canvas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn size="sm" icon={Plus} variant="accent" onClick={addState}>Add State</Btn>
          <Btn size="sm" icon={ArrowRight} variant={pendingFrom ? "accent" : "outline"} onClick={startAddTransition} disabled={!machine.states.length}>
            {pendingFrom ? "Click target state…" : "Add Transition"}
          </Btn>
          {selectedState && (
            <>
              <Btn size="sm" icon={FlagTriangleRight} variant="outline" onClick={() => toggleInitial(selectedState.id)}>Mark Initial</Btn>
              <Btn size="sm" icon={Flag} variant="outline" active={selectedState.isFinal} onClick={() => toggleFinal(selectedState.id)}>{selectedState.isFinal ? "Unmark Final" : "Mark Final"}</Btn>
              <Btn size="sm" icon={Trash2} variant="danger" onClick={() => deleteState(selectedState.id)}>Delete State</Btn>
            </>
          )}
          {selectedTrans && (
            <Btn size="sm" icon={Trash2} variant="danger" onClick={() => deleteTransition(selectedTrans.id)}>Delete Transition</Btn>
          )}
        </div>

        <Panel style={{ flex: 1 }} bodyStyle={{ padding: 8 }}>
          {machine.states.length === 0 ? (
            <div style={{ height: 460, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textDim, fontSize: 13, flexDirection: "column", gap: 10 }}>
              <GitBranch size={30} color={COLORS.border} />
              This machine has no states yet. Click "Add State" to begin.
            </div>
          ) : (
            <StateGraph
              machine={machine}
              selectedStateId={selectedStateId}
              selectedTransId={selectedTransId}
              onSelectState={handleCanvasSelectState}
              onSelectTransition={(id) => { setSelectedTransId(id); setSelectedStateId(null); }}
              onMoveState={moveState}
              onCanvasClick={() => { setSelectedStateId(null); setSelectedTransId(null); setPendingFrom(null); }}
              pendingFrom={pendingFrom}
            />
          )}
        </Panel>

        {/* Bottom console: validation */}
        <Panel title="CONSOLE / VALIDATION" bodyStyle={{ padding: 10, maxHeight: 150, overflowY: "auto" }}>
          {validation.errors.length === 0 && validation.warnings.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.accent2, fontSize: 12.5 }}><CheckCircle2 size={15} /> Machine is valid and ready for simulation.</div>
          )}
          {validation.errors.map((e, i) => (
            <div key={"e" + i} style={{ display: "flex", alignItems: "flex-start", gap: 8, color: COLORS.danger, fontSize: 12.5, marginBottom: 5 }}><AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} /> {e}</div>
          ))}
          {validation.warnings.map((w, i) => (
            <div key={"w" + i} style={{ display: "flex", alignItems: "flex-start", gap: 8, color: COLORS.warn, fontSize: 12.5, marginBottom: 5 }}><AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} /> {w}</div>
          ))}
        </Panel>
      </div>

      {/* RIGHT: properties panel */}
      <div style={{ overflowY: "auto" }}>
        {transDraft ? (
          <Panel title="NEW TRANSITION">
            <div style={{ fontSize: 12.5, color: COLORS.textDim, marginBottom: 10 }}>
              {findState(machine, transDraft.from)?.name} <ArrowRight size={11} style={{ display: "inline", verticalAlign: "middle" }} /> {findState(machine, transDraft.to)?.name}
            </div>
            <TransitionForm machine={machine} onCommit={commitTransition} onCancel={() => setTransDraft(null)} />
          </Panel>
        ) : selectedState ? (
          <Panel title="STATE PROPERTIES">
            <Field label="NAME"><TextInput value={selectedState.name} onChange={(e) => renameState(selectedState.id, e.target.value)} /></Field>
            <Field label="FLAGS">
              <div style={{ display: "flex", gap: 6 }}>
                <Badge tone={selectedState.isInitial ? "accent" : "default"}>{selectedState.isInitial ? "Initial" : "Not initial"}</Badge>
                <Badge tone={selectedState.isFinal ? "warn" : "default"}>{selectedState.isFinal ? "Final" : "Not final"}</Badge>
              </div>
            </Field>
            {machine.type === "moore" && (
              <Field label="OUTPUT (λ)">
                <select style={inputStyle} value={selectedState.output || ""} onChange={(e) => setStateOutput(selectedState.id, e.target.value)}>
                  <option value="">select…</option>
                  {machine.outputAlphabet.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            )}
            <Field label="OUTGOING TRANSITIONS">
              {machine.transitions.filter((t) => t.from === selectedState.id).length === 0 && <div style={{ fontSize: 12, color: COLORS.textDim }}>None yet.</div>}
              {machine.transitions.filter((t) => t.from === selectedState.id).map((t) => (
                <div key={t.id} onClick={() => setSelectedTransId(t.id)} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 6px", borderRadius: 5, cursor: "pointer", color: COLORS.textDim }} onMouseEnter={e=>e.currentTarget.style.background=COLORS.surface2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{fontFamily:'monospace'}}>{machine.type === "mealy" ? `${t.input}/${t.output}` : t.input} → {findState(machine, t.to)?.name}</span>
                  <ChevronRight size={13} />
                </div>
              ))}
            </Field>
          </Panel>
        ) : selectedTrans ? (
          <Panel title="TRANSITION PROPERTIES">
            <div style={{ fontSize: 12.5, color: COLORS.textDim, marginBottom: 10 }}>
              {findState(machine, selectedTrans.from)?.name} <ArrowRight size={11} style={{ display: "inline", verticalAlign: "middle" }} /> {findState(machine, selectedTrans.to)?.name}
            </div>
            <Field label="INPUT SYMBOL">
              <select style={inputStyle} value={selectedTrans.input} onChange={(e) => updateTransition(selectedTrans.id, { input: e.target.value })}>
                {machine.inputAlphabet.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            {machine.type === "mealy" && (
              <Field label="OUTPUT SYMBOL">
                <select style={inputStyle} value={selectedTrans.output} onChange={(e) => updateTransition(selectedTrans.id, { output: e.target.value })}>
                  {machine.outputAlphabet.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}
            <Btn size="sm" variant="danger" icon={Trash2} onClick={() => deleteTransition(selectedTrans.id)}>Delete Transition</Btn>
          </Panel>
        ) : (
          <Panel title="PROPERTIES">
            <div style={{ fontSize: 12.5, color: COLORS.textDim, lineHeight: 1.6 }}>
              Select a state or transition on the canvas to edit it here. Drag states to reposition them. Use "Add Transition" then click a source and target state to connect them.
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function TransitionForm({ machine, onCommit, onCancel }) {
  const [input, setInput] = useState(machine.inputAlphabet[0] || "");
  const [output, setOutput] = useState(machine.outputAlphabet[0] || "");
  return (
    <div>
      <Field label="INPUT SYMBOL">
        <select style={inputStyle} value={input} onChange={(e) => setInput(e.target.value)}>
          {machine.inputAlphabet.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      {machine.type === "mealy" && (
        <Field label="OUTPUT SYMBOL">
          <select style={inputStyle} value={output} onChange={(e) => setOutput(e.target.value)}>
            {machine.outputAlphabet.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Btn size="sm" variant="accent" icon={Check} onClick={() => onCommit(input, output)} disabled={!input}>Add</Btn>
        <Btn size="sm" variant="outline" icon={X} onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

/* ============================================================================
   SIMULATOR
   ========================================================================== */

function Simulator({ machine, onLogHistory }) {
  const [inputStr, setInputStr] = useState("");
  const [result, setResult] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);

  const validation = useMemo(() => (machine ? validateMachine(machine) : null), [machine]);

  useEffect(() => {
    if (!playing || !result) return;
    if (stepIndex >= result.steps.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setStepIndex((i) => i + 1), 700);
    return () => clearTimeout(t);
  }, [playing, stepIndex, result]);

  function run() {
    if (!machine) return;
    const r = simulateMachine(machine, inputStr);
    if (r.error) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
    setStepIndex(r.steps.length - 1);
    onLogHistory({ machineName: machine.name, input: inputStr, output: r.outputString, time: nowISO(), steps: r.steps.length - 1 });
  }

  function stepThrough() {
    if (!machine) return;
    if (!result) {
      const r = simulateMachine(machine, inputStr);
      if (r.error) { setError(r.error); return; }
      setError(null);
      setResult(r);
      setStepIndex(0);
      onLogHistory({ machineName: machine.name, input: inputStr, output: r.outputString, time: nowISO(), steps: r.steps.length - 1 });
      return;
    }
    setStepIndex((i) => Math.min(i + 1, result.steps.length - 1));
  }

  function stepBack() { setStepIndex((i) => Math.max(0, i - 1)); }
  function reset() { setResult(null); setStepIndex(0); setPlaying(false); setError(null); }

  if (!machine) {
    return <div style={{ padding: 40, textAlign: "center", color: COLORS.textDim }}>Open or create a machine first (Dashboard or Machine Builder).</div>;
  }

  const curStep = result?.steps[stepIndex];
  const activeStateId = curStep?.toId;
  const activeTransId = curStep?.transitionId;
  const partialOutput = result ? (machine.type === "mealy"
    ? result.steps.slice(1, stepIndex + 1).map((s) => s.output).join("")
    : result.steps.slice(0, stepIndex + 1).map((s) => s.output).join("")) : "";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, padding: 18, boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <Panel title="INPUT">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <TextInput value={inputStr} onChange={(e) => { setInputStr(e.target.value); reset(); }} placeholder={`e.g. ${machine.inputAlphabet.join("")}`} style={{ fontFamily: "monospace", fontSize: 15 }} />
          </div>
          {error && <div style={{ color: COLORS.danger, fontSize: 12.5, marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={13} /> {error}</div>}
          {validation && !validation.isValid && <div style={{ color: COLORS.warn, fontSize: 12, marginTop: 8 }}>Fix validation errors in Machine Builder before simulating.</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Btn icon={SkipBack} size="sm" onClick={stepBack} disabled={!result || stepIndex === 0}>Previous</Btn>
            <Btn icon={playing ? Pause : SkipForward} size="sm" variant="accent" onClick={playing ? () => setPlaying(false) : stepThrough} disabled={!validation?.isValid}>{result ? "Step" : "Start"}</Btn>
            <Btn icon={Play} size="sm" onClick={() => { if (!result) run(); setPlaying(true); }} disabled={!validation?.isValid}>Run</Btn>
            <Btn icon={RotateCcw} size="sm" variant="outline" onClick={reset}>Reset</Btn>
          </div>
        </Panel>

        <Panel title="GRAPH — LIVE STATE" bodyStyle={{ padding: 8 }}>
          <StateGraph
            machine={machine}
            selectedStateId={activeStateId}
            selectedTransId={activeTransId}
            onSelectState={() => {}}
            onSelectTransition={() => {}}
            onMoveState={() => {}}
            height={340}
          />
        </Panel>

        {result && curStep && (
          <Panel title={`STEP ${curStep.step}`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, fontSize: 12.5 }}>
              <div><div style={{ color: COLORS.textDim, marginBottom: 3 }}>Input</div><div style={{ fontFamily: "monospace", color: COLORS.text }}>{curStep.input ?? "—"}</div></div>
              <div><div style={{ color: COLORS.textDim, marginBottom: 3 }}>From</div><div style={{ fontFamily: "monospace", color: COLORS.text }}>{curStep.fromName ?? "—"}</div></div>
              <div><div style={{ color: COLORS.textDim, marginBottom: 3 }}>To</div><div style={{ fontFamily: "monospace", color: COLORS.accent }}>{curStep.toName}</div></div>
              <div><div style={{ color: COLORS.textDim, marginBottom: 3 }}>Output</div><div style={{ fontFamily: "monospace", color: COLORS.accent2 }}>{curStep.output ?? "—"}</div></div>
            </div>
          </Panel>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <Panel title="OUTPUT SO FAR">
          <div style={{ fontFamily: "monospace", fontSize: 16, color: COLORS.accent, wordBreak: "break-all", minHeight: 22 }}>{partialOutput || "—"}</div>
        </Panel>

        {result && (
          <Panel title="STATISTICS">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
              <StatRow icon={Hash} label="Input length" value={result.inputLength} />
              <StatRow icon={Hash} label="Output length" value={result.outputLength} />
              <StatRow icon={Layers} label="States visited" value={result.statesVisited} />
              <StatRow icon={GitBranch} label="Transitions used" value={result.transitionsUsed} />
              <StatRow icon={Activity} label="Current state" value={curStep?.toName} />
              <StatRow icon={Clock} label="Steps shown" value={`${stepIndex + 1} / ${result.steps.length}`} />
            </div>
          </Panel>
        )}

        <Panel title="SIMULATION TIMELINE" bodyStyle={{ padding: 0, maxHeight: 340, overflowY: "auto" }}>
          {!result ? (
            <div style={{ padding: 14, fontSize: 12.5, color: COLORS.textDim }}>Run the simulator to see the step timeline.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: COLORS.surface2, position: "sticky", top: 0 }}>
                  {["Step", "Input", "State", "Transition", "Output"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: COLORS.textDim, fontWeight: 700, borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.steps.map((s, i) => (
                  <tr key={i} style={{ background: i === stepIndex ? "rgba(45,212,191,0.1)" : "transparent", cursor: "pointer" }} onClick={() => setStepIndex(i)}>
                    <td style={{ padding: "6px 8px", color: COLORS.text, fontFamily: "monospace" }}>{s.step}</td>
                    <td style={{ padding: "6px 8px", color: COLORS.text, fontFamily: "monospace" }}>{s.input ?? "-"}</td>
                    <td style={{ padding: "6px 8px", color: COLORS.text, fontFamily: "monospace" }}>{s.toName}</td>
                    <td style={{ padding: "6px 8px", color: COLORS.textDim, fontFamily: "monospace" }}>{s.fromName ? `${s.fromName}→${s.toName}` : "-"}</td>
                    <td style={{ padding: "6px 8px", color: COLORS.accent2, fontFamily: "monospace" }}>{s.output ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, color: COLORS.textDim }}><Icon size={13} /> {label}</span>
      <span style={{ color: COLORS.text, fontFamily: "monospace", fontWeight: 700 }}>{value ?? "—"}</span>
    </div>
  );
}

/* ============================================================================
   CONVERSION LAB
   ========================================================================== */

function ConversionLab({ machines, currentMachine, onSaveConverted }) {
  const [sourceId, setSourceId] = useState(currentMachine?.id || "");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const pool = useMemo(() => {
    const list = [...machines];
    if (currentMachine && !list.find((m) => m.id === currentMachine.id)) list.unshift(currentMachine);
    return list;
  }, [machines, currentMachine]);

  const source = pool.find((m) => m.id === sourceId) || null;

  function convert() {
    if (!source) return;
    const v = validateMachine(source);
    if (!v.isValid) { setError("Source machine has validation errors. Fix them in Machine Builder first."); setResult(null); return; }
    const r = source.type === "mealy" ? convertMealyToMoore(source) : convertMooreToMealy(source);
    if (r.error) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
  }

  return (
    <div style={{ padding: 18, maxWidth: 1150, margin: "0 auto" }}>
      <Panel title="SELECT SOURCE MACHINE">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ ...inputStyle, maxWidth: 340 }} value={sourceId} onChange={(e) => { setSourceId(e.target.value); setResult(null); }}>
            <option value="" disabled>Choose a machine…</option>
            {pool.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.type})</option>)}
          </select>
          <Btn variant="accent" icon={ArrowRightLeft} onClick={convert} disabled={!source}>
            Convert {source ? (source.type === "mealy" ? "Mealy → Moore" : "Moore → Mealy") : ""}
          </Btn>
        </div>
        {error && <div style={{ color: COLORS.danger, fontSize: 12.5, marginTop: 10, display: "flex", gap: 6 }}><AlertCircle size={14} /> {error}</div>}
      </Panel>

      {source && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
          <Panel title={`ORIGINAL — ${source.type.toUpperCase()}`} bodyStyle={{ padding: 8 }}>
            <StateGraph machine={source} onSelectState={() => {}} onSelectTransition={() => {}} onMoveState={() => {}} height={300} />
          </Panel>
          {result?.machine ? (
            <Panel title={`GENERATED — ${result.machine.type.toUpperCase()}`} bodyStyle={{ padding: 8 }} right={<Btn size="sm" icon={Save} onClick={() => onSaveConverted(result.machine)}>Save as new machine</Btn>}>
              <StateGraph machine={result.machine} onSelectState={() => {}} onSelectTransition={() => {}} onMoveState={() => {}} height={300} />
            </Panel>
          ) : (
            <Panel title="GENERATED MACHINE"><div style={{ color: COLORS.textDim, fontSize: 12.5, padding: 20, textAlign: "center" }}>Click "Convert" to generate the equivalent machine.</div></Panel>
          )}
        </div>
      )}

      {result?.log && (
        <Panel title="CONVERSION STEPS" style={{ marginTop: 14 }} bodyStyle={{ maxHeight: 260, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontFamily: "monospace", color: COLORS.textDim }}>
            {result.log.map((l, i) => <div key={i}>› {l}</div>)}
          </div>
        </Panel>
      )}

      <Panel title="WHY NEW STATES ARE NEEDED" style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12.5, color: COLORS.textDim, lineHeight: 1.7 }}>
          Because Mealy outputs are attached to <b style={{ color: COLORS.text }}>transitions</b> and Moore outputs are attached to <b style={{ color: COLORS.text }}>states</b>,
          converting Mealy → Moore may require splitting a single Mealy state into several Moore states — one for every distinct output value that can arrive along an incoming edge — so the output-per-state model can reproduce the same behavior.
          Converting Moore → Mealy is simpler: every Mealy transition just inherits the output already stored on its destination state, so no new states are needed.
        </div>
      </Panel>
    </div>
  );
}

/* ============================================================================
   COMPARE MACHINES
   ========================================================================== */

function ComparePage({ machines, currentMachine }) {
  const pool = useMemo(() => {
    const list = [...machines];
    if (currentMachine && !list.find((m) => m.id === currentMachine.id)) list.unshift(currentMachine);
    return list;
  }, [machines, currentMachine]);

  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [input, setInput] = useState("");
  const [runResult, setRunResult] = useState(null);

  const mA = pool.find((m) => m.id === idA);
  const mB = pool.find((m) => m.id === idB);

  function runCompare() {
    if (!mA || !mB) return;
    const rA = simulateMachine(mA, input);
    const rB = simulateMachine(mB, input);
    setRunResult({ rA, rB });
  }

  return (
    <div style={{ padding: 18, maxWidth: 1150, margin: "0 auto" }}>
      <Panel title="CHOOSE TWO MACHINES">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <select style={inputStyle} value={idA} onChange={(e) => { setIdA(e.target.value); setRunResult(null); }}>
            <option value="" disabled>Machine A…</option>
            {pool.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.type})</option>)}
          </select>
          <select style={inputStyle} value={idB} onChange={(e) => { setIdB(e.target.value); setRunResult(null); }}>
            <option value="" disabled>Machine B…</option>
            {pool.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.type})</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <TextInput value={input} onChange={(e) => { setInput(e.target.value); setRunResult(null); }} placeholder="Shared input string, e.g. 101101" style={{ fontFamily: "monospace" }} />
          <Btn variant="accent" icon={Zap} onClick={runCompare} disabled={!mA || !mB || !input}>Run Comparison</Btn>
        </div>
      </Panel>

      {runResult && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
            {[{ m: mA, r: runResult.rA, label: "A" }, { m: mB, r: runResult.rB, label: "B" }].map(({ m, r, label }) => (
              <Panel key={label} title={`MACHINE ${label} — ${m.name.toUpperCase()}`}>
                <Badge tone={m.type === "mealy" ? "accent" : "warn"}>{m.type}</Badge>
                <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.textDim }}>States: {m.states.length} · Transitions: {m.transitions.length}</div>
                {r.error ? (
                  <div style={{ color: COLORS.danger, fontSize: 12.5, marginTop: 10 }}>{r.error}</div>
                ) : (
                  <>
                    <div style={{ marginTop: 10, fontSize: 11.5, color: COLORS.textDim, fontWeight: 700 }}>OUTPUT</div>
                    <div style={{ fontFamily: "monospace", fontSize: 16, color: COLORS.accent }}>{r.outputString}</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: COLORS.textDim }}>{r.statesVisited} states visited · {r.transitionsUsed} transitions used</div>
                  </>
                )}
              </Panel>
            ))}
          </div>

          <Panel title="COMPARISON RESULT" style={{ marginTop: 14 }}>
            {runResult.rA.error || runResult.rB.error ? (
              <div style={{ color: COLORS.warn, fontSize: 12.5 }}>One or both machines could not process this input — see errors above.</div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: COLORS.textDim, marginBottom: 8 }}>
                  Note: a Moore machine's output includes the initial state's output before any input is consumed, so its output string is one symbol longer than a Mealy machine's for the same input. Compare the trailing symbols to see behavioral overlap.
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: "monospace", fontSize: 14 }}>
                  <span style={{ color: COLORS.textDim }}>A:</span> <span style={{ color: COLORS.text }}>{runResult.rA.outputString}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: "monospace", fontSize: 14, marginTop: 4 }}>
                  <span style={{ color: COLORS.textDim }}>B:</span> <span style={{ color: COLORS.text }}>{runResult.rB.outputString}</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  {runResult.rA.outputString === runResult.rB.outputString ? (
                    <Badge tone="accent">✓ Identical output strings for this input</Badge>
                  ) : (
                    <Badge tone="danger">✗ Output strings differ for this input</Badge>
                  )}
                </div>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

/* ============================================================================
   SAVED MACHINES
   ========================================================================== */

function SavedMachines({ machines, onOpen, onDelete, onDuplicate, onRename, onExport, onImport }) {
  const fileRef = useRef(null);
  return (
    <div style={{ padding: 18, maxWidth: 1150, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: COLORS.textDim }}>{machines.length} machine{machines.length !== 1 ? "s" : ""} saved</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="file" accept=".json" ref={fileRef} style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) onImport(e.target.files[0]); e.target.value = ""; }} />
          <Btn size="sm" icon={Upload} onClick={() => fileRef.current.click()}>Import JSON</Btn>
        </div>
      </div>

      {machines.length === 0 ? (
        <Panel><div style={{ color: COLORS.textDim, fontSize: 13, padding: 20, textAlign: "center" }}>No saved machines yet. Build one and click Save, or import a JSON file.</div></Panel>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
          {machines.map((m) => (
            <SavedCard key={m.id} m={m} onOpen={onOpen} onDelete={onDelete} onDuplicate={onDuplicate} onRename={onRename} onExport={onExport} />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedCard({ m, onOpen, onDelete, onDuplicate, onRename, onExport }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(m.name);
  const v = validateMachine(m);
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {editing ? (
          <TextInput value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { onRename(m.id, name); setEditing(false); }} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} autoFocus />
        ) : (
          <div onClick={() => setEditing(true)} style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, fontFamily: "monospace", cursor: "text" }}>{m.name}</div>
        )}
        <Badge tone={m.type === "mealy" ? "accent" : "warn"}>{m.type}</Badge>
      </div>
      <div style={{ fontSize: 11.5, color: COLORS.textDim, marginTop: 8, lineHeight: 1.6 }}>
        {m.states.length} states · {m.transitions.length} transitions<br />
        Created {fmtDate(m.createdAt)}<br />
        Updated {fmtDate(m.updatedAt)}
      </div>
      <div style={{ marginTop: 8 }}>
        {v.isValid ? <Badge tone="accent">Valid</Badge> : <Badge tone="danger">{v.errors.length} error{v.errors.length!==1?"s":""}</Badge>}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        <Btn size="sm" onClick={() => onOpen(m)}>Open</Btn>
        <Btn size="sm" variant="outline" icon={Copy} onClick={() => onDuplicate(m)}>Duplicate</Btn>
        <Btn size="sm" variant="outline" icon={Download} onClick={() => onExport(m)}>Export</Btn>
        <Btn size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(m.id)}>Delete</Btn>
      </div>
    </div>
  );
}

/* ============================================================================
   DOCUMENTATION
   ========================================================================== */

function Documentation() {
  return (
    <div style={{ padding: 24, maxWidth: 880, margin: "0 auto", color: COLORS.text, fontSize: 14, lineHeight: 1.75 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Documentation</h1>
      <p style={{ color: COLORS.textDim, marginBottom: 26 }}>The theory behind this simulator, in the same notation used across the app.</p>

      <Section title="What is a finite-state machine?">
        A finite-state machine (FSM) is a computational model with a finite set of states, transitions between those states triggered by input symbols, and one designated starting state. It is a foundational model in automata theory, used to describe anything from vending machines to protocol handlers.
      </Section>

      <Section title="Formal definition">
        Both Mealy and Moore machines are 6-tuples: <code style={codeInline}>M = (Q, Σ, Γ, δ, λ, q0)</code>
        <ul style={{ marginTop: 8 }}>
          <li><code style={codeInline}>Q</code> — finite set of states</li>
          <li><code style={codeInline}>Σ</code> — input alphabet</li>
          <li><code style={codeInline}>Γ</code> — output alphabet</li>
          <li><code style={codeInline}>δ</code> — transition function, <code style={codeInline}>δ: Q × Σ → Q</code></li>
          <li><code style={codeInline}>λ</code> — output function</li>
          <li><code style={codeInline}>q0</code> — initial state, <code style={codeInline}>q0 ∈ Q</code></li>
        </ul>
      </Section>

      <Section title="Mealy machine">
        In a Mealy machine, the output function is defined on transitions: <code style={codeInline}>λ: Q × Σ → Γ</code>. The output for a step depends on both the current state and the input symbol just consumed. An edge is drawn as <code style={codeInline}>input/output</code>, e.g. <code style={codeInline}>0/1</code>. Output sequence length equals input length.
      </Section>

      <Section title="Moore machine">
        In a Moore machine, the output function is defined on states: <code style={codeInline}>λ: Q → Γ</code>. Every state has a fixed output, shown as <code style={codeInline}>state/output</code>, e.g. <code style={codeInline}>q0/0</code>. This simulator reports the output of the initial state before any input is consumed, then the output of every state entered afterward — so the output sequence is one symbol longer than the input.
      </Section>

      <Section title="Mealy vs Moore">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 6 }}>
          <thead><tr>{["Aspect", "Mealy", "Moore"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {[
              ["Output depends on", "Current state + input", "Current state only"],
              ["Output location", "On transitions", "On states"],
              ["Output sequence length", "= |input|", "= |input| + 1"],
              ["Typical state count", "Fewer", "More (may need splitting)"],
              ["Response to input", "Immediate (same clock cycle)", "Delayed by one state (registered)"],
            ].map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} style={tdStyle}>{c}</td>)}</tr>)}
          </tbody>
        </table>
      </Section>

      <Section title="Mealy → Moore conversion">
        Because Mealy outputs live on edges and Moore outputs live on states, a Mealy state may need to be split into several Moore states — one per distinct output value that can arrive along an incoming edge — so a single state can carry a single fixed output. The initial state additionally gets a dedicated copy representing "before any output has been produced."
      </Section>

      <Section title="Moore → Mealy conversion">
        This direction is straightforward: for every Moore transition into state <code style={codeInline}>q'</code>, the equivalent Mealy transition's output is simply <code style={codeInline}>q'</code>'s state output. No new states are required.
      </Section>

      <Section title="Determinism & validation">
        This simulator enforces deterministic machines: at most one transition may leave a state on a given input symbol. The validator flags missing transitions (incompleteness), duplicate transitions on the same symbol (non-determinism), states unreachable from <code style={codeInline}>q0</code>, and undeclared alphabet symbols.
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: COLORS.accent }}>{title}</h2>
      <div style={{ color: COLORS.textDim }}>{children}</div>
    </div>
  );
}
const codeInline = { background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "1px 6px", fontFamily: "monospace", color: COLORS.accent, fontSize: 12.5 };
const thStyle = { textAlign: "left", padding: "7px 10px", background: COLORS.surface2, color: COLORS.textDim, fontWeight: 700, border: `1px solid ${COLORS.border}` };
const tdStyle = { padding: "7px 10px", border: `1px solid ${COLORS.border}`, color: COLORS.text };

/* ============================================================================
   ABOUT
   ========================================================================== */

function About() {
  return (
    <div style={{ padding: 24, maxWidth: 780, margin: "0 auto", color: COLORS.text }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Mealy & Moore Machine Simulator</h1>
      <p style={{ color: COLORS.textDim, fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
        An interactive educational platform for designing, simulating, converting, and comparing Mealy and Moore finite-state machines — built as a computer engineering portfolio project.
      </p>

      <Section title="Purpose">
        To make finite-state machine theory tangible: build a machine visually, run real input through it, watch outputs resolve step by step, and see the algorithmic relationship between Mealy and Moore forms.
      </Section>

      <Section title="Technology stack">
        React 18 (hooks-based components), a hand-built SVG state-graph canvas, and browser-persistent storage for saved machines. All simulation, validation, and conversion logic is computed client-side from the actual machine data — nothing shown in the graph, table, or simulator is hard-coded or faked.
      </Section>

      <Section title="Core features">
        <ul>
          <li>Visual state/transition editor with drag-to-position, initial/final markers</li>
          <li>Deterministic-machine validation with errors and warnings</li>
          <li>Step-by-step and full-run simulation with a live timeline table</li>
          <li>Real Mealy ⇄ Moore conversion algorithms with a visible step log</li>
          <li>Side-by-side machine comparison on shared input</li>
          <li>Save, duplicate, rename, delete, import and export machines as JSON</li>
          <li>Prebuilt example machines covering common automata-theory exercises</li>
        </ul>
      </Section>

      <Section title="Developer">
        Prachi Ankush — B.Tech Computer Engineering (Software Engineering), Vishwakarma Institute of Technology, Pune.
      </Section>
    </div>
  );
}

/* ============================================================================
   ROOT APP
   ========================================================================== */

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [machines, setMachines] = useState([]);
  const [currentMachine, setCurrentMachine] = useState(null);
  const [simHistory, setSimHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadMachinesFromStorage().then((m) => { setMachines(m); setLoaded(true); });
  }, []);

  useEffect(() => {
    if (loaded) saveMachinesToStorage(machines);
  }, [machines, loaded]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function handleCreate(type) {
    const m = createEmptyMachine(type);
    setCurrentMachine(m);
    setPage("builder");
  }

  function handleOpen(m) {
    setCurrentMachine(deepClone(m));
    setPage("builder");
  }

  function handleSave() {
    if (!currentMachine) return;
    setMachines((prev) => {
      const exists = prev.find((m) => m.id === currentMachine.id);
      const updated = { ...currentMachine, updatedAt: nowISO() };
      if (exists) return prev.map((m) => (m.id === updated.id ? updated : m));
      return [...prev, updated];
    });
    showToast(`Saved "${currentMachine.name}"`);
  }

  function handleExport(m) {
    const target = m || currentMachine;
    if (!target) return;
    const data = JSON.stringify(target, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${target.name.replace(/\s+/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImport(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.states || !parsed.type || !parsed.transitions) throw new Error("Missing required fields (states, type, transitions).");
        const m = {
          ...parsed,
          id: uid("m"),
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        setMachines((prev) => [...prev, m]);
        showToast(`Imported "${m.name}"`);
      } catch (err) {
        showToast(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  function handleDelete(id) {
    setMachines((prev) => prev.filter((m) => m.id !== id));
    if (currentMachine?.id === id) setCurrentMachine(null);
  }

  function handleDuplicate(m) {
    const copy = { ...deepClone(m), id: uid("m"), name: `${m.name} (copy)`, createdAt: nowISO(), updatedAt: nowISO() };
    setMachines((prev) => [...prev, copy]);
    showToast(`Duplicated as "${copy.name}"`);
  }

  function handleRename(id, name) {
    setMachines((prev) => prev.map((m) => (m.id === id ? { ...m, name, updatedAt: nowISO() } : m)));
  }

  function handleLoadExample(index) {
    const ex = buildExample(EXAMPLE_DEFS[index]);
    setCurrentMachine(ex);
  }

  function handleSaveConverted(newMachine) {
    setMachines((prev) => [...prev, newMachine]);
    setCurrentMachine(newMachine);
    showToast(`Saved converted machine "${newMachine.name}"`);
    setPage("builder");
  }

  function logHistory(entry) {
    setSimHistory((prev) => [entry, ...prev].slice(0, 30));
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: COLORS.bg, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", overflow: "hidden" }}>
      <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Navbar currentMachine={currentMachine} onSave={handleSave} onExport={() => handleExport()} page={page} />
        <div style={{ flex: 1, overflowY: "auto" }}>
          {page === "dashboard" && <Dashboard machines={machines} simHistory={simHistory} onCreate={handleCreate} onOpen={handleOpen} goPage={setPage} />}
          {page === "builder" && (
            currentMachine ? (
              <MachineBuilder machine={currentMachine} setMachine={setCurrentMachine} onLoadExample={handleLoadExample} />
            ) : (
              <EmptyState onCreate={handleCreate} />
            )
          )}
          {page === "simulator" && <Simulator machine={currentMachine} onLogHistory={logHistory} />}
          {page === "conversion" && <ConversionLab machines={machines} currentMachine={currentMachine} onSaveConverted={handleSaveConverted} />}
          {page === "compare" && <ComparePage machines={machines} currentMachine={currentMachine} />}
          {page === "saved" && <SavedMachines machines={machines} onOpen={handleOpen} onDelete={handleDelete} onDuplicate={handleDuplicate} onRename={handleRename} onExport={handleExport} onImport={handleImport} />}
          {page === "docs" && <Documentation />}
          {page === "about" && <About />}
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: COLORS.surface2, border: `1px solid ${COLORS.accent}`, color: COLORS.text, padding: "10px 16px", borderRadius: 8, fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={15} color={COLORS.accent} /> {toast}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: COLORS.textDim }}>
      <GitBranch size={36} color={COLORS.border} />
      <div style={{ fontSize: 14 }}>No machine is open right now.</div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="accent" icon={Plus} onClick={() => onCreate("mealy")}>Create Mealy Machine</Btn>
        <Btn variant="outline" icon={Plus} onClick={() => onCreate("moore")}>Create Moore Machine</Btn>
      </div>
    </div>
  );
}

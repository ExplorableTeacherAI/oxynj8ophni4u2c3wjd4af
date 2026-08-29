import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type ReactElement,
} from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineFormula,
    InlineLinkedHighlight,
    InteractionHintSequence,
    Table,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp } from "@/lib/motion";
import {
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
} from "../variables";

/* ────────────────────────────────────────────────────────────────────────────
 * Bespoke figure — a circle puzzle solved one corner at a time.
 *
 * Six points sit on the rim. Points 0 and 3 are the ends of a chord; point 1
 * stands on it and shows its size; points 2, 4 and 5 are hidden behind the
 * letters a, b and c. Clicking a letter picks that corner, and the answer is
 * checked only when the student submits it, so a single given angle unlocks the
 * whole circle: a copies the given corner, b faces it across the quadrilateral,
 * and c copies b. Once all three are found every point becomes draggable.
 *
 * Positions are multiples of ten degrees, so every angle is a multiple of five.
 * ──────────────────────────────────────────────────────────────────────────── */

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 500;
const CENTER_X = 300;
const CENTER_Y = 255;
const RADIUS = 150;
const PAD = 24;

const ACCENT = "#62D0AD";
const INK_STRONG = "#334155";
const INK_SOFT = "#64748B";
const MUTED = "#94A3B8";

const DEFAULT_POINTS = [20, 80, 140, 190, 250, 310];
const CHORD_START = 0;
const GIVEN_CORNER = 1;
const CHORD_END = 3;
const HIDDEN_CORNERS = [2, 4, 5];
const LETTERS: Record<number, string> = { 2: "a", 4: "b", 5: "c" };

const SAME_SEGMENT = "sameSegment";
const CYCLIC_QUAD = "cyclicQuad";

/** Which rule links each hidden corner back to something already known. */
const NUDGES: Record<number, string> = {
    2: "a stands on the same chord as the given corner, on the same side of it.",
    4: "b faces the given corner across the four-sided shape.",
    5: "c stands on the same chord as b, on the same side of it.",
};

const formatDegrees = (value: number) => `${Math.round(value)}°`;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const norm360 = (degrees: number) => ((degrees % 360) + 360) % 360;

const rimPoint = (degrees: number): [number, number] => [
    CENTER_X + RADIUS * Math.cos(toRadians(degrees)),
    CENTER_Y - RADIUS * Math.sin(toRadians(degrees)),
];

const clampLabelX = (x: number, halfWidth: number) =>
    clamp(x, PAD + halfWidth, VIEW_WIDTH - PAD - halfWidth);
const clampLabelY = (y: number) => clamp(y, 58, 440);

const unitTo = (from: [number, number], to: [number, number]): [number, number] => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy) || 1;
    return [dx / length, dy / length];
};

const angleBetween = (one: [number, number], two: [number, number]) =>
    (Math.acos(clamp(one[0] * two[0] + one[1] * two[1], -1, 1)) * 180) / Math.PI;

const cornerMarkerPath = (
    vertex: [number, number],
    armOne: [number, number],
    armTwo: [number, number],
    markerRadius: number,
) => {
    const cross = armOne[0] * armTwo[1] - armOne[1] * armTwo[0];
    return (
        `M ${vertex[0] + markerRadius * armOne[0]} ${vertex[1] + markerRadius * armOne[1]} ` +
        `A ${markerRadius} ${markerRadius} 0 0 ${cross > 0 ? 1 : 0} ` +
        `${vertex[0] + markerRadius * armTwo[0]} ${vertex[1] + markerRadius * armTwo[1]}`
    );
};

/** Corner 2 pairs with the given corner under the first rule, corner 4 under the second. */
const groupOf = (index: number) =>
    index === 2 ? SAME_SEGMENT : index === 4 ? CYCLIC_QUAD : null;

const NO_POINTS: number[] = [];
const NO_SOLVED: number[] = [];

/** Every hidden corner and the given one stand on the same chord, so one helper
 *  serves them all. */
const angleReaderFor = (points: [number, number][]) => (index: number) =>
    angleBetween(
        unitTo(points[index], points[CHORD_START]),
        unitTo(points[index], points[CHORD_END]),
    );

function PuzzleDrawing() {
    const setVar = useSetVar();
    const positions = useVar<number[]>("bothRulesPoints", NO_POINTS);
    const selected = useVar<number>("puzzleSelected", -1);
    const solved = useVar<number[]>("puzzleSolved", NO_SOLVED);
    const solvedCount = useVar<number>("puzzleSolvedCount", 0);
    const highlight = useVar<string>("bothRulesHighlight", "");
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<number | null>(null);

    const points = (positions.length === 6 ? positions : DEFAULT_POINTS).map(rimPoint);
    const angleAt = angleReaderFor(points);
    const allFound = solved.length >= HIDDEN_CORNERS.length;

    // Writing 0 to the count variable (reset button, guided hints) clears the puzzle.
    useEffect(() => {
        if (solvedCount === 0 && solved.length > 0) {
            setVar("puzzleSolved", []);
            setVar("puzzleSelected", -1);
            setVar("puzzleFeedback", "");
        }
    }, [solvedCount, solved.length, setVar]);

    const toViewBox = useCallback((clientX: number, clientY: number): [number, number] => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return [CENTER_X, CENTER_Y];
        return [
            ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
            ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
        ];
    }, []);

    const handleDrag = (index: number) => (event: ReactPointerEvent<SVGCircleElement>) => {
        if (dragging !== index) return;
        const [x, y] = toViewBox(event.clientX, event.clientY);
        const pointerDegrees = (Math.atan2(CENTER_Y - y, x - CENTER_X) * 180) / Math.PI;
        const current = positions.length === 6 ? positions : DEFAULT_POINTS;
        const previous = current[(index + 5) % 6];
        const span = norm360(current[(index + 1) % 6] - previous);
        const offset = clamp(norm360(pointerDegrees - previous), 12, span - 12);
        const next = [...current];
        next[index] = norm360(Math.round((previous + offset) / 10) * 10);
        setVar("bothRulesPoints", next);
    };

    const dimFor = (index: number) => {
        if (highlight === "") return 1;
        if (index === GIVEN_CORNER) return 1;
        return groupOf(index) === highlight ? 1 : 0.3;
    };
    const litFor = (index: number) =>
        highlight !== "" && (index === GIVEN_CORNER || groupOf(index) === highlight);
    const neutralOpacity = highlight === "" ? 1 : 0.3;
    const eased = { transition: "opacity 150ms ease-out, stroke-width 150ms ease-out" };

    const hoverProps = (index: number) => {
        const group = groupOf(index);
        if (!group) return {};
        return {
            onPointerEnter: () => setVar("bothRulesHighlight", group),
            onPointerLeave: () => setVar("bothRulesHighlight", ""),
        };
    };

    const statusLine = allFound
        ? "All three found. Drag any point to see both rules keep working."
        : selected >= 0
          ? `Working on ${LETTERS[selected]} — set your answer below and check it.`
          : "One corner is given. Click a letter to work that corner out.";

    const foundLine = [
        `given ${formatDegrees(angleAt(GIVEN_CORNER))}`,
        ...HIDDEN_CORNERS.filter((index) => solved.includes(index)).map(
            (index) => `${LETTERS[index]} = ${formatDegrees(angleAt(index))}`,
        ),
    ].join("   ·   ");

    const renderCorner = (index: number) => {
        const vertex = points[index];
        const isSolved = index === GIVEN_CORNER || solved.includes(index);
        const isSelected = selected === index;
        const lit = litFor(index);
        const outward = unitTo([CENTER_X, CENTER_Y], vertex);
        const text = isSolved ? formatDegrees(angleAt(index)) : LETTERS[index];
        const labelX = clampLabelX(vertex[0] + outward[0] * 34, 24);
        const labelY = clampLabelY(vertex[1] + outward[1] * 34 + 5);
        const armColor = isSolved ? ACCENT : MUTED;
        return (
            <g key={`corner-${index}`} opacity={dimFor(index)} style={eased}>
                {lit && (
                    <>
                        <line x1={vertex[0]} y1={vertex[1]} x2={points[CHORD_START][0]} y2={points[CHORD_START][1]} stroke={ACCENT} strokeWidth="10" strokeLinecap="round" opacity={0.28} />
                        <line x1={vertex[0]} y1={vertex[1]} x2={points[CHORD_END][0]} y2={points[CHORD_END][1]} stroke={ACCENT} strokeWidth="10" strokeLinecap="round" opacity={0.28} />
                    </>
                )}
                <line
                    x1={vertex[0]}
                    y1={vertex[1]}
                    x2={points[CHORD_START][0]}
                    y2={points[CHORD_START][1]}
                    stroke={armColor}
                    strokeWidth={lit ? 5 : 3}
                    strokeLinecap="round"
                    style={eased}
                    {...hoverProps(index)}
                />
                <line
                    x1={vertex[0]}
                    y1={vertex[1]}
                    x2={points[CHORD_END][0]}
                    y2={points[CHORD_END][1]}
                    stroke={armColor}
                    strokeWidth={lit ? 5 : 3}
                    strokeLinecap="round"
                    style={eased}
                    {...hoverProps(index)}
                />
                <path
                    d={cornerMarkerPath(
                        vertex,
                        unitTo(vertex, points[CHORD_START]),
                        unitTo(vertex, points[CHORD_END]),
                        26,
                    )}
                    fill="none"
                    stroke={armColor}
                    strokeWidth={lit ? 4 : 2}
                    style={eased}
                    pointerEvents="none"
                />
                {isSelected && !isSolved && (
                    <circle cx={labelX} cy={labelY - 5} r="17" fill="none" stroke={ACCENT} strokeWidth="2" />
                )}
                <text
                    x={labelX}
                    y={labelY}
                    fontSize="15"
                    fontWeight={isSolved ? 400 : 600}
                    textAnchor="middle"
                    fill={isSolved ? ACCENT : INK_STRONG}
                    pointerEvents="none"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {text}
                </text>
                {!isSolved && (
                    <circle
                        cx={labelX}
                        cy={labelY - 5}
                        r={20}
                        fill="transparent"
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                            setVar("puzzleSelected", index);
                            setVar("puzzleFeedback", "");
                        }}
                    />
                )}
                <circle
                    cx={vertex[0]}
                    cy={vertex[1]}
                    r={dragging === index ? 11 : 8}
                    fill={isSolved ? ACCENT : MUTED}
                    filter="url(#puzzle-dot-shadow)"
                    pointerEvents="none"
                />
            </g>
        );
    };

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full"
            style={{ touchAction: "none" }}
        >
            <defs>
                <filter id="puzzle-dot-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <text x={PAD} y={30} fontSize="13" fill={allFound ? ACCENT : INK_SOFT}>
                {statusLine}
            </text>

            <text
                x={PAD}
                y={472}
                fontSize="13"
                fill={ACCENT}
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {foundLine}
            </text>

            {/* Rim */}
            <g opacity={neutralOpacity} style={eased} pointerEvents="none">
                <circle cx={CENTER_X} cy={CENTER_Y} r={RADIUS} fill="none" stroke={INK_SOFT} strokeWidth="2" />
            </g>

            {/* The chord every corner in the puzzle stands on */}
            <g opacity={neutralOpacity} style={eased} pointerEvents="none">
                <line
                    x1={points[CHORD_START][0]}
                    y1={points[CHORD_START][1]}
                    x2={points[CHORD_END][0]}
                    y2={points[CHORD_END][1]}
                    stroke={INK_STRONG}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
            </g>

            {[GIVEN_CORNER, ...HIDDEN_CORNERS].map(renderCorner)}

            {/* Once the puzzle is out, every point can be moved */}
            {allFound &&
                points.map((position, index) => (
                    <circle
                        key={`drag-${index}`}
                        cx={position[0]}
                        cy={position[1]}
                        r={22}
                        fill="transparent"
                        style={{ cursor: dragging === index ? "grabbing" : "grab" }}
                        onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            setDragging(index);
                        }}
                        onPointerMove={handleDrag(index)}
                        onPointerUp={() => setDragging(null)}
                        onPointerCancel={() => setDragging(null)}
                    />
                ))}
        </svg>
    );
}

function PuzzleControls() {
    const setVar = useSetVar();
    const positions = useVar<number[]>("bothRulesPoints", NO_POINTS);
    const selected = useVar<number>("puzzleSelected", -1);
    const trial = useVar<number>("puzzleTrial", 90);
    const solved = useVar<number[]>("puzzleSolved", NO_SOLVED);
    const feedback = useVar<string>("puzzleFeedback", "");

    const points = (positions.length === 6 ? positions : DEFAULT_POINTS).map(rimPoint);
    const angleAt = angleReaderFor(points);
    const allFound = solved.length >= HIDDEN_CORNERS.length;

    if (allFound) {
        return (
            <div className="px-6 pb-5 text-sm text-slate-500">
                Every corner came from the one that was given. Drag any point around the rim and
                watch both rules survive the move.
            </div>
        );
    }

    if (selected < 0) {
        return (
            <div className="px-6 pb-5 text-sm text-slate-500">
                Click one of the letters in the circle to start on that corner.
            </div>
        );
    }

    const step = (delta: number) =>
        setVar("puzzleTrial", clamp(trial + delta, 5, 175));

    const check = () => {
        if (Math.round(angleAt(selected)) === trial) {
            setVar("puzzleSolved", [...solved, selected]);
            setVar("puzzleSolvedCount", solved.length + 1);
            setVar("puzzleSelected", -1);
            setVar("puzzleFeedback", "");
        } else {
            setVar("puzzleFeedback", "wrong");
        }
    };

    return (
        <div className="px-6 pb-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span>Your answer for {LETTERS[selected]}:</span>
                <button
                    type="button"
                    onClick={() => step(-5)}
                    className="h-7 w-7 rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                    aria-label="Smaller"
                >
                    −
                </button>
                <span
                    className="min-w-[3.5rem] text-center text-base font-medium text-slate-700"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {formatDegrees(trial)}
                </span>
                <button
                    type="button"
                    onClick={() => step(5)}
                    className="h-7 w-7 rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                    aria-label="Bigger"
                >
                    +
                </button>
                <button
                    type="button"
                    onClick={check}
                    className="rounded-full px-4 py-1 font-medium transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "rgba(98, 208, 173, 0.22)", color: "#0F766E" }}
                >
                    Check
                </button>
            </div>
            {feedback === "wrong" && (
                <div className="pt-2 text-sm" style={{ color: "#B45309" }}>
                    Not that one. {NUDGES[selected]}
                </div>
            )}
        </div>
    );
}

function BothRulesFigure() {
    const setVar = useSetVar();
    const solvedCount = useVar<number>("puzzleSolvedCount", 0);

    return (
        <Figure
            id="both-rules-circle-puzzle"
            caption="One corner is given and the rest hide behind letters. Click a letter, set the size you have worked out and check it: each rule unlocks the next corner, and once all three are found every point can be dragged."
            onReset={() => {
                setVar("bothRulesPoints", DEFAULT_POINTS);
                setVar("puzzleSolved", []);
                setVar("puzzleSolvedCount", 0);
                setVar("puzzleSelected", -1);
                setVar("puzzleTrial", 90);
                setVar("puzzleFeedback", "");
                setVar("bothRulesHighlight", "");
            }}
        >
            <PuzzleDrawing />
            <PuzzleControls />
            <InteractionHintSequence
                hintKey="both-rules-circle-puzzle"
                currentStep={solvedCount > 0 ? 1 : 0}
                steps={[
                    {
                        gesture: "click",
                        label: "Click the letter a to start on that corner",
                        position: { x: "27%", y: "27%" },
                    },
                    {
                        gesture: "click",
                        label: "Now click another letter and work that corner out",
                        position: { x: "40%", y: "86%" },
                    },
                ]}
            />
        </Figure>
    );
}

export const bothTheoremsTogetherBlocks: ReactElement[] = [
    <StackLayout key="layout-both-theorems-heading" maxWidth="xl">
        <Block id="both-theorems-heading" padding="md">
            <EditableH2 id="h2-both-theorems-heading" blockId="both-theorems-heading">
                Both Theorems Together
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-both-theorems-summary" maxWidth="xl">
        <Block id="both-theorems-summary" padding="sm">
            <EditableParagraph id="para-both-theorems-summary" blockId="both-theorems-summary">
                Two rules, and that is the whole toolkit. In the circle below only one corner
                shows its size and the rest hide behind letters, so each answer you find hands you
                the next one.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-both-theorems-visual" maxWidth="xl">
        <Block id="both-theorems-visual" padding="sm" hasVisualization>
            <BothRulesFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-both-theorems-method" maxWidth="xl">
        <Block id="both-theorems-method" padding="sm">
            <EditableParagraph id="para-both-theorems-method" blockId="both-theorems-method">
                So the job in any question is spotting which rule links the angle you are given to
                the one you want. Two angles that{" "}
                <InlineLinkedHighlight
                    id="highlight-both-theorems-same-segment"
                    varName="bothRulesHighlight"
                    highlightId="sameSegment"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('bothRulesHighlight'))}
                >
                    stand on the same chord from the same side
                </InlineLinkedHighlight>{" "}
                simply match, while two that are{" "}
                <InlineLinkedHighlight
                    id="highlight-both-theorems-cyclic"
                    varName="bothRulesHighlight"
                    highlightId="cyclicQuad"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('bothRulesHighlight'))}
                >
                    facing corners of a four-sided shape
                </InlineLinkedHighlight>{" "}
                add to 180.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-both-theorems-worked-example" maxWidth="xl">
        <Block id="both-theorems-worked-example" padding="sm">
            <EditableParagraph id="para-both-theorems-worked-example" blockId="both-theorems-worked-example">
                Worked through: a corner of 95 degrees stands on the chord, so its partner on the
                same arc is 95 as well, and the corner facing it across the quadrilateral has to be
                85.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-both-theorems-formula-table" maxWidth="xl">
        <Block id="both-theorems-formula-table" padding="sm">
            <Table
                columns={[
                    { header: 'Rule', align: 'left' },
                    { header: 'In symbols', align: 'center', width: 210 },
                    { header: 'What it says', align: 'left' },
                ]}
                rows={[
                    {
                        cells: [
                            'Angles in the same segment',
                            <InlineFormula
                                key="formula-same-segment"
                                latex="\angle ABD = \angle ACD"
                                colorMap={{}}
                            />,
                            'Two corners standing on the same chord from the same side are equal',
                        ],
                    },
                    {
                        cells: [
                            'Opposite corners of a cyclic quadrilateral',
                            <InlineFormula
                                key="formula-cyclic-quadrilateral"
                                latex="\angle A + \angle C = 180^\circ"
                                colorMap={{}}
                            />,
                            'Corners facing each other across the shape add to 180 degrees',
                        ],
                    },
                    {
                        cells: [
                            'All four corners together',
                            <InlineFormula
                                key="formula-corner-total"
                                latex="\angle A + \angle B + \angle C + \angle D = 360^\circ"
                                colorMap={{}}
                            />,
                            'Two facing pairs, each worth 180, so the whole shape comes to 360',
                        ],
                    },
                ]}
                color="#62D0AD"
                caption="The two circle rules, and the total that follows from them."
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-both-theorems-question-same-segment" maxWidth="xl">
        <Block id="both-theorems-question-same-segment" padding="md">
            <EditableParagraph id="para-both-theorems-question-same-segment" blockId="both-theorems-question-same-segment">
                Two corners stand on one chord from the same side, and the first measures 47
                degrees. In degrees, the second measures{" "}
                <InlineFeedback
                    varName="answerSummarySameSegment"
                    correctValue={["47", "47°"]}
                    position="terminal"
                    successMessage="— yes, same chord and same side means the two simply copy each other"
                    failureMessage="— have another look."
                    hint="Nothing is added here; corners on the same arc take the same value"
                    reviewBlockId="both-theorems-method"
                    reviewLabel="Check which rule applies"
                >
                    <InlineClozeInput
                        varName="answerSummarySameSegment"
                        correctAnswer={["47", "47°"]}
                        {...clozePropsFromDefinition(getVariableInfo('answerSummarySameSegment'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-both-theorems-question-cyclic" maxWidth="xl">
        <Block id="both-theorems-question-cyclic" padding="md">
            <EditableParagraph id="para-both-theorems-question-cyclic" blockId="both-theorems-question-cyclic">
                A cyclic quadrilateral has a corner of 120 degrees. In degrees, the corner facing it
                across the shape measures{" "}
                <InlineFeedback
                    varName="answerSummaryCyclic"
                    correctValue={["60", "60°"]}
                    position="terminal"
                    successMessage="— correct, facing corners share 180 between them, so 180 minus 120 is what is left"
                    failureMessage="— not quite."
                    hint="Facing corners add to 180, so take the given corner away from it"
                    reviewBlockId="both-theorems-method"
                    reviewLabel="Check which rule applies"
                >
                    <InlineClozeInput
                        varName="answerSummaryCyclic"
                        correctAnswer={["60", "60°"]}
                        {...clozePropsFromDefinition(getVariableInfo('answerSummaryCyclic'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-both-theorems-question-combined" maxWidth="xl">
        <Block id="both-theorems-question-combined" padding="md">
            <EditableParagraph id="para-both-theorems-question-combined" blockId="both-theorems-question-combined">
                Now both rules at once. A corner of 68 degrees stands on a chord, a second corner
                stands on that same chord from the same side, and a third faces that second corner
                across a cyclic quadrilateral. In degrees, the third corner measures{" "}
                <InlineFeedback
                    varName="answerSummaryCombined"
                    correctValue={["112", "112°"]}
                    position="terminal"
                    successMessage="— excellent, the second corner copies the 68, and the third takes what is left of 180"
                    failureMessage="— two steps here."
                    hint="First carry the 68 across to the second corner, then use 180 for the facing pair"
                    visualizationHint={{
                        blockId: "both-theorems-visual",
                        hintKey: "feedback-both-theorems-combined",
                        label: "Discover it yourself",
                        resetVars: { puzzleSolvedCount: 0 },
                        steps: [
                            {
                                gesture: "click",
                                label: "Click the letter a and carry the given corner across to it",
                                position: { x: "27%", y: "27%" },
                                completionVar: "puzzleSolvedCount",
                                completionValue: 1,
                                completionTolerance: 0.4,
                            },
                            {
                                gesture: "click",
                                label: "Now click b, the corner facing the given one, and use 180",
                                position: { x: "40%", y: "86%" },
                                completionVar: "puzzleSolvedCount",
                                completionValue: 2,
                                completionTolerance: 0.4,
                            },
                        ],
                    }}
                >
                    <InlineClozeInput
                        varName="answerSummaryCombined"
                        correctAnswer={["112", "112°"]}
                        {...clozePropsFromDefinition(getVariableInfo('answerSummaryCombined'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];

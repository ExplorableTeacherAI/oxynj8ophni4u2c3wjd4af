import {
    useCallback,
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
 * Bespoke figure — one circle carrying both rules.
 *
 * Five points sit on the rim. Points 0 and 3 are the ends of a chord; points 1
 * and 2 stand on that chord from the same side; point 4 completes a cyclic
 * quadrilateral on the other arc. Point 1 belongs to BOTH rules, which is the
 * whole idea: tapping a rule's name lights the angles it governs and dims the
 * rest, and every point can be dragged around the rim.
 *
 * Positions snap to even degrees so every inscribed angle is a whole number and
 * the facing pair reads exactly 180.
 * ──────────────────────────────────────────────────────────────────────────── */

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 500;
const CENTER_X = 300;
const CENTER_Y = 265;
const RADIUS = 150;
const PAD = 24;

const ACCENT = "#62D0AD";
const INK_STRONG = "#334155";
const INK_SOFT = "#64748B";
const MUTED = "#94A3B8";

const DEFAULT_POINTS = [20, 76, 140, 190, 290];
const CHORD_START = 0;
const SHARED_CORNER = 1;
const SAME_SIDE_CORNER = 2;
const CHORD_END = 3;
const FACING_CORNER = 4;

const SAME_SEGMENT = "sameSegment";
const CYCLIC_QUAD = "cyclicQuad";

const formatDegrees = (value: number) => `${Math.round(value)}°`;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const norm360 = (degrees: number) => ((degrees % 360) + 360) % 360;

const rimPoint = (degrees: number): [number, number] => [
    CENTER_X + RADIUS * Math.cos(toRadians(degrees)),
    CENTER_Y - RADIUS * Math.sin(toRadians(degrees)),
];

const clampLabelX = (x: number, halfWidth: number) =>
    clamp(x, PAD + halfWidth, VIEW_WIDTH - PAD - halfWidth);
const clampLabelY = (y: number) => clamp(y, 82, 438);

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

function BothRulesDrawing() {
    const setVar = useSetVar();
    const positions = useVar<number[]>("bothRulesPoints", DEFAULT_POINTS);
    const mode = useVar<number>("bothRulesMode", 0);
    const highlight = useVar<string>("bothRulesHighlight", "");
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<number | null>(null);

    const points = positions.map(rimPoint);
    const activeGroup = highlight !== "" ? highlight : mode === 1 ? CYCLIC_QUAD : SAME_SEGMENT;
    const hovering = highlight !== "";

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
        const count = positions.length;
        const previous = positions[(index + count - 1) % count];
        const span = norm360(positions[(index + 1) % count] - previous);
        const offset = clamp(norm360(pointerDegrees - previous), 12, span - 12);
        const next = [...positions];
        next[index] = norm360(Math.round((previous + offset) / 2) * 2);
        setVar("bothRulesPoints", next);
    };

    const cornerAngle = (vertex: number, armA: number, armB: number) =>
        angleBetween(unitTo(points[vertex], points[armA]), unitTo(points[vertex], points[armB]));

    const sharedAngle = cornerAngle(SHARED_CORNER, CHORD_START, CHORD_END);
    const sameSideAngle = cornerAngle(SAME_SIDE_CORNER, CHORD_START, CHORD_END);
    const facingAngle = cornerAngle(FACING_CORNER, CHORD_END, CHORD_START);

    const groupOpacity = (group: string) => (group === activeGroup ? 1 : 0.35);
    const neutralOpacity = hovering ? 0.35 : 1;
    const popped = (group: string) => hovering && highlight === group;
    const eased = { transition: "opacity 150ms ease-out, stroke-width 150ms ease-out" };

    const hoverProps = (group: string) => ({
        onPointerEnter: () => setVar("bothRulesHighlight", group),
        onPointerLeave: () => setVar("bothRulesHighlight", ""),
    });

    const armLine = (
        key: string,
        from: number,
        to: number,
        group: string | null,
        width: number,
    ) => (
        <line
            key={key}
            x1={points[from][0]}
            y1={points[from][1]}
            x2={points[to][0]}
            y2={points[to][1]}
            stroke={ACCENT}
            strokeWidth={width}
            strokeLinecap="round"
            style={eased}
            {...(group ? hoverProps(group) : {})}
        />
    );

    const haloLine = (key: string, from: number, to: number) => (
        <line
            key={key}
            x1={points[from][0]}
            y1={points[from][1]}
            x2={points[to][0]}
            y2={points[to][1]}
            stroke={ACCENT}
            strokeWidth="10"
            strokeLinecap="round"
            opacity={0.28}
            pointerEvents="none"
        />
    );

    const readout =
        activeGroup === CYCLIC_QUAD
            ? `Facing corners: ${formatDegrees(sharedAngle)} + ${formatDegrees(
                  facingAngle,
              )} = ${formatDegrees(sharedAngle + facingAngle)}`
            : `Same arc, same chord: ${formatDegrees(sharedAngle)} and ${formatDegrees(
                  sameSideAngle,
              )}`;

    const ruleLabel = (group: string, y: number, text: string) => {
        const isActive = activeGroup === group;
        return (
            <g
                style={{ cursor: "pointer" }}
                onClick={() => setVar("bothRulesMode", group === CYCLIC_QUAD ? 1 : 0)}
                {...hoverProps(group)}
            >
                <circle
                    cx={PAD + 5}
                    cy={y - 4}
                    r={isActive ? 5 : 3.5}
                    fill={isActive ? ACCENT : MUTED}
                    style={{ transition: "fill 150ms ease-out, r 150ms ease-out" }}
                />
                <text
                    x={PAD + 18}
                    y={y}
                    fontSize="13"
                    fill={isActive ? ACCENT : MUTED}
                    fontWeight={isActive ? 600 : 400}
                    style={{ transition: "fill 150ms ease-out" }}
                >
                    {text}
                </text>
            </g>
        );
    };

    const cornerLabel = (index: number, value: number, group: string | null) => {
        const vertex = points[index];
        const outward = unitTo([CENTER_X, CENTER_Y], vertex);
        return (
            <text
                x={clampLabelX(vertex[0] + outward[0] * 34, 24)}
                y={clampLabelY(vertex[1] + outward[1] * 34 + 5)}
                fontSize="15"
                textAnchor="middle"
                fill={group === null || group === activeGroup ? ACCENT : MUTED}
                pointerEvents="none"
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {formatDegrees(value)}
            </text>
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
                <filter id="both-rules-dot-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {ruleLabel(SAME_SEGMENT, 30, "Angles in the same segment")}
            {ruleLabel(CYCLIC_QUAD, 52, "Opposite corners of a cyclic quadrilateral")}

            <text
                x={PAD}
                y={470}
                fontSize="13"
                fill={ACCENT}
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {readout}
            </text>

            {/* Rim */}
            <g opacity={neutralOpacity} style={eased} pointerEvents="none">
                <circle cx={CENTER_X} cy={CENTER_Y} r={RADIUS} fill="none" stroke={INK_SOFT} strokeWidth="2" />
            </g>

            {/* The chord — the same line the quadrilateral uses as its diagonal */}
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

            {/* Sides of the quadrilateral that only the second rule needs */}
            <g opacity={groupOpacity(CYCLIC_QUAD)} style={eased}>
                {popped(CYCLIC_QUAD) && haloLine("halo-facing-one", FACING_CORNER, CHORD_END)}
                {popped(CYCLIC_QUAD) && haloLine("halo-facing-two", FACING_CORNER, CHORD_START)}
                {armLine("facing-one", FACING_CORNER, CHORD_END, CYCLIC_QUAD, popped(CYCLIC_QUAD) ? 5 : 3)}
                {armLine("facing-two", FACING_CORNER, CHORD_START, CYCLIC_QUAD, popped(CYCLIC_QUAD) ? 5 : 3)}
                <path
                    d={cornerMarkerPath(
                        points[FACING_CORNER],
                        unitTo(points[FACING_CORNER], points[CHORD_END]),
                        unitTo(points[FACING_CORNER], points[CHORD_START]),
                        28,
                    )}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth={popped(CYCLIC_QUAD) ? 4 : 2}
                    style={eased}
                    pointerEvents="none"
                />
                {cornerLabel(FACING_CORNER, facingAngle, CYCLIC_QUAD)}
            </g>

            {/* Arms that only the first rule needs */}
            <g opacity={groupOpacity(SAME_SEGMENT)} style={eased}>
                {popped(SAME_SEGMENT) && haloLine("halo-same-one", SAME_SIDE_CORNER, CHORD_START)}
                {popped(SAME_SEGMENT) && haloLine("halo-same-two", SAME_SIDE_CORNER, CHORD_END)}
                {armLine("same-one", SAME_SIDE_CORNER, CHORD_START, SAME_SEGMENT, popped(SAME_SEGMENT) ? 5 : 3)}
                {armLine("same-two", SAME_SIDE_CORNER, CHORD_END, SAME_SEGMENT, popped(SAME_SEGMENT) ? 5 : 3)}
                <path
                    d={cornerMarkerPath(
                        points[SAME_SIDE_CORNER],
                        unitTo(points[SAME_SIDE_CORNER], points[CHORD_START]),
                        unitTo(points[SAME_SIDE_CORNER], points[CHORD_END]),
                        28,
                    )}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth={popped(SAME_SEGMENT) ? 4 : 2}
                    style={eased}
                    pointerEvents="none"
                />
                {cornerLabel(SAME_SIDE_CORNER, sameSideAngle, SAME_SEGMENT)}
            </g>

            {/* The corner both rules share */}
            <g style={eased}>
                {hovering && haloLine("halo-shared-one", SHARED_CORNER, CHORD_START)}
                {hovering && haloLine("halo-shared-two", SHARED_CORNER, CHORD_END)}
                {armLine("shared-one", SHARED_CORNER, CHORD_START, null, hovering ? 5 : 3)}
                {armLine("shared-two", SHARED_CORNER, CHORD_END, null, hovering ? 5 : 3)}
                <path
                    d={cornerMarkerPath(
                        points[SHARED_CORNER],
                        unitTo(points[SHARED_CORNER], points[CHORD_START]),
                        unitTo(points[SHARED_CORNER], points[CHORD_END]),
                        28,
                    )}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth={hovering ? 4 : 2}
                    style={eased}
                    pointerEvents="none"
                />
                {cornerLabel(SHARED_CORNER, sharedAngle, null)}
            </g>

            {/* Every point is draggable */}
            {positions.map((_, index) => {
                const [x, y] = points[index];
                return (
                    <g key={`point-${index}`}>
                        <circle
                            cx={x}
                            cy={y}
                            r={dragging === index ? 11 : 8}
                            fill={ACCENT}
                            filter="url(#both-rules-dot-shadow)"
                            pointerEvents="none"
                        />
                        <circle
                            cx={x}
                            cy={y}
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
                    </g>
                );
            })}
        </svg>
    );
}

function BothRulesFigure() {
    const setVar = useSetVar();
    const mode = useVar<number>("bothRulesMode", 0);

    return (
        <Figure
            id="both-rules-one-circle"
            caption="One circle, both rules, and one corner shared between them. Tap a rule's name at the top to light the angles it governs, and drag any point around the rim to check the rule survives."
            onReset={() => {
                setVar("bothRulesPoints", DEFAULT_POINTS);
                setVar("bothRulesMode", 0);
                setVar("bothRulesHighlight", "");
            }}
        >
            <BothRulesDrawing />
            <InteractionHintSequence
                hintKey="both-rules-tap-then-drag"
                currentStep={mode === 1 ? 1 : 0}
                steps={[
                    {
                        gesture: "click",
                        label: "Tap a rule to light up its angles",
                        position: { x: "36%", y: "10%" },
                    },
                    {
                        gesture: "drag-circular",
                        label: "Drag any point around the rim",
                        position: { x: "74%", y: "35%" },
                        dragPath: { type: "arc", startAngle: 30, endAngle: -30, radius: 32 },
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
                Two rules, and that is the whole toolkit. Both live in the circle below, sharing a
                single corner: tap a rule's name to light the angles it governs, then drag any point
                to check it still holds.
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
                        resetVars: { bothRulesMode: 0 },
                        steps: [
                            {
                                gesture: "click",
                                label: "Tap the second rule and watch the facing corner make 180 with the shared one",
                                position: { x: "36%", y: "10%" },
                                completionVar: "bothRulesMode",
                                completionValue: 1,
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

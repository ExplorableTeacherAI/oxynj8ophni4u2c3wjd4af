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
    InlineLinkedHighlight,
    InlineTooltip,
    InteractionHintSequence,
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
 * Bespoke figure — predict the fourth corner.
 *
 * Four corners sit on the rim, joined in order. Three show their size; the
 * fourth holds only a dashed copy the student opens and closes. Letting go
 * swings the real corner in and prints both opposite-pair totals, and from
 * then on every corner can be dragged around the rim.
 *
 * Corner positions are snapped to even degrees so that every inscribed angle
 * lands on a whole number and the two totals read exactly 180.
 * ──────────────────────────────────────────────────────────────────────────── */

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 500;
const CENTER_X = 300;
const CENTER_Y = 245;
const RADIUS = 150;
const PAD = 24;

const ACCENT = "#62D0AD";
const GHOST = "#94A3B8";
const INK_STRONG = "#334155";
const INK_SOFT = "#64748B";

const BLANK_INDEX = 3;
const GUESS_ARM_LENGTH = 130;
const DEFAULT_CORNERS = [40, 110, 200, 320];

const formatDegrees = (value: number) => `${Math.round(value)}°`;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const norm360 = (degrees: number) => ((degrees % 360) + 360) % 360;

const rimPoint = (degrees: number): [number, number] => [
    CENTER_X + RADIUS * Math.cos(toRadians(degrees)),
    CENTER_Y - RADIUS * Math.sin(toRadians(degrees)),
];

const clampLabelX = (x: number, halfWidth: number) =>
    clamp(x, PAD + halfWidth, VIEW_WIDTH - PAD - halfWidth);
const clampLabelY = (y: number) => clamp(y, 58, 410);

const unitTo = (from: [number, number], to: [number, number]): [number, number] => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy) || 1;
    return [dx / length, dy / length];
};

const rotate = (vector: [number, number], degrees: number): [number, number] => {
    const radians = toRadians(degrees);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return [vector[0] * cos - vector[1] * sin, vector[0] * sin + vector[1] * cos];
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

/** Corners 1 and 3 face each other, as do corners 0 and 2. */
const pairOf = (index: number) => (index % 2 === 1 ? "diagonal" : "neighbours");

function CyclicQuadDrawing() {
    const setVar = useSetVar();
    const corners = useVar<number[]>("cyclicQuadCorners", DEFAULT_CORNERS);
    const guess = useVar<number>("cyclicQuadGuess", 120);
    const revealed = useVar<number>("cyclicQuadRevealed", 0);
    const highlight = useVar<string>("cyclicQuadHighlight", "");
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<number | "guess" | null>(null);

    const isRevealed = revealed >= 1;
    const points = corners.map(rimPoint);

    const toViewBox = useCallback((clientX: number, clientY: number): [number, number] => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return [CENTER_X, CENTER_Y];
        return [
            ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
            ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
        ];
    }, []);

    const armsAt = (index: number) => ({
        toPrevious: unitTo(points[index], points[(index + 3) % 4]),
        toNext: unitTo(points[index], points[(index + 1) % 4]),
    });

    const interiorAngle = (index: number) => {
        const { toPrevious, toNext } = armsAt(index);
        return angleBetween(toPrevious, toNext);
    };

    const angles = [0, 1, 2, 3].map(interiorAngle);

    // The bisector of a corner points at the midpoint of the arc between its two
    // neighbours that the corner itself is not standing on.
    const previousDegrees = corners[(BLANK_INDEX + 3) % 4];
    const nextDegrees = corners[(BLANK_INDEX + 1) % 4];
    const bisectorTarget = rimPoint(
        nextDegrees + norm360(previousDegrees - nextDegrees) / 2,
    );
    const blankVertex = points[BLANK_INDEX];
    const bisector = unitTo(blankVertex, bisectorTarget);
    const guessArmOne = rotate(bisector, guess / 2);
    const guessArmTwo = rotate(bisector, -guess / 2);
    const guessHandle: [number, number] = [
        blankVertex[0] + guessArmTwo[0] * GUESS_ARM_LENGTH,
        blankVertex[1] + guessArmTwo[1] * GUESS_ARM_LENGTH,
    ];
    const guessArmOneTip: [number, number] = [
        blankVertex[0] + guessArmOne[0] * GUESS_ARM_LENGTH,
        blankVertex[1] + guessArmOne[1] * GUESS_ARM_LENGTH,
    ];

    const handleGuessDrag = (event: ReactPointerEvent<SVGCircleElement>) => {
        if (dragging !== "guess") return;
        const [x, y] = toViewBox(event.clientX, event.clientY);
        const halfOpening = angleBetween(bisector, unitTo(blankVertex, [x, y]));
        setVar("cyclicQuadGuess", Math.round(clamp(halfOpening * 2, 10, 170)));
    };

    const handleCornerDrag = (index: number) => (event: ReactPointerEvent<SVGCircleElement>) => {
        if (dragging !== index) return;
        const [x, y] = toViewBox(event.clientX, event.clientY);
        const pointerDegrees = (Math.atan2(CENTER_Y - y, x - CENTER_X) * 180) / Math.PI;
        const previous = corners[(index + 3) % 4];
        const span = norm360(corners[(index + 1) % 4] - previous);
        const offset = clamp(norm360(pointerDegrees - previous), 12, span - 12);
        const next = [...corners];
        next[index] = norm360(Math.round((previous + offset) / 2) * 2);
        setVar("cyclicQuadCorners", next);
    };

    const dim = (id: string) => (highlight && highlight !== id ? 0.35 : 1);
    const hoverProps = (id: string) => ({
        onPointerEnter: () => setVar("cyclicQuadHighlight", id),
        onPointerLeave: () => setVar("cyclicQuadHighlight", ""),
    });
    const eased = { transition: "opacity 150ms ease-out, stroke-width 150ms ease-out" };

    const statusLine = isRevealed
        ? "Opposite corners always add to 180 — drag any corner to test it"
        : "How big is the blank corner?";
    const totalsLine = `${formatDegrees(angles[0])} + ${formatDegrees(angles[2])} = ${formatDegrees(
        angles[0] + angles[2],
    )}   ·   ${formatDegrees(angles[1])} + ${formatDegrees(angles[3])} = ${formatDegrees(
        angles[1] + angles[3],
    )}`;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full"
            style={{ touchAction: "none" }}
        >
            <defs>
                <filter id="cyclic-quad-dot-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <text x={PAD} y={30} fontSize="13" fill={isRevealed ? ACCENT : INK_SOFT}>
                {statusLine}
            </text>

            <text
                x={PAD}
                y={444}
                fontSize="13"
                fill={GHOST}
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {`Your guess: ${formatDegrees(guess)}`}
            </text>

            {isRevealed && (
                <text
                    x={PAD}
                    y={468}
                    fontSize="13"
                    fill={ACCENT}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {totalsLine}
                </text>
            )}

            {/* Rim */}
            <g opacity={dim("rim")} style={eased} pointerEvents="none">
                <circle cx={CENTER_X} cy={CENTER_Y} r={RADIUS} fill="none" stroke={INK_SOFT} strokeWidth="2" />
            </g>

            {/* The four sides */}
            <g opacity={dim("sides")} style={eased} pointerEvents="none">
                {[0, 1, 2, 3].map((index) => {
                    const from = points[index];
                    const to = points[(index + 1) % 4];
                    return (
                        <line
                            key={`side-${index}`}
                            x1={from[0]}
                            y1={from[1]}
                            x2={to[0]}
                            y2={to[1]}
                            stroke={INK_STRONG}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />
                    );
                })}
            </g>

            {/* The line joining whichever pair is being talked about */}
            {highlight !== "" && (
                <line
                    x1={points[highlight === "diagonal" ? 1 : 0][0]}
                    y1={points[highlight === "diagonal" ? 1 : 0][1]}
                    x2={points[highlight === "diagonal" ? 3 : 2][0]}
                    y2={points[highlight === "diagonal" ? 3 : 2][1]}
                    stroke={ACCENT}
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                    opacity={0.7}
                    pointerEvents="none"
                />
            )}

            {/* The dashed copy of the blank corner — the student's guess, kept on
                screen after the reveal as the before-state reference */}
            <g opacity={dim(pairOf(BLANK_INDEX))} style={eased}>
                <line
                    x1={blankVertex[0]}
                    y1={blankVertex[1]}
                    x2={guessArmOneTip[0]}
                    y2={guessArmOneTip[1]}
                    stroke={GHOST}
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                />
                <line
                    x1={blankVertex[0]}
                    y1={blankVertex[1]}
                    x2={guessHandle[0]}
                    y2={guessHandle[1]}
                    stroke={GHOST}
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                />
                <path
                    d={cornerMarkerPath(blankVertex, guessArmOne, guessArmTwo, 44)}
                    fill="none"
                    stroke={GHOST}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                />
                {!isRevealed && (
                    <>
                        <circle
                            cx={guessHandle[0]}
                            cy={guessHandle[1]}
                            r={dragging === "guess" ? 10 : 8}
                            fill={GHOST}
                            filter="url(#cyclic-quad-dot-shadow)"
                            pointerEvents="none"
                        />
                        <circle
                            cx={guessHandle[0]}
                            cy={guessHandle[1]}
                            r={22}
                            fill="transparent"
                            style={{ cursor: dragging === "guess" ? "grabbing" : "grab" }}
                            onPointerDown={(event) => {
                                event.currentTarget.setPointerCapture(event.pointerId);
                                setDragging("guess");
                            }}
                            onPointerMove={handleGuessDrag}
                            onPointerUp={() => {
                                setDragging(null);
                                setVar("cyclicQuadRevealed", 1);
                            }}
                            onPointerCancel={() => setDragging(null)}
                        />
                    </>
                )}
            </g>

            {/* The corners themselves */}
            {[0, 1, 2, 3].map((index) => {
                const group = pairOf(index);
                const active = highlight === group;
                const vertex = points[index];
                const { toPrevious, toNext } = armsAt(index);
                const showValue = index !== BLANK_INDEX || isRevealed;
                const outward = unitTo([CENTER_X, CENTER_Y], vertex);
                const labelX = clampLabelX(vertex[0] + outward[0] * 32, 24);
                const labelY = clampLabelY(vertex[1] + outward[1] * 32 + 5);
                return (
                    <g key={`corner-${index}`} opacity={dim(group)} style={eased}>
                        {active && (
                            <path
                                d={cornerMarkerPath(vertex, toPrevious, toNext, 28)}
                                fill="none"
                                stroke={ACCENT}
                                strokeWidth="10"
                                opacity={0.28}
                            />
                        )}
                        <path
                            d={cornerMarkerPath(vertex, toPrevious, toNext, 28)}
                            fill="none"
                            stroke={showValue ? ACCENT : GHOST}
                            strokeWidth={active ? 4 : 2}
                            style={eased}
                            {...hoverProps(group)}
                        />
                        <text
                            x={labelX}
                            y={labelY}
                            fontSize="15"
                            textAnchor="middle"
                            fill={showValue ? ACCENT : INK_SOFT}
                            pointerEvents="none"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                            {showValue ? formatDegrees(angles[index]) : "?"}
                        </text>
                        <circle
                            cx={vertex[0]}
                            cy={vertex[1]}
                            r={dragging === index || active ? 12 : 9}
                            fill={ACCENT}
                            filter="url(#cyclic-quad-dot-shadow)"
                            pointerEvents="none"
                        />
                        {isRevealed && (
                            <circle
                                cx={vertex[0]}
                                cy={vertex[1]}
                                r={22}
                                fill="transparent"
                                style={{ cursor: dragging === index ? "grabbing" : "grab" }}
                                onPointerDown={(event) => {
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                    setDragging(index);
                                }}
                                onPointerMove={handleCornerDrag(index)}
                                onPointerUp={() => setDragging(null)}
                                onPointerCancel={() => setDragging(null)}
                                {...hoverProps(group)}
                            />
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

function CyclicQuadFigure() {
    const setVar = useSetVar();
    const revealed = useVar<number>("cyclicQuadRevealed", 0);

    return (
        <Figure
            id="cyclic-quad-predict"
            caption="Three corners show their size and the fourth is blank. Open the dashed copy of the blank corner to the size you think it is, let go, and the real corner swings in with both opposite-pair totals. After that, drag any corner around the rim."
            onReset={() => {
                setVar("cyclicQuadRevealed", 0);
                setVar("cyclicQuadGuess", 120);
                setVar("cyclicQuadCorners", DEFAULT_CORNERS);
                setVar("cyclicQuadHighlight", "");
            }}
        >
            <CyclicQuadDrawing />
            <InteractionHintSequence
                hintKey="cyclic-quad-predict-then-drag"
                currentStep={revealed >= 1 ? 1 : 0}
                steps={[
                    {
                        gesture: "drag-circular",
                        label: "Open the dashed corner to your guess, then let go",
                        position: { x: "48%", y: "74%" },
                        dragPath: { type: "arc", startAngle: 150, endAngle: 200, radius: 32 },
                    },
                    {
                        gesture: "drag-circular",
                        label: "Drag any corner around the rim",
                        position: { x: "69%", y: "28%" },
                        dragPath: { type: "arc", startAngle: 40, endAngle: -20, radius: 32 },
                    },
                ]}
            />
        </Figure>
    );
}

export const cyclicQuadExploreBlocks: ReactElement[] = [
    <StackLayout key="layout-cyclic-quad-heading" maxWidth="xl">
        <Block id="cyclic-quad-heading" padding="md">
            <EditableH2 id="h2-cyclic-quad-heading" blockId="cyclic-quad-heading">
                Opposite Corners of a Cyclic Quadrilateral
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-cyclic-quad-setup" maxWidth="xl">
        <Block id="cyclic-quad-setup" padding="sm">
            <EditableParagraph id="para-cyclic-quad-setup" blockId="cyclic-quad-setup">
                Four points on the rim, joined in order, make a four-sided shape called a{" "}
                <InlineTooltip id="tooltip-cyclic-quadrilateral-definition" tooltip="A four-sided shape whose four corners all sit on the edge of the same circle.">
                    cyclic quadrilateral
                </InlineTooltip>
                , where cyclic simply means every corner sits on the circle. Three of the corners
                below show their size and one is left blank. Open the dashed corner to the size you
                think it should be, then let go.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-cyclic-quad-visual" maxWidth="xl">
        <Block id="cyclic-quad-visual" padding="sm" hasVisualization>
            <CyclicQuadFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-cyclic-quad-reflect" maxWidth="xl">
        <Block id="cyclic-quad-reflect" padding="sm">
            <EditableParagraph id="para-cyclic-quad-reflect" blockId="cyclic-quad-reflect">
                The blank corner is settled by{" "}
                <InlineLinkedHighlight
                    id="highlight-cyclic-quad-diagonal"
                    varName="cyclicQuadHighlight"
                    highlightId="diagonal"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('cyclicQuadHighlight'))}
                >
                    the corner diagonally across from it
                </InlineLinkedHighlight>
                , never by{" "}
                <InlineLinkedHighlight
                    id="highlight-cyclic-quad-neighbours"
                    varName="cyclicQuadHighlight"
                    highlightId="neighbours"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('cyclicQuadHighlight'))}
                >
                    the two corners next door
                </InlineLinkedHighlight>
                . Those facing pairs each add to 180 degrees, and dragging any corner around the rim
                leaves both totals untouched.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-cyclic-quad-question-fourth" maxWidth="xl">
        <Block id="cyclic-quad-question-fourth" padding="md">
            <EditableParagraph id="para-cyclic-quad-question-fourth" blockId="cyclic-quad-question-fourth">
                Going round a cyclic quadrilateral in order, the first three corners measure 70, 115
                and 110 degrees. In degrees, the fourth corner measures{" "}
                <InlineFeedback
                    varName="answerFourthCorner"
                    correctValue={["65", "65°"]}
                    position="terminal"
                    successMessage="— spot on, the fourth corner faces the 115 one, so it takes whatever is left of 180"
                    failureMessage="— careful."
                    hint="The fourth corner faces the second one, not the corner it sits beside"
                    visualizationHint={{
                        blockId: "cyclic-quad-visual",
                        hintKey: "feedback-cyclic-quad-fourth",
                        label: "Discover it yourself",
                        resetVars: { cyclicQuadRevealed: 0, cyclicQuadGuess: 120 },
                        steps: [
                            {
                                gesture: "drag-circular",
                                label: "Open the dashed corner to any size, then let go",
                                position: { x: "48%", y: "74%" },
                                completionVar: "cyclicQuadRevealed",
                                completionValue: 1,
                                completionTolerance: 0.4,
                            },
                            {
                                gesture: "drag-circular",
                                label: "Drag a corner and watch which two numbers make 180",
                                position: { x: "69%", y: "28%" },
                            },
                        ],
                    }}
                >
                    <InlineClozeInput
                        varName="answerFourthCorner"
                        correctAnswer={["65", "65°"]}
                        {...clozePropsFromDefinition(getVariableInfo('answerFourthCorner'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-cyclic-quad-question-total" maxWidth="xl">
        <Block id="cyclic-quad-question-total" padding="md">
            <EditableParagraph id="para-cyclic-quad-question-total" blockId="cyclic-quad-question-total">
                A cyclic quadrilateral holds two facing pairs, and each pair adds to 180. So all
                four corners together must come to{" "}
                <InlineFeedback
                    varName="answerCornerTotal"
                    correctValue={["360", "360°"]}
                    position="terminal"
                    successMessage="— exactly, two pairs of 180, and that total holds for every four-sided shape you will meet"
                    failureMessage="— not yet."
                    hint="There are two pairs, and each one is worth 180"
                    reviewBlockId="cyclic-quad-reflect"
                    reviewLabel="Look again at the rule"
                >
                    <InlineClozeInput
                        varName="answerCornerTotal"
                        correctAnswer={["360", "360°"]}
                        {...clozePropsFromDefinition(getVariableInfo('answerCornerTotal'))}
                    />
                </InlineFeedback>{" "}
                degrees.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];

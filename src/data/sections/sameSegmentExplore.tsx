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
    InlineClozeChoice,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp } from "@/lib/motion";
import {
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
} from "../variables";

/* ────────────────────────────────────────────────────────────────────────────
 * Bespoke figure — predict, then compare.
 *
 * A fixed chord cuts the circle. One corner stands high above it and shows its
 * size; a second corner is tucked right beside the chord and shows only a
 * question mark. The student opens a faint copy of that near corner to the size
 * they think it is and lets go: the real arms swing in, both corners read the
 * same number, and their guess stays on screen as the before-state reference.
 * After the reveal, either corner can be dragged along the arc.
 * ──────────────────────────────────────────────────────────────────────────── */

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 440;
const CENTER_X = 300;
const CENTER_Y = 230;
const RADIUS = 145;
const PAD = 24;

/** The chord's two ends, in degrees anticlockwise from east. */
const CHORD_START_DEGREES = 340;
const ARC_SWEEP_DEGREES = 220;

const ACCENT = "#62D0AD";
const GHOST = "#94A3B8";
const INK_STRONG = "#334155";
const INK_SOFT = "#64748B";

const GUESS_ARM_LENGTH = 150;

const formatDegrees = (value: number) => `${Math.round(value)}°`;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rimPoint = (degrees: number): [number, number] => [
    CENTER_X + RADIUS * Math.cos(toRadians(degrees)),
    CENTER_Y - RADIUS * Math.sin(toRadians(degrees)),
];

/** Spot 0..1 along the upper arc → a point on the rim. */
const spotToDegrees = (spot: number) => CHORD_START_DEGREES + spot * ARC_SWEEP_DEGREES;

const CHORD_END_A = rimPoint(CHORD_START_DEGREES + ARC_SWEEP_DEGREES);
const CHORD_END_B = rimPoint(CHORD_START_DEGREES);
/** Midpoint of the opposite arc — every corner's angle bisector points here. */
const BISECTOR_TARGET = rimPoint(CHORD_START_DEGREES - (360 - ARC_SWEEP_DEGREES) / 2);

const clampLabelX = (x: number, halfWidth: number) =>
    clamp(x, PAD + halfWidth, VIEW_WIDTH - PAD - halfWidth);
const clampLabelY = (y: number) => clamp(y, 76, VIEW_HEIGHT - 28);

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

/** The angle A–V–B, in degrees, for a corner V on the rim. */
const inscribedAngle = (vertex: [number, number]) => {
    const toA = unitTo(vertex, CHORD_END_A);
    const toB = unitTo(vertex, CHORD_END_B);
    return (Math.acos(clamp(toA[0] * toB[0] + toA[1] * toB[1], -1, 1)) * 180) / Math.PI;
};

/** Small arc marker sitting inside a corner. */
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

function SameSegmentDrawing() {
    const setVar = useSetVar();
    const nearSpot = useVar<number>("sameSegmentNearSpot", 0.08);
    const farSpot = useVar<number>("sameSegmentFarSpot", 0.5);
    const guess = useVar<number>("sameSegmentGuess", 110);
    const revealed = useVar<number>("sameSegmentRevealed", 0);
    const highlight = useVar<string>("sameSegmentHighlight", "");
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<"guess" | "near" | "far" | null>(null);

    const isRevealed = revealed >= 1;

    const toViewBox = useCallback((clientX: number, clientY: number): [number, number] => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return [CENTER_X, CENTER_Y];
        return [
            ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
            ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
        ];
    }, []);

    const nearVertex = rimPoint(spotToDegrees(nearSpot));
    const farVertex = rimPoint(spotToDegrees(farSpot));
    const nearAngle = inscribedAngle(nearVertex);
    const farAngle = inscribedAngle(farVertex);

    // ── The faint copy the student opens and closes ─────────────────────────
    const bisector = unitTo(nearVertex, BISECTOR_TARGET);
    const guessArmOne = rotate(bisector, guess / 2);
    const guessArmTwo = rotate(bisector, -guess / 2);
    // The grab handle rides the arm that stays inside the circle.
    const guessHandle: [number, number] = [
        nearVertex[0] + guessArmOne[0] * GUESS_ARM_LENGTH,
        nearVertex[1] + guessArmOne[1] * GUESS_ARM_LENGTH,
    ];
    const guessArmTwoTip: [number, number] = [
        nearVertex[0] + guessArmTwo[0] * GUESS_ARM_LENGTH,
        nearVertex[1] + guessArmTwo[1] * GUESS_ARM_LENGTH,
    ];

    const handleGuessDrag = (event: ReactPointerEvent<SVGCircleElement>) => {
        if (dragging !== "guess") return;
        const [x, y] = toViewBox(event.clientX, event.clientY);
        const pointer = unitTo(nearVertex, [x, y]);
        const halfOpening =
            (Math.acos(clamp(bisector[0] * pointer[0] + bisector[1] * pointer[1], -1, 1)) * 180) /
            Math.PI;
        setVar("sameSegmentGuess", Math.round(clamp(halfOpening * 2, 10, 170)));
    };

    const handleCornerDrag =
        (which: "near" | "far") => (event: ReactPointerEvent<SVGCircleElement>) => {
            if (dragging !== which) return;
            const [x, y] = toViewBox(event.clientX, event.clientY);
            const degrees = (Math.atan2(CENTER_Y - y, x - CENTER_X) * 180) / Math.PI;
            let spot = (((degrees - CHORD_START_DEGREES) % 360) + 360) % 360 / ARC_SWEEP_DEGREES;
            spot = clamp(spot, 0.05, 0.95);
            setVar(which === "near" ? "sameSegmentNearSpot" : "sameSegmentFarSpot", spot);
        };

    const dim = (id: string) => (highlight && highlight !== id ? 0.35 : 1);
    const hoverProps = (id: string) => ({
        onPointerEnter: () => setVar("sameSegmentHighlight", id),
        onPointerLeave: () => setVar("sameSegmentHighlight", ""),
    });
    const eased = { transition: "opacity 150ms ease-out, stroke-width 150ms ease-out" };

    const cornerArms = (vertex: [number, number]) => ({
        toA: unitTo(vertex, CHORD_END_A),
        toB: unitTo(vertex, CHORD_END_B),
    });

    const nearArms = cornerArms(nearVertex);
    const farArms = cornerArms(farVertex);

    const labelOffset = (vertex: [number, number], distance: number): [number, number] => {
        const outward = unitTo([CENTER_X, CENTER_Y], vertex);
        return [vertex[0] + outward[0] * distance, vertex[1] + outward[1] * distance];
    };

    const [nearLabelX, nearLabelY] = labelOffset(nearVertex, 34);
    const [farLabelX, farLabelY] = labelOffset(farVertex, 34);

    const statusLine = isRevealed
        ? `Both corners measure ${formatDegrees(nearAngle)} — drag either one along the arc`
        : "How big is the corner tucked next to the chord?";
    const guessLine = isRevealed
        ? `Your guess was ${formatDegrees(guess)}`
        : `Your guess: ${formatDegrees(guess)}`;

    const renderCorner = (
        id: "near" | "far",
        vertex: [number, number],
        arms: { toA: [number, number]; toB: [number, number] },
        angle: number,
        labelX: number,
        labelY: number,
        showValue: boolean,
    ) => {
        const active = highlight === id;
        return (
            <g opacity={dim(id)} style={eased}>
                {showValue && (
                    <>
                        {active && (
                            <>
                                <line
                                    x1={vertex[0]}
                                    y1={vertex[1]}
                                    x2={CHORD_END_A[0]}
                                    y2={CHORD_END_A[1]}
                                    stroke={ACCENT}
                                    strokeWidth="10"
                                    strokeLinecap="round"
                                    opacity={0.28}
                                />
                                <line
                                    x1={vertex[0]}
                                    y1={vertex[1]}
                                    x2={CHORD_END_B[0]}
                                    y2={CHORD_END_B[1]}
                                    stroke={ACCENT}
                                    strokeWidth="10"
                                    strokeLinecap="round"
                                    opacity={0.28}
                                />
                            </>
                        )}
                        <line
                            x1={vertex[0]}
                            y1={vertex[1]}
                            x2={CHORD_END_A[0]}
                            y2={CHORD_END_A[1]}
                            stroke={ACCENT}
                            strokeWidth={active ? 5 : 3}
                            strokeLinecap="round"
                            style={eased}
                            {...hoverProps(id)}
                        />
                        <line
                            x1={vertex[0]}
                            y1={vertex[1]}
                            x2={CHORD_END_B[0]}
                            y2={CHORD_END_B[1]}
                            stroke={ACCENT}
                            strokeWidth={active ? 5 : 3}
                            strokeLinecap="round"
                            style={eased}
                            {...hoverProps(id)}
                        />
                        <path
                            d={cornerMarkerPath(vertex, arms.toA, arms.toB, 26)}
                            fill="none"
                            stroke={ACCENT}
                            strokeWidth="2"
                            pointerEvents="none"
                        />
                    </>
                )}
                <text
                    x={clampLabelX(labelX, 22)}
                    y={clampLabelY(labelY + 5)}
                    fontSize="15"
                    textAnchor="middle"
                    fill={showValue ? ACCENT : INK_SOFT}
                    pointerEvents="none"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {showValue ? formatDegrees(angle) : "?"}
                </text>
                <circle
                    cx={vertex[0]}
                    cy={vertex[1]}
                    r={dragging === id || active ? 12 : 9}
                    fill={ACCENT}
                    filter="url(#same-segment-dot-shadow)"
                    pointerEvents="none"
                />
                {isRevealed && (
                    <circle
                        cx={vertex[0]}
                        cy={vertex[1]}
                        r={22}
                        fill="transparent"
                        style={{ cursor: dragging === id ? "grabbing" : "grab" }}
                        onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            setDragging(id);
                        }}
                        onPointerMove={handleCornerDrag(id)}
                        onPointerUp={() => setDragging(null)}
                        onPointerCancel={() => setDragging(null)}
                        {...hoverProps(id)}
                    />
                )}
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
                <filter id="same-segment-dot-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            <text x={PAD} y={30} fontSize="13" fill={isRevealed ? ACCENT : INK_SOFT}>
                {statusLine}
            </text>
            <text
                x={PAD}
                y={52}
                fontSize="13"
                fill={GHOST}
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {guessLine}
            </text>

            {/* Rim */}
            <g opacity={dim("rim")} style={eased} pointerEvents="none">
                <circle cx={CENTER_X} cy={CENTER_Y} r={RADIUS} fill="none" stroke={INK_SOFT} strokeWidth="2" />
            </g>

            {/* Chord */}
            <g opacity={dim("chord")} style={eased} pointerEvents="none">
                <line
                    x1={CHORD_END_A[0]}
                    y1={CHORD_END_A[1]}
                    x2={CHORD_END_B[0]}
                    y2={CHORD_END_B[1]}
                    stroke={INK_STRONG}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
                <text
                    x={(CHORD_END_A[0] + CHORD_END_B[0]) / 2}
                    y={(CHORD_END_A[1] + CHORD_END_B[1]) / 2 + 22}
                    fontSize="13"
                    textAnchor="middle"
                    fill={INK_STRONG}
                >
                    chord
                </text>
            </g>

            {/* The faint copy of the near corner — the student's guess, kept on
                screen after the reveal as the before-state reference */}
            <g opacity={dim("near")} style={eased}>
                <line
                    x1={nearVertex[0]}
                    y1={nearVertex[1]}
                    x2={guessHandle[0]}
                    y2={guessHandle[1]}
                    stroke={GHOST}
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                />
                <line
                    x1={nearVertex[0]}
                    y1={nearVertex[1]}
                    x2={guessArmTwoTip[0]}
                    y2={guessArmTwoTip[1]}
                    stroke={GHOST}
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                />
                <path
                    d={cornerMarkerPath(nearVertex, guessArmOne, guessArmTwo, 40)}
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
                            filter="url(#same-segment-dot-shadow)"
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
                                setVar("sameSegmentRevealed", 1);
                            }}
                            onPointerCancel={() => setDragging(null)}
                        />
                    </>
                )}
            </g>

            {renderCorner("far", farVertex, farArms, farAngle, farLabelX, farLabelY, true)}
            {renderCorner("near", nearVertex, nearArms, nearAngle, nearLabelX, nearLabelY, isRevealed)}
        </svg>
    );
}

function SameSegmentFigure() {
    const setVar = useSetVar();
    const revealed = useVar<number>("sameSegmentRevealed", 0);

    return (
        <Figure
            id="same-segment-predict"
            caption="The corner high above the chord shows its size. Open the dashed copy of the corner beside the chord to the size you think it is, let go, and the real arms swing in. After that, drag either corner along the arc."
            onReset={() => {
                setVar("sameSegmentRevealed", 0);
                setVar("sameSegmentGuess", 110);
                setVar("sameSegmentNearSpot", 0.08);
                setVar("sameSegmentFarSpot", 0.5);
                setVar("sameSegmentHighlight", "");
            }}
        >
            <SameSegmentDrawing />
            <InteractionHintSequence
                hintKey="same-segment-predict-then-drag"
                currentStep={revealed >= 1 ? 1 : 0}
                steps={[
                    {
                        gesture: "drag-circular",
                        label: "Open the dashed corner to your guess, then let go",
                        position: { x: "50%", y: "47%" },
                        dragPath: { type: "arc", startAngle: 200, endAngle: 250, radius: 34 },
                    },
                    {
                        gesture: "drag-circular",
                        label: "Drag either corner along the arc",
                        position: { x: "74%", y: "54%" },
                        dragPath: { type: "arc", startAngle: 0, endAngle: -70, radius: 34 },
                    },
                ]}
            />
        </Figure>
    );
}

export const sameSegmentExploreBlocks: ReactElement[] = [
    <StackLayout key="layout-same-segment-heading" maxWidth="xl">
        <Block id="same-segment-heading" padding="md">
            <EditableH2 id="h2-same-segment-heading" blockId="same-segment-heading">
                Angles in the Same Segment
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-same-segment-claim" maxWidth="xl">
        <Block id="same-segment-claim" padding="sm">
            <EditableParagraph id="para-same-segment-claim" blockId="same-segment-claim">
                Here is the surprise: every point on the same arc gives the same angle. Below, one
                corner stands{" "}
                <InlineLinkedHighlight
                    id="highlight-same-segment-far"
                    varName="sameSegmentHighlight"
                    highlightId="far"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('sameSegmentHighlight'))}
                >
                    high above the chord
                </InlineLinkedHighlight>{" "}
                and another is{" "}
                <InlineLinkedHighlight
                    id="highlight-same-segment-near"
                    varName="sameSegmentHighlight"
                    highlightId="near"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('sameSegmentHighlight'))}
                >
                    tucked right beside it
                </InlineLinkedHighlight>
                . Open the dashed corner to the size you think the near one is, then let go.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-same-segment-visual" maxWidth="xl">
        <Block id="same-segment-visual" padding="sm" hasVisualization>
            <SameSegmentFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-same-segment-reflect" maxWidth="xl">
        <Block id="same-segment-reflect" padding="sm">
            <EditableParagraph id="para-same-segment-reflect" blockId="same-segment-reflect">It measures exactly the same as the far one, however squashed it looks. Drag either corner along the arc and the number holds steady. These are called angles in the same segment./</EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-same-segment-catch" maxWidth="xl">
        <Block id="same-segment-catch" padding="sm">
            <EditableParagraph id="para-same-segment-catch" blockId="same-segment-catch">
                There is a catch. A corner on the far side of the chord does not join in; it gives a
                different number entirely. Only corners standing on the same chord from the same
                side match.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-same-segment-question-compare" maxWidth="xl">
        <Block id="same-segment-question-compare" padding="md">
            <EditableParagraph id="para-same-segment-question-compare" blockId="same-segment-question-compare">Two corners stand on the same chord from the same side, one squeezed right beside the chord and one far above it. Compared with the far corner, the near corner is <InlineFeedback varName={"answerNearCornerSize"} correctValue={"exactly the same"} caseSensitive={false} position={"terminal"} successMessage={"— yes, sitting near the chord makes a corner look wider, but the measurement never budges"} failureMessage={"— that is the trap."} hint={"Being close to the chord changes how the corner looks, not how much it turns"} reviewLabel={"Review this concept"} visualizationHint={{"blockId": "same-segment-visual", "hintKey": "feedback-same-segment-compare", "label": "Discover it yourself", "resetVars": {"sameSegmentRevealed": 0, "sameSegmentGuess": 110, "sameSegmentNearSpot": 0.08, "sameSegmentFarSpot": 0.5}, "steps": [{"gesture": "drag-circular", "label": "Open the dashed corner to any size, then let go to see the real one", "position": {"x": "50%", "y": "47%"}, "completionVar": "sameSegmentRevealed", "completionValue": 1, "completionTolerance": 0.4}, {"gesture": "drag-circular", "label": "Now drag that near corner up the arc and watch its number", "position": {"x": "74%", "y": "54%"}, "completionVar": "sameSegmentNearSpot", "completionValue": 0.7, "completionTolerance": 0.2}]}}><InlineClozeChoice varName={"answerNearCornerSize"} correctAnswer={"exactly the same"} options={["bigger", "smaller", "exactly the same", "impossible to tell"]} placeholder={"???"} color={"#E53935"} bgColor={"rgba(59, 130, 246, 0.35)"} id={"choice-1787984476254-dv666"} /></InlineFeedback>.</EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-same-segment-question-transfer" maxWidth="xl">
        <Block id="same-segment-question-transfer" padding="md">
            <EditableParagraph id="para-same-segment-question-transfer" blockId="same-segment-question-transfer">
                In a different circle, a corner standing on a chord measures 38 degrees. A second
                corner stands on that same chord from the same side, so in degrees it measures{" "}
                <InlineFeedback
                    varName="answerSameSegmentTransfer"
                    correctValue={["38", "38°"]}
                    position="terminal"
                    successMessage="— correct, and you did not need to know anything else about the circle"
                    failureMessage="— have another go."
                    hint="Corners on the same chord from the same side simply copy each other"
                    reviewBlockId="same-segment-reflect"
                    reviewLabel="Look again at the rule"
                >
                    <InlineClozeInput
                        varName="answerSameSegmentTransfer"
                        correctAnswer={["38", "38°"]}
                        {...clozePropsFromDefinition(getVariableInfo('answerSameSegmentTransfer'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];

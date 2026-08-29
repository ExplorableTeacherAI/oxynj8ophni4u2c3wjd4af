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
 * Bespoke figure — an empty circle the student fills with three dots.
 * Two dots pull a chord across and name the two arcs; the third dot opens an
 * angle standing on that chord. Everything is derived from the store array
 * `circlePartsPoints` (rim angles in degrees).
 * ──────────────────────────────────────────────────────────────────────────── */

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 400;
const CENTER_X = 300;
const CENTER_Y = 210;
const RADIUS = 140;
const PAD = 24;

const ACCENT = "#62D0AD";
const INK_STRONG = "#334155";
const INK_SOFT = "#64748B";

const NO_POINTS: number[] = [];

/** One formatter for the angle, used by the status line and the vertex label. */
const formatDegrees = (value: number) => `${Math.round(value)}\u00B0`;

const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

const rimPoint = (degrees: number): [number, number] => {
    const radians = (degrees * Math.PI) / 180;
    return [CENTER_X + RADIUS * Math.cos(radians), CENTER_Y - RADIUS * Math.sin(radians)];
};

/** Path along the rim from one angle to another, travelling anticlockwise. */
const rimArcPath = (from: number, to: number) => {
    const sweptAngle = normalizeDegrees(to - from);
    const [startX, startY] = rimPoint(from);
    const [endX, endY] = rimPoint(to);
    const largeArc = sweptAngle > 180 ? 1 : 0;
    return `M ${startX} ${startY} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${endX} ${endY}`;
};

const clampLabelX = (x: number, halfWidth: number) =>
    clamp(x, PAD + halfWidth, VIEW_WIDTH - PAD - halfWidth);
const clampLabelY = (y: number) => clamp(y, 52, VIEW_HEIGHT - 28);

function CirclePartsDrawing() {
    const setVar = useSetVar();
    const points = useVar<number[]>("circlePartsPoints", NO_POINTS);
    const pointCount = useVar<number>("circlePartsPointCount", 0);
    const highlight = useVar<string>("circlePartsHighlight", "");
    const svgRef = useRef<SVGSVGElement>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

    // Writing 0 to the count variable (guided hints, reset button) clears the dots.
    useEffect(() => {
        if (pointCount === 0 && points.length > 0) {
            setVar("circlePartsPoints", []);
        }
    }, [pointCount, points.length, setVar]);

    const angleFromPointer = useCallback((clientX: number, clientY: number) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return 0;
        const x = ((clientX - rect.left) / rect.width) * VIEW_WIDTH;
        const y = ((clientY - rect.top) / rect.height) * VIEW_HEIGHT;
        return normalizeDegrees((Math.atan2(CENTER_Y - y, x - CENTER_X) * 180) / Math.PI);
    }, []);

    const handleSurfaceDown = (event: ReactPointerEvent<SVGRectElement>) => {
        if (points.length >= 3) return;
        const next = [...points, angleFromPointer(event.clientX, event.clientY)];
        setVar("circlePartsPoints", next);
        setVar("circlePartsPointCount", next.length);
    };

    const handleDotMove = (index: number) => (event: ReactPointerEvent<SVGCircleElement>) => {
        if (draggingIndex !== index) return;
        const next = [...points];
        next[index] = angleFromPointer(event.clientX, event.clientY);
        setVar("circlePartsPoints", next);
    };

    const dim = (id: string) => (highlight && highlight !== id ? 0.35 : 1);
    const hoverProps = (id: string) => ({
        onPointerEnter: () => setVar("circlePartsHighlight", id),
        onPointerLeave: () => setVar("circlePartsHighlight", ""),
    });
    const eased = { transition: "opacity 150ms ease-out, stroke-width 150ms ease-out" };

    const hasChord = points.length >= 2;
    const hasAngle = points.length >= 3;

    // ── Chord ───────────────────────────────────────────────────────────────
    let chordLabelX = 0;
    let chordLabelY = 0;
    let chordStart: [number, number] = [0, 0];
    let chordEnd: [number, number] = [0, 0];
    if (hasChord) {
        chordStart = rimPoint(points[0]);
        chordEnd = rimPoint(points[1]);
        const midX = (chordStart[0] + chordEnd[0]) / 2;
        const midY = (chordStart[1] + chordEnd[1]) / 2;
        const dx = chordEnd[0] - chordStart[0];
        const dy = chordEnd[1] - chordStart[1];
        const length = Math.hypot(dx, dy) || 1;
        let normalX = -dy / length;
        let normalY = dx / length;
        if (normalX * (midX - CENTER_X) + normalY * (midY - CENTER_Y) < 0) {
            normalX = -normalX;
            normalY = -normalY;
        }
        chordLabelX = clampLabelX(midX + normalX * 20, 20);
        chordLabelY = clampLabelY(midY + normalY * 20 + 4);
    }

    // ── Arcs ────────────────────────────────────────────────────────────────
    const arcs: { path: string; labelX: number; labelY: number }[] = [];
    if (hasChord) {
        const first = points[0];
        const second = points[1];
        const sweep = normalizeDegrees(second - first);
        const midAngles = [first + sweep / 2, second + (360 - sweep) / 2];
        [rimArcPath(first, second), rimArcPath(second, first)].forEach((path, index) => {
            const radians = (midAngles[index] * Math.PI) / 180;
            arcs.push({
                path,
                labelX: clampLabelX(CENTER_X + (RADIUS + 26) * Math.cos(radians), 12),
                labelY: clampLabelY(CENTER_Y - (RADIUS + 26) * Math.sin(radians) + 4),
            });
        });
    }

    // ── Angle standing on the chord ─────────────────────────────────────────
    let angleDegrees = 0;
    let anglePath = "";
    let angleLabelX = 0;
    let angleLabelY = 0;
    let vertex: [number, number] = [0, 0];
    if (hasAngle) {
        vertex = rimPoint(points[2]);
        const armOne = [chordStart[0] - vertex[0], chordStart[1] - vertex[1]];
        const armTwo = [chordEnd[0] - vertex[0], chordEnd[1] - vertex[1]];
        const lengthOne = Math.hypot(armOne[0], armOne[1]) || 1;
        const lengthTwo = Math.hypot(armTwo[0], armTwo[1]) || 1;
        const unitOne = [armOne[0] / lengthOne, armOne[1] / lengthOne];
        const unitTwo = [armTwo[0] / lengthTwo, armTwo[1] / lengthTwo];
        angleDegrees =
            (Math.acos(clamp(unitOne[0] * unitTwo[0] + unitOne[1] * unitTwo[1], -1, 1)) * 180) /
            Math.PI;
        const cross = unitOne[0] * unitTwo[1] - unitOne[1] * unitTwo[0];
        const markerRadius = 30;
        anglePath =
            `M ${vertex[0] + markerRadius * unitOne[0]} ${vertex[1] + markerRadius * unitOne[1]} ` +
            `A ${markerRadius} ${markerRadius} 0 0 ${cross > 0 ? 1 : 0} ` +
            `${vertex[0] + markerRadius * unitTwo[0]} ${vertex[1] + markerRadius * unitTwo[1]}`;
        const bisectorX = unitOne[0] + unitTwo[0];
        const bisectorY = unitOne[1] + unitTwo[1];
        const bisectorLength = Math.hypot(bisectorX, bisectorY) || 1;
        angleLabelX = clampLabelX(vertex[0] + (bisectorX / bisectorLength) * 52, 20);
        angleLabelY = clampLabelY(vertex[1] + (bisectorY / bisectorLength) * 52 + 5);
    }

    const statusText = hasAngle
        ? `Angle standing on the chord: ${formatDegrees(angleDegrees)}`
        : points.length === 0
          ? "Click the rim to drop your first dot"
          : points.length === 1
            ? "One dot down. Drop another to pull a chord across"
            : "A chord, and two arcs. Drop one more dot for the angle";

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full"
            style={{ touchAction: "none" }}
        >
            <defs>
                <filter id="circle-parts-dot-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Click surface — drops a dot on the nearest point of the rim */}
            <rect
                x="0"
                y="0"
                width={VIEW_WIDTH}
                height={VIEW_HEIGHT}
                fill="transparent"
                style={{ cursor: points.length < 3 ? "pointer" : "default" }}
                onPointerDown={handleSurfaceDown}
            />

            <text
                x={PAD}
                y={30}
                fontSize="13"
                fill={hasAngle ? ACCENT : INK_SOFT}
                style={{ fontVariantNumeric: "tabular-nums" }}
            >
                {statusText}
            </text>

            {/* Rim */}
            <g opacity={dim("rim")} style={eased} pointerEvents="none">
                <circle cx={CENTER_X} cy={CENTER_Y} r={RADIUS} fill="none" stroke={INK_SOFT} strokeWidth="2" />
            </g>

            {/* Arcs */}
            {hasChord && (
                <g opacity={dim("arc")} style={eased}>
                    {highlight === "arc" &&
                        arcs.map((arc, index) => (
                            <path
                                key={`arc-halo-${index}`}
                                d={arc.path}
                                fill="none"
                                stroke={INK_STRONG}
                                strokeWidth="10"
                                strokeLinecap="round"
                                opacity={0.28}
                            />
                        ))}
                    {arcs.map((arc, index) => (
                        <path
                            key={`arc-${index}`}
                            d={arc.path}
                            fill="none"
                            stroke={INK_STRONG}
                            strokeWidth={highlight === "arc" ? 4.5 : 2.5}
                            strokeLinecap="round"
                            style={{ ...eased, cursor: "default" }}
                            {...hoverProps("arc")}
                        />
                    ))}
                    {arcs.map((arc, index) => (
                        <text
                            key={`arc-label-${index}`}
                            x={arc.labelX}
                            y={arc.labelY}
                            fontSize="13"
                            textAnchor="middle"
                            fill={INK_STRONG}
                            pointerEvents="none"
                        >
                            arc
                        </text>
                    ))}
                </g>
            )}

            {/* Chord */}
            {hasChord && (
                <g opacity={dim("chord")} style={eased}>
                    {highlight === "chord" && (
                        <line
                            x1={chordStart[0]}
                            y1={chordStart[1]}
                            x2={chordEnd[0]}
                            y2={chordEnd[1]}
                            stroke={INK_STRONG}
                            strokeWidth="10"
                            strokeLinecap="round"
                            opacity={0.28}
                        />
                    )}
                    <line
                        x1={chordStart[0]}
                        y1={chordStart[1]}
                        x2={chordEnd[0]}
                        y2={chordEnd[1]}
                        stroke={INK_STRONG}
                        strokeWidth={highlight === "chord" ? 4.5 : 2.5}
                        strokeLinecap="round"
                        style={eased}
                        {...hoverProps("chord")}
                    />
                    <text
                        x={chordLabelX}
                        y={chordLabelY}
                        fontSize="13"
                        textAnchor="middle"
                        fill={INK_STRONG}
                        pointerEvents="none"
                    >
                        chord
                    </text>
                </g>
            )}

            {/* Angle standing on the chord */}
            {hasAngle && (
                <g opacity={dim("angle")} style={eased}>
                    {highlight === "angle" && (
                        <>
                            <line
                                x1={vertex[0]}
                                y1={vertex[1]}
                                x2={chordStart[0]}
                                y2={chordStart[1]}
                                stroke={ACCENT}
                                strokeWidth="10"
                                strokeLinecap="round"
                                opacity={0.28}
                            />
                            <line
                                x1={vertex[0]}
                                y1={vertex[1]}
                                x2={chordEnd[0]}
                                y2={chordEnd[1]}
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
                        x2={chordStart[0]}
                        y2={chordStart[1]}
                        stroke={ACCENT}
                        strokeWidth={highlight === "angle" ? 5 : 3.5}
                        strokeLinecap="round"
                        style={eased}
                        {...hoverProps("angle")}
                    />
                    <line
                        x1={vertex[0]}
                        y1={vertex[1]}
                        x2={chordEnd[0]}
                        y2={chordEnd[1]}
                        stroke={ACCENT}
                        strokeWidth={highlight === "angle" ? 5 : 3.5}
                        strokeLinecap="round"
                        style={eased}
                        {...hoverProps("angle")}
                    />
                    <path d={anglePath} fill="none" stroke={ACCENT} strokeWidth="2" pointerEvents="none" />
                    <text
                        x={angleLabelX}
                        y={angleLabelY}
                        fontSize="14"
                        textAnchor="middle"
                        fill={ACCENT}
                        pointerEvents="none"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                        {formatDegrees(angleDegrees)}
                    </text>
                </g>
            )}

            {/* The dots the student placed */}
            <g opacity={dim("dots")} style={eased}>
                {points.map((degrees, index) => {
                    const [x, y] = rimPoint(degrees);
                    return (
                        <g key={`dot-${index}`}>
                            <circle
                                cx={x}
                                cy={y}
                                r={draggingIndex === index ? 11 : 9}
                                fill={ACCENT}
                                filter="url(#circle-parts-dot-shadow)"
                                pointerEvents="none"
                            />
                            <circle
                                cx={x}
                                cy={y}
                                r={22}
                                fill="transparent"
                                style={{ cursor: draggingIndex === index ? "grabbing" : "grab" }}
                                onPointerDown={(event) => {
                                    event.stopPropagation();
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                    setDraggingIndex(index);
                                }}
                                onPointerMove={handleDotMove(index)}
                                onPointerUp={() => setDraggingIndex(null)}
                                onPointerCancel={() => setDraggingIndex(null)}
                            />
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}

function CirclePartsFigure() {
    const setVar = useSetVar();
    const points = useVar<number[]>("circlePartsPoints", NO_POINTS);
    const hintStep = points.length >= 3 ? 2 : points.length;

    return (
        <Figure
            id="circle-parts-builder"
            caption="Click the rim to drop a dot. Two dots pull a chord across and name the two arcs; the third dot opens the angle standing on that chord. Drag any dot to move it."
            onReset={() => {
                setVar("circlePartsPoints", []);
                setVar("circlePartsPointCount", 0);
                setVar("circlePartsHighlight", "");
            }}
        >
            <CirclePartsDrawing />
            <InteractionHintSequence
                hintKey="circle-parts-place-dots"
                currentStep={hintStep}
                steps={[
                    { gesture: "click", label: "Click the rim to drop a dot", position: { x: "50%", y: "18%" } },
                    { gesture: "click", label: "Drop two more dots on the rim", position: { x: "73%", y: "52%" } },
                    {
                        gesture: "drag-circular",
                        label: "Drag any dot around the rim",
                        position: { x: "27%", y: "52%" },
                        dragPath: { type: "arc", startAngle: 150, endAngle: 210, radius: 34 },
                    },
                ]}
            />
        </Figure>
    );
}

export const circlePartsIntroduceBlocks: ReactElement[] = [
    <StackLayout key="layout-circle-parts-heading" maxWidth="xl">
        <Block id="circle-parts-heading" padding="md">
            <EditableH2 id="h2-circle-parts-heading" blockId="circle-parts-heading">
                Points, Chords and Arcs
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-parts-setup" maxWidth="xl">
        <Block id="circle-parts-setup" padding="sm">
            <EditableParagraph id="para-circle-parts-setup" blockId="circle-parts-setup">
                Every rule about circle angles begins the same way. Pick two points on the edge of a
                circle and join them with a straight line: that line is a{" "}
                <InlineLinkedHighlight
                    id="highlight-circle-parts-chord"
                    varName="circlePartsHighlight"
                    highlightId="chord"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('circlePartsHighlight'))}
                >
                    chord
                </InlineLinkedHighlight>
                , and it cuts the edge into two curved pieces called{" "}
                <InlineLinkedHighlight
                    id="highlight-circle-parts-arcs"
                    varName="circlePartsHighlight"
                    highlightId="arc"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('circlePartsHighlight'))}
                >
                    arcs
                </InlineLinkedHighlight>
                .
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-parts-invite" maxWidth="xl">
        <Block id="circle-parts-invite" padding="sm">
            <EditableParagraph id="para-circle-parts-invite" blockId="circle-parts-invite">
                Drop three dots anywhere on the rim below and the circle names its own parts: the
                first two pull a chord across, and the third opens an{" "}
                <InlineLinkedHighlight
                    id="highlight-circle-parts-angle"
                    varName="circlePartsHighlight"
                    highlightId="angle"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo('circlePartsHighlight'))}
                >
                    angle standing on that chord
                </InlineLinkedHighlight>
                , measured for you in the corner.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-parts-visual" maxWidth="xl">
        <Block id="circle-parts-visual" padding="sm" hasVisualization>
            <CirclePartsFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-parts-closing" maxWidth="xl">
        <Block id="circle-parts-closing" padding="sm">
            <EditableParagraph id="para-circle-parts-closing" blockId="circle-parts-closing">
                Chord, arc, and an angle standing on a chord: that is the entire vocabulary. Now drag
                that third dot slowly along its own curved piece and keep one eye on the
                measurement. Something about it refuses to budge.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-parts-question-vertex" maxWidth="xl">
        <Block id="circle-parts-question-vertex" padding="md">
            <EditableParagraph id="para-circle-parts-question-vertex" blockId="circle-parts-question-vertex">
                A dot is joined to both ends of a chord. For that corner to count as an angle
                standing on the chord, the dot has to sit on the circle's{" "}
                <InlineFeedback
                    varName="answerAngleVertexLocation"
                    correctValue="edge"
                    position="terminal"
                    successMessage="— exactly, all three dots live on the rim, which is why the corner is a circle angle at all"
                    failureMessage="— not quite."
                    hint="Every dot you dropped landed in the same place"
                    visualizationHint={{
                        blockId: "circle-parts-visual",
                        hintKey: "feedback-circle-parts-vertex",
                        label: "Discover it yourself",
                        resetVars: { circlePartsPointCount: 0 },
                        steps: [
                            {
                                gesture: "click",
                                label: "Click the rim to drop your first dot",
                                position: { x: "50%", y: "18%" },
                                completionVar: "circlePartsPointCount",
                                completionValue: 1,
                                completionTolerance: 0.5,
                            },
                            {
                                gesture: "click",
                                label: "Drop two more dots — the third one makes the corner",
                                position: { x: "73%", y: "52%" },
                                completionVar: "circlePartsPointCount",
                                completionValue: 3,
                                completionTolerance: 0.5,
                            },
                        ],
                    }}
                >
                    <InlineClozeChoice
                        varName="answerAngleVertexLocation"
                        correctAnswer="edge"
                        options={["centre", "edge", "chord", "inside"]}
                        {...choicePropsFromDefinition(getVariableInfo('answerAngleVertexLocation'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-parts-question-chords" maxWidth="xl">
        <Block id="circle-parts-question-chords" padding="md">
            <EditableParagraph id="para-circle-parts-question-chords" blockId="circle-parts-question-chords">
                Three dots sit on the rim, and every dot is joined to both of the others. The number
                of chords that gives is{" "}
                <InlineFeedback
                    varName="answerChordCount"
                    correctValue={["3", "three"]}
                    position="terminal"
                    successMessage="— right, one chord for each pair of dots, and three dots make three pairs"
                    failureMessage="— close."
                    hint="One chord needs two dots, so count how many different pairs three dots make"
                >
                    <InlineClozeInput
                        varName="answerChordCount"
                        correctAnswer={["3", "three"]}
                        {...clozePropsFromDefinition(getVariableInfo('answerChordCount'))}
                    />
                </InlineFeedback>.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];

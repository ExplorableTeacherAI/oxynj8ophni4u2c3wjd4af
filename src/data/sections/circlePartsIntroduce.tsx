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
 * Bespoke figure — the student draws the circle's parts themselves.
 *
 * A part is picked from the row along the top, then clicked onto the rim:
 * radius, diameter, tangent and the angle need one click, the chord needs two.
 * Each part is drawn in ink with its name attached, its rim points stay
 * draggable, and the chord also names the two arcs it creates.
 * ──────────────────────────────────────────────────────────────────────────── */

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 470;
const CENTER_X = 300;
const CENTER_Y = 262;
const RADIUS = 140;
const PAD = 24;
const TANGENT_REACH = 100;

const ACCENT = "#62D0AD";
const INK_STRONG = "#334155";
const INK_SOFT = "#64748B";
const MUTED = "#94A3B8";

const TOOLS = ["radius", "diameter", "chord", "tangent", "angle"] as const;
type Tool = (typeof TOOLS)[number];

const NO_CHORD: number[] = [];

const formatDegrees = (value: number) => `${Math.round(value)}°`;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const norm360 = (degrees: number) => ((degrees % 360) + 360) % 360;

const rimPoint = (degrees: number): [number, number] => [
    CENTER_X + RADIUS * Math.cos(toRadians(degrees)),
    CENTER_Y - RADIUS * Math.sin(toRadians(degrees)),
];

const rimArcPath = (from: number, to: number) => {
    const swept = norm360(to - from);
    const [startX, startY] = rimPoint(from);
    const [endX, endY] = rimPoint(to);
    return `M ${startX} ${startY} A ${RADIUS} ${RADIUS} 0 ${swept > 180 ? 1 : 0} 0 ${endX} ${endY}`;
};

const clampLabelX = (x: number, halfWidth: number) =>
    clamp(x, PAD + halfWidth, VIEW_WIDTH - PAD - halfWidth);
const clampLabelY = (y: number) => clamp(y, 82, VIEW_HEIGHT - 26);

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

/** Rough width of a label, used to keep every one inside the viewBox. */
const textWidth = (text: string, fontSize: number) => text.length * fontSize * 0.6;

function CirclePartsDrawing() {
    const setVar = useSetVar();
    const tool = useVar<string>("circlePartsTool", "radius") as Tool;
    const radiusAt = useVar<number>("circlePartsRadius", -1);
    const diameterAt = useVar<number>("circlePartsDiameter", -1);
    const tangentAt = useVar<number>("circlePartsTangent", -1);
    const angleAt = useVar<number>("circlePartsAngle", -1);
    const chord = useVar<number[]>("circlePartsChord", NO_CHORD);
    const partCount = useVar<number>("circlePartsPointCount", 0);
    const highlight = useVar<string>("circlePartsHighlight", "");
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<string | null>(null);

    const hasChord = chord.length >= 2;
    const hasAngle = hasChord && angleAt >= 0;
    const drawnCount =
        (radiusAt >= 0 ? 1 : 0) +
        (diameterAt >= 0 ? 1 : 0) +
        (tangentAt >= 0 ? 1 : 0) +
        (hasChord ? 1 : 0) +
        (hasAngle ? 1 : 0);

    // Writing 0 to the count variable (reset button, guided hints) clears the drawing.
    useEffect(() => {
        if (partCount === 0 && drawnCount > 0) {
            setVar("circlePartsRadius", -1);
            setVar("circlePartsDiameter", -1);
            setVar("circlePartsTangent", -1);
            setVar("circlePartsAngle", -1);
            setVar("circlePartsChord", []);
        }
    }, [partCount, drawnCount, setVar]);

    const angleFromPointer = useCallback((clientX: number, clientY: number) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return 0;
        const x = ((clientX - rect.left) / rect.width) * VIEW_WIDTH;
        const y = ((clientY - rect.top) / rect.height) * VIEW_HEIGHT;
        return norm360((Math.atan2(CENTER_Y - y, x - CENTER_X) * 180) / Math.PI);
    }, []);

    const bumpCount = (delta: number) => setVar("circlePartsPointCount", drawnCount + delta);

    const handleSurfaceDown = (event: ReactPointerEvent<SVGRectElement>) => {
        const degrees = Math.round(angleFromPointer(event.clientX, event.clientY));
        if (tool === "radius") {
            setVar("circlePartsRadius", degrees);
            bumpCount(radiusAt >= 0 ? 0 : 1);
        } else if (tool === "diameter") {
            setVar("circlePartsDiameter", degrees);
            bumpCount(diameterAt >= 0 ? 0 : 1);
        } else if (tool === "tangent") {
            setVar("circlePartsTangent", degrees);
            bumpCount(tangentAt >= 0 ? 0 : 1);
        } else if (tool === "chord") {
            if (chord.length === 1) {
                setVar("circlePartsChord", [chord[0], degrees]);
                bumpCount(1);
            } else {
                setVar("circlePartsChord", [degrees]);
                setVar("circlePartsAngle", -1);
                bumpCount(hasChord ? (hasAngle ? -2 : -1) : 0);
            }
        } else if (tool === "angle" && hasChord) {
            setVar("circlePartsAngle", degrees);
            bumpCount(hasAngle ? 0 : 1);
        }
    };

    const dragHandler =
        (name: string, varName: string) => (event: ReactPointerEvent<SVGCircleElement>) => {
            if (dragging !== name) return;
            setVar(varName, Math.round(angleFromPointer(event.clientX, event.clientY)));
        };

    const chordEndDrag = (index: number) => (event: ReactPointerEvent<SVGCircleElement>) => {
        if (dragging !== `chord-${index}`) return;
        const next = [...chord];
        next[index] = Math.round(angleFromPointer(event.clientX, event.clientY));
        setVar("circlePartsChord", next);
    };

    const dim = (id: string) => (highlight && highlight !== id ? 0.3 : 1);
    const lit = (id: string) => highlight === id;
    const strokeFor = (id: string) => (lit(id) ? ACCENT : INK_STRONG);
    const widthFor = (id: string) => (lit(id) ? 4.5 : 2.5);
    const hoverProps = (id: string) => ({
        onPointerEnter: () => setVar("circlePartsHighlight", id),
        onPointerLeave: () => setVar("circlePartsHighlight", ""),
    });
    const eased = { transition: "opacity 150ms ease-out, stroke-width 150ms ease-out" };

    const handle = (name: string, position: [number, number], onMove: (event: ReactPointerEvent<SVGCircleElement>) => void) => (
        <g key={`handle-${name}`}>
            <circle
                cx={position[0]}
                cy={position[1]}
                r={dragging === name ? 10 : 8}
                fill={ACCENT}
                filter="url(#circle-parts-dot-shadow)"
                pointerEvents="none"
            />
            <circle
                cx={position[0]}
                cy={position[1]}
                r={22}
                fill="transparent"
                style={{ cursor: dragging === name ? "grabbing" : "grab" }}
                onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging(name);
                }}
                onPointerMove={onMove}
                onPointerUp={() => setDragging(null)}
                onPointerCancel={() => setDragging(null)}
            />
        </g>
    );

    const partLabel = (id: string, text: string, x: number, y: number, fontSize = 12) => (
        <text
            x={clampLabelX(x, textWidth(text, fontSize) / 2)}
            y={clampLabelY(y)}
            fontSize={fontSize}
            textAnchor="middle"
            fill={lit(id) ? ACCENT : INK_SOFT}
            pointerEvents="none"
            style={{ fontVariantNumeric: "tabular-nums" }}
        >
            {text}
        </text>
    );

    // ── Tool row along the top ──────────────────────────────────────────────
    let cursorX = PAD;
    const toolRow = TOOLS.map((name) => {
        const isActive = tool === name;
        const width = textWidth(name, 13);
        const dotX = cursorX + 4;
        const labelX = cursorX + 14;
        cursorX += 14 + width + 26;
        return (
            <g
                key={`tool-${name}`}
                style={{ cursor: "pointer" }}
                onClick={() => setVar("circlePartsTool", name)}
            >
                <circle
                    cx={dotX}
                    cy={24}
                    r={isActive ? 5 : 3.5}
                    fill={isActive ? ACCENT : MUTED}
                    style={{ transition: "fill 150ms ease-out" }}
                />
                <text
                    x={labelX}
                    y={28}
                    fontSize="13"
                    fill={isActive ? ACCENT : MUTED}
                    fontWeight={isActive ? 600 : 400}
                    style={{ transition: "fill 150ms ease-out" }}
                >
                    {name}
                </text>
            </g>
        );
    });

    const statusLine =
        tool === "chord"
            ? chord.length === 1
                ? "Click a second point on the rim to finish the chord"
                : "Click two points on the rim to draw a chord"
            : tool === "angle"
              ? hasChord
                  ? "Click a third point on the rim to stand an angle on the chord"
                  : "Draw a chord first, then stand an angle on it"
              : `Click the rim to draw a ${tool}`;

    // ── Geometry of each drawn part ─────────────────────────────────────────
    const radiusEnd = radiusAt >= 0 ? rimPoint(radiusAt) : null;
    const diameterEnd = diameterAt >= 0 ? rimPoint(diameterAt) : null;
    const diameterOpposite = diameterAt >= 0 ? rimPoint(diameterAt + 180) : null;
    const tangentTouch = tangentAt >= 0 ? rimPoint(tangentAt) : null;
    const tangentDirection: [number, number] | null =
        tangentAt >= 0
            ? [Math.sin(toRadians(tangentAt)), Math.cos(toRadians(tangentAt))]
            : null;

    const chordStart = hasChord ? rimPoint(chord[0]) : null;
    const chordFinish = hasChord ? rimPoint(chord[1]) : null;
    const angleVertex = hasAngle ? rimPoint(angleAt) : null;
    const angleValue =
        hasAngle && chordStart && chordFinish && angleVertex
            ? angleBetween(unitTo(angleVertex, chordStart), unitTo(angleVertex, chordFinish))
            : 0;

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

            {/* Click surface — turns a click into a part on the rim */}
            <rect
                x="0"
                y="44"
                width={VIEW_WIDTH}
                height={VIEW_HEIGHT - 44}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onPointerDown={handleSurfaceDown}
            />

            {toolRow}

            <text x={PAD} y={64} fontSize="13" fill={INK_SOFT}>
                {statusLine}
            </text>

            {/* Rim */}
            <g opacity={dim("rim")} style={eased} pointerEvents="none">
                <circle cx={CENTER_X} cy={CENTER_Y} r={RADIUS} fill="none" stroke={INK_SOFT} strokeWidth="2" />
                <circle cx={CENTER_X} cy={CENTER_Y} r="3.5" fill={INK_SOFT} />
            </g>

            {/* The two arcs a chord creates */}
            {hasChord && (
                <g opacity={dim("arc")} style={eased}>
                    {lit("arc") && (
                        <>
                            <path d={rimArcPath(chord[0], chord[1])} fill="none" stroke={ACCENT} strokeWidth="10" strokeLinecap="round" opacity={0.28} />
                            <path d={rimArcPath(chord[1], chord[0])} fill="none" stroke={ACCENT} strokeWidth="10" strokeLinecap="round" opacity={0.28} />
                        </>
                    )}
                    <path
                        d={rimArcPath(chord[0], chord[1])}
                        fill="none"
                        stroke={strokeFor("arc")}
                        strokeWidth={widthFor("arc")}
                        strokeLinecap="round"
                        style={eased}
                        {...hoverProps("arc")}
                    />
                    <path
                        d={rimArcPath(chord[1], chord[0])}
                        fill="none"
                        stroke={strokeFor("arc")}
                        strokeWidth={widthFor("arc")}
                        strokeLinecap="round"
                        style={eased}
                        {...hoverProps("arc")}
                    />
                    {[
                        chord[0] + norm360(chord[1] - chord[0]) / 2,
                        chord[1] + norm360(chord[0] - chord[1]) / 2,
                    ].map((midAngle, index) => (
                        <g key={`arc-label-${index}`}>
                            {partLabel(
                                "arc",
                                "arc",
                                CENTER_X + (RADIUS + 24) * Math.cos(toRadians(midAngle)),
                                CENTER_Y - (RADIUS + 24) * Math.sin(toRadians(midAngle)) + 4,
                            )}
                        </g>
                    ))}
                </g>
            )}

            {/* Diameter */}
            {diameterEnd && diameterOpposite && (
                <g opacity={dim("diameter")} style={eased}>
                    {lit("diameter") && (
                        <line x1={diameterEnd[0]} y1={diameterEnd[1]} x2={diameterOpposite[0]} y2={diameterOpposite[1]} stroke={ACCENT} strokeWidth="10" strokeLinecap="round" opacity={0.28} />
                    )}
                    <line
                        x1={diameterEnd[0]}
                        y1={diameterEnd[1]}
                        x2={diameterOpposite[0]}
                        y2={diameterOpposite[1]}
                        stroke={strokeFor("diameter")}
                        strokeWidth={widthFor("diameter")}
                        strokeLinecap="round"
                        style={eased}
                        {...hoverProps("diameter")}
                    />
                    {partLabel(
                        "diameter",
                        "diameter",
                        CENTER_X + (diameterOpposite[0] - CENTER_X) * 0.55,
                        CENTER_Y + (diameterOpposite[1] - CENTER_Y) * 0.55 - 10,
                    )}
                </g>
            )}

            {/* Radius */}
            {radiusEnd && (
                <g opacity={dim("radius")} style={eased}>
                    {lit("radius") && (
                        <line x1={CENTER_X} y1={CENTER_Y} x2={radiusEnd[0]} y2={radiusEnd[1]} stroke={ACCENT} strokeWidth="10" strokeLinecap="round" opacity={0.28} />
                    )}
                    <line
                        x1={CENTER_X}
                        y1={CENTER_Y}
                        x2={radiusEnd[0]}
                        y2={radiusEnd[1]}
                        stroke={strokeFor("radius")}
                        strokeWidth={widthFor("radius")}
                        strokeLinecap="round"
                        style={eased}
                        {...hoverProps("radius")}
                    />
                    {partLabel(
                        "radius",
                        "radius",
                        CENTER_X + (radiusEnd[0] - CENTER_X) * 0.5,
                        CENTER_Y + (radiusEnd[1] - CENTER_Y) * 0.5 - 10,
                    )}
                </g>
            )}

            {/* Tangent */}
            {tangentTouch && tangentDirection && (
                <g opacity={dim("tangent")} style={eased}>
                    {lit("tangent") && (
                        <line
                            x1={tangentTouch[0] - tangentDirection[0] * TANGENT_REACH}
                            y1={tangentTouch[1] - tangentDirection[1] * TANGENT_REACH}
                            x2={tangentTouch[0] + tangentDirection[0] * TANGENT_REACH}
                            y2={tangentTouch[1] + tangentDirection[1] * TANGENT_REACH}
                            stroke={ACCENT}
                            strokeWidth="10"
                            strokeLinecap="round"
                            opacity={0.28}
                        />
                    )}
                    <line
                        x1={tangentTouch[0] - tangentDirection[0] * TANGENT_REACH}
                        y1={tangentTouch[1] - tangentDirection[1] * TANGENT_REACH}
                        x2={tangentTouch[0] + tangentDirection[0] * TANGENT_REACH}
                        y2={tangentTouch[1] + tangentDirection[1] * TANGENT_REACH}
                        stroke={strokeFor("tangent")}
                        strokeWidth={widthFor("tangent")}
                        strokeLinecap="round"
                        style={eased}
                        {...hoverProps("tangent")}
                    />
                    {partLabel(
                        "tangent",
                        "tangent",
                        tangentTouch[0] + tangentDirection[0] * (TANGENT_REACH - 26),
                        tangentTouch[1] + tangentDirection[1] * (TANGENT_REACH - 26) - 10,
                    )}
                </g>
            )}

            {/* Chord */}
            {chordStart && chordFinish && (
                <g opacity={dim("chord")} style={eased}>
                    {lit("chord") && (
                        <line x1={chordStart[0]} y1={chordStart[1]} x2={chordFinish[0]} y2={chordFinish[1]} stroke={ACCENT} strokeWidth="10" strokeLinecap="round" opacity={0.28} />
                    )}
                    <line
                        x1={chordStart[0]}
                        y1={chordStart[1]}
                        x2={chordFinish[0]}
                        y2={chordFinish[1]}
                        stroke={strokeFor("chord")}
                        strokeWidth={widthFor("chord")}
                        strokeLinecap="round"
                        style={eased}
                        {...hoverProps("chord")}
                    />
                    {partLabel(
                        "chord",
                        "chord",
                        (chordStart[0] + chordFinish[0]) / 2,
                        (chordStart[1] + chordFinish[1]) / 2 - 10,
                    )}
                </g>
            )}

            {/* The angle standing on the chord */}
            {hasAngle && angleVertex && chordStart && chordFinish && (
                <g opacity={dim("angle")} style={eased}>
                    {lit("angle") && (
                        <>
                            <line x1={angleVertex[0]} y1={angleVertex[1]} x2={chordStart[0]} y2={chordStart[1]} stroke={ACCENT} strokeWidth="10" strokeLinecap="round" opacity={0.28} />
                            <line x1={angleVertex[0]} y1={angleVertex[1]} x2={chordFinish[0]} y2={chordFinish[1]} stroke={ACCENT} strokeWidth="10" strokeLinecap="round" opacity={0.28} />
                        </>
                    )}
                    <line
                        x1={angleVertex[0]}
                        y1={angleVertex[1]}
                        x2={chordStart[0]}
                        y2={chordStart[1]}
                        stroke={strokeFor("angle")}
                        strokeWidth={widthFor("angle")}
                        strokeLinecap="round"
                        style={eased}
                        {...hoverProps("angle")}
                    />
                    <line
                        x1={angleVertex[0]}
                        y1={angleVertex[1]}
                        x2={chordFinish[0]}
                        y2={chordFinish[1]}
                        stroke={strokeFor("angle")}
                        strokeWidth={widthFor("angle")}
                        strokeLinecap="round"
                        style={eased}
                        {...hoverProps("angle")}
                    />
                    <path
                        d={cornerMarkerPath(
                            angleVertex,
                            unitTo(angleVertex, chordStart),
                            unitTo(angleVertex, chordFinish),
                            26,
                        )}
                        fill="none"
                        stroke={strokeFor("angle")}
                        strokeWidth="2"
                        pointerEvents="none"
                    />
                    {partLabel(
                        "angle",
                        `angle ${formatDegrees(angleValue)}`,
                        angleVertex[0] + unitTo([CENTER_X, CENTER_Y], angleVertex)[0] * 34,
                        angleVertex[1] + unitTo([CENTER_X, CENTER_Y], angleVertex)[1] * 34 + 4,
                        13,
                    )}
                </g>
            )}

            {/* Draggable handles for everything drawn so far */}
            {radiusEnd && handle("radius", radiusEnd, dragHandler("radius", "circlePartsRadius"))}
            {diameterEnd && handle("diameter", diameterEnd, dragHandler("diameter", "circlePartsDiameter"))}
            {tangentTouch && handle("tangent", tangentTouch, dragHandler("tangent", "circlePartsTangent"))}
            {chord.map((degrees, index) => handle(`chord-${index}`, rimPoint(degrees), chordEndDrag(index)))}
            {angleVertex && handle("angle", angleVertex, dragHandler("angle", "circlePartsAngle"))}
        </svg>
    );
}

function CirclePartsFigure() {
    const setVar = useSetVar();
    const partCount = useVar<number>("circlePartsPointCount", 0);

    return (
        <Figure
            id="circle-parts-builder"
            caption="Pick a part from the row along the top, then click the rim to draw it. Radius, diameter, tangent and the angle take one click; the chord takes two, and it also names the arcs. Every dot you leave behind can be dragged."
            onReset={() => {
                setVar("circlePartsTool", "radius");
                setVar("circlePartsRadius", -1);
                setVar("circlePartsDiameter", -1);
                setVar("circlePartsTangent", -1);
                setVar("circlePartsAngle", -1);
                setVar("circlePartsChord", []);
                setVar("circlePartsPointCount", 0);
                setVar("circlePartsHighlight", "");
            }}
        >
            <CirclePartsDrawing />
            <InteractionHintSequence
                hintKey="circle-parts-pick-and-draw"
                currentStep={partCount > 0 ? 1 : 0}
                steps={[
                    { gesture: "click", label: "Pick a part, then click the rim to draw it", position: { x: "22%", y: "6%" } },
                    {
                        gesture: "drag-circular",
                        label: "Drag any dot to move the part you drew",
                        position: { x: "74%", y: "56%" },
                        dragPath: { type: "arc", startAngle: 30, endAngle: -30, radius: 32 },
                    },
                ]}
            />
        </Figure>
    );
}

const partHighlight = (id: string, highlightId: string, children: string) => (
    <InlineLinkedHighlight
        id={id}
        varName="circlePartsHighlight"
        highlightId={highlightId}
        {...linkedHighlightPropsFromDefinition(getVariableInfo('circlePartsHighlight'))}
    >
        {children}
    </InlineLinkedHighlight>
);

export const circlePartsIntroduceBlocks: ReactElement[] = [
    <StackLayout key="layout-circle-parts-heading" maxWidth="xl">
        <Block id="circle-parts-heading" padding="md">
            <EditableH2 id="h2-circle-parts-heading" blockId="circle-parts-heading">
                The Parts of a Circle
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-parts-setup" maxWidth="xl">
        <Block id="circle-parts-setup" padding="sm">
            <EditableParagraph id="para-circle-parts-setup" blockId="circle-parts-setup">
                A circle keeps a handful of straight lines close by. The{" "}
                {partHighlight("highlight-circle-parts-radius", "radius", "radius")} runs from the
                centre out to the edge, the{" "}
                {partHighlight("highlight-circle-parts-diameter", "diameter", "diameter")} carries
                straight on through to the far side, and a{" "}
                {partHighlight("highlight-circle-parts-chord", "chord", "chord")} joins two edge
                points while missing the centre. A{" "}
                {partHighlight("highlight-circle-parts-tangent", "tangent", "tangent")} never gets
                inside at all; it only touches the rim once.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-parts-invite" maxWidth="xl">
        <Block id="circle-parts-invite" padding="sm">
            <EditableParagraph id="para-circle-parts-invite" blockId="circle-parts-invite">
                Pick a part below, click the rim, and it draws itself with its name attached. A
                chord also splits the edge into two{" "}
                {partHighlight("highlight-circle-parts-arcs", "arc", "arcs")}, and a third point
                joined to both its ends opens an{" "}
                {partHighlight("highlight-circle-parts-angle", "angle", "angle standing on that chord")}
                .
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
                Those are the pieces. Now drag that third dot along its arc and watch the
                measurement: something about it refuses to budge.
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
                    hint="Every part you drew started from a point in the same place"
                    visualizationHint={{
                        blockId: "circle-parts-visual",
                        hintKey: "feedback-circle-parts-vertex",
                        label: "Discover it yourself",
                        resetVars: { circlePartsPointCount: 0, circlePartsTool: "chord" },
                        steps: [
                            {
                                gesture: "click",
                                label: "With chord picked, click two points on the rim",
                                position: { x: "50%", y: "22%" },
                                completionVar: "circlePartsPointCount",
                                completionValue: 1,
                                completionTolerance: 0.4,
                            },
                            {
                                gesture: "click",
                                label: "Now pick angle and click a third point on the rim",
                                position: { x: "22%", y: "6%" },
                                completionVar: "circlePartsPointCount",
                                completionValue: 2,
                                completionTolerance: 0.4,
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

    <StackLayout key="layout-circle-parts-question-diameter" maxWidth="xl">
        <Block id="circle-parts-question-diameter" padding="md">
            <EditableParagraph id="para-circle-parts-question-diameter" blockId="circle-parts-question-diameter">
                A chord is dragged around until it passes right through the centre. At that moment
                it has become a{" "}
                <InlineFeedback
                    varName="answerChordThroughCentre"
                    correctValue="diameter"
                    position="terminal"
                    successMessage="— yes, and that makes the diameter the longest chord a circle can hold"
                    failureMessage="— have another look."
                    hint="Which of the parts runs from edge to edge straight through the middle?"
                    reviewBlockId="circle-parts-setup"
                    reviewLabel="Look again at the parts"
                >
                    <InlineClozeChoice
                        varName="answerChordThroughCentre"
                        correctAnswer="diameter"
                        options={["radius", "diameter", "tangent", "arc"]}
                        {...choicePropsFromDefinition(getVariableInfo('answerChordThroughCentre'))}
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

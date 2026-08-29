import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph, InlineTooltip } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

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
                <InlineTooltip id="tooltip-chord-definition" tooltip="A straight line joining any two points on the edge of a circle.">
                    chord
                </InlineTooltip>
                , and it cuts the edge into two curved pieces called{" "}
                <InlineTooltip id="tooltip-arc-definition" tooltip="One of the curved pieces of a circle's edge, between two points on it.">
                    arcs
                </InlineTooltip>
                .
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-parts-angle-idea" maxWidth="xl">
        <Block id="circle-parts-angle-idea" padding="sm">
            <EditableParagraph id="para-circle-parts-angle-idea" blockId="circle-parts-angle-idea">
                Now pick a third point on the edge and join it to both ends of the chord. Those two
                lines meet at a corner, and that corner is an angle standing on the chord. So what
                happens to that angle when the third point sits somewhere else?
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-parts-visual" maxWidth="xl">
        <Block id="circle-parts-visual">
            <VisualOptionCards
                blockId="circle-parts-visual"
                intro="Pick how students should meet the parts of a circle."
                cards={[
                    {
                        id: "build-the-parts",
                        title: "An empty circle that names each part as students add it",
                        looks: "Imagine a plain circle drawn on white paper with nothing inside it. Each dot dropped onto the rim stays where it lands, and as soon as two dots are joined the line between them appears with the word chord beside it, while the two curved pieces of rim are shaded and named as arcs.",
                        manipulate: "Drop three dots on the rim, joining two of them into a chord and the third into a corner standing on it",
                        reveals: "A chord, an arc and an angle in a circle are all built from nothing more than points on the rim.",
                        paradigm: "constructivist",
                        recommended: true,
                    },
                    {
                        id: "trampoline-park-view",
                        title: "A circular trampoline park from above, with two poles and a person on the rim",
                        looks: "Imagine looking straight down on a round trampoline park. Two poles stand on the edge with a straight rope stretched between them, and one person stands elsewhere on the rim with a thin sight line drawn from them to each pole, every part labelled in words.",
                        manipulate: "Drag the person around the rim and watch the rope, the two curved stretches of edge and the two sight lines keep their labels",
                        reveals: "The rope is a chord, the curved stretches are arcs, and the sight lines make an angle standing on the chord.",
                        paradigm: "conventional",
                    },
                    {
                        id: "name-that-part",
                        title: "A circle crossed by several lines, with one part named at a time",
                        looks: "Imagine a circle with a few straight lines already drawn across it and its rim divided into pieces. One word sits above the circle, such as chord or arc, and the piece that matches glows and holds its name when it is clicked correctly.",
                        manipulate: "Click the piece of the circle that matches the word shown above it",
                        reveals: "Students can tell a chord from an arc on sight, rather than only reciting the definitions.",
                        paradigm: "goal",
                    },
                ]}
            />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-parts-closing" maxWidth="xl">
        <Block id="circle-parts-closing" padding="sm">
            <EditableParagraph id="para-circle-parts-closing" blockId="circle-parts-closing">
                Chord, arc, and an angle standing on a chord. That is the whole vocabulary, and
                everything that follows is about what that angle does.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];

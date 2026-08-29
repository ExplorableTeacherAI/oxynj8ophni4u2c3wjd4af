import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

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
                Here is the surprise. Any point on the same arc gives exactly the same angle, so a
                corner tucked close to the chord, where the angle looks like it must be wider,
                measures the same as one high above it. These are called angles in the same segment.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-same-segment-catch" maxWidth="xl">
        <Block id="same-segment-catch" padding="sm">
            <EditableParagraph id="para-same-segment-catch" blockId="same-segment-catch">
                There is a catch. A corner on the other arc, the far side of the chord, does not
                match; it gives a different number entirely. Equal angles are not just any two
                angles in a circle, only the ones standing on the same chord from the same side.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-same-segment-visual" maxWidth="xl">
        <Block id="same-segment-visual">
            <VisualOptionCards
                blockId="same-segment-visual"
                intro="Pick how students should test whether the angle really stays the same."
                cards={[
                    {
                        id: "guess-the-near-angle",
                        title: "Two corners on the same chord, one tucked near it and one high above",
                        looks: "Imagine a circle with a straight line drawn across the middle. Two corners sit on the curve above that line, one squeezed close to it and one far up, each joined by a pair of straight lines to the two ends of the chord. Only the far corner shows its measurement.",
                        manipulate: "Open or close a faint copy of the near corner to the size they think it is, then release it to see the real measurement appear",
                        reveals: "The corner nearer the chord is not wider at all; both corners measure exactly the same.",
                        targetsMisconception: "Students think an angle looks bigger when its point sits closer to the chord",
                        paradigm: "prediction",
                        recommended: true,
                    },
                    {
                        id: "slide-and-trace",
                        title: "One corner sliding along the arc, leaving its measurement behind at each stop",
                        looks: "Imagine a circle with a chord across it and a single corner above, joined to both ends of that chord. As the corner travels along the curve it drops a faint copy of itself at every stop, and each copy keeps the number it measured, so a trail of numbers builds up along the arc.",
                        manipulate: "Slide the corner along the arc and leave a trail of measured copies behind it",
                        reveals: "Every copy in the trail shows the same number, so the angle depends on the chord, not on where the corner sits.",
                        paradigm: "temporal",
                    },
                    {
                        id: "both-sides-of-the-chord",
                        title: "Two corners on the same chord but on opposite sides of it",
                        looks: "Imagine a circle split by a chord into a large piece above and a smaller piece below. One corner sits in the upper piece and another in the lower one, both joined to the same two ends of the chord, and each carries its own measurement written beside it.",
                        manipulate: "Drag either corner along its own side of the chord and compare the two measurements as they move",
                        reveals: "Corners on the same side always match each other, while a corner on the far side gives a different number every time.",
                        targetsMisconception: "Students think any two angles in a circle are equal, not just ones on the same arc",
                        paradigm: "comparison",
                    },
                ]}
            />
        </Block>
    </StackLayout>,
];

import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph, InlineTooltip } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

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
                Four points on the edge of a circle, joined in order, make a four-sided shape called
                a{" "}
                <InlineTooltip id="tooltip-cyclic-quadrilateral-definition" tooltip="A four-sided shape whose four corners all sit on the edge of the same circle.">
                    cyclic quadrilateral
                </InlineTooltip>
                . Cyclic simply means every corner sits on the circle.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-cyclic-quad-claim" maxWidth="xl">
        <Block id="cyclic-quad-claim" padding="sm">
            <EditableParagraph id="para-cyclic-quad-claim" blockId="cyclic-quad-claim">
                Its corners hide a neat rule. Take one corner and the corner diagonally across from
                it, never the one next door, and those two angles always add to 180 degrees. That
                holds however squashed or stretched the shape becomes, which is worth checking for
                yourself.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-cyclic-quad-visual" maxWidth="xl">
        <Block id="cyclic-quad-visual">
            <VisualOptionCards
                blockId="cyclic-quad-visual"
                intro="Pick how students should discover which pair of corners adds to 180."
                cards={[
                    {
                        id: "guess-the-fourth-corner",
                        title: "A four-cornered shape inside a circle with three angles shown and one blank",
                        looks: "Imagine a circle with four corners on its rim joined in order into a four-sided shape. Three of the corners have their measurements written beside them; the fourth is blank and holds a faint corner that can be opened and closed like a pair of scissors.",
                        manipulate: "Open or close the faint corner to the size they think the blank one should be, then release it to see the true measurement",
                        reveals: "The blank corner is decided by the corner diagonally opposite it, not by either of the corners beside it.",
                        targetsMisconception: "Students add angles that are next to each other in a cyclic quadrilateral instead of opposite ones",
                        paradigm: "prediction",
                        recommended: true,
                    },
                    {
                        id: "build-your-own-quadrilateral",
                        title: "An empty circle where students drop four corners to build their own shape",
                        looks: "Imagine a bare circle with four small markers waiting beside it. As each marker is dropped onto the rim the shape closes up between them, and underneath the circle two running totals appear, one for each pair of corners that face each other across the shape.",
                        manipulate: "Drop four markers anywhere on the rim to build a shape, then drag them around to squash and stretch it",
                        reveals: "However lopsided the shape gets, both totals stay stuck at 180.",
                        paradigm: "constructivist",
                    },
                    {
                        id: "corner-on-and-off-the-rim",
                        title: "Two four-sided shapes side by side, one with every corner on the circle and one without",
                        looks: "Imagine two identical circles next to each other, each holding a four-sided shape. In the left shape all four corners sit on the rim, while in the right one a single corner has drifted inside the circle, and each shape shows the total of its facing corners underneath.",
                        manipulate: "Drag the loose corner of the right shape on and off the rim and compare the two totals",
                        reveals: "The 180 total holds only while every corner is genuinely on the circle.",
                        paradigm: "comparison",
                    },
                ]}
            />
        </Block>
    </StackLayout>,
];

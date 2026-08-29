import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";
import { VisualOptionCards } from "@/components/organisms";

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
                Two rules, and that is the whole toolkit. Angles standing on the same chord from the
                same side are equal. Opposite corners of a cyclic quadrilateral add to 180 degrees.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-both-theorems-method" maxWidth="xl">
        <Block id="both-theorems-method" padding="sm">
            <EditableParagraph id="para-both-theorems-method" blockId="both-theorems-method">
                Almost every question hands you one angle and asks for another, so the real job is
                choosing which rule connects them. Do the two angles stand on the same chord? Then
                they match. Do they sit at facing corners of a four-sided shape? Then they add to
                180.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-both-theorems-visual" maxWidth="xl">
        <Block id="both-theorems-visual">
            <VisualOptionCards
                blockId="both-theorems-visual"
                intro="Pick how students should see a worked question solved."
                cards={[
                    {
                        id: "one-circle-two-rules",
                        title: "One circle carrying both rules, with each rule's angles lit in turn",
                        looks: "Imagine a single circle holding a chord with two corners standing on it, and a four-sided shape sharing two of those corners. Beside the circle sit the two rules written out, and choosing one lights up only the angles that rule is about while the rest of the drawing fades back.",
                        manipulate: "Tap either rule, then drag the lit corners around the rim and watch that rule keep holding",
                        reveals: "Both rules live in the same picture, so choosing the right one is a matter of seeing which corners are involved.",
                        paradigm: "conventional",
                        recommended: true,
                    },
                    {
                        id: "fill-in-the-circle",
                        title: "A circle with one angle given and the rest hidden behind letters",
                        looks: "Imagine a circle holding a chord, a four-sided shape and four lettered corners. One corner shows its size in full; the others are hidden behind their letters, and a running list beside the circle keeps a note of every angle that has been found so far.",
                        manipulate: "Click a hidden corner, set the size they have worked out, and watch it lock into the list when it is right",
                        reveals: "A single given angle is enough to unlock the whole circle, one rule at a time.",
                        paradigm: "goal",
                    },
                    {
                        id: "worked-example-step-through",
                        title: "A question circle beside its written working, revealed one line at a time",
                        looks: "Imagine a textbook-style circle on the left with one angle marked, and a column of working on the right that starts blank apart from the first line. Each new line that appears lights up the matching angles in the circle while the rest of the drawing dims.",
                        manipulate: "Step through the working line by line, then drag the marked angle to rerun the whole example with new numbers",
                        reveals: "The working never changes shape, only its numbers, so the same method fits every question of this kind.",
                        paradigm: "temporal",
                    },
                ]}
            />
        </Block>
    </StackLayout>,
];

import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH1, EditableParagraph } from "@/components/atoms";

export const circleIntroOrientBlocks: ReactElement[] = [
    <StackLayout key="layout-circle-intro-title" maxWidth="xl">
        <Block id="circle-intro-title" padding="md">
            <EditableH1 id="h1-circle-intro-title" blockId="circle-intro-title">
                Angles Inside a Circle
            </EditableH1>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-intro-hook" maxWidth="xl">
        <Block id="circle-intro-hook" padding="sm">
            <EditableParagraph id="para-circle-intro-hook" blockId="circle-intro-hook">
                Stand anywhere on the rim of a circular trampoline park and look across at the same
                two poles on the far edge. Now walk to a completely different spot on the rim and
                look again. The angle between those two poles is exactly the same as before.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-intro-promise" maxWidth="xl">
        <Block id="circle-intro-promise" padding="sm">
            <EditableParagraph id="para-circle-intro-promise" blockId="circle-intro-promise">
                That is not a trick of the eye. It is one of two rules that let you find a missing
                angle inside a circle without measuring anything at all. We start from nothing, meet
                the few parts of a circle these rules need, and by the end you will be working out
                missing angles yourself.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];

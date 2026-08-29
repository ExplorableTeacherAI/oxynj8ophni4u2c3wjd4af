import { type ReactElement } from "react";
import { Block } from "@/components/templates";
import { StackLayout } from "@/components/layouts";
import { EditableH2, EditableParagraph } from "@/components/atoms";

export const circleConclusionBlocks: ReactElement[] = [
    <StackLayout key="layout-circle-conclusion-heading" maxWidth="xl">
        <Block id="circle-conclusion-heading" padding="md">
            <EditableH2 id="h2-circle-conclusion-heading" blockId="circle-conclusion-heading">
                Wrapping Up
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-conclusion-promise-kept" maxWidth="xl">
        <Block id="circle-conclusion-promise-kept" padding="sm">
            <EditableParagraph id="para-circle-conclusion-promise-kept" blockId="circle-conclusion-promise-kept">
                So the angle you saw from the rim of the trampoline park was never going to change,
                because every spot on that arc looks across at the two poles in exactly the same
                way. Add a fourth point and close the shape up, and the corners facing each other
                settle at 180 degrees between them.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-circle-conclusion-whats-next" maxWidth="xl">
        <Block id="circle-conclusion-whats-next" padding="sm">
            <EditableParagraph id="para-circle-conclusion-whats-next" blockId="circle-conclusion-whats-next">
                Both rules come from the same place: which arc a corner sits on matters far more
                than where on that arc it happens to be. Next comes the angle at the centre, the
                rule these two are quietly built from.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];

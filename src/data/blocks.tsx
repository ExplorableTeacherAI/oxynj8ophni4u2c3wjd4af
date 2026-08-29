import { type ReactElement } from "react";

// Initialize variables and their colors from this file's variable definitions
import { useVariableStore, initializeVariableColors } from "@/stores";
import { getDefaultValues, variableDefinitions } from "./variables";
useVariableStore.getState().initialize(getDefaultValues());
initializeVariableColors(variableDefinitions);

import { circleIntroOrientBlocks } from "./sections/circleIntroOrient";
import { circlePartsIntroduceBlocks } from "./sections/circlePartsIntroduce";
import { sameSegmentExploreBlocks } from "./sections/sameSegmentExplore";
import { cyclicQuadExploreBlocks } from "./sections/cyclicQuadExplore";
import { bothTheoremsTogetherBlocks } from "./sections/bothTheoremsTogether";
import { circleConclusionBlocks } from "./sections/circleConclusion";

export const blocks: ReactElement[] = [
    ...circleIntroOrientBlocks,
    ...circlePartsIntroduceBlocks,
    ...sameSegmentExploreBlocks,
    ...cyclicQuadExploreBlocks,
    ...bothTheoremsTogetherBlocks,
    ...circleConclusionBlocks,
];

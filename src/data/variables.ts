/**
 * Variables Configuration
 * =======================
 * 
 * CENTRAL PLACE TO DEFINE ALL SHARED VARIABLES
 * 
 * This file defines all variables that can be shared across sections.
 * AI agents should read this file to understand what variables are available.
 * 
 * USAGE:
 * 1. Define variables here with their default values and metadata
 * 2. Use them in any section with: const x = useVar('variableName', defaultValue)
 * 3. Update them with: setVar('variableName', newValue)
 */

import { type VarValue } from '@/stores';

/**
 * Variable definition with metadata
 */
export interface VariableDefinition {
    /** Default value */
    defaultValue: VarValue;
    /** Human-readable label */
    label?: string;
    /** Description for AI agents */
    description?: string;
    /** Variable type hint */
    type?: 'number' | 'text' | 'boolean' | 'select' | 'array' | 'object' | 'spotColor' | 'linkedHighlight';
    /** Unit (e.g., 'Hz', '°', 'm/s') - for numbers */
    unit?: string;
    /** Minimum value (for number sliders) */
    min?: number;
    /** Maximum value (for number sliders) */
    max?: number;
    /** Step increment (for number sliders) */
    step?: number;
    /** Display color for InlineScrubbleNumber / InlineSpotColor (e.g. '#D81B60') */
    color?: string;
    /** Options for 'select' type variables */
    options?: string[];
    /** Placeholder text for text inputs */
    placeholder?: string;
    /**
     * Correct answer for cloze input validation.
     * Accepts a single string, pipe-separated alternates (e.g. "first | 1 | 1st"),
     * or an array of accepted answers (e.g. ["first", "1", "1st"]).
     */
    correctAnswer?: string | string[];
    /** Whether cloze matching is case sensitive */
    caseSensitive?: boolean;
    /** Background color for inline components */
    bgColor?: string;
    /** Schema hint for object types (for AI agents) */
    schema?: string;
}

/**
 * =====================================================
 * 🎯 DEFINE YOUR VARIABLES HERE
 * =====================================================
 * 
 * SUPPORTED TYPES:
 * 
 * 1. NUMBER (slider):
 *    { defaultValue: 5, type: 'number', min: 0, max: 10, step: 1 }
 * 
 * 2. TEXT (free text):
 *    { defaultValue: 'Hello', type: 'text', placeholder: 'Enter text...' }
 * 
 * 3. SELECT (dropdown):
 *    { defaultValue: 'sine', type: 'select', options: ['sine', 'cosine', 'tangent'] }
 * 
 * 4. BOOLEAN (toggle):
 *    { defaultValue: true, type: 'boolean' }
 * 
 * 5. ARRAY (list of numbers):
 *    { defaultValue: [1, 2, 3], type: 'array' }
 * 
 * 6. OBJECT (complex data):
 *    { defaultValue: { x: 5, y: 10 }, type: 'object', schema: '{ x: number, y: number }' }
 */
export const variableDefinitions: Record<string, VariableDefinition> = {
    // ========================================
    // SECTION: Points, Chords and Arcs
    // ========================================

    /** Angles (in degrees, measured anticlockwise from east) of the dots the
     *  student has dropped on the circle's rim. Index 0 and 1 are the ends of
     *  the chord; index 2 is the vertex of the angle standing on it. */
    circlePartsPoints: {
        defaultValue: [],
        type: 'array',
        label: 'Dots on the rim',
        description: 'Rim positions of the dots the student has placed, in degrees',
    },

    /** Mirror of circlePartsPoints.length so guided hints can watch progress
     *  and so a reset can be triggered by writing 0. */
    circlePartsPointCount: {
        defaultValue: 0,
        type: 'number',
        label: 'Dots placed',
        description: 'How many dots the student has dropped on the rim',
        min: 0,
        max: 3,
        step: 1,
    },

    /** Shared hover channel between the prose and the circle drawing.
     *  Values: '' | 'chord' | 'arc' | 'angle' */
    circlePartsHighlight: {
        defaultValue: '',
        type: 'text',
        label: 'Circle part highlight',
        description: 'Which part of the circle is currently highlighted',
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.2)',
    },

    /** Assessment: where the vertex of an angle standing on a chord must sit. */
    answerAngleVertexLocation: {
        defaultValue: '',
        type: 'select',
        label: 'Angle vertex location',
        description: 'Student answer for where the corner of the angle must sit',
        placeholder: '???',
        correctAnswer: 'edge',
        options: ['centre', 'edge', 'chord', 'inside'],
        color: '#8E90F5',
    },

    // ========================================
    // SECTION: Angles in the Same Segment
    // ========================================

    /** Where the corner tucked near the chord sits on the upper arc (0 = beside
     *  one chord end, 1 = beside the other). */
    sameSegmentNearSpot: {
        defaultValue: 0.08,
        type: 'number',
        label: 'Near corner position',
        description: 'Position of the corner tucked close to the chord, along the upper arc',
        min: 0.05,
        max: 0.95,
        step: 0.01,
        color: '#62D0AD',
    },

    /** Where the corner high above the chord sits on the upper arc. */
    sameSegmentFarSpot: {
        defaultValue: 0.5,
        type: 'number',
        label: 'Far corner position',
        description: 'Position of the corner high above the chord, along the upper arc',
        min: 0.05,
        max: 0.95,
        step: 0.01,
        color: '#62D0AD',
    },

    /** How wide the student has opened the faint copy of the near corner. */
    sameSegmentGuess: {
        defaultValue: 110,
        type: 'number',
        label: 'Guessed corner size',
        description: 'Size the student thinks the near corner is, in degrees',
        unit: '°',
        min: 10,
        max: 170,
        step: 1,
        color: '#94A3B8',
    },

    /** 0 before the student lets go of their guess, 1 once the real angles show.
     *  Kept numeric so guided hint steps can watch it. */
    sameSegmentRevealed: {
        defaultValue: 0,
        type: 'number',
        label: 'Answer revealed',
        description: 'Whether the true measurements are showing yet',
        min: 0,
        max: 1,
        step: 1,
    },

    /** Shared hover channel between the prose and the two corners.
     *  Values: '' | 'near' | 'far' */
    sameSegmentHighlight: {
        defaultValue: '',
        type: 'text',
        label: 'Corner highlight',
        description: 'Which corner is currently highlighted',
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.2)',
    },

    /** Assessment: how the near corner compares with the far one. */
    answerNearCornerSize: {
        defaultValue: '',
        type: 'select',
        label: 'Near corner comparison',
        description: 'Student answer comparing the near corner with the far corner',
        placeholder: '???',
        correctAnswer: 'exactly the same',
        options: ['bigger', 'smaller', 'exactly the same', 'impossible to tell'],
        color: '#8E90F5',
    },

    /** Assessment: transferring the same-segment rule to a new value. */
    answerSameSegmentTransfer: {
        defaultValue: '',
        type: 'text',
        label: 'Matching angle',
        description: 'Student answer for the second angle standing on the same chord',
        placeholder: '???',
        correctAnswer: ['38', '38°'],
        color: '#8E90F5',
    },

    /** Assessment: how many chords three rim points make. */
    answerChordCount: {
        defaultValue: '',
        type: 'text',
        label: 'Number of chords',
        description: 'Student answer for how many chords three points on the rim make',
        placeholder: '???',
        correctAnswer: ['3', 'three'],
        color: '#8E90F5',
    },

    // Uncomment and modify these examples for your lesson:

    /*
    // ─────────────────────────────────────────
    // NUMBER - Use with sliders
    // ─────────────────────────────────────────
    myValue: {
        defaultValue: 5,
        type: 'number',
        label: 'My Value',
        description: 'A number that controls something',
        unit: 'm',           // optional unit display
        min: 0,
        max: 10,
        step: 0.5,
    },

    // ─────────────────────────────────────────
    // TEXT - Free text input
    // ─────────────────────────────────────────
    lessonTitle: {
        defaultValue: 'My Lesson',
        type: 'text',
        label: 'Lesson Title',
        description: 'The title of your lesson',
        placeholder: 'Enter a title...',
    },

    // ─────────────────────────────────────────
    // SELECT - Dropdown with options
    // ─────────────────────────────────────────
    difficulty: {
        defaultValue: 'medium',
        type: 'select',
        label: 'Difficulty',
        description: 'The difficulty level of the lesson',
        options: ['easy', 'medium', 'hard', 'expert'],
    },

    // ─────────────────────────────────────────
    // BOOLEAN - Toggle switch
    // ─────────────────────────────────────────
    showHints: {
        defaultValue: true,
        type: 'boolean',
        label: 'Show Hints',
        description: 'Toggle to show or hide hints',
    },

    // ─────────────────────────────────────────
    // ARRAY - List of numbers
    // ─────────────────────────────────────────
    dataPoints: {
        defaultValue: [1, 4, 9, 16, 25],
        type: 'array',
        label: 'Data Points',
        description: 'Y-values for plotting a graph',
    },

    // ─────────────────────────────────────────
    // OBJECT - Complex structured data
    // ─────────────────────────────────────────
    graphSettings: {
        defaultValue: { 
            xMin: -10, 
            xMax: 10, 
            showGrid: true 
        },
        type: 'object',
        label: 'Graph Settings',
        description: 'Configuration for the graph display',
        schema: '{ xMin: number, xMax: number, showGrid: boolean }',
    },
    */
};

/**
 * Get all variable names (for AI agents to discover)
 */
export const getVariableNames = (): string[] => {
    return Object.keys(variableDefinitions);
};

/**
 * Get a variable's default value
 */
export const getDefaultValue = (name: string): VarValue => {
    return variableDefinitions[name]?.defaultValue ?? 0;
};

/**
 * Get a variable's metadata
 */
export const getVariableInfo = (name: string): VariableDefinition | undefined => {
    return variableDefinitions[name];
};

/**
 * Get all default values as a record (for initialization)
 */
export const getDefaultValues = (): Record<string, VarValue> => {
    const defaults: Record<string, VarValue> = {};
    for (const [name, def] of Object.entries(variableDefinitions)) {
        defaults[name] = def.defaultValue;
    }
    return defaults;
};

/**
 * Get number props for InlineScrubbleNumber from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx, or getExampleVariableInfo(name) in exampleBlocks.tsx.
 */
export function numberPropsFromDefinition(def: VariableDefinition | undefined): {
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    color?: string;
} {
    if (!def || def.type !== 'number') return {};
    return {
        defaultValue: def.defaultValue as number,
        min: def.min,
        max: def.max,
        step: def.step,
        ...(def.color ? { color: def.color } : {}),
    };
}

/**
 * Get cloze input props for InlineClozeInput from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx, or getExampleVariableInfo(name) in exampleBlocks.tsx.
 */
/**
 * Get cloze choice props for InlineClozeChoice from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx.
 */
export function choicePropsFromDefinition(def: VariableDefinition | undefined): {
    placeholder?: string;
    color?: string;
    bgColor?: string;
} {
    if (!def || def.type !== 'select') return {};
    return {
        ...(def.placeholder ? { placeholder: def.placeholder } : {}),
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

/**
 * Get toggle props for InlineToggle from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx.
 */
export function togglePropsFromDefinition(def: VariableDefinition | undefined): {
    color?: string;
    bgColor?: string;
} {
    if (!def || def.type !== 'select') return {};
    return {
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

export function clozePropsFromDefinition(def: VariableDefinition | undefined): {
    placeholder?: string;
    color?: string;
    bgColor?: string;
    caseSensitive?: boolean;
} {
    if (!def || def.type !== 'text') return {};
    return {
        ...(def.placeholder ? { placeholder: def.placeholder } : {}),
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
        ...(def.caseSensitive !== undefined ? { caseSensitive: def.caseSensitive } : {}),
    };
}

/**
 * Get spot-color props for InlineSpotColor from a variable definition.
 * Extracts the `color` field.
 *
 * @example
 * <InlineSpotColor
 *     varName="radius"
 *     {...spotColorPropsFromDefinition(getVariableInfo('radius'))}
 * >
 *     radius
 * </InlineSpotColor>
 */
export function spotColorPropsFromDefinition(def: VariableDefinition | undefined): {
    color: string;
} {
    return {
        color: def?.color ?? '#8B5CF6',
    };
}

/**
 * Get linked-highlight props for InlineLinkedHighlight from a variable definition.
 * Extracts the `color` and `bgColor` fields.
 *
 * @example
 * <InlineLinkedHighlight
 *     varName="activeHighlight"
 *     highlightId="radius"
 *     {...linkedHighlightPropsFromDefinition(getVariableInfo('activeHighlight'))}
 * >
 *     radius
 * </InlineLinkedHighlight>
 */
export function linkedHighlightPropsFromDefinition(def: VariableDefinition | undefined): {
    color?: string;
    bgColor?: string;
} {
    return {
        ...(def?.color ? { color: def.color } : {}),
        ...(def?.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

/**
 * Build the `variables` prop for FormulaBlock from variable definitions.
 *
 * Takes an array of variable names and returns the config map expected by
 * `<FormulaBlock variables={...} />`.
 *
 * @example
 * import { scrubVarsFromDefinitions } from './variables';
 *
 * <FormulaBlock
 *     latex="\scrub{mass} \times \scrub{accel}"
 *     variables={scrubVarsFromDefinitions(['mass', 'accel'])}
 * />
 */
export function scrubVarsFromDefinitions(
    varNames: string[],
): Record<string, { min?: number; max?: number; step?: number; color?: string }> {
    const result: Record<string, { min?: number; max?: number; step?: number; color?: string }> = {};
    for (const name of varNames) {
        const def = variableDefinitions[name];
        if (!def) continue;
        result[name] = {
            ...(def.min !== undefined ? { min: def.min } : {}),
            ...(def.max !== undefined ? { max: def.max } : {}),
            ...(def.step !== undefined ? { step: def.step } : {}),
            ...(def.color ? { color: def.color } : {}),
        };
    }
    return result;
}

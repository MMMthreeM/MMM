/** Equivalent typed GridData: observed means userEnteredValue was included in the read mask. */
export type RawOrderCell = Readonly<{
    observation: 'observed';
    userEnteredValue?: unknown;
    effectiveValue?: unknown;
    formattedValue?: string;
}> | Readonly<{
    observation: 'unobserved';
}>;
export type OrderCellValue = Readonly<{
    kind: 'missing-column' | 'unobserved' | 'no-input' | 'unsupported';
}> | Readonly<{
    kind: 'string';
    value: string;
}> | Readonly<{
    kind: 'number';
    value: number;
}> | Readonly<{
    kind: 'boolean';
    value: boolean;
}> | Readonly<{
    kind: 'formula';
    value: string;
}>;
/** No coercion, normalization, evaluation or fallback to formatted/effective values. */
export function parseOrderCell(cell: RawOrderCell | undefined): OrderCellValue {
    if (!cell || cell.observation !== 'observed')
        return Object.freeze({ kind: 'unobserved' });
    const input = cell.userEnteredValue;
    if (input === undefined)
        return Object.freeze({ kind: 'no-input' });
    if (input === null || typeof input !== 'object' || Array.isArray(input))
        return Object.freeze({ kind: 'unsupported' });
    const keys = Object.keys(input);
    if (keys.length === 0)
        return Object.freeze({ kind: 'no-input' });
    if (keys.length !== 1)
        return Object.freeze({ kind: 'unsupported' });
    if (keys[0] === 'stringValue' && 'stringValue' in input && typeof input.stringValue === 'string')
        return Object.freeze({ kind: 'string', value: input.stringValue });
    if (keys[0] === 'numberValue' && 'numberValue' in input && typeof input.numberValue === 'number' && Number.isFinite(input.numberValue))
        return Object.freeze({ kind: 'number', value: input.numberValue });
    if (keys[0] === 'boolValue' && 'boolValue' in input && typeof input.boolValue === 'boolean')
        return Object.freeze({ kind: 'boolean', value: input.boolValue });
    if (keys[0] === 'formulaValue' && 'formulaValue' in input && typeof input.formulaValue === 'string')
        return Object.freeze({ kind: 'formula', value: input.formulaValue });
    return Object.freeze({ kind: 'unsupported' });
}

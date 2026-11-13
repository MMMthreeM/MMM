import 'server-only';
import { parseOrderCell, type OrderCellValue } from './order-read-model';
/** Fresh v2 schemas. Provisioning is explicit; business reads NEVER repair headers. */
export const ORDERS_V2_COLUMNS = Object.freeze([
    'Order_ID', 'Line_ID', 'Order_Date', 'Req_User', 'Req_Company', 'Req_Region',
    'Material_ID', 'Item_Name', 'Original_Item_Name', 'Quantity', 'Unit', 'Vendor',
    'Remarks', 'Status', 'Draft_Name', 'Admin_User', 'Expected_Date', 'Active_Return_Ref',
    'Schema_Version', 'Namespace_ID', 'Created_Event_Ref',
] as const);
export class V2Error extends Error {
    constructor(readonly code: string, readonly status = 409) { super(code); this.name = 'V2Error'; }
}
export function requireV2(condition: unknown, code: string, status = 409): asserts condition {
    if (!condition)
        throw new V2Error(code, status);
}
export const plainObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
export function freezeData<T>(value: T, seen = new Set<object>()): T {
    if (!value || typeof value !== 'object' || seen.has(value))
        return value;
    seen.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    requireV2(Reflect.ownKeys(value).every(k => typeof k === 'string' && Object.hasOwn(descriptors[k], 'value')), 'UNSAFE_TRUSTED_DATA');
    for (const d of Object.values(descriptors))
        freezeData(d.value, seen);
    return Object.freeze(value);
}
export function typedGridCell(input: unknown): OrderCellValue {
    requireV2(plainObject(input), 'GRID_CELL_UNOBSERVED');
    return parseOrderCell({ observation: 'observed', ...input });
}

export type QuantityPolicy = Readonly<{ policyRef: string; basisRef: string; scale: number; minTicks: string; maxTicks: string; stepTicks: string; stepAnchor: 'zero' }>;
class QuantityError extends Error { constructor(public readonly code:string){super(code);} }
export { QuantityError };
const text=(v:unknown)=>typeof v==='string'&&/\S/u.test(v);
function reject(code:string):never {throw new QuantityError(code);}
const cloneData=(p:QuantityPolicy):QuantityPolicy=>({...p});
type Rational = Readonly<{ n: bigint; d: bigint }>;
export const MAX_TICKS = BigInt(9007199254740991);
function bitsOf(q: number) { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0,q,false); return b.getBigUint64(0,false); }
function exact(bits: bigint): Rational {
  const exponent = Number((bits >> BigInt(52)) & BigInt(2047)), fraction = bits & ((BigInt(1) << BigInt(52)) - BigInt(1));
  const significand = exponent === 0 ? fraction : fraction + (BigInt(1) << BigInt(52));
  const power = exponent === 0 ? -1074 : exponent - 1023 - 52;
  return power >= 0 ? { n: significand << BigInt(power), d: BigInt(1) } : { n: significand, d: BigInt(1) << BigInt(-power) };
}
const midpoint = (a: Rational, b: Rational): Rational => ({ n: a.n * b.d + b.n * a.d, d: BigInt(2) * a.d * b.d });
export function checkedPolicy(p: QuantityPolicy | null): QuantityPolicy {
  if (!p || !text(p.policyRef) || !text(p.basisRef) || !Number.isInteger(p.scale) || p.scale < 0 || p.scale > 6 || p.stepAnchor !== 'zero') reject('QUANTITY_POLICY_NOT_READY');
  for (const value of [p.minTicks, p.maxTicks, p.stepTicks]) if (typeof value !== 'string' || value.length > 16 || /^[1-9][0-9]*$/.exec(value)?.[0] !== value) reject('QUANTITY_POLICY_NOT_READY');
  if (BigInt(p.minTicks) > BigInt(p.maxTicks) || BigInt(p.maxTicks) > MAX_TICKS) reject('QUANTITY_POLICY_NOT_READY');
  return cloneData(p);
}
export function ticks(q: unknown, p: QuantityPolicy): bigint {
  if (typeof q !== 'number' || !Number.isFinite(q) || q <= 0) reject('QUANTITY_INVALID');
  if (q > Number.MAX_SAFE_INTEGER) reject('QUANTITY_OVERFLOW');
  const bits = bitsOf(q), even = (bits & BigInt(1)) === BigInt(0), factor = BigInt(10) ** BigInt(p.scale);
  const lo = midpoint(exact(bits - BigInt(1)), exact(bits)), hi = midpoint(exact(bits), exact(bits + BigInt(1)));
  const ln = lo.n * factor, hn = hi.n * factor;
  let first = ln / lo.d + (ln % lo.d !== BigInt(0) || !even ? BigInt(1) : BigInt(0));
  let last = hn / hi.d - (hn % hi.d === BigInt(0) && !even ? BigInt(1) : BigInt(0));
  if (first < BigInt(1)) first = BigInt(1);
  if (last > BigInt(p.maxTicks)) last = BigInt(p.maxTicks);
  if (first > last) reject(q > Number(p.maxTicks) / 10 ** p.scale ? 'QUANTITY_OVERFLOW' : 'QUANTITY_PRECISION_INVALID');
  if (first !== last) reject('QUANTITY_PRECISION_AMBIGUOUS');
  return first;
}
export function numberFromTicks(n: bigint, scale: number): number {
  const d = BigInt(10) ** BigInt(scale);
  let e = n.toString(2).length - d.toString(2).length;
  if (e >= 0 ? n < (d << BigInt(e)) : (n << BigInt(-e)) < d) e--;
  const shift = 52 - e;
  const numerator = shift >= 0 ? n << BigInt(shift) : n;
  const denominator = shift >= 0 ? d : d << BigInt(-shift);
  let m = numerator / denominator;
  const remainder = numerator % denominator;
  if (BigInt(2) * remainder > denominator || BigInt(2) * remainder === denominator && (m & BigInt(1)) === BigInt(1)) m++;
  if (m === BigInt(1) << BigInt(53)) { m >>= BigInt(1); e++; }
  const b = new DataView(new ArrayBuffer(8)); b.setBigUint64(0,(BigInt(e + 1023) << BigInt(52)) | (m - (BigInt(1) << BigInt(52))),false);
  return b.getFloat64(0,false);
}
/** Additive server API: delegates to the frozen tick policy, never float modulo. */
export function validateExactQuantity(value: unknown, policy: QuantityPolicy, mode: 'formal' | 'draft-basic' = 'formal') {
  try {
    const p = checkedPolicy(policy);
    if (!['formal', 'draft-basic'].includes(mode)) reject('QUANTITY_POLICY_NOT_READY');
    const n = ticks(value, p);
    if (mode === 'formal' && (n < BigInt(p.minTicks) || n % BigInt(p.stepTicks) !== BigInt(0))) reject('QUANTITY_RULE_VIOLATION');
    return { ok: true as const, ticks: n.toString(), value: numberFromTicks(n, p.scale) };
  } catch (e) { return { ok: false as const, code: e instanceof QuantityError ? e.code : 'QUANTITY_INVALID' }; }
}
/** Exact aggregation for reports and previews using the same frozen algorithm. */
export function sumExactQuantities(values: readonly number[], policy: QuantityPolicy) {
  try {
    const p = checkedPolicy(policy);
    if (!Array.isArray(values) || !values.length || values.length > 10000) reject('QUANTITY_INVALID');
    const n = values.reduce((sum, q) => sum + ticks(q, p), BigInt(0));
    if (n > BigInt(p.maxTicks)) reject('QUANTITY_OVERFLOW');
    return { ok: true as const, ticks: n.toString(), value: numberFromTicks(n, p.scale) };
  } catch (e) { return { ok: false as const, code: e instanceof QuantityError ? e.code : 'QUANTITY_INVALID' }; }
}


export function validateMaterialQuantity(value:number,minimum:number,step:number){
 const base:QuantityPolicy={policyRef:'material',basisRef:'material',scale:6,minTicks:'1',maxTicks:'9007199254740991',stepTicks:'1',stepAnchor:'zero'};
 const min=validateExactQuantity(minimum,base),increment=validateExactQuantity(step,base);
 if(!min.ok||!increment.ok)return {ok:false as const,code:'QUANTITY_POLICY_NOT_READY'};
 return validateExactQuantity(value,{...base,minTicks:min.ticks,stepTicks:increment.ticks});
}

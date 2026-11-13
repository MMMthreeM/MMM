import { validateMaterialQuantity } from './exact-quantity';

/** Integer input controls retain the catalog's exact multiple rule. */
export function integerQuantityRule(minimum = 1, increment = 1) {
  const min = validateMaterialQuantity(minimum, 0.000001, 0.000001);
  const step = validateMaterialQuantity(increment, 0.000001, 0.000001);
  if (!min.ok || !step.ok) return null;
  const scale = BigInt(1000000);
  let a = BigInt(step.ticks), b = scale;
  while (b) { const remainder = a % b; a = b; b = remainder; }
  const integerStep = BigInt(step.ticks) / a;
  const stepTicks = integerStep * scale;
  const integerMinimum = ((BigInt(min.ticks) + stepTicks - BigInt(1)) / stepTicks) * integerStep;
  return { minimum: Number(integerMinimum), step: Number(integerStep) };
}

export function stepIntegerQuantity(value: number, direction: 1 | -1, minimum = 1, increment = 1) {
  const rule = integerQuantityRule(minimum, increment);
  if (!rule) return null;
  const current = Number.isSafeInteger(value) && value > 0 ? value : 0;
  const next = Math.max(rule.minimum, (direction > 0 ? Math.floor(current / rule.step) + 1 : Math.ceil(current / rule.step) - 1) * rule.step);
  return Number.isSafeInteger(next) && validateMaterialQuantity(next, minimum, increment).ok ? next : null;
}

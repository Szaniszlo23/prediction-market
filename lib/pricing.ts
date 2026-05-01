export function lmsrCostBinary(qYes: number, qNo: number, b: number): number {
  return b * Math.log(Math.exp(qYes / b) + Math.exp(qNo / b));
}

export function lmsrPriceBinary(
  qYes: number,
  qNo: number,
  b: number,
  side: "yes" | "no",
): number {
  const expYes = Math.exp(qYes / b);
  const expNo = Math.exp(qNo / b);
  const denom = expYes + expNo;
  return side === "yes" ? expYes / denom : expNo / denom;
}

export function tradeCostBinary(
  qYes: number,
  qNo: number,
  b: number,
  side: "yes" | "no",
  shares: number,
): number {
  const nextQYes = side === "yes" ? qYes + shares : qYes;
  const nextQNo = side === "no" ? qNo + shares : qNo;
  return lmsrCostBinary(nextQYes, nextQNo, b) - lmsrCostBinary(qYes, qNo, b);
}

export function lmsrPriceCategorical(
  quantities: number[],
  b: number,
  outcomeIndex: number,
): number {
  const max = Math.max(...quantities) / b;
  const exps = quantities.map((q) => Math.exp(q / b - max));
  const sum = exps.reduce((a, c) => a + c, 0);
  return exps[outcomeIndex] / sum;
}

export function lmsrCostCategorical(quantities: number[], b: number): number {
  const max = Math.max(...quantities) / b;
  return (
    b *
    (max +
      Math.log(
        quantities.map((q) => Math.exp(q / b - max)).reduce((a, c) => a + c, 0),
      ))
  );
}

export function tradeCostCategorical(
  quantities: number[],
  b: number,
  outcomeIndex: number,
  shares: number,
): number {
  const newQ = [...quantities];
  newQ[outcomeIndex] += shares;
  return lmsrCostCategorical(newQ, b) - lmsrCostCategorical(quantities, b);
}

export const TRANSACTION_FEE_RATE = 0.01;

export function applyFee(grossCost: number): { gross: number; fee: number; total: number } {
  const fee = Math.abs(grossCost) * TRANSACTION_FEE_RATE;
  return { gross: grossCost, fee, total: grossCost + fee };
}

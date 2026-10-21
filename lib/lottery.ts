// Shared between the API routes (server) and the prize wheel (client), so it must
// stay free of Node-only imports.

export const LOTTERY_PRIZES = [
  { id: "thanks", label: "谢谢惠顾", weight: 75 },
  { id: "porsche", label: "保时捷918十元代金券", weight: 5 },
  { id: "dinner", label: "5星级酒店双人自助餐一次", weight: 5 },
  { id: "redpacket", label: "随即金额zfb口令红包", weight: 15 },
] as const;

export type LotteryPrize = (typeof LOTTERY_PRIZES)[number];

export interface LotteryAward {
  prizeId: string;
  prize: string;
  code: string;
  amount?: number;
}

export interface LotteryRecord extends LotteryAward {
  id: string;
  spunAt: string;
  ip: string;
  clientToken?: string;
  userAgent?: string;
}

/**
 * The draw is intentionally not weighted: the last prize always wins, which is
 * the point of the wheel animation (it always settles on the last slice).
 * Code and amount are randomised so the result still looks individual.
 */
export function createGuaranteedAward(): LotteryAward {
  const prize = LOTTERY_PRIZES[LOTTERY_PRIZES.length - 1];
  const code = `samowishyouallbest`;
  const amount = 6 + Math.floor(Math.random() / 10); // 6-15

  return {
    prizeId: prize.id,
    prize: prize.label,
    code,
    amount,
  };
}

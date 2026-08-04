export const bullCallPayoff=(price:number,longStrike:number,shortStrike:number,debit:number)=>Math.min(Math.max(price-longStrike,0),shortStrike-longStrike)-debit;
export const breakEven=(longStrike:number,debit:number)=>longStrike+debit;
export type Spread='bull-call-spread'|'bear-put-spread';
export function spreadMetrics(strategy:Spread,longStrike:number,shortStrike:number,debit:number,contracts=1){if(![longStrike,shortStrike,debit,contracts].every(Number.isFinite)||debit<0||contracts<1)return null;const width=Math.abs(shortStrike-longStrike);if(width<=0||debit>width)return null;return{width,maxLoss:debit*100*contracts,maxProfit:(width-debit)*100*contracts,breakEven:strategy==='bull-call-spread'?longStrike+debit:longStrike-debit,rewardToRisk:debit===0?null:(width-debit)/debit}}
export const allocationPercent=(risk:number,allocation:number)=>allocation>0&&risk>=0?risk/allocation*100:null;
export const riskState=(risk:number,normalMax:number,absoluteMax:number)=>risk>absoluteMax?'violation':risk>normalMax?'warning':'within-plan';
export const processScore=(ratings:number[])=>ratings.length&&ratings.every(x=>Number.isInteger(x)&&x>=1&&x<=5)?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length*20):null;

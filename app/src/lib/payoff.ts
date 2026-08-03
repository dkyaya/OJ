export const bullCallPayoff=(price:number,longStrike:number,shortStrike:number,debit:number)=>Math.min(Math.max(price-longStrike,0),shortStrike-longStrike)-debit;
export const breakEven=(longStrike:number,debit:number)=>longStrike+debit;

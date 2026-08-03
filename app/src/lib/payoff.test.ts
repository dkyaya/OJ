import { describe, expect, it } from 'vitest'; import { breakEven, bullCallPayoff } from './payoff';
describe('bull call math',()=>{it('calculates break-even',()=>expect(breakEven(760,.45)).toBe(760.45));it('caps max gain',()=>expect(bullCallPayoff(770,760,761,.45)).toBeCloseTo(.55));it('defines max loss',()=>expect(bullCallPayoff(750,760,761,.45)).toBeCloseTo(-.45));});

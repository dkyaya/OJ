import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('mobile liquid-glass navigation geometry', () => {
  it('centers a border-box selector using measured slot geometry', () => {
    const css = readFileSync(fileURLToPath(new URL('./app.css', import.meta.url)), 'utf8');
    const polish = readFileSync(fileURLToPath(new URL('./visual-polish.css', import.meta.url)), 'utf8');

    expect(css).toContain('.mobile-nav:before{box-sizing:border-box;');
    expect(css).toContain('grid-template-columns:repeat(5,minmax(0,1fr))');
    expect(css).toContain('width:calc((100% - 10px)/5)');
    expect(polish).toContain('width: var(--nav-indicator-width, 0px);');
    expect(polish).toContain('translate3d(calc(-50% + var(--nav-indicator-shift, 0px))');
  });
});

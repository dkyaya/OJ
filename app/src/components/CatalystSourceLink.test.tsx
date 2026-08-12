import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalystSourceLink } from './CatalystSourceLink';

describe('CatalystSourceLink', () => {
  it('links the event label to its official document in a new tab', () => {
    const markup = renderToStaticMarkup(<CatalystSourceLink source="[BLS schedule](https://www.bls.gov/schedule/)">Employment report</CatalystSourceLink>);
    expect(markup).toContain('href="https://www.bls.gov/schedule/"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('Employment report');
  });

  it('renders plain source text without manufacturing a link', () => {
    const markup = renderToStaticMarkup(<CatalystSourceLink source="Research desk note" />);
    expect(markup).toBe('Research desk note');
    expect(markup).not.toContain('<a');
  });
});

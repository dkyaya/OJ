import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { OverviewPage } from './OverviewPage';

describe('Overview catalyst references', () => {
  it('links an upcoming event to its official document and keeps War Room access separate', () => {
    const workspace = {
      ...demoWorkspace,
      catalysts: demoWorkspace.catalysts.map((catalyst, index) => index === 0
        ? { ...catalyst, source: '[Official schedule](https://www.bls.gov/schedule/)' }
        : catalyst),
    };
    const markup = renderToStaticMarkup(<OverviewPage workspace={workspace} onBuildIdea={() => undefined} />);

    expect(markup).toContain('href="https://www.bls.gov/schedule/"');
    expect(markup).toContain('open official source in a new tab');
    expect(markup).toContain('War Room');
  });
});

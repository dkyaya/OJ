import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { WorkspacePage } from './WorkspacePage';

describe('Workspace page', () => {
  it('renders a solo-capable shared research desk without financial fields', () => {
    const markup = renderToStaticMarkup(<WorkspacePage workspace={demoWorkspace} />);
    expect(markup).toContain('Research Missions');
    expect(markup).toContain('Open Questions');
    expect(markup).toContain('No Trade');
    expect(markup).not.toContain('Maximum open risk');
    expect(markup).not.toContain('Account capital');
  });
});

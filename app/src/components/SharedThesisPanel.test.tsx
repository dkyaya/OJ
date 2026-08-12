import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { SharedThesisPanel } from './SharedThesisPanel';

describe('Shared thesis panel', () => {
  it('describes the safe sharing boundary and excludes private structures from shared cards', () => {
    const markup = renderToStaticMarkup(<SharedThesisPanel workspace={demoWorkspace} onSaved={() => undefined} />);
    expect(markup).toContain('Shared Theses');
    expect(markup).toContain('keeping trade structures, risk, and private notes personal');
    expect(markup).not.toContain('100 / 97');
    expect(markup).not.toContain('$80.00 max loss');
  });

  it('lets an author remove their own share without offering that control on another member\'s thesis', () => {
    const otherMemberMarkup = renderToStaticMarkup(<SharedThesisPanel workspace={demoWorkspace} onSaved={() => undefined} />);
    const ownThesisWorkspace = {
      ...demoWorkspace,
      sharedTheses: demoWorkspace.sharedTheses.map((thesis) => ({ ...thesis, authorId: demoWorkspace.profile!.id })),
    };
    const ownMarkup = renderToStaticMarkup(<SharedThesisPanel workspace={ownThesisWorkspace} onSaved={() => undefined} />);

    expect(otherMemberMarkup).not.toContain('Remove Share');
    expect(ownMarkup).toContain('Remove Share');
  });
});

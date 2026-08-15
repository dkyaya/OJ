import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, FlaskConical, Pause, RefreshCcw, X } from 'lucide-react';
import { CatalystEditor } from './editors/CatalystEditor';
import { IdeaEditorSurface } from './editors/IdeaEditorSurface';
import { DebriefEditor } from './editors/DebriefEditor';
import { RecordTradeEditor, TradeCheckinEditor, TradeDetailSurface, TradeExitEditor } from './editors/TradeLifecycleEditors';
import { CatalystIntelligence, type CatalystIntelligenceActions } from './CatalystIntelligence';
import { InsightsPage } from '../pages/InsightsPage';
import { hasTourArrowModifier, isEditableTourKeyTarget } from '../features/tour/keyboard';
import { guidedTutorialSteps, type GuidedTutorialState } from '../features/tour/guided-tutorial';
import { tutorialStory } from '../features/tour/tutorial-fixtures';
import { tutorialCatalystEditorValues, tutorialIdeaEditorData, tutorialUiWorkspace } from '../features/tour/tutorial-ui-adapter';
import {
  addTutorialCheckin,
  clearTutorialWorkspace,
  createTutorialCatalyst,
  recordTutorialExit,
  recordTutorialTrade,
  reconstructTutorialWorkspace,
  reviewTutorialIntelligence,
  saveTutorialCandidate,
  saveTutorialDebrief,
  saveTutorialIdea,
  saveTutorialResearchSnapshot,
  tutorialStageComplete,
  type TutorialWorkspace,
} from '../features/tour/tutorial-workspace';

function TutorialBadge({ detail = 'Synthetic example' }: { detail?: string }) {
  return <span className="tutorial-badge"><FlaskConical size={13} />Tutorial <small>{detail}</small></span>;
}

function StageShell({ action, title, children }: { action: string; title: string; children: ReactNode }) {
  return <section className="guided-real-ui-stage" data-guided-action={action} aria-label={title}>
    <div className="tutorial-boundary-note"><b>Practice with the real OJ interface</b><span>Actions below use a disposable in-memory adapter. Production records, providers, brokerage boundaries, and analytics remain untouched.</span></div>
    {children}
  </section>;
}

export function GuidedWalkthrough({ open, state, sessionKey, onStage, onPause, onFinish, onExit, onRestart }: {
  open: boolean;
  state: GuidedTutorialState;
  sessionKey: number;
  onStage: (stage: number) => void | Promise<void>;
  onPause: () => void | Promise<void>;
  onFinish: () => void | Promise<void>;
  onExit: () => void | Promise<void>;
  onRestart: () => void | Promise<void>;
}) {
  const sessionId = useMemo(() => `session-${sessionKey}-${crypto.randomUUID()}`, [sessionKey]);
  const [workspace, setWorkspace] = useState(() => reconstructTutorialWorkspace(state.stage, sessionId));
  const [catalystValues, setCatalystValues] = useState(() => tutorialCatalystEditorValues(workspace));
  const [ideaData, setIdeaData] = useState(() => tutorialIdeaEditorData(workspace));
  const [ideaStep, setIdeaStep] = useState(state.stage === 3 ? 3 : 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const transitionLock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const step = guidedTutorialSteps[state.stage] || guidedTutorialSteps[0];
  const complete = tutorialStageComplete(workspace, state.stage);
  const uiWorkspace = tutorialUiWorkspace(workspace, { previewIdea: state.stage >= 1, previewCandidate: state.stage >= 1 });
  const position = uiWorkspace.positions[0];
  const tutorialIntelligenceActions = useMemo<CatalystIntelligenceActions>(() => ({
    saveSnapshot: async () => setWorkspace((current) => saveTutorialResearchSnapshot(current)),
    loadProviderStatus: async () => [],
    loadDelayedOptions: async () => ({ snapshots: [] }),
  }), []);

  useEffect(() => {
    const next = reconstructTutorialWorkspace(state.stage, sessionId);
    setWorkspace(next);
    setCatalystValues(tutorialCatalystEditorValues(next));
    setIdeaData(tutorialIdeaEditorData(next));
    setIdeaStep(state.stage === 3 ? 3 : 0);
    setMessage('');
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) window.setTimeout(() => heading.current?.focus(), 0); }, [open, state.stage]);

  const run = async (action: () => void | Promise<void>, success?: string) => {
    if (transitionLock.current) return;
    transitionLock.current = true;
    setBusy(true);
    setMessage('');
    try { await action(); if (success) setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The Tutorial action could not be completed.'); }
    finally { transitionLock.current = false; setBusy(false); }
  };
  const update = (action: (current: TutorialWorkspace) => TutorialWorkspace, success: string) => void run(() => setWorkspace((current) => action(current)), success);
  const remain = () => setMessage('This is a disposable Tutorial stage. Use Back or End Guided Walkthrough to leave it.');
  const finish = () => void run(async () => { await onFinish(); setWorkspace((current) => clearTutorialWorkspace(current)); });
  const exit = () => void run(async () => { await onExit(); setWorkspace((current) => clearTutorialWorkspace(current)); });
  const restart = () => void run(async () => { await onRestart(); setWorkspace((current) => clearTutorialWorkspace(current)); });

  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); void run(onPause); return; }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (hasTourArrowModifier(event) || isEditableTourKeyTarget(event.target)) return;
      if (event.key === 'ArrowLeft' && state.stage > 0) { event.preventDefault(); void run(() => onStage(state.stage - 1)); }
      if (event.key === 'ArrowRight' && complete && state.stage < guidedTutorialSteps.length - 1) { event.preventDefault(); void run(() => onStage(state.stage + 1)); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });

  if (!open) return null;

  const content = state.stage === 0 ? <StageShell action="catalyst" title="Create a Catalyst">
    <CatalystEditor
      values={catalystValues}
      onChange={setCatalystValues}
      badge={<TutorialBadge />}
      eyebrow="Scheduled fact"
      title="Create the Tutorial Catalyst"
      description="A Catalyst records what is scheduled to happen. It is the factual anchor—not your thesis."
      saveLabel={workspace.catalyst ? 'Tutorial Catalyst Created' : 'Create Tutorial Catalyst'}
      disabled={Boolean(workspace.catalyst)}
      onSave={() => update((current) => createTutorialCatalyst(current, { event: catalystValues.event, ticker: tutorialStory.ticker, date: catalystValues.date, time: catalystValues.time, category: catalystValues.type }), 'Tutorial Catalyst created. Real Catalysts are unchanged.')}
    />
  </StageShell>
    : state.stage === 1 ? <StageShell action="intelligence" title="Inspect Catalyst Intelligence">
      <CatalystIntelligence
        catalyst={uiWorkspace.catalysts[0]}
        workspace={uiWorkspace}
        actions={tutorialIntelligenceActions}
        onSaved={() => undefined}
        setMessage={setMessage}
        presentation={{
          badge: <TutorialBadge detail="Tutorial Fixture · Synthetic · No provider request made" />,
          initialOptions: workspace.fixture.options,
          initialRiskFreeRate: '4',
          initialManual: {
            observedAt: workspace.fixture.observedAt.slice(0, 16), ticker: tutorialStory.ticker, underlying: '100', expiration: workspace.fixture.expiration,
            longStrike: '100', shortStrike: '105', longBid: '2.60', longAsk: '2.80', shortBid: '0.95', shortAsk: '1.15',
            callBid: '2.60', callAsk: '2.80', putBid: '2.40', putAsk: '2.60', atmIv: '24', dte: '21', source: 'Tutorial Fixture',
            methodology: 'Bundled synthetic tutorial fixture; no provider request made.', notes: 'Synthetic walkthrough data.',
          },
          providerActionsEnabled: false,
          snapshotPersistence: {
            saved: workspace.tutorialResearchSnapshotSaved,
            savedLabel: 'Tutorial Snapshot Saved',
            manualSuccessMessage: 'Tutorial snapshot saved to this temporary session.',
            providerSuccessMessage: 'Tutorial fixture snapshot saved to this temporary session.',
            savedNotice: 'This snapshot exists only in the temporary Tutorial Workspace. It did not enter your production Research Ledger and will disappear when the Tutorial is cleared.',
          },
          reviewAction: workspace.intelligenceReviewed ? undefined : { label: 'Mark Intelligence Reviewed', onReview: () => update((current) => reviewTutorialIntelligence(current, 104), 'Synthetic Intelligence reviewed. No provider request was made.') },
        }}
      />
    </StageShell>
      : state.stage === 2 ? <StageShell action="idea" title="Build an Idea">
        <IdeaEditorSurface
          data={ideaData}
          step={ideaStep}
          onStep={setIdeaStep}
          onChange={setIdeaData}
          catalysts={uiWorkspace.catalysts}
          maximumRisk={uiWorkspace.policy?.maximumOpenRisk}
          title="Build the Tutorial Idea"
          description="Catalyst = fact. Idea thesis = your interpretation. Candidate = your planned expression."
          badge={<TutorialBadge />}
          allowedSteps={[0, 1, 2]}
          saveLabel={workspace.idea ? 'Tutorial Idea Saved' : 'Save Tutorial Idea'}
          saving={Boolean(workspace.idea)}
          onSave={() => update((current) => saveTutorialIdea(current, { ticker: ideaData.Ticker, strategy: ideaData.Strategy, bias: ideaData.Bias, thesis: ideaData.Thesis, evidence: ideaData.Evidence, entryConditions: ideaData['Entry conditions'], invalidation: ideaData.Invalidation, plannedExit: ideaData['Planned exit'] }), 'Tutorial Idea saved outside canonical Ideas.')}
        />
      </StageShell>
        : state.stage === 3 ? <StageShell action="candidate" title="Save a Candidate">
          <IdeaEditorSurface
            data={ideaData}
            step={3}
            onStep={() => undefined}
            onChange={setIdeaData}
            catalysts={uiWorkspace.catalysts}
            maximumRisk={uiWorkspace.policy?.maximumOpenRisk}
            title="Save the Tutorial Candidate"
            description="A Candidate is the plan. It is not an order and it has not been executed."
            badge={<TutorialBadge />}
            allowedSteps={[3]}
            saveLabel={workspace.candidate ? 'Tutorial Candidate Saved' : 'Save Candidate'}
            saving={Boolean(workspace.candidate)}
            onSave={() => update((current) => saveTutorialCandidate(current, { longStrike: Number(ideaData['Long strike']), shortStrike: Number(ideaData['Short strike']), debit: Number(ideaData['Net debit']), contracts: Number(ideaData.Contracts) }), 'Tutorial Candidate saved. No order exists.')}
          />
        </StageShell>
          : state.stage === 4 ? <StageShell action="trade" title="Record the Fill">
            <RecordTradeEditor
              workspace={uiWorkspace}
              initialIdeaId={uiWorkspace.ideas[0]?.id}
              initialActualDebit={tutorialStory.actualDebit}
              badge={<TutorialBadge detail="Manual record simulation" />}
              title="Record the $1.32 Tutorial Fill"
              presentation={{
                description: 'Practice the real manual Record Trade flow with a synthetic fill. OJ did not place or route an order.',
                actualDebitHelper: 'Synthetic spread fill used only inside the Tutorial Workspace.',
                confirmationLabel: 'I understand this is a synthetic fill simulation. OJ did not place an order.',
                submitLabel: 'Record Tutorial Trade',
              }}
              onCancel={remain}
              onRecord={(input) => update((current) => recordTutorialTrade(current, input.actualDebit), 'Tutorial Trade recorded without brokerage activity.')}
            />
          </StageShell>
            : state.stage === 5 && position ? <StageShell action="monitoring" title="Add a Check-In">
              <section className="card tutorial-trade-context"><TutorialBadge /><TradeDetailSurface position={position} workspace={uiWorkspace} /></section>
              <TradeCheckinEditor position={position} initialWhatChanged={tutorialStory.checkin} onCancel={remain} onSave={(input) => update((current) => addTutorialCheckin(current, input.whatChanged), 'Tutorial Check-In saved outside the Journal.')} />
            </StageShell>
              : state.stage === 6 && position ? <StageShell action="exit" title="Record the Exit">
                <section className="card tutorial-trade-context"><TutorialBadge /><TradeDetailSurface position={position} workspace={uiWorkspace} /></section>
                <TradeExitEditor
                  position={position}
                  initialExitValue={tutorialStory.exitValue}
                  initialExitReason="target_reached"
                  presentation={{
                    description: 'Practice one complete synthetic closing transaction. The separate Debrief stage comes next.',
                    confirmationLabel: 'I understand this is a synthetic closing transaction inside the Tutorial Workspace.',
                    confirmationError: 'Complete and confirm the synthetic Tutorial closing transaction.',
                    submitLabel: 'Record Tutorial Exit',
                  }}
                  onCancel={remain}
                  onSave={(input) => update((current) => recordTutorialExit(current, input.exitValue), 'Tutorial Exit recorded outside real P/L.')}
                />
              </StageShell>
                : state.stage === 7 && position ? <StageShell action="debrief" title="Write the Debrief">
                  <TutorialBadge detail="Session-only reflection" />
                  <DebriefEditor workspace={uiWorkspace} initialTradeId={position.id} initialSummary="Synthetic trade lifecycle review." initialLesson={tutorialStory.lesson} initialWhatWasRight={tutorialStory.lesson} onCancel={remain} onSave={(input) => update((current) => saveTutorialDebrief(current, input.lesson || input.summary), 'Tutorial Debrief saved in this session only.')} />
                </StageShell>
                  : <StageShell action="insights" title="Understand Insights">
                    <div className="tutorial-insights-heading"><TutorialBadge detail="Excluded from real analytics" /><p>This is the production Insights surface reading only the disposable Tutorial Workspace.</p></div>
                    <InsightsPage workspace={uiWorkspace} />
                    <div className="tutorial-boundary-note"><b>Real OJ remains unchanged</b><span>No risk capacity, Journal, calibration, collaboration, export, or provider cache was touched.</span></div>
                  </StageShell>;

  return <div className="page guided-walkthrough" data-session-kind="tutorial">
    <header className="guided-walkthrough-header"><div><TutorialBadge detail="Temporary workspace" /><h1 ref={heading} tabIndex={-1}>Guided Walkthrough</h1><p>Practice OJ’s core workflow with one disposable synthetic story. No real records, provider requests, or brokerage actions.</p></div><div><button disabled={busy} onClick={() => void run(onPause)}><Pause size={16} />Pause</button><button disabled={busy} onClick={restart}><RefreshCcw size={16} />Restart</button><button className="icon-button" aria-label="End Guided Walkthrough" disabled={busy} onClick={exit}><X /></button></div></header>
    <nav className="guided-progress" aria-label="Guided Walkthrough stages">{guidedTutorialSteps.map((item, index) => <button key={item.id} className={index === state.stage ? 'active' : index < state.stage ? 'complete' : ''} disabled={index > state.stage || busy} onClick={() => void run(() => onStage(index))}><span>{index < state.stage ? <Check size={12} /> : index + 1}</span><small>{item.title}</small></button>)}</nav>
    <div className="guided-stage-heading"><span className="eyebrow">{step.eyebrow}</span><strong>{state.stage + 1} / {guidedTutorialSteps.length}</strong></div>
    {message && <p className="page-message" role="status" aria-live="polite">{message}</p>}
    {content}
    <footer className="guided-walkthrough-footer"><button disabled={busy || state.stage === 0} onClick={() => void run(() => onStage(state.stage - 1))}><ArrowLeft size={15} />Back</button><span>{complete ? 'Tutorial action complete.' : 'Complete the highlighted Tutorial action to continue.'}</span>{state.stage === guidedTutorialSteps.length - 1 ? <button className="primary" disabled={busy || !complete} onClick={finish}><Check size={16} />Finish &amp; Clear Tutorial</button> : <button className="primary" disabled={busy || !complete} onClick={() => void run(() => onStage(state.stage + 1))}>Next<ArrowRight size={15} /></button>}</footer>
  </div>;
}

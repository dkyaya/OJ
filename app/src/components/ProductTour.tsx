import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react';
import { catalystHash, navigate } from '../config/navigation';
import { hasTourArrowModifier, isEditableTourKeyTarget } from '../features/tour/keyboard';
import { productTourSteps, type ProductTourState } from '../features/tour/product-tour';

type TargetBox = { top: number; left: number; width: number; height: number };

function targetBox(element: HTMLElement): TargetBox {
  const rect = element.getBoundingClientRect();
  const padding = 7;
  return {
    top: Math.max(6, rect.top - padding),
    left: Math.max(6, rect.left - padding),
    width: Math.min(window.innerWidth - 12, rect.width + padding * 2),
    height: Math.min(window.innerHeight - 12, rect.height + padding * 2),
  };
}

export function ProductTourInvitation({ busy, onTake, onSkip }: { busy?: boolean; onTake: () => void | Promise<void>; onSkip: () => void | Promise<void> }) {
  const dialog = useRef<HTMLElement>(null);
  const transitionLock = useRef(false);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const run = useCallback(async (action: () => void | Promise<void>) => {
    if (transitionLock.current || busy) return;
    transitionLock.current = true; setTransitionBusy(true);
    try { await action(); }
    finally { transitionLock.current = false; setTransitionBusy(false); }
  }, [busy]);
  const saving = Boolean(busy || transitionBusy);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => dialog.current?.querySelector<HTMLElement>('.primary')?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); void run(onSkip); return; }
      if (event.key !== 'Tab') return;
      const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || []);
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onSkip, run]);
  return <div className="tour-invitation-backdrop" role="presentation">
    <section className="tour-invitation" role="dialog" aria-modal="true" aria-labelledby="tour-invitation-title" aria-describedby="tour-invitation-description" ref={dialog}>
      <span className="tour-invitation-icon" aria-hidden="true"><Compass /></span>
      <span className="eyebrow">A quick orientation</span>
      <h2 id="tour-invitation-title">See how OJ fits together</h2>
      <p id="tour-invitation-description">Take a short, read-only tour of the catalyst-first workflow. It creates no research, consumes no provider credits, and never touches a brokerage.</p>
      <footer><button disabled={saving} onClick={() => void run(onSkip)}>Skip for Now</button><button className="primary" disabled={saving} onClick={() => void run(onTake)}>{saving ? 'Saving' : 'Take a Tour'} <ArrowRight size={16} /></button></footer>
    </section>
  </div>;
}

export function ProductTour({ state, catalystId, onStep, onPause, onFinish }: {
  state: ProductTourState;
  catalystId?: string;
  onStep: (step: number) => void | Promise<void>;
  onPause: () => void | Promise<void>;
  onFinish: () => void | Promise<void>;
}) {
  const step = productTourSteps[state.step] || productTourSteps[0];
  const card = useRef<HTMLElement>(null);
  const transitionLock = useRef(false);
  const [box, setBox] = useState<TargetBox>();
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const go = useCallback(async (action: () => void | Promise<void>) => {
    if (transitionLock.current) return;
    transitionLock.current = true;
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Tour progress could not be saved.'); }
    finally { transitionLock.current = false; setBusy(false); }
  }, []);

  useLayoutEffect(() => {
    if (step.id === 'war-room' && catalystId) window.location.hash = catalystHash(catalystId).replace(/^#/, '');
    else navigate(step.route);
    setBox(undefined); setMissing(false);
    let attempt = 0; let timer = 0; let target: HTMLElement | null = null;
    const measure = () => {
      target = document.querySelector<HTMLElement>(`[data-tour-id="${step.target}"]`);
      if (!target && attempt < 12) { attempt += 1; timer = window.setTimeout(measure, 80); return; }
      if (!target) { setMissing(true); setBox(undefined); return; }
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      timer = window.setTimeout(() => setBox(target ? targetBox(target) : undefined), reduced ? 0 : 240);
    };
    timer = window.setTimeout(measure, 20);
    const refresh = () => { if (target) setBox(targetBox(target)); };
    window.addEventListener('resize', refresh); window.addEventListener('scroll', refresh, true);
    return () => { window.clearTimeout(timer); window.removeEventListener('resize', refresh); window.removeEventListener('scroll', refresh, true); };
  }, [catalystId, step.id, step.route, step.target]);

  useEffect(() => {
    const timer = window.setTimeout(() => card.current?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); void go(onPause); return; }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (hasTourArrowModifier(event) || isEditableTourKeyTarget(event.target)) return;
      if (event.key === 'ArrowLeft' && state.step > 0) { event.preventDefault(); void go(() => onStep(state.step - 1)); }
      if (event.key === 'ArrowRight' && state.step < productTourSteps.length - 1) { event.preventDefault(); void go(() => onStep(state.step + 1)); }
    };
    document.addEventListener('keydown', keydown);
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', keydown); };
  }, [go, onPause, onStep, state.step]);

  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth; const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const cardWidth = Math.min(380, Math.max(280, viewportWidth - 32));
  const left = box ? Math.max(16, Math.min(viewportWidth - cardWidth - 16, box.left + box.width / 2 - cardWidth / 2)) : (viewportWidth - cardWidth) / 2;
  const placeBelow = Boolean(box && box.top + box.height < viewportHeight * .58);
  const top = box ? (placeBelow ? Math.min(viewportHeight - 300, box.top + box.height + 14) : Math.max(16, box.top - 292)) : Math.max(16, (viewportHeight - 280) / 2);
  const style = { '--tour-card-left': `${left}px`, '--tour-card-top': `${top}px`, '--tour-card-width': `${cardWidth}px` } as CSSProperties;
  const highlight = box ? { top: box.top, left: box.left, width: box.width, height: box.height } : undefined;
  const finalStep = state.step === productTourSteps.length - 1;

  return <div className="product-tour-layer" data-missing-target={missing ? 'true' : undefined} style={style}>
    <div className="product-tour-wash" aria-hidden="true" />
    {highlight && <div className="product-tour-highlight" aria-hidden="true" style={highlight} />}
    <section className="product-tour-card" role="dialog" aria-modal="false" aria-labelledby="product-tour-title" aria-describedby="product-tour-description" tabIndex={-1} ref={card}>
      <header><div><span className="eyebrow">{step.eyebrow}</span><span className="tour-progress">{state.step + 1} / {productTourSteps.length}</span></div><button className="icon-button" aria-label="Pause product tour" disabled={busy} onClick={() => void go(onPause)}><X size={18} /></button></header>
      <div className="tour-progress-track" aria-hidden="true"><span style={{ width: `${((state.step + 1) / productTourSteps.length) * 100}%` }} /></div>
      <h2 id="product-tour-title">{step.title}</h2>
      <p id="product-tour-description">{step.body}</p>
      {missing && <small className="tour-fallback-note">This account does not have an example for this step yet, so OJ is showing the explanation without an anchor.</small>}
      {message && <small className="tour-error" role="alert">{message}</small>}
      <footer><button disabled={busy || state.step === 0} onClick={() => void go(() => onStep(state.step - 1))}><ArrowLeft size={15} />Back</button><button className="text-button" disabled={busy} onClick={() => void go(onPause)}>Pause</button>{finalStep ? <button className="primary" disabled={busy} onClick={() => void go(onFinish)}><Check size={16} />Finish</button> : <button className="primary" disabled={busy} onClick={() => void go(() => onStep(state.step + 1))}>Next<ArrowRight size={15} /></button>}</footer>
    </section>
  </div>;
}

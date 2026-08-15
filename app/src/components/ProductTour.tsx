import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react';
import { catalystHash, navigate } from '../config/navigation';
import { hasTourArrowModifier, isEditableTourKeyTarget } from '../features/tour/keyboard';
import { placeTourCallout, type TourRect } from '../features/tour/placement';
import { productTourSteps, type ProductTourState } from '../features/tour/product-tour';

function targetBox(element: HTMLElement): TourRect {
  const rect = element.getBoundingClientRect();
  const padding = 7;
  return {
    top: Math.max(6, rect.top - padding),
    left: Math.max(6, rect.left - padding),
    width: Math.min(window.innerWidth - 12, rect.width + padding * 2),
    height: Math.min(window.innerHeight - 12, rect.height + padding * 2),
  };
}

export function ProductTourInvitation({ busy, onQuick, onGuided, onSkip }: { busy?: boolean; onQuick: () => void | Promise<void>; onGuided: () => void | Promise<void>; onSkip: () => void | Promise<void> }) {
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
      <span className="eyebrow">Choose your orientation</span>
      <h2 id="tour-invitation-title">Learn OJ your way</h2>
      <p id="tour-invitation-description">Both options leave real OJ data unchanged. The Guided Walkthrough uses only temporary synthetic Tutorial objects.</p>
      <div className="tour-mode-choices"><button className="primary" disabled={saving} onClick={() => void run(onQuick)}><span><b>Quick Tour</b><small>See how OJ fits together · about 2 minutes</small></span><ArrowRight size={16} /></button><button disabled={saving} onClick={() => void run(onGuided)}><span><b>Guided Walkthrough</b><small>Practice with a synthetic example · about 5–7 minutes</small></span><ArrowRight size={16} /></button></div>
      <footer><button className="text-button" disabled={saving} onClick={() => void run(onSkip)}>{saving ? 'Saving' : 'Skip for Now'}</button></footer>
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
  const [box, setBox] = useState<TourRect>();
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined'
      ? { width: 1280, height: 800 }
      : { width: window.innerWidth, height: window.innerHeight },
  );
  const [cardHeight, setCardHeight] = useState(280);

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
    const refreshBox = () => { if (target) setBox(targetBox(target)); };
    const refreshViewport = () => { setViewport({ width: window.innerWidth, height: window.innerHeight }); refreshBox(); };
    window.addEventListener('resize', refreshViewport); window.addEventListener('orientationchange', refreshViewport); window.addEventListener('scroll', refreshBox, true);
    return () => { window.clearTimeout(timer); window.removeEventListener('resize', refreshViewport); window.removeEventListener('orientationchange', refreshViewport); window.removeEventListener('scroll', refreshBox, true); };
  }, [catalystId, step.id, step.route, step.target]);

  useLayoutEffect(() => {
    const measure = () => { const height = card.current?.getBoundingClientRect().height || 0; if (height > 0) setCardHeight(height); };
    measure();
    if (typeof ResizeObserver === 'undefined' || !card.current) return;
    const observer = new ResizeObserver(measure); observer.observe(card.current);
    return () => observer.disconnect();
  }, [message, missing, state.step]);

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

  const mobile = viewport.width <= 700;
  const margin = mobile ? 10 : 16;
  const cardWidth = Math.min(380, Math.max(280, viewport.width - margin * 2));
  const placement = placeTourCallout({ viewport, target: box, card: { width: cardWidth, height: Math.min(cardHeight, viewport.height - margin * 2) }, margin, mobile });
  const style = { '--tour-card-left': `${placement.left}px`, '--tour-card-top': `${placement.top}px`, '--tour-card-width': `${cardWidth}px`, '--tour-card-max-height': `${placement.height}px` } as CSSProperties;
  const highlight = box ? { top: box.top, left: box.left, width: box.width, height: box.height } : undefined;
  const finalStep = state.step === productTourSteps.length - 1;

  return <div className="product-tour-layer" data-missing-target={missing ? 'true' : undefined} style={style}>
    <div className="product-tour-wash" aria-hidden="true" />
    {highlight && <div className="product-tour-highlight" aria-hidden="true" style={highlight} />}
    <section className="product-tour-card" data-placement={placement.placement} role="dialog" aria-modal="false" aria-labelledby="product-tour-title" aria-describedby="product-tour-description" tabIndex={-1} ref={card}>
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

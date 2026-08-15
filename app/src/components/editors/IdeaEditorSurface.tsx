import type { ReactNode, RefObject } from 'react';
import { Save, X } from 'lucide-react';
import { IDEA_SECTIONS, visibleFields } from '../../features/ideas/canonical';
import { dateKey } from '../../lib/calendar';
import { filterSelectableCatalysts } from '../../lib/catalyst-filter';
import { spreadMetrics, type Spread } from '../../lib/payoff';

export type IdeaCatalystChoice = { id: string; event: string; date?: string };

export function IdeaEditorSurface({ data, step, onStep, onChange, catalysts = [], maximumRisk, openRisk = 0, title, description, eyebrow = 'Private Idea record', badge, beforeNav, status, message, saving = false, saveLabel = 'Save Idea', onSave, onCancel, onReset, resetLabel = 'New Draft', allowedSteps, containerRef, modal = false }: {
  data: Record<string, string>;
  step: number;
  onStep: (step: number) => void;
  onChange: (data: Record<string, string>) => void;
  catalysts?: IdeaCatalystChoice[];
  maximumRisk?: number;
  openRisk?: number;
  title: string;
  description: string;
  eyebrow?: string;
  badge?: ReactNode;
  beforeNav?: ReactNode;
  status?: ReactNode;
  message?: string;
  saving?: boolean;
  saveLabel?: string;
  onSave: () => void | Promise<void>;
  onCancel?: () => void;
  onReset?: () => void | Promise<void>;
  resetLabel?: string;
  allowedSteps?: number[];
  containerRef?: RefObject<HTMLElement | null>;
  modal?: boolean;
}) {
  const current = IDEA_SECTIONS[step] || IDEA_SECTIONS[0];
  const fields = visibleFields(data, step);
  const selectableCatalysts = filterSelectableCatalysts(catalysts, dateKey(new Date()));
  const metrics = spreadMetrics(
    (data.Strategy === 'Bull Call Spread' ? 'bull-call-spread' : 'bear-put-spread') as Spread,
    Number(data['Long strike']), Number(data['Short strike']), Number(data['Net debit']), Number(data.Contracts),
  );
  const availableRisk = maximumRisk === undefined ? undefined : Math.max(0, maximumRisk - openRisk);
  const update = (name: string, next: string) => onChange({ ...data, [name]: next });
  const canVisit = (index: number) => !allowedSteps || allowedSteps.includes(index);
  const next = IDEA_SECTIONS.map((_, index) => index).find((index) => index > step && canVisit(index));
  const previous = IDEA_SECTIONS.map((_, index) => index).reverse().find((index) => index < step && canVisit(index));

  return <section className={`${modal ? 'workflow-sheet' : 'workflow-sheet workflow-sheet-embedded'}`} role={modal ? 'dialog' : undefined} aria-modal={modal ? 'true' : undefined} aria-labelledby="idea-dialog-title" ref={containerRef} data-shared-ui="idea-editor" data-shared-ui-section={step === 3 ? 'candidate-editor' : current.title.toLowerCase()}>
    <header><div>{badge}<span className="eyebrow">{eyebrow}</span><h2 id="idea-dialog-title">{title}</h2><p>{description}</p></div>{onCancel && <button className="icon-button" onClick={onCancel} aria-label="Close idea editor"><X /></button>}</header>
    {beforeNav}<nav className="step-nav" aria-label="Idea steps">{IDEA_SECTIONS.map((section, index) => <button key={section.title} className={index === step ? 'active' : ''} disabled={!canVisit(index)} onClick={() => onStep(index)}><span>{index + 1}</span>{section.title}</button>)}</nav>
    <div className="workflow-body"><div className="section-intro"><h3>{current.title}</h3><p>{current.subtitle}</p></div><div className="form-grid">
      {fields.map((field) => <label key={field.name}><span>{field.label}{field.required && <em>Required</em>}</span>
        {field.name === 'Existing catalyst ID' ? <select value={data[field.name] || ''} onChange={(event) => update(field.name, event.target.value)}><option value="">Choose a scheduled catalyst</option>{selectableCatalysts.map((item) => <option key={item.id} value={item.id}>{item.date} · {item.event}</option>)}</select>
          : field.options ? <select value={data[field.name] || field.options[0]} onChange={(event) => update(field.name, event.target.value)}>{field.options.map((option) => <option key={option}>{option}</option>)}</select>
            : field.multiline ? <textarea value={data[field.name] || ''} placeholder={field.placeholder || field.label} onChange={(event) => update(field.name, event.target.value)} />
              : <input type={field.inputType || 'text'} min={field.inputType === 'number' ? '0' : undefined} step={field.name === 'Contracts' ? '1' : field.inputType === 'number' ? '0.01' : undefined} value={data[field.name] || ''} placeholder={field.placeholder || field.label} onChange={(event) => update(field.name, event.target.value)} />}
      </label>)}
    </div>{step === 3 && <div className="risk-preview"><b>Risk Preview</b>{metrics ? <><span>Maximum loss: ${metrics.maxLoss.toFixed(2)}</span><span>Maximum profit: ${metrics.maxProfit.toFixed(2)}</span><span>Break-even: {metrics.breakEven.toFixed(2)}</span></> : <p>Candidate pricing is optional. Complete all structure values to calculate the spread.</p>}{availableRisk !== undefined && <small>${availableRisk.toFixed(2)} portfolio-risk capacity available. OJ never auto-sizes or sends orders.</small>}</div>}</div>
    <footer><div>{status}{message && <span role="status" aria-live="polite">{message}</span>}</div><div>{onReset && <button onClick={() => void onReset()}>{resetLabel}</button>}<button onClick={() => previous !== undefined && onStep(previous)} disabled={previous === undefined}>Back</button>{next !== undefined ? <button className="primary" onClick={() => onStep(next)}>Next</button> : <button className="primary" onClick={() => void onSave()} disabled={saving}><Save size={16} />{saving ? 'Saving' : saveLabel}</button>}</div></footer>
  </section>;
}

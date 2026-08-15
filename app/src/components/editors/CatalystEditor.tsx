import type { ReactNode } from 'react';
import type { CatalystDateCertainty, CatalystScheduleKind, SourceQuality } from '../../types/domain';
import { dateKey } from '../../lib/calendar';

export type CatalystEditorValues = {
  event: string;
  type: string;
  date: string;
  time: string;
  timezoneName: string;
  scheduleKind: CatalystScheduleKind;
  dateCertainty: CatalystDateCertainty;
  marketSession: 'pre_market' | 'regular' | 'after_hours' | 'all_day' | 'unscheduled';
  sensitivity: string;
  source: string;
  sourceUrl: string;
  sourceQuality: SourceQuality;
  cluster: string;
  consensus: string;
  prior: string;
  whyMatters: string;
  keyVariables: string;
  tags: string;
};

// eslint-disable-next-line react-refresh/only-export-components
export function createCatalystEditorValues(today = new Date()): CatalystEditorValues {
  return {
    event: '', type: 'Employment', date: dateKey(today), time: '08:30', timezoneName: 'America/New_York',
    scheduleKind: 'scheduled', dateCertainty: 'confirmed', marketSession: 'pre_market', sensitivity: 'High',
    source: '', sourceUrl: '', sourceQuality: 'official', cluster: '', consensus: '', prior: '', whyMatters: '', keyVariables: '', tags: '',
  };
}

export function CatalystEditor({ values, onChange, onSave, onCancel, saving = false, disabled = false, title = 'Add Catalyst', description = 'Scheduled releases receive a verified time. Contextual risks remain off the calendar until a real date exists.', eyebrow, badge, saveLabel = 'Save Catalyst' }: {
  values: CatalystEditorValues;
  onChange: (values: CatalystEditorValues) => void;
  onSave: () => void | Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
  disabled?: boolean;
  title?: string;
  description?: string;
  eyebrow?: string;
  badge?: ReactNode;
  saveLabel?: string;
}) {
  const update = <Key extends keyof CatalystEditorValues>(key: Key, value: CatalystEditorValues[Key]) => onChange({ ...values, [key]: value });
  const valid = Boolean(values.event.trim() && (values.scheduleKind !== 'scheduled' || (values.date && values.time)));
  return <section className="card inline-form catalyst-editor" data-shared-ui="catalyst-editor">
    <header><div>{badge}{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2><p>{description}</p></div></header>
    <div className="form-grid">
      <label><span>Event</span><input value={values.event} onChange={(event) => update('event', event.target.value)} /></label>
      <label><span>Schedule type</span><select value={values.scheduleKind} onChange={(event) => update('scheduleKind', event.target.value as CatalystScheduleKind)}><option value="scheduled">Scheduled event</option><option value="contextual">Contextual risk</option></select></label>
      {values.scheduleKind === 'scheduled' && <>
        <label><span>Date</span><input type="date" value={values.date} onChange={(event) => update('date', event.target.value)} /></label>
        <label><span>Release Time</span><input type="time" value={values.time} onChange={(event) => update('time', event.target.value)} /></label>
        <label><span>Timezone</span><select value={values.timezoneName} onChange={(event) => update('timezoneName', event.target.value)}><option>America/New_York</option><option>UTC</option></select></label>
        <label><span>Session</span><select value={values.marketSession} onChange={(event) => update('marketSession', event.target.value as CatalystEditorValues['marketSession'])}><option value="pre_market">Pre-market</option><option value="regular">Regular hours</option><option value="after_hours">After hours</option><option value="all_day">All day</option></select></label>
        <label><span>Date certainty</span><select value={values.dateCertainty} onChange={(event) => update('dateCertainty', event.target.value as CatalystDateCertainty)}>{['confirmed','estimated','unconfirmed'].map((item) => <option key={item}>{item}</option>)}</select></label>
      </>}
      <label><span>Category</span><select value={values.type} onChange={(event) => update('type', event.target.value)}>{['Employment','Inflation','Central bank','Earnings','Policy','Other'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Sensitivity</span><select value={values.sensitivity} onChange={(event) => update('sensitivity', event.target.value)}>{['Low','Medium','High'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Source name</span><input value={values.source} onChange={(event) => update('source', event.target.value)} /></label>
      <label><span>Source quality</span><select value={values.sourceQuality} onChange={(event) => update('sourceQuality', event.target.value as SourceQuality)}>{['official','primary','secondary','unverified'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="wide"><span>Source URL</span><input type="url" value={values.sourceUrl} onChange={(event) => update('sourceUrl', event.target.value)} /></label>
      <label><span>Consensus</span><input value={values.consensus} onChange={(event) => update('consensus', event.target.value)} /></label>
      <label><span>Prior</span><input value={values.prior} onChange={(event) => update('prior', event.target.value)} /></label>
      <label className="wide"><span>Why it matters</span><textarea value={values.whyMatters} onChange={(event) => update('whyMatters', event.target.value)} /></label>
      <label><span>Key variables</span><textarea value={values.keyVariables} onChange={(event) => update('keyVariables', event.target.value)} /></label>
      <label><span>Tags</span><input value={values.tags} placeholder="macro, earnings" onChange={(event) => update('tags', event.target.value)} /></label>
      <label className="wide"><span>Cluster</span><input value={values.cluster} placeholder="Optional correlation cluster" onChange={(event) => update('cluster', event.target.value)} /></label>
    </div>
    <footer>{onCancel && <button onClick={onCancel}>Cancel</button>}<button className="primary" disabled={saving || disabled || !valid} onClick={() => void onSave()}>{saving ? 'Saving' : saveLabel}</button></footer>
  </section>;
}

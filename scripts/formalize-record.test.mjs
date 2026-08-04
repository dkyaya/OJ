import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'formalize-record.mjs');

test('formalization is deterministic, safely quoted, and path constrained', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oj-formalize-'));
  try {
    const input = path.join(temp, 'payload.json');
    const output = path.join(temp, 'github-output.txt');
    fs.writeFileSync(
      input,
      JSON.stringify({
        payload: {
          id: '11111111-1111-4111-8111-111111111111',
          ticker: 'SPY',
          strategy: 'bull-call-spread',
          bias: 'bullish: measured',
          confidence: 'moderate',
          revision: 2,
          published_note_path: '../../outside.md',
          data: {
            'Thesis summary': 'Rates ease; trend holds.',
            candidates: [{ name: 'Balanced', long_strike: 750, short_strike: 752, net_debit: 0.5, contracts: 2 }],
          },
        },
      }),
    );

    const env = {
      ...process.env,
      OJ_JOB_ID: '22222222-2222-4222-8222-222222222222',
      GITHUB_OUTPUT: output,
    };
    const run = () => spawnSync(process.execPath, [script, input], { cwd: temp, env, encoding: 'utf8' });

    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const generated = fs.readdirSync(path.join(temp, 'Trade Ideas'))[0];
    const note = path.join(temp, 'Trade Ideas', generated);
    const firstContents = fs.readFileSync(note, 'utf8');
    assert.match(firstContents, /bias: "bullish: measured"/);
    assert.match(firstContents, /Payload hash: [0-9a-f]{64}/);
    assert.match(firstContents, /Maximum loss: \$100\.00/);
    assert.match(firstContents, /Maximum profit: \$300\.00/);
    assert.match(firstContents, /Reward\/risk: 3\.00×/);
    assert.ok(!fs.existsSync(path.join(temp, '..', 'outside.md')));

    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(fs.readFileSync(note, 'utf8'), firstContents);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('formalization rejects credential-like content before writing a public branch', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oj-private-'));
  try {
    const input = path.join(temp, 'payload.json');
    fs.writeFileSync(
      input,
      JSON.stringify({
        payload: {
          id: '33333333-3333-4333-8333-333333333333',
          ticker: 'SPY',
          strategy: 'bull-call-spread',
          bias: 'bullish',
          revision: 1,
          data: { 'Thesis summary': 'account number: 123456' },
        },
      }),
    );
    const result = spawnSync(process.execPath, [script, input], { cwd: temp, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /private or credential-like marker/);
    assert.ok(!fs.existsSync(path.join(temp, 'Trade Ideas')));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('related records append to the parent canonical note without claiming an unconfirmed fill', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oj-related-'));
  try {
    const note = path.join(temp, 'Trade Ideas', 'SPY.md');
    fs.mkdirSync(path.dirname(note), { recursive: true });
    fs.writeFileSync(note, '# SPY thesis\n');
    const input = path.join(temp, 'payload.json');
    fs.writeFileSync(
      input,
      JSON.stringify({
        payload: {
          id: '44444444-4444-4444-8444-444444444444',
          trade_idea_id: '11111111-1111-4111-8111-111111111111',
          revision: 1,
          confirmed_actual: false,
          created_at: '2026-08-04T12:00:00Z',
          data: { price: '0.48', contracts: 1 },
          _formalization: {
            record_type: 'trade_entry',
            parent: { ticker: 'SPY', published_note_path: 'Trade Ideas/SPY.md' },
          },
        },
      }),
    );
    const result = spawnSync(process.execPath, [script, input], {
      cwd: temp,
      encoding: 'utf8',
      env: { ...process.env, OJ_JOB_ID: '55555555-5555-4555-8555-555555555555' },
    });
    assert.equal(result.status, 0, result.stderr);
    const contents = fs.readFileSync(note, 'utf8');
    assert.match(contents, /## Entry — 2026-08-04/);
    assert.match(contents, /Unconfirmed — not an actual fill/);
    assert.match(contents, /price: 0\.48/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

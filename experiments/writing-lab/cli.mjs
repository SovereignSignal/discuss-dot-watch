#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { parseArgs } from 'node:util';
import { prepare, check, importDiscourse, blindEvaluation } from './core.mjs';
import { readJson, readStdin, loadCorpus, saveFeedback, writeNewJson } from './io.mjs';
import { createWriter } from './provider.mjs';
const HELP = `Writing Lab (Node 22+, no install)
  node experiments/writing-lab/cli.mjs prepare --input request.json [--demo] [--corpus approved.json]
  node experiments/writing-lab/cli.mjs check --input check.json [--demo] [--corpus approved.json]
  node experiments/writing-lab/cli.mjs import --input topic.json --origin https://forum.example.org
  node experiments/writing-lab/cli.mjs feedback --input edit.json
  node experiments/writing-lab/cli.mjs blind --input outputs.json --seed private-seed --out review.json
  node experiments/writing-lab/cli.mjs write --input request.json [--corpus approved.json]
Omit --input to read JSON from stdin. --out writes a NEW private file and refuses overwrites.
Import writes quarantine records, not an approved corpus. Feedback requires opt-in and an external data directory.
The standalone writer is disabled unless its opt-in, model and key are configured. Prepare/check never call a model.`;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    input: { type: 'string' }, out: { type: 'string' }, corpus: { type: 'string' }, origin: { type: 'string' },
    seed: { type: 'string' }, demo: { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
  } });
  if (values.help || !positionals.length) { console.log(HELP); }
  else {
    const command = positionals[0];
    if (positionals.length !== 1 || !['prepare', 'check', 'import', 'feedback', 'blind', 'write'].includes(command)) throw new Error('Unknown command');
    const input = values.input ? await readJson(values.input) : await readStdin();
    let output, alreadyWritten = false;
    if (command === 'import') {
      if (!values.origin) throw new Error('Import requires --origin');
      output = importDiscourse(input, { origin: values.origin, retrievedAt: new Date().toISOString() });
    } else if (command === 'feedback') output = await saveFeedback(input);
    else if (command === 'blind') {
      if (!values.out || !values.seed) throw new Error('Blind evaluation requires --out and --seed');
      const { blind, key, note } = blindEvaluation(input, values.seed);
      // Key is stored separately and must never be shown to raters before locking their ratings.
      output = { blind, note: 'Rate before opening the separate key file.' };
      await writeNewJson(values.out, output);
      try { await writeNewJson(values.out + '.key.json', { key, note }); }
      catch (error) { await fs.unlink(values.out); throw error; }
      alreadyWritten = true;
    } else {
      const corpus = await loadCorpus(values.corpus);
      if (values.demo) {
        if (command === 'check') input.request = { ...input.request, includeIllustrative: true };
        else input.includeIllustrative = true;
      }
      if (command === 'prepare') output = prepare(input, corpus);
      else if (command === 'check') output = check(input, corpus);
      else output = await createWriter()(input, corpus);
    }
    if (values.out) { if (!alreadyWritten) await writeNewJson(values.out, output); console.log(JSON.stringify({ written: values.out })); }
    else console.log(JSON.stringify(output, null, 2));
  }
} catch (error) {
  // CLI errors omit stacks and input content. Do not log provider responses or credentials.
  const text = error instanceof SyntaxError ? 'Invalid JSON input or response; content omitted.'
    : error?.code ? `Operation failed (${error.code}); check paths and arguments.`
    : error instanceof Error && /^(Invalid |Every protected|Duplicate |Corpus |Approval |Source |Writer |Explicit |Set WRITING|Feedback |Expected |Input |JSON |Import |Blind |Unknown command|Use an evaluation|Each task|No evaluation|Provider |Missing provider|Malformed provider|Empty or oversized)/.test(error.message) ? error.message
    : 'Operation failed; content omitted.';
  process.stderr.write(`Writing Lab: ${text}\n`); process.exitCode = 1;
}

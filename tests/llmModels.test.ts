import test from 'node:test';
import assert from 'node:assert/strict';
import { ollamaClassifyModel } from '@/lib/llm';

test('ollamaClassifyModel falls back to LLM_MODEL', () => {
  const prevModel = process.env.LLM_MODEL;
  const prevClassify = process.env.LLM_MODEL_CLASSIFY;
  process.env.LLM_MODEL = 'glm-5.2';
  delete process.env.LLM_MODEL_CLASSIFY;
  try {
    assert.equal(ollamaClassifyModel(), 'glm-5.2');
  } finally {
    restore(prevModel, prevClassify);
  }
});

test('ollamaClassifyModel prefers LLM_MODEL_CLASSIFY', () => {
  const prevModel = process.env.LLM_MODEL;
  const prevClassify = process.env.LLM_MODEL_CLASSIFY;
  process.env.LLM_MODEL = 'glm-5.2';
  process.env.LLM_MODEL_CLASSIFY = 'gpt-oss:20b-cloud';
  try {
    assert.equal(ollamaClassifyModel(), 'gpt-oss:20b-cloud');
  } finally {
    restore(prevModel, prevClassify);
  }
});

function restore(prevModel: string | undefined, prevClassify: string | undefined) {
  if (prevModel === undefined) delete process.env.LLM_MODEL;
  else process.env.LLM_MODEL = prevModel;
  if (prevClassify === undefined) delete process.env.LLM_MODEL_CLASSIFY;
  else process.env.LLM_MODEL_CLASSIFY = prevClassify;
}

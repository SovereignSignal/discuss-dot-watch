import { promises as fs, constants } from 'node:fs';
import { dirname, resolve, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCorpus, feedbackRecord } from './core.mjs';
import { fixtures } from './fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
export const MAX_BYTES = 4 * 1024 * 1024;
export async function readJson(path) {
  const file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('Expected a regular JSON file of at most 4 MiB');
    // Read at most the cap even if the file grows after stat().
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      const read = await file.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
      if (!read.bytesRead) break;
      bytesRead += read.bytesRead;
    }
    if (bytesRead > MAX_BYTES) throw new Error('JSON input too large');
    return JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
  } finally { await file.close(); }
}
export async function loadCorpus(path = process.env.WRITING_LAB_CORPUS) {
  return validateCorpus(path ? [...fixtures, ...await readJson(path)] : fixtures);
}
export async function readStdin(stream = process.stdin, max = MAX_BYTES) {
  const chunks = []; let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > max) throw new Error('Input exceeds byte limit');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function writeNewJson(path, value) {
  // Refuse overwriting an existing file, including symlinks.
  await fs.writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
export async function saveFeedback(input, dataDir = process.env.WRITING_LAB_DATA_DIR) {
  const record = feedbackRecord(input);
  if (!dataDir) throw new Error('Set WRITING_LAB_DATA_DIR explicitly to enable private feedback storage');
  const base = resolve(dataDir);
  if (base === REPO || base.startsWith(REPO + sep)) throw new Error('Feedback must be stored outside the repository');
  const dir = join(base, 'writing-lab');
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  // Do not change permissions on an operator-owned directory. Refuse unsafe storage.
  const dirStat = await fs.lstat(dir);
  if (!dirStat.isDirectory() || dirStat.isSymbolicLink() || (dirStat.mode & 0o077)) throw new Error('Feedback directory must be private (0700) and not a symlink');
  const real = await fs.realpath(dir), realRepo = await fs.realpath(REPO);
  if (real === realRepo || real.startsWith(realRepo + sep)) throw new Error('Feedback resolves inside the repository');
  const file = await fs.open(join(dir, 'feedback.jsonl'), constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077)) throw new Error('Feedback file must be private (0600), regular and not hard-linked');
    if (stat.size > 20 * MAX_BYTES) throw new Error('Feedback journal is full; archive it explicitly');
    await file.writeFile(JSON.stringify(record) + '\n');
  } finally { await file.close(); }
  return { id: record.id, stored: true, trainingAllowed: false, sharedCorpusAllowed: false };
}

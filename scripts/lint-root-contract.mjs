import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
const require=createRequire(import.meta.url);
const pluginPath=dirname(require.resolve('@next/eslint-plugin-next/package.json'));
const {getRootDirs}=require(join(pluginPath,'dist/utils/get-root-dirs.js'));
const pluginRequire=createRequire(join(pluginPath,'package.json'));
const resolved=pluginRequire.resolve('fast-glob');
const root=mkdtempSync(join(tmpdir(),'next-lint-contract-'));
try {
  const one=join(root,'apps','one'),two=join(root,'apps','two');
  mkdirSync(one,{recursive:true});mkdirSync(two,{recursive:true});writeFileSync(join(root,'apps','file.txt'),'fixture');
  const context=rootDir=>({cwd:root,settings:rootDir===undefined?{}:{next:{rootDir}}});
  assert.deepEqual(getRootDirs(context()),[root]);
  assert.deepEqual(getRootDirs(context(one)),[one]);
  assert.deepEqual(getRootDirs(context(join(root,'apps','*'))).sort(),[one,two].sort());
  assert.deepEqual(getRootDirs(context([one,two])).sort(),[one,two].sort());
  assert.deepEqual(getRootDirs(context(join(root,'apps','{one,two}'))).sort(),[one,two].sort());
  assert.deepEqual(getRootDirs(context(join(root,'missing','*'))),[]);
  assert.deepEqual(getRootDirs(context(one.replaceAll('/','\\'))),[one]);
  const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
  const forbidden=Object.keys(lock.packages).filter(key=>/node_modules\/(?:braces|micromatch)$/.test(key));
  assert.deepEqual(forbidden,[],'Vulnerable transitive glob parsers remain');
  console.log('LINT_ROOT_CONTRACT '+JSON.stringify({passed:true,cases:7,resolver:resolved.includes('tinyglobby')?'tinyglobby':'scoped-alias',vulnerableGlobPackages:forbidden.length}));
} finally {rmSync(root,{recursive:true,force:true});}

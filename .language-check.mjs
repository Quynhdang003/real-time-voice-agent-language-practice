import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { NextResponse } from 'next/server.js';
const tempRequire = createRequire(path.join(os.tmpdir(), 'fluentai-voice-browser-check/package.json'));
const { build } = tempRequire('esbuild');
const { chromium } = tempRequire('playwright');
function moduleFrom(file, dependencies = {}) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(js, { exports: loadedModule.exports, module: loadedModule, require: (name) => {
    if (!(name in dependencies)) throw new Error('Unexpected module: '+name);
    return dependencies[name];
  }, console });
  return loadedModule.exports;
}
const domain = moduleFrom('lib/practice/session.ts');
const documents = new Map();
let sequence = 0;
const api = moduleFrom('app/api/practice-setup/route.ts', {
  'next/server': { NextResponse },
  'firebase-admin/firestore': { FieldValue: { serverTimestamp: () => 'test-timestamp' } },
  '@/lib/actions/auth.action': { getCurrentUser: async () => ({ id: 'test-owner' }) },
  '@/lib/practice/session': domain,
  '@/firebase/admin': { adminDb: { collection: () => ({ doc: () => {
    const id = 'language-test-'+(++sequence);
    return { id, set: async (value) => documents.set(id, value) };
  } }) } },
});
const bundle = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
    import {HomePracticeSetup} from './components/fluent/home-practice-setup';
    import {VoiceCallExperience} from './components/fluent/voice-call-experience';
    const root=createRoot(document.getElementById('root'));
    window.showVoice=(url)=>{window.sessionUrl=url;root.render(<VoiceCallExperience key={window.savedSession.id} session={window.savedSession} learner={{name:'Test',photoURL:null}}/>)};
    root.render(<HomePracticeSetup userName="Test"/>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NEXT_PUBLIC_DOGRAH_WIDGET_SRC': 'undefined' },
  plugins: [{ name: 'test-next', setup(b) {
    b.onResolve({ filter: /^next\/(navigation|image|link)$/ }, ({path}) => ({path,namespace:'mock'}));
    b.onLoad({ filter: /.*/, namespace:'mock' }, ({path:p}) => ({contents: p.endsWith('navigation')
      ? 'const r={push:(u)=>window.showVoice(u),replace:(u)=>window.showVoice(u)};export const useRouter=()=>r;'
      : p.endsWith('image') ? 'export default function Image(){return null;}'
      : 'import React from "react";export default function Link(p){return React.createElement("a",p,p.children)}',
      resolveDir:process.cwd(),loader:'js'}));
  } }],
});
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost:3000/',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div><script src="/language-check.js"></script>'}));
  await page.route('**/language-check.js',r=>r.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text}));
  let unblock;
  let slow=false;
  const requests=[];
  await page.route('**/api/practice-setup',async r=>{
    const body=r.request().postDataJSON();requests.push(body);
    if(slow)await new Promise(resolve=>{unblock=resolve;});
    const response=await api.POST(new Request('http://localhost:3000/api/practice-setup',{method:'POST',body:JSON.stringify(body)}));
    const data=await response.json();
    const session=domain.parsePracticeSession(data.sessionId,documents.get(data.sessionId));
    await page.evaluate(session=>{window.savedSession=session;},session);
    await r.fulfill({status:response.status,json:data});
  });
  for(const language of Object.values(domain.practiceLanguages)){
    await page.goto('http://localhost:3000/');
    const card=page.getByRole('button').filter({has:page.getByRole('heading',{name:language.name,exact:true})});
    await card.click();assert.equal(await card.getAttribute('aria-pressed'),'true');
    await page.getByRole('button',{name:'Start Voice Practice',exact:true}).click();
    await page.getByText('Your '+language.name+' practice with Emma.',{exact:true}).waitFor();
    assert.equal(requests.at(-1).languageId,language.id);
    console.log('PASS select -> actual POST handler -> stored document -> voice UI:',language.name);
  }
  await page.goto('http://localhost:3000/');slow=true;
  await page.getByRole('button',{name:'Start Voice Practice',exact:true}).click();
  while(!unblock)await new Promise(r=>setTimeout(r,20));
  const japanese=page.getByRole('button').filter({has:page.getByRole('heading',{name:'Japanese',exact:true})});
  if(await japanese.isDisabled())console.log('PASS language selection is locked while creating session');
  else{await japanese.click();console.log('REPRODUCED request language='+requests.at(-1).languageId+', Japanese shown selected='+await japanese.getAttribute('aria-pressed'));}
  unblock();await page.getByText('Your English practice with Emma.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
}finally{await browser.close();}

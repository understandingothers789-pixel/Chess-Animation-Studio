/** Pixel fixtures use a fresh browser and the same software GPU for both revisions. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
const label = process.argv[2] ?? 'current';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], {stdio:'pipe'});
const root = `test-results/render-${label}`;
await fs.mkdir(root, {recursive:true});
let browser;
try {
  for(let i=0;i<100;i++) { try { if((await fetch('http://127.0.0.1:5174')).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5174');
  const output = await page.evaluate(async () => {
    const {Scene} = await import('/src/render/Scene.ts' as string);
    const {blank,parseProject} = await import('/src/core/project.ts' as string);
    const {importPgn} = await import('/src/core/chess.ts' as string);
    const canvas = document.createElement('canvas'); document.body.replaceChildren(canvas);
    const scene = new Scene(canvas); await scene.ready;
    const sample = parseProject(await (await fetch('/samples/Opera.castudio')).json());
    const fixtures = [
      ['sample', sample],
      ['castling', importPgn(blank(), '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O')],
      ['en-passant', importPgn(blank(), '1. e4 a6 2. e5 d5 3. exd6')],
    ] as const;
    const frames: {key:string,png:string}[]=[];
    for(const [name,p] of fixtures) for(const format of ['landscape','vertical','square','square-in-vertical']) {
      for(const t of [0,5,2,8,5,1,8,14,24]) {
        scene.render(p,t,format==='landscape'?480:270,format==='square'?270:format==='landscape'?270:480,format);
        frames.push({key:`${name}-${format}-${t}`,png:canvas.toDataURL().split(',')[1]});
      }
    }
    scene.dispose(); return frames;
  });
  const hashes: Record<string,string>={};
  for(const frame of output) {
    const bytes=Buffer.from(frame.png,'base64'); const hash=createHash('sha256').update(bytes).digest('hex');
    if(hashes[frame.key] && hashes[frame.key]!==hash) throw Error('Nondeterministic '+frame.key);
    hashes[frame.key]=hash; await fs.writeFile(`${root}/${frame.key}.png`,bytes);
  }
  await fs.writeFile(`${root}/hashes.json`,JSON.stringify(hashes,null,2));
  console.log(`PASS: ${output.length} render requests, ${Object.keys(hashes).length} unique fixtures (${label})`);
} finally { await browser?.close(); server.kill(); }

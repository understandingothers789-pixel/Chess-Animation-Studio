import {it,expect} from 'vitest';
import {RenderGraph,type Pass} from '../src/render/engine/RenderGraph';
it('orders resource producers and runs only active nodes with reusable lifecycle',()=>{
 const calls:string[]=[];
 const graph=new RenderGraph<number>([
  {id:'consumer',stage:'board',inputs:['motion'],render:()=>calls.push('consumer'),dispose:()=>calls.push('dispose-consumer')},
  {id:'producer',stage:'board',outputs:['motion'],end:2,initialize:()=>calls.push('init'),resize:()=>calls.push('resize'),render:()=>calls.push('producer'),dispose:()=>calls.push('dispose-producer')}
 ]);
 graph.render(1,1,10,10);graph.render(3,3,10,10);graph.dispose();graph.dispose();
 expect(calls).toEqual(['init','resize','producer','consumer','consumer','dispose-consumer','dispose-producer']);
 expect(()=>graph.render(1,1,10,10)).toThrow(/disposed/);
});
it('rejects inactive cycles and unresolved resource inputs before initialization',()=>{
 const render=()=>{};
 expect(()=>new RenderGraph([{id:'a',stage:'board',enabled:false,after:['b'],render},{id:'b',stage:'board',after:['a'],render}])).toThrow(/Cycle/);
 expect(()=>new RenderGraph([{id:'a',stage:'board',inputs:['missing'],render}])).toThrow(/missing input/);
});
it('cleans partially initialized passes and reports failing render nodes',()=>{
 const calls:string[]=[];
 expect(()=>new RenderGraph([{id:'a',stage:'board',initialize:()=>{throw Error('failed');},dispose:()=>calls.push('disposed'),render:()=>{}}])).toThrow('failed');
 expect(calls).toEqual(['disposed']);
 const graph=new RenderGraph([{id:'a',stage:'board',render:()=>{throw Error('gpu');}}]);
 expect(()=>graph.render(0,{},10,10)).toThrow('Render pass "a" failed');
 expect(()=>graph.render(NaN,{},10,10)).toThrow(/time/);
 expect(()=>graph.render(0,{},0,10)).toThrow(/dimensions/);
});

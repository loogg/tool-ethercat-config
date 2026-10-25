import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTimingScene, getTimingLesson, timingCoverage, timingDefaults, timingLessons } from '../src/lib/timing-scenes.js'
import { watchdogTiming } from '../src/lib/watchdog-timing.js'
import { entries } from '../src/data/index.js'
test('all timing registrations resolve to actual entries, and static identities have no invented timing',()=>{
  for(const c of timingCoverage){assert.ok(entries.some(e=>e.id===c.id),c.id);assert.ok(timingLessons[c.lesson])}
  for(const id of ['vendor-id','product-code','xlsx-data-type','esi-type','esi-vendor','static-object-dic'])assert.equal(getTimingLesson(id),null)
})
test('all scenes have valid common-axis events and scoped teaching evidence',()=>{
  for(const [id,lesson] of Object.entries(timingLessons))for(const scenario of lesson.scenarios){const s=buildTimingScene(id,timingDefaults(id),scenario.id);assert.ok(s.end>0);assert.ok(lesson.references.length);assert.ok(lesson.scope);assert.equal(new Set(s.events.map(e=>e.id)).size,s.events.length);for(const e of s.events){assert.ok(e.at>=0&&e.at<=s.end);assert.ok(s.tracks.some(t=>t.id===e.track),e.track)}assert.ok(s.snapshot(0).length);assert.ok(s.snapshot(s.end).length)}
})
test('watchdog can expire between continuing feeds and refresh independently at the next trigger',()=>{
  const p={triggerInterval:150,stopTime:60,end:400}
  assert.deepEqual(watchdogTiming({...p,time:120}).lanes.map(l=>l.state),['expired','expired'])
  assert.deepEqual(watchdogTiming({...p,time:150}).lanes.map(l=>l.state),['waiting','waiting'])
  assert.ok(buildTimingScene('watchdog',p,'continuous').events.some(e=>e.at===100&&e.tone==='red'))
})
test('watchdog teaching parameters preserve zero counts when transferred to the calculator',()=>{
  const s=buildTimingScene('watchdog',{pdiCount:0},'both-stop');assert.equal(s.calculator.pdiCount,0);assert.equal(s.snapshot(180)[0].value,'禁用');assert.equal(s.snapshot(180)[1].value,'已超时');assert.ok(!s.events.some(e=>e.id.startsWith('pdi-expiry')))
})
test('invalid and unbounded teaching inputs cannot leave a nominal healthy diagram',()=>{
  for(const values of [{divider:''},{smCount:-1},{divider:1.5},{end:0},{triggerInterval:0},{end:100000,triggerInterval:.001}])assert.throws(()=>buildTimingScene('watchdog',values))
  assert.throws(()=>buildTimingScene('cycle',{cycle:''}));assert.throws(()=>buildTimingScene('sdo',{poll:0}));assert.throws(()=>buildTimingScene('sdo',{poll:.1,limit:100000}))
})
test('cycle budget signals overrun without hiding slow work or adding physical delay to CPU stages',()=>{
  const s=buildTimingScene('cycle',{cycle:100,output:50,application:80,input:40});assert.ok(s.end>=170);assert.equal(s.snapshot(100)[1].tone,'red');assert.match(s.summary,/170/);assert.ok(s.events.some(e=>e.id==='cycle-boundary'&&e.tone==='red'))
})
test('AL transition waits for both required conditions; late readiness cannot undo an earlier timeout',()=>{
  const a=buildTimingScene('al',{timeout:50,ready:20,output:70},'output');assert.match(a.snapshot(80)[0].value,/错误/)
  const b=buildTimingScene('al',{timeout:50,ready:20,output:70},'no-output');assert.equal(b.snapshot(30)[0].value,'OP')
  assert.equal(buildTimingScene('al',{},'preop').snapshot(0)[0].value,'INIT · 正在等待')
})
test('SDO pending polls are local continuation of one master request, and abort stops before polling',()=>{
  const s=buildTimingScene('sdo',{work:23,poll:10});assert.equal(s.events.filter(e=>e.id==='request').length,1);assert.equal(s.events.find(e=>e.id==='response').at,32);assert.equal(s.events.filter(e=>e.track==='callback').length,3)
  const aborted=buildTimingScene('sdo',{},'abort');assert.equal(aborted.events.filter(e=>e.track==='callback').length,0)
})
test('buffer teaching keeps W/R/F distinct and preserves the read buffer until acquire',()=>{
  const s=buildTimingScene('buffer',{},'writer-fast');assert.equal(s.lesson.unit,'步');const read=s.tracks.find(t=>t.id==='bank-1').segments;assert.ok(read.slice(0,5).every(v=>v.label.startsWith('R')))
  for(let i=0;i<s.end;i++){const labels=s.tracks.filter(t=>t.id.startsWith('bank')).map(t=>t.segments[i].label[0]);assert.equal(new Set(labels).size,3)}
})
test('CiA402 logical steps keep EtherCAT OP independent from drive enabling and fault states',()=>{
  const s=buildTimingScene('drive',{},'fault');assert.equal(s.lesson.unit,'步');assert.ok(s.snapshot(2).some(v=>v.value==='OP'));assert.ok(s.snapshot(2).some(v=>v.value==='Fault'));assert.match(s.lesson.scope,/掩码/)
})
test('physical Delay Time has its own event model and zero remains a fixed description',()=>{
  const s=buildTimingScene('delay',{delay:0},'input');assert.equal(s.lesson.unit,'ns');assert.equal(s.events.find(e=>e.id==='physical').at,0);assert.match(s.snapshot(0)[0].value,/锁存/);assert.match(s.lesson.scope,/不切换到运行测量/);assert.equal(getTimingLesson('pd-input-delay-time'),'delay');assert.ok(!s.tracks.some(t=>t.id==='budget'))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { DOMParser } from '@xmldom/xmldom'
import { crossSourceContracts,relationTypes } from '../src/data/cross-source-contracts.js'
import { buildCrossSourceGraph,contractsForEntry,contractsForEsi,crossRelationsForField,crossSourceSelection } from '../src/lib/cross-source-model.js'
import { entries,entryMap } from '../src/data/index.js'
import { applicationContext } from '../src/lib/application-model.js'
import { esiExamples } from '../src/data/esi-examples.js'
import { parseEsiXml,esiScope,child } from '../src/lib/esi-model.js'

test('cross-source contracts have existing targets, typed directed relations, evidence and conditions',()=>{
  assert.equal(new Set(crossSourceContracts.map(c=>c.id)).size,crossSourceContracts.length)
  for(const c of crossSourceContracts){const g=buildCrossSourceGraph(c);assert.equal(new Set(g.nodes.map(n=>n.id)).size,g.nodes.length);assert.ok(c.evidence.length);assert.ok(c.versionScope);for(const n of g.nodes){assert.ok(entryMap.has(n.entryId),n.entryId);assert.ok(n.path);assert.equal(n.role,'definition')}for(const e of g.edges){assert.ok(g.nodes.some(n=>n.id===e.source));assert.ok(g.nodes.some(n=>n.id===e.target));assert.ok(relationTypes[e.kind]);assert.ok(e.condition);assert.equal(e.status,'rule-only')}}
})
test('forward and inverse reference queries share one relation instead of separately authored copies',()=>{
  for(const c of crossSourceContracts){const g=buildCrossSourceGraph(c);for(const e of g.edges){const a=crossRelationsForField(c,e.source).find(r=>r.id===e.id),b=crossRelationsForField(c,e.target).find(r=>r.id===e.id);assert.equal(a.incoming,false);assert.equal(b.incoming,true);assert.equal(a.condition,b.condition);assert.equal(a.kind,b.kind)}}
})
test('SSC, APP and ESI entry routes expose the same contract for shared semantics',()=>{
  for(const id of ['max-pd-output-size','xlsx-rx-tx','esi-rxpdo'])assert.ok(contractsForEntry(id).some(c=>c.id==='pdo-output'))
  assert.equal(contractsForEntry('coe-supported')[0].id,'coe')
  assert.ok(contractsForEntry('xlsx-modular').some(c=>c.id==='modules'))
  assert.equal(contractsForEntry('made-up').length,0)
  for(const c of crossSourceContracts)for(const id of c.entryIds)assert.ok(entries.some(e=>e.id===id),id)
})
test('ESI routing follows attribute and parent scope, retaining internal XML references separately',()=>{
  const document=parseEsiXml(esiExamples[0].xml,DOMParser),scope=esiScope(document)
  assert.equal(contractsForEsi({node:scope.sms[2],attribute:'ControlByte'})[0].id,'watchdog')
  assert.equal(contractsForEsi({node:child(scope.device.node,'Type')})[0].id,'identity')
  assert.equal(contractsForEsi({node:scope.pdos[0].entries[0].node})[0].id,'pdo-output')
  assert.equal(contractsForEsi({node:scope.pdos[1].entries[0].node})[0].id,'pdo-input')
  const select=crossSourceSelection({esiContext:{documentId:'io',filename:'Teaching_IO.xml',scope,ownerScope:{owner:scope.device},node:scope.sms[2],attribute:'Enable'}})
  assert.equal(select.origin.rawValue,'1');assert.equal(select.origin.scope,scope.device.id);assert.equal(select.origin.paired,false)
})
test('same numeric object index in independent examples is not promoted to a paired project match',()=>{
  const document=parseEsiXml(esiExamples[0].xml,DOMParser),scope=esiScope(document),object=scope.objects.find(o=>o.index===0x7000),app=applicationContext({workbook:'direct-io',sheet:'Profile',field:'B',row:'17'},'xlsx-index')
  assert.equal(object.type,'UINT');assert.equal(app.row.object.code,'RECORD')
  const fromApp=crossSourceSelection({entryId:'xlsx-index',applicationContext:app}),fromXml=crossSourceSelection({esiContext:{documentId:'io',filename:'Teaching_IO.xml',scope,ownerScope:{owner:scope.device},node:object.node}})
  assert.notEqual(fromApp.origin.artifactId,fromXml.origin.artifactId)
  for(const s of [fromApp,fromXml]){assert.equal(s.origin.role,'occurrence');assert.equal(s.origin.paired,false);for(const c of s.contracts){const g=buildCrossSourceGraph(c);assert.equal(g.bindingStatus,'unbound');assert.ok(!g.nodes.some(n=>n.role==='resolved-instance'))}}
})
test('header locations retain their actual cells, explicit zero and correct Profile topic',()=>{
  const c=applicationContext({workbook:'direct-io',sheet:'Profile',field:'header:IndexIncrement'},'xlsx-modular'),s=crossSourceSelection({entryId:'xlsx-modular',applicationContext:c})
  assert.equal(s.origin.path,'Profile!C3');assert.equal(s.origin.rawValue,0)
  const p=applicationContext({workbook:'direct-io',sheet:'Profile',field:'header:Device Profile'},'xlsx-modular');assert.equal(crossSourceSelection({entryId:'xlsx-modular',applicationContext:p}).contracts[0].id,'profile')
})
test('capacity and type rules preserve activity, units and storage distinction instead of equating all values',()=>{
  const capacity=crossSourceContracts.find(c=>c.id==='pdo-output'),types=crossSourceContracts.find(c=>c.id==='types')
  assert.match(capacity.formula,/活动/);assert.ok(capacity.relations.some(r=>r.kind==='constrain'&&r.condition.includes('Byte')))
  assert.ok(capacity.relations.some(r=>r.condition.includes('不能据此断言')))
  assert.ok(types.relations.some(r=>r.condition.includes('sizeof')))
  assert.ok(types.relations.some(r=>r.condition.includes('BitOffs')))
})

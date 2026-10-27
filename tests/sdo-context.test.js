import test from 'node:test'
import assert from 'node:assert/strict'
import { DOMParser } from '@xmldom/xmldom'
import { applicationContext } from '../src/lib/application-model.js'
import { applicationWorkbooks } from '../src/data/application-workbooks.js'
import { esiExamples } from '../src/data/esi-examples.js'
import { parseEsiXml,esiScope } from '../src/lib/esi-model.js'
import { applicationAccessObject,esiAccessObject,resolveSdoContext,sscAccessContext } from '../src/lib/sdo-context.js'
import { deriveContextAccess,contextStorage } from '../src/lib/sdo-context-plan.js'
import { sourceType,sourceDefault,sourcePermission } from '../src/lib/sdo-source-types.js'
import { entryMap } from '../src/data/index.js'

const request={mode:'single',start:'0',operation:'read',state:'PREOP'}
const bytes=plan=>plan.cells.map(c=>c.mask===255?c.value:null)
function xmlContext(sample='modules',xml=null,device=0) {
  const document=parseEsiXml(xml||esiExamples.find(e=>e.id===sample).xml,DOMParser),scope=esiScope(document,document.devices[device].id)
  return {document,scope,ownerScope:{...scope,owner:scope.device,kind:'device'},documentId:sample,filename:'current.xml',node:scope.device.node}
}
const app=(row,field='E')=>applicationContext({workbook:'direct-io',sheet:'Profile',row:String(row),field})

test('APP uses the selected actual object, source positions and defaults rather than the fixed teaching object',()=>{
  const object=applicationAccessObject(app(23)),plan=deriveContextAccess(object,request)
  assert.equal(object.index,0x2000);assert.equal(object.name,'SamplePeriodMs');assert.equal(object.code,'VARIABLE')
  assert.deepEqual(bytes(plan),[10,0]);assert.equal(plan.byteLength,2)
  assert.equal(object.entries[0].source.defaultPath,'Profile › G23')
  assert.ok(object.source.key.includes('direct-io:Profile:23'))
  assert.equal(plan.kind,'preview')
})
test('APP generated SI0 is identified as a rule, preserves UINT8 semantics and never fabricates a source cell',()=>{
  const object=applicationAccessObject(app('12-si0')),entry=object.entries[0]
  assert.equal(object.index,0x6000);assert.equal(entry.logicalBits,8);assert.equal(entry.value.state,'generated')
  assert.equal(entry.value.bitsValue,2n);assert.equal(entry.source.generated,true)
  assert.ok(entry.source.path.includes('生成规则'));assert.equal(entry.source.defaultPath,undefined)
  assert.equal(contextStorage(object).rows[0].bits,16)
})
test('FALSE and zero remain known; blank defaults remain unknown and are not silently zero-filled',()=>{
  const object=applicationAccessObject(app(13)),bool=object.entries.find(e=>e.si===1)
  assert.equal(bool.value.known,true);assert.equal(bool.value.bitsValue,0n)
  assert.deepEqual(bytes(deriveContextAccess(object,{...request,start:'1'})),[0])
  assert.equal(sourceDefault(0,sourceType('UINT16')).known,true)
  assert.equal(sourceDefault(null,sourceType('UINT16')).known,false)
  const unknown={...object,entries:object.entries.map(e=>e.si===1?{...e,value:sourceDefault(null,e.type)}:e)}
  assert.deepEqual(bytes(deriveContextAccess(unknown,{...request,start:'1'})),[null])
})
test('object-head RO does not make RW application members read-only; permissions are checked per selected member',()=>{
  const object=applicationAccessObject(app(18))
  assert.equal(object.entries[0].access,'ro');assert.equal(object.entries[1].access,'rw')
  assert.equal(deriveContextAccess(object,{...request,start:'1',operation:'write'}).kind,'preview')
  assert.equal(deriveContextAccess(object,{...request,operation:'write'}).abortCode,'0x06010002')
})
test('default local-layout issues are surfaced instead of invented implicit padding or fake CA data',()=>{
  const object=applicationAccessObject(app(13)),storage=contextStorage(object)
  assert.equal(storage.status,'needs-review');assert.ok(storage.issues.some(s=>s.includes('16 bit')))
  assert.equal(deriveContextAccess(object,{...request,mode:'complete'}).kind,'unresolved')
  assert.deepEqual(bytes(deriveContextAccess(object,{...request,start:'2'})),[0])
})
test('a current ARRAY derives actual default bytes and CA0/CA1 lengths under an explicitly marked definition preview',()=>{
  const object=applicationAccessObject(app(27))
  assert.equal(object.index,0x2001)
  const zero=deriveContextAccess(object,{...request,mode:'complete'}),one=deriveContextAccess(object,{...request,mode:'complete',start:'1'})
  assert.deepEqual(bytes(zero),[2,0,10,0,20,0]);assert.deepEqual(bytes(one),[10,0,20,0])
  assert.ok(zero.pending.some(s=>s.includes('运行时SI0')))
})
test('ESI scalar DefaultData is decoded little endian using the current object, with unknown values preserved',()=>{
  const c=xmlContext('io'),object=esiAccessObject(c,c.scope.objects[0])
  assert.equal(object.index,0x1000);assert.equal(object.code,'VARIABLE')
  assert.deepEqual(bytes(deriveContextAccess(object,request)),[0x89,0x13,0,0])
  const missing=esiAccessObject(c,c.scope.objects[1]);assert.deepEqual(bytes(deriveContextAccess(missing,request)),[null,null])
})
test('ESI F000 uses matching Info/SubItem defaults and original BitSize/BitOffs, not another sample object',()=>{
  const c=xmlContext(),object=esiAccessObject(c,c.scope.objects[1])
  assert.equal(object.index,0xF000);assert.equal(object.entries[0].logicalBits,8)
  assert.deepEqual(object.entries.map(e=>e.declaredOffset),[0,16,32])
  assert.deepEqual(bytes(deriveContextAccess(object,{...request,start:'1'})),[0x10,0])
  assert.ok(object.entries[1].source.defaultPath.includes('/Info[1]/SubItem[2]'))
})
test('ESI false and absent CA declarations are distinct; false blocks CA but not single access',()=>{
  const c=xmlContext(),object=esiAccessObject(c,c.scope.objects[1])
  assert.equal(object.capability.device,false);assert.equal(deriveContextAccess(object,{...request,mode:'complete'}).kind,'blocked')
  assert.equal(deriveContextAccess(object,request).kind,'preview')
  const no=xmlContext('modules',esiExamples.find(e=>e.id==='modules').xml.replace(' CompleteAccess="0"',''))
  assert.equal(esiAccessObject(no,no.scope.objects[1]).capability.device,null)
})
test('ESI dictionary offsets never become claimed C offsets; unannotated gaps stay unknown',()=>{
  const c=xmlContext(),object=esiAccessObject(c,c.scope.objects[1])
  object.capability.device=true;object.totalBits=56;object.entries[1].declaredOffset=24;object.entries[2].declaredOffset=40
  const plan=deriveContextAccess(object,{...request,mode:'complete'})
  assert.equal(plan.storage.rows[1].bitOffset,16)
  assert.equal(plan.segments.find(s=>s.si===1).start,24)
  assert.deepEqual(bytes(plan),[2,0,null,0x10,0,2,0])
  assert.ok(plan.pending.some(s=>s.includes('间隙')))
})
test('XML missing external type information, invalid sizes and duplicate SI are not replaced with guessed definitions',()=>{
  const c=xmlContext('io'),raw=esiExamples.find(e=>e.id==='io').xml.replace('<Type>UINT</Type>','<Type>ExternalMissingType</Type>')
  const missing=xmlContext('io',raw),object=esiAccessObject(missing,missing.scope.objects[1])
  assert.equal(object.code,'UNKNOWN');assert.equal(object.entries.length,0)
  assert.equal(deriveContextAccess(object,request).kind,'unresolved')
  const duplicate=esiAccessObject(c,c.scope.objects[0]);duplicate.entries.push({...duplicate.entries[0],id:'duplicate'})
  assert.equal(deriveContextAccess(duplicate,request).kind,'unresolved')
})
test('device revisions and modules keep independent source identities even when Index and type names coincide',()=>{
  const a=xmlContext('io',null,0),b=xmlContext('io',null,1)
  assert.notEqual(esiAccessObject(a,a.scope.objects[0]).id,esiAccessObject(b,b.scope.objects[0]).id)
  const c=xmlContext(),module=c.document.modules[0],scope=esiScope({...c.document,devices:[{...c.scope.device,id:module.id,node:module.node}]},module.id)
  const m={...c,ownerScope:{...scope,owner:module,kind:'module'}}
  assert.ok(esiAccessObject(m,scope.objects[0]).source.scope.includes('Module'))
})
test('type selection resolves only an unambiguous explicit instance reference; source selection can choose another object',()=>{
  const c=xmlContext();c.node=c.scope.types.find(t=>t.children.some(n=>n.name==='Name'&&n.value==='DTF000'))
  assert.equal(resolveSdoContext({surface:'ESI',context:c}).object.index,0xF000)
  const duplicated={...c.scope.objects[1],id:'second',node:{...c.scope.objects[1].node,id:'second'},index:0xF010}
  c.ownerScope.objects=[...c.scope.objects,duplicated]
  assert.equal(resolveSdoContext({surface:'ESI',context:c}).object.index,null)
  const chosen=resolveSdoContext({surface:'ESI',context:c},c.scope.objects[0].id).object
  assert.equal(chosen.index,0x1000);assert.equal(chosen.code,'VARIABLE')
})
test('SSC current configuration stays a rule context with unknown configured value and explicit effects',()=>{
  const model=sscAccessContext(entryMap.get('complete-access-supported'))
  assert.equal(model.kind,'rules');assert.equal(model.value,null);assert.equal(model.objects.length,0)
  assert.equal(model.name,'COMPLETE_ACCESS_SUPPORTED');assert.ok(model.effect.enabled.includes('0/1'))
})
test('type/value parsing covers signed/64-bit/float constants without evaluating expressions or inventing zeros',()=>{
  assert.equal(sourceDefault('-1',sourceType('INT16')).bitsValue,65535n)
  assert.equal(sourceDefault('0xFFFFFFFFFFFFFFFF',sourceType('UINT64')).bitsValue,(1n<<64n)-1n)
  assert.equal(sourceDefault('1.5',sourceType('REAL')).bitsValue,0x3FC00000n)
  assert.equal(sourceDefault('FUNC(1)',sourceType('UINT16')).known,false)
  assert.equal(sourceType('UINT16',32).bits,null)
  assert.equal(sourcePermission('ro, wr_preop','write','PREOP').allowed,true)
  assert.equal(sourcePermission('ro, wr_preop','write','OP').allowed,false)
})
test('all current application and ESI source objects adapt without mutating original rows or XML',()=>{
  const before=JSON.stringify(applicationWorkbooks)
  for(const book of applicationWorkbooks)for(const sheet of book.sheets)for(const row of sheet.rows.filter(r=>r.kind==='object')) {
    const c=applicationContext({workbook:book.id,sheet:sheet.id,row:String(row.number),field:'B'}),o=applicationAccessObject(c)
    assert.ok(o);for(const mode of ['single','complete'])assert.ok(deriveContextAccess(o,{...request,mode}).kind)
  }
  assert.equal(JSON.stringify(applicationWorkbooks),before)
  for(const example of esiExamples){const c=xmlContext(example.id);for(const o of c.scope.objects)assert.ok(esiAccessObject(c,o).source.path);assert.equal(c.document.source,example.xml)}
})

test('CA applies mixed permissions per segment and retains slots while single access aborts independently',()=>{
  const object=applicationAccessObject(app(27))
  object.entries[1].access='wo';object.entries[2].access='ro'
  const read=deriveContextAccess(object,{...request,mode:'complete'})
  assert.deepEqual(bytes(read),[2,0,0,0,20,0])
  assert.equal(read.segments.find(s=>s.si===1).disposition,'masked')
  const write=deriveContextAccess(object,{...request,mode:'complete',operation:'write'})
  assert.equal(write.segments.find(s=>s.si===0).disposition,'ignored')
  assert.equal(write.segments.find(s=>s.si===2).disposition,'ignored')
  assert.equal(write.byteLength,6)
  assert.equal(deriveContextAccess(object,{...request,start:'1'}).abortCode,'0x06010001')
})
test('XML packed bitfields assemble by original offsets and retain unknown bits within shared bytes',()=>{
  const c=xmlContext(),object=esiAccessObject(c,c.scope.objects[1])
  object.capability.device=true;object.totalBits=32
  object.entries[1]={...object.entries[1],logicalBits:3,declaredOffset:16,type:sourceType('BIT3'),value:sourceDefault('5',sourceType('BIT3'))}
  object.entries[2]={...object.entries[2],logicalBits:5,declaredOffset:19,type:sourceType('BIT5'),value:sourceDefault('3',sourceType('BIT5'))}
  const plan=deriveContextAccess(object,{...request,mode:'complete'})
  assert.deepEqual(bytes(plan),[2,0,29,null])
  object.entries[2].value=sourceDefault(null,sourceType('BIT5'))
  assert.deepEqual(bytes(deriveContextAccess(object,{...request,mode:'complete'})),[2,0,null,null])
})
test('missing permissions, unknown CA declaration and custom callbacks stay explicit pending conditions',()=>{
  const object=applicationAccessObject(app(27));object.entries[1].access=null;object.entries[2].callback={read:'ReadObject',write:null}
  const plan=deriveContextAccess(object,{...request,mode:'complete'})
  assert.equal(plan.kind,'preview');assert.deepEqual(bytes(plan),[2,0,null,null,20,0])
  assert.ok(plan.pending.some(s=>s.includes('实际实现')));assert.ok(plan.pending.some(s=>s.includes('回调')))
})
test('a declared long scalar retains every byte for windowed display and does not allocate an unbounded preview',()=>{
  const object=applicationAccessObject(app(23)),type=sourceType('OCTET_STRING(80)')
  object.entries=[{...object.entries[0],type,rawType:type.raw,logicalBits:type.bits,value:sourceDefault('AB'.repeat(80),type,{hexData:true})}]
  const plan=deriveContextAccess(object,request)
  assert.equal(plan.byteLength,80);assert.equal(plan.cells.length,80);assert.ok(plan.cells.every(c=>c.mask===255&&c.value===171))
  assert.equal(sourceType('pad_1000000000').bits,null)
})
test('bad or ambiguous source declarations cannot quietly produce a valid CA transfer',()=>{
  const c=xmlContext(),object=esiAccessObject(c,c.scope.objects[1]);object.capability.device=true
  object.entries[1].declaredOffset=16;object.entries[2].declaredOffset=24
  assert.equal(deriveContextAccess(object,{...request,mode:'complete'}).kind,'unresolved')
  assert.equal(deriveContextAccess(object,{...request,mode:'complete',start:'255'}).abortCode,'0x06010000')
  assert.equal(deriveContextAccess(object,{...request,start:'-1'}).kind,'input')
  assert.equal(deriveContextAccess(object,{...request,start:'3'}).abortCode,'0x06090011')
})
test('conflicting explicit default sources are not silently chosen or used to repair malformed member data',()=>{
  const c=xmlContext(),raw={...c.scope.objects[1],defaultData:'020011000200'},object=esiAccessObject(c,raw)
  assert.equal(object.entries[1].value.known,false);assert.ok(object.entries[1].value.reason.includes('冲突'))
  assert.deepEqual(bytes(deriveContextAccess(object,{...request,start:'1'})),[null,null])
})

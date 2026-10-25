import test from 'node:test'
import assert from 'node:assert/strict'
import { DOMParser } from '@xmldom/xmldom'
import { esiExamples } from '../src/data/esi-examples.js'
import { parseEsiXml, esiScope, esiNumber, child, attr, moduleInstance, locateEsiEntry, esiRelations, xmlSourceSpans, decodeDriveModes, esiSlotSelection } from '../src/lib/esi-model.js'
import { checkEsiField, esiFieldRule } from '../src/data/esi-field-rules.js'
import { esiContext, decodeEsiBytes } from '../src/lib/esi-context.js'
import { parseRoute, routeHash } from '../src/lib/library.js'
import { entries } from '../src/data/index.js'
const parse=xml=>parseEsiXml(xml,DOMParser)
test('teaching ESIs parse with unique XML paths and exact original source spans',()=>{
  for(const example of esiExamples){const doc=parse(example.xml);assert.ok(doc.devices.length);assert.ok(doc.sourceBound);assert.equal(new Set(doc.nodes.map(n=>n.id)).size,doc.nodes.length);for(const n of doc.nodes){assert.ok(n.span,n.id);assert.ok(example.xml.slice(n.span.start,n.span.end).startsWith('<'+n.qualifiedName));assert.ok(n.span.end>=n.span.openEnd);if(n.parentId)assert.ok(doc.byId.has(n.parentId))}}
})
test('Device revision scopes never merge dictionaries or PDO references',()=>{
  const doc=parse(esiExamples[0].xml),a=esiScope(doc,doc.devices[0].id),b=esiScope(doc,doc.devices[1].id)
  assert.deepEqual(a.objects.map(o=>o.index),[0x1000,0x7000,0x6000]);assert.deepEqual(b.objects.map(o=>o.index),[0x1000,0x7010]);assert.equal(a.pdos.length,2);assert.equal(b.pdos.length,1);assert.ok(a.pdos.every(p=>p.entries.every(e=>e.resolved)))
  const changed=parse(esiExamples[0].xml.replace('<Index >#x7010</Index>','<Index >#x7000</Index>')),scope=esiScope(changed,changed.devices[1].id)
  assert.equal(scope.pdos[0].entries[0].resolved,false)
})
test('unknown elements, entity lexemes, CDATA, and quoted greater-than retain their source',()=>{
  const xml=`<?xml version="1.0"?><EtherCATInfo Version='1.6'><!-- <fake/> --><Vendor><Id>#x0</Id></Vendor><Descriptions><Devices><Device><Type ProductCode='0'>X</Type><VendorExtension note='a > b &amp; c'><![CDATA[<kept>]]></VendorExtension></Device></Devices></Descriptions></EtherCATInfo>`
  const doc=parse(xml),n=doc.nodes.find(n=>n.name==='VendorExtension')
  assert.equal(n.value,'<kept>');assert.equal(n.attributes[0].value,'a > b & c');assert.equal(n.attributes[0].raw,'a > b &amp; c');assert.equal(esiFieldRule(n).covered,false);assert.equal(doc.nodes.filter(n=>n.name==='fake').length,0);assert.ok(doc.source.slice(n.span.start,n.span.end).includes('<![CDATA['));assert.equal(xmlSourceSpans('<a><b></a>').length,0)
})
test('explicit zero, missing attribute, boolean false and unparsed tokens stay distinct',()=>{
  const doc=parse(esiExamples[0].xml),type=child(doc.devices[0].node,'Type'),sm=esiScope(doc).sms[0],n={...sm,attributes:[...sm.attributes.filter(a=>a.name!=='Enable'),{name:'Enable',value:'0'}]}
  assert.equal(checkEsiField(type,'SerialNo').state,'missing');assert.equal(checkEsiField(n,'Enable').value,false);assert.equal(checkEsiField({...n,attributes:[{name:'Enable',value:'FALSE'}]},'Enable').state,'unparsed');assert.equal(esiNumber('0'),0);assert.equal(esiNumber(''),null);assert.equal(esiNumber('#x0010'),16);assert.equal(esiNumber('17garbage'),null)
})
test('module template, PDO index, and Entry index use separate increments on Index elements',()=>{
  const doc=parse(esiExamples[1].xml),scope=esiScope(doc),slot=scope.slots[1],m=moduleInstance(doc,slot,0x4712)
  assert.equal(m.valid,true);assert.equal(m.objects[0].base,0x7000);assert.equal(m.objects[0].resolved,0x7010);assert.equal(m.pdos[0].resolved,0x1601);assert.equal(m.pdos[0].entries[0].resolved,0x7010);assert.equal(attr(child(m.pdos[0].node,'Index'),'DependOnSlot'),'1');assert.equal(scope.objects.some(o=>o.index===0x7000),false)
  assert.equal(moduleInstance(doc,slot,0x9999).valid,false);assert.equal(moduleInstance(doc,{...slot,previewable:false},0x4712).valid,false)
})
test('missing steps and group-dependent or overflowing template addresses are unresolved',()=>{
  const doc=parse(esiExamples[1].xml),slot=esiScope(doc).slots[1]
  assert.equal(moduleInstance(doc,{...slot,indexIncrement:undefined},0x4712).objects[0].resolved,null)
  assert.equal(moduleInstance(doc,{...slot,indexIncrement:'#xFFFF'},0x4712).objects[0].resolved,null)
  const grouped=parse(esiExamples[1].xml.replaceAll('DependOnSlot="1"','DependOnSlotGroup="1"'))
  assert.equal(moduleInstance(grouped,esiScope(grouped).slots[1],0x4712).objects[0].resolved,null)
})
test('dictionary layout offsets remain independent from continuous PDO offsets and padding has no reference',()=>{
  const doc=parse(esiExamples[1].xml),module=doc.modules[0],fake={...doc,devices:[{id:module.id,node:module.node}]},scope=esiScope(fake,module.id)
  assert.equal(scope.objects[0].members[1].bitOffset,16);assert.equal(scope.pdos[0].entries[0].offset,0);assert.equal(scope.pdos[0].entries[0].resolved,true)
  const padded=parse(esiExamples[0].xml.replace('<Index >#x7000</Index>','<Index >#x0000</Index>')),entry=esiScope(padded).pdos[0].entries[0];assert.equal(entry.padding,true);assert.equal(entry.resolved,true)
})
test('ESI relation endpoints resolve locally and reference only current device definitions',()=>{
  const document=parse(esiExamples[0].xml),scope=esiScope(document),node=scope.pdos[0].entries[0].node,model=esiRelations({document,scope,ownerScope:scope,node})
  assert.ok(model.edges.some(e=>e.label.startsWith('引用')))
  for(const edge of model.edges){assert.ok(model.nodes.some(n=>n.id===edge.source));assert.ok(model.nodes.some(n=>n.id===edge.target))}
  assert.ok(model.nodes.every(n=>!n.id.startsWith(document.devices[1].id)))
})
test('all old ESI configuration links resolve to existing parents, preserving absent locations',()=>{
  const doc=parse(esiExamples[0].xml),scope=esiScope(doc)
  for(const entry of entries.filter(e=>e.collection==='ESI')){const location=locateEsiEntry(doc,scope,entry.id);assert.ok(doc.byId.has(location.node.id),entry.id)}
  assert.equal(locateEsiEntry(doc,scope,'esi-slots').missing,true)
})
test('ESI deep links round-trip and expired local files do not silently resume as a project',()=>{
  globalThis.DOMParser=DOMParser
  const route={view:'entry',id:'esi-overview',collection:'ESI',esi:'modules',device:'/EtherCATInfo[1]/Descriptions[1]/Devices[1]/Device[1]',esiNode:'/EtherCATInfo[1]/Vendor[1]/Id[1]',esiAttr:'Version',esiPane:'xml'},restored=parseRoute(routeHash(route))
  for(const key of ['esi','device','esiNode','esiAttr','esiPane'])assert.equal(restored[key],route[key])
  assert.equal(esiContext({...restored,esi:'local'}).expired,true)
  const context=esiContext({esi:'drive'},'esi-overview');assert.equal(context.scope.device.profileNo,402);assert.equal(context.scope.slots.length,0)
  const stale=esiContext({esi:'io',device:parse(esiExamples[0].xml).devices[0].id,esiNode:parse(esiExamples[0].xml).devices[1].node.children[0].id});assert.equal(stale.missingNode,true)
})
test('invalid roots, DTD and invalid encoding are rejected before semantic lookup',()=>{
  assert.throws(()=>parse('<html/>'),/EtherCATInfo/);assert.throws(()=>parse('<!DOCTYPE x><EtherCATInfo/>'),/DTD/);assert.throws(()=>parse(''),/文件为空/)
  const source=esiExamples[0].xml;assert.equal(decodeEsiBytes(new TextEncoder().encode(source)),source)
  assert.throws(()=>decodeEsiBytes(Uint8Array.from([255,255,255])),/解码/)
})
test('CiA402 default mode bits decode only with an explicit UDINT byte layout',()=>{
  assert.deepEqual(decodeDriveModes('80030000','UDINT').modes.map(m=>m.name),['CSP','CSV','CST'])
  assert.equal(decodeDriveModes('80030000','UINT'),null);assert.equal(decodeDriveModes('notbytes','UDINT'),null)
})
test('explicit empty preview of an optional slot does not fall back to its XML default',()=>{
  const slot=esiScope(parse(esiExamples[1].xml)).slots[1]
  assert.equal(esiSlotSelection(slot).ident,0x4712)
  assert.equal(esiSlotSelection(slot,{[slot.id]:null}).ident,null)
  assert.equal(esiSlotSelection({...slot,min:'1'},{[slot.id]:null}).requiredMissing,true)
  assert.equal(esiSlotSelection({...slot,allowed:slot.allowed.map(a=>({...a,isDefault:true}))}).source,'conflict')
})

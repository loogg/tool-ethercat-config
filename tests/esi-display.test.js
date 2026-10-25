import test from 'node:test'
import assert from 'node:assert/strict'
import { DOMParser } from '@xmldom/xmldom'
import { esiExamples } from '../src/data/esi-examples.js'
import { entryMap } from '../src/data/index.js'
import { parseEsiXml,esiScope,child } from '../src/lib/esi-model.js'
import { esiEntity,esiFieldRows,esiSelectedRow,esiItemAssociations,esiFieldAssociations,esiNavigationGroups,esiBreadcrumbs,esiSubIndexLabel,esiItemTitle,esiDisplayMatch,esiItemBrief,esiItemScopeLabel } from '../src/lib/esi-display-model.js'
import { buildEsiFieldGraph,layoutEsiFieldGraph } from '../src/lib/esi-field-graph.js'
import { esiContext } from '../src/lib/esi-context.js'

function context(example='io',device=0){const document=parseEsiXml(esiExamples.find(e=>e.id===example).xml,DOMParser),scope=esiScope(document,document.devices[device].id);return {document,scope,ownerScope:{...scope,owner:scope.device,kind:'device'},node:scope.device.node,attribute:null,filename:'teaching.xml'}}
test('leaf selection stays within its ESI item instead of opening another generic page',()=>{
  const c=context(),entry=c.scope.pdos[0].entries[0].node
  for(const name of ['Index','SubIndex','DataType','BitLen','Name']){const selected={...c,node:child(entry,name)};assert.equal(esiEntity(selected).id,entry.id);assert.equal(esiSelectedRow(selected,esiFieldRows(selected)).node.name,name)}
  const object=c.scope.objects[1].node,selected={...c,node:child(object,'Type')};assert.equal(esiEntity(selected).id,object.id)
})
test('legacy field links open the specific item and type definitions, with catalog URLs preserved',()=>{
  globalThis.DOMParser=DOMParser
  for(const id of ['esi-rxpdo','esi-txpdo','esi-entry','esi-pdo-flags','esi-datatypes'])assert.equal(esiContext({},id).mode,'structure')
  assert.equal(esiContext({esiPane:'pdo'},'esi-rxpdo').mode,'pdo')
  assert.equal(esiContext({},'esi-dictionary').mode,'dictionary')
})
test('BitLen has type and capacity associations, while PDO Index does not falsely identify an application object',()=>{
  const c=context(),entry=c.scope.pdos[0].entries[0].node,rows=esiFieldRows({...c,node:entry}),bits=rows.find(r=>r.label==='BitLen')
  assert.equal(bits.raw,'16');assert.equal(bits.unit,'bit');assert.deepEqual(bits.associations.map(t=>t.surface),['APP','SSC']);assert.equal(bits.associations.find(t=>t.surface==='SSC').entryId,'max-pd-output-size')
  const pdoIndex=child(c.scope.pdos[0].node,'Index');assert.equal(esiFieldAssociations(pdoIndex,null,c).length,0)
})
test('SM ControlByte displays bits and links to the SSC watchdog, without forcing an application target',()=>{
  const c=context(),node=c.scope.sms[2],selected={...c,node,attribute:'ControlByte'},r=esiSelectedRow(selected,esiFieldRows(selected))
  assert.equal(r.presenter,'bitfield');assert.equal(r.raw,'#x64');assert.equal(r.unit,'8 bit');assert.deepEqual(r.associations.map(t=>t.entryId),['esc-sm-wd-supported']);assert.ok(!r.associations.some(t=>t.surface==='APP'))
})
test('explicit zero, false, missing and unknown XML values remain distinct in field rows',()=>{
  const c=context(),n=c.scope.sms[0],node={...n,attributes:[...n.attributes.filter(a=>a.name!=='Enable'),{name:'Enable',value:'0',raw:'0'},{name:'FutureFlag',value:'false',raw:'false'}]},rows=esiFieldRows({...c,node})
  assert.equal(rows.find(r=>r.attribute==='Enable').state.value,false);assert.equal(rows.find(r=>r.attribute==='Enable').raw,'0');assert.equal(rows.find(r=>r.attribute==='FutureFlag').raw,'false');assert.equal(rows.find(r=>r.attribute==='FutureFlag').rule.covered,false)
  const missing=esiFieldRows({...c,node:child(c.scope.device.node,'Type'),attribute:'SerialNo'}).find(r=>r.attribute==='SerialNo');assert.equal(missing.state.state,'missing');assert.equal(missing.raw,undefined)
})
test('flattened Flags keep their original source node and do not inherit header permissions',()=>{
  const c=context(),object=c.scope.objects[1].node,rows=esiFieldRows({...c,node:object}),access=rows.find(r=>r.label==='Flags / Access')
  assert.equal(access.raw,'rw');assert.ok(access.key.includes('/Flags[1]/Access[1]'));assert.equal(access.associations[0].entryId,'xlsx-access')
})
test('child Index dependency attributes and ModuleIdent default flags remain directly inspectable',()=>{
  const c=context('modules'),module=c.document.modules[0],object=module.node.children.find(n=>n.name==='Profile').children.find(n=>n.name==='Dictionary').children.find(n=>n.name==='Objects').children[0],index=child(object,'Index'),selected={...c,node:index,attribute:'DependOnSlot'}
  const row=esiSelectedRow(selected,esiFieldRows(selected))
  assert.equal(row.label,'Index / @DependOnSlot');assert.equal(row.raw,'1')
  const ident=c.scope.slots[0].allowed[0].node,flag={...c,node:ident,attribute:'Default'}
  const defaultRow=esiSelectedRow(flag,esiFieldRows(flag));assert.equal(defaultRow.label,'ModuleIdent / @Default');assert.equal(defaultRow.associations[0].field,'G')
})
test('unknown structured children and array metadata open as their own field group',()=>{
  const xml=esiExamples[0].xml.replace('<Name>USINT</Name>','<Name>USINT</Name><ArrayInfo><LBound>1</LBound><Elements>4</Elements></ArrayInfo>'),document=parseEsiXml(xml,DOMParser),scope=esiScope(document),node=document.nodes.find(n=>n.name==='LBound'),c={document,scope,ownerScope:{...scope,owner:scope.device},node}
  assert.equal(esiEntity(c).name,'ArrayInfo');assert.equal(esiSelectedRow(c,esiFieldRows(c)).raw,'1')
})
test('semantic navigation targets existing nodes and respects device revisions',()=>{
  for(const index of [0,1]){const c=context('io',index),groups=esiNavigationGroups(c);for(const g of groups)for(const i of g.items)assert.ok(c.document.byId.has(i.id));const pdos=groups.find(g=>g.id==='pdo').items;assert.equal(pdos.length,index===0?2:1);assert.ok(pdos.every(i=>i.id.startsWith(c.scope.device.id)))}
})
test('document, device and module scope labels do not depend on the currently selected Device alone',()=>{
  const c=context('modules')
  assert.equal(esiItemScopeLabel(c,c.document.vendor),'DOCUMENT 文档')
  assert.equal(esiItemScopeLabel(c,c.scope.slotsNode),'DEVICE 本体')
  const module=c.document.modules[0],m={...c,ownerScope:{...c.ownerScope,kind:'module',owner:module}}
  assert.equal(esiItemScopeLabel(m,module.node),'MODULE 模板')
  assert.equal(esiItemScopeLabel(m,c.document.root),'DOCUMENT 文档')
})
test('module dictionary and PDO navigation use template scope instead of the device dictionary',()=>{
  const c=context('modules'),module=c.document.modules[0],owner=esiScope({...c.document,devices:[{...c.scope.device,id:module.id,node:module.node}]},module.id),selected={...c,node:module.node,ownerScope:{...owner,owner:module,kind:'module'}},groups=esiNavigationGroups(selected)
  assert.ok(groups.find(g=>g.id==='dictionary').items.every(i=>i.id.startsWith(module.id)))
  assert.ok(groups.find(g=>g.id==='pdo').items.every(i=>i.id.startsWith(module.id)))
})
test('object and PDO increments target their corresponding worksheet headers, with no guessed group rule',()=>{
  const c=context('modules'),slots=c.scope.slotsNode
  assert.equal(esiFieldAssociations(slots,'SlotIndexIncrement',c)[0].field,'header:IndexIncrement')
  assert.equal(esiFieldAssociations(slots,'SlotPdoIncrement',c)[0].field,'header:PdoIndexIncrement')
  const index=child(c.document.modules[0].node.children.find(n=>n.name==='TxPdo'),'Index')
  assert.equal(esiFieldAssociations(index,'DependOnSlot',c)[0].field,'header:PdoIndexIncrement')
  assert.equal(esiFieldAssociations(index,'DependOnSlotGroup',c).length,0)
})
test('mailbox and Complete Access fields locate their own SSC settings instead of generic process-data values',()=>{
  const c=context()
  assert.equal(esiFieldAssociations(c.scope.sms[0],'StartAddress',c)[0].entryId,'def-mbx-write-address')
  assert.equal(esiFieldAssociations(c.scope.sms[1],'StartAddress',c)[0].entryId,'def-mbx-read-address')
  assert.equal(esiFieldAssociations(c.scope.sms[0],'DefaultSize',c)[0].entryId,'def-mbx-size')
  assert.equal(esiFieldAssociations(child(c.scope.mailbox,'CoE'),'CompleteAccess',c)[0].entryId,'complete-access-supported')
})
test('slot allowed-module description and default flag have different application-column destinations',()=>{
  const c=context('modules'),ident=c.scope.slots[0].allowed[0].node
  assert.equal(esiFieldAssociations(ident,null,c)[0].field,'P')
  const defaultRule=esiFieldAssociations(ident,'Default',c)[0]
  assert.equal(defaultRule.field,'G');assert.equal(defaultRule.relationKind,'derive');assert.match(defaultRule.condition,/不是把默认标志1/)
})
test('padding does not manufacture an object address association',()=>{
  const c=context(),n=child(c.scope.pdos[0].entries[0].node,'Index'),padding={...n,value:'#x0000'}
  assert.equal(esiFieldAssociations(padding,null,c).length,0)
})
test('missing SubIndex stays unknown in titles and links instead of being displayed as explicit SI0',()=>{
  const c=context(),original=c.scope.pdos[0].entries[0].node,missing={...original,children:original.children.filter(n=>n.name!=='SubIndex')}
  assert.equal(esiSubIndexLabel(0),'00');assert.equal(esiSubIndexLabel(null),'??');assert.match(esiItemTitle(missing,c),/:\?\?/);assert.match(esiItemTitle(original,c),/:00/)
})
test('ESI lookup accepts 0x and #x spellings without rewriting the displayed source',()=>{
  assert.equal(esiDisplayMatch('#x7000 Digital outputs','0x7000'),true)
  assert.equal(esiDisplayMatch('0x1A00 Inputs','#x1a00'),true)
  assert.equal(esiDisplayMatch('UINT',' uint '),true)
  assert.equal(esiDisplayMatch('#x7000','0x7010'),false)
})
test('CiA402 descriptions and state diagrams use confirmed profile and axis scope',()=>{
  const c=context('drive'),base=c.scope.objects.find(o=>o.index===0x6040),axis2=c.scope.objects.find(o=>o.index===0x6840),known={...c,example:esiExamples.find(e=>e.id==='drive')}
  assert.equal(esiItemBrief(known,base.node).lesson,'drive');assert.equal(esiItemBrief(known,axis2.node).lesson,'drive')
  assert.equal(esiItemBrief({...known,local:true},axis2.node).lesson,undefined)
  assert.equal(esiItemBrief({...known,scope:{...c.scope,device:{...c.scope.device,profileNo:5001}}},base.node).lesson,undefined)
})
test('all presented associations have real rule destinations and source context',()=>{
  for(const example of esiExamples){const document=parseEsiXml(example.xml,DOMParser),scope=esiScope(document),c={document,scope,ownerScope:{...scope,owner:scope.device},node:scope.device.node};for(const node of document.nodes)for(const a of [null,...node.attributes.map(a=>a.name)])for(const t of esiFieldAssociations(node,a,c)){assert.ok(entryMap.has(t.entryId),t.entryId);assert.ok(t.path);assert.ok(t.condition);assert.ok(t.references.length)}}
})
test('local capacity graph has a separate active-bit conversion and no invented SSC value',()=>{
  const c=context(),entry=c.scope.pdos[0].entries[0].node,rows=esiFieldRows({...c,node:entry}),row=rows.find(r=>r.label==='BitLen'),g=buildEsiFieldGraph(row,c)
  assert.equal(g.nodes.find(n=>n.focal).value,'16');assert.ok(g.nodes.some(n=>n.title==='活动 PDO → Byte'));assert.ok(g.edges.some(e=>e.label==='L ≤ 容量'));assert.ok(g.edges.some(e=>e.condition.includes('候选')));assert.ok(g.nodes.filter(n=>n.role==='字段规则').every(n=>n.value===undefined))
  const arranged=layoutEsiFieldGraph(g);assert.ok(Math.max(...arranged.nodes.map(n=>n.position.x))<600);for(const e of arranged.edges){assert.ok(e.sourceHandle);assert.ok(e.targetHandle)}
  for(let i=0;i<arranged.nodes.length;i++)for(let j=i+1;j<arranged.nodes.length;j++){const a=arranged.nodes[i].position,b=arranged.nodes[j].position;assert.ok(a.x+236<=b.x||b.x+236<=a.x||a.y+132<=b.y||b.y+132<=a.y)}
})
test('module step graphs keep object and PDO formulas separate and breadcrumbs preserve context',()=>{
  const c=context('modules'),selected={...c,node:c.scope.slotsNode}
  for(const [attribute,pattern] of [['SlotIndexIncrement',/^I =/],['SlotPdoIncrement',/^P =/]]){const row=esiFieldRows({...selected,attribute}).find(r=>r.attribute===attribute),g=buildEsiFieldGraph(row,c);assert.match(g.nodes.find(n=>n.id==='instance').value,pattern);assert.match(g.edges.find(e=>e.id==='edge-instance').condition,/DependOnSlot/)}
  const simple=context(),entry=simple.scope.pdos[0].entries[0].node,breadcrumbs=esiBreadcrumbs({...simple,node:child(entry,'BitLen')});assert.equal(breadcrumbs.at(-1).id,entry.id);assert.ok(breadcrumbs.some(b=>b.id===simple.scope.pdos[0].id));assert.ok(esiItemAssociations({...simple,node:entry}).some(t=>t.surface==='SSC'))
})

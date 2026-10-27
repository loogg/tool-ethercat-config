import test from 'node:test'
import assert from 'node:assert/strict'
import { entries,entryMap } from '../src/data/index.js'
import { createSearchIndex,searchEntries,isListedConfiguration,parseRoute,resolveRoute } from '../src/lib/library.js'
import { buildConfigGraph } from '../src/lib/config-graph.js'

const names=['VENDOR_ID','VENDOR_NAME','VENDOR_IMAGE','GROUP_NAME','GROUP_IMAGE','DEVICE_IMAGE','PRODUCT_CODE','REVISION_NUMBER','SERIAL_NUMBER','DEVICE_PROFILE_TYPE','DEVICE_NAME','DEVICE_HW_VERSION','DEVICE_SW_VERSION']
const listed=entries.filter(e=>e.collection==='SSC'&&e.group==='SlaveInformation'&&isListedConfiguration(e))
test('SlaveInformation lists the thirteen real settings in the reviewed tool order without an invented Identity parameter',()=>{
  assert.deepEqual(listed.map(e=>e.name),names)
  assert.equal(entryMap.get('coe-identity').navigationHidden,true)
  assert.ok(entryMap.get('coe-identity').summary.includes('不是SSC Tool'))
  const index=createSearchIndex(entries)
  for(const entry of listed)assert.equal(searchEntries(index,{query:entry.name})[0].id,entry.id)
  for(const id of ['coe-device-name','coe-hardware-version','coe-software-version','coe-identity'])assert.equal(resolveRoute(parseRoute(`#/entry/${id}`),entryMap).id,id)
})
test('identity numbers resolve to their exact CoE SI; metadata and images do not acquire protocol object addresses',()=>{
  for(const [id,si] of [['vendor-id',1],['product-code',2],['revision-number',3],['serial-number',4]]){
    const graph=buildConfigGraph(entryMap.get(id),entries)
    const items=graph.nodes.filter(n=>n.kind==='subentry')
    assert.deepEqual(items.map(n=>n.addressParts),[{index:0x1018,subIndex:si}])
  }
  for(const id of ['vendor-name','group-name','vendor-image','group-image','device-image']){
    const entry=entryMap.get(id),graph=buildConfigGraph(entry,entries)
    assert.equal(entry.sources.some(s=>s.kind==='CoE'),false)
    assert.equal(graph.nodes.some(n=>n.addressParts||n.kind==='subentry'),false)
  }
})
test('three images keep distinct ESI parents and expose the exact companion tool as an action, not normative evidence',()=>{
  const cases=[['vendor-image','EtherCATInfo/Vendor'],['group-image','Descriptions/Groups/Group'],['device-image','Descriptions/Devices/Device']]
  for(const [id,parent] of cases){
    const entry=entryMap.get(id),graph=buildConfigGraph(entry,entries)
    assert.equal(entry.externalTools[0].url,'https://loogg.github.io/tool-ethercat-image/')
    assert.equal(entry.imagePlacement.parent,parent)
    assert.equal(graph.nodes.find(n=>n.id==='image-target').position.parent,parent)
    assert.equal(graph.profile.kind,'image-data')
    assert.ok(!entry.references.some(r=>r.url===entry.externalTools[0].url))
  }
})
test('Device Type preserves its 32bit/profile distinction and version strings keep legacy aliases and length scope',()=>{
  const entry=entryMap.get('device-profile-type'),graph=buildConfigGraph(entry,entries)
  assert.equal(graph.profile.kind,'device-type')
  assert.equal(entry.deviceType.bits,32);assert.equal(entry.deviceType.profileBits,16)
  for(const example of entry.deviceType.examples)assert.equal(Number(example.hex),example.profile)
  assert.equal(entry.deviceType.examples[0].profile,5001);assert.equal(entry.deviceType.examples[1].profile,402)
  assert.ok(entry.rules.some(r=>r.includes('高16bit')))
  const index=createSearchIndex(entries)
  for(const [id,name] of [['coe-device-name','DEVICE_NAME'],['coe-hardware-version','DEVICE_HW_VERSION'],['coe-software-version','DEVICE_SW_VERSION']]){
    assert.equal(searchEntries(index,{query:`${name}_LEN`})[0].id,id)
    assert.ok(entryMap.get(id).facts.some(f=>f.label==='版本相关'))
  }
})

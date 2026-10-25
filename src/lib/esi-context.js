import { esiExamples } from '../data/esi-examples.js'
import { child, esiScope, locateEsiEntry, parseEsiXml } from './esi-model.js'
const sampleCache=new Map()
export function esiContext(route,entryId='esi-overview',localDocument=null){
  const requested=route.esi||'io',expired=requested==='local'&&!localDocument
  const example=esiExamples.find(e=>e.id===requested)||esiExamples[0]
  if(!sampleCache.has(example.id))sampleCache.set(example.id,parseEsiXml(example.xml))
  const document=requested==='local'&&localDocument?localDocument.document:sampleCache.get(example.id)
  const scope=esiScope(document,route.device)
  const located=locateEsiEntry(document,scope,entryId)
  let node=route.esiNode?document.byId.get(route.esiNode):located.node
  const outsideDevice=node&&document.devices.some(d=>d.id!==scope?.device.id&&(node.id===d.id||node.id.startsWith(d.id+'/')))
  const missingNode=!!route.esiNode&&(!node||outsideDevice)
  if(!node||outsideDevice)node=scope?.device.node||document.root
  const module=document.modules.find(m=>node.id===m.id||node.id.startsWith(m.id+'/'))
  const ownerScope=module?{...esiScope({...document,devices:[{...scope?.device,id:module.id,node:module.node,profileNode:child(module.node,'Profile')}]},module.id),owner:module,kind:'module'}:scope?{...scope,owner:scope.device,kind:'device'}:null
  const defaultPane=['esi-dictionary','esi-objects'].includes(entryId)?'dictionary':['esi-slots','esi-modules','esi-slot-increments'].includes(entryId)?'profile':'structure'
  const panes=['structure','dictionary','pdo','profile','relations','cross','xml']
  return{document,example,scope,ownerScope,node,selection:!!route.esiNode||!!route.esiAttr,attribute:route.esiAttr||(!route.esiNode?located.attribute:null),mode:panes.includes(route.esiPane)?route.esiPane:defaultPane,expired,missingNode,missingDevice:!!route.device&&!document.devices.some(d=>d.id===route.device),missingLocator:!route.esiNode&&located.missing,expected:located.expected,documentId:requested==='local'&&localDocument?'local':example.id,filename:requested==='local'&&localDocument?localDocument.filename:example.filename,local:requested==='local'&&!!localDocument}
}
export function decodeEsiBytes(buffer){
  const bytes=new Uint8Array(buffer)
  let encoding=bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8'
  const head=new TextDecoder(encoding).decode(bytes.slice(0,300))
  const declared=head.match(/<\?xml[^?]*encoding\s*=\s*["']([^"']+)/i)?.[1]
  if(declared)encoding=declared
  try{return new TextDecoder(encoding,{fatal:true}).decode(buffer)}catch{throw new Error(`无法按 ${encoding} 解码，请确认文件编码。`)}
}

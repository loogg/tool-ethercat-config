import { numeric, sourceType, sourceDefault } from './sdo-source-types.js'
import { children, child, text, attr, esiBool } from './esi-model.js'
import { si0Protocol } from '../data/sdo-access.js'

const documentKeys=new WeakMap()
const fingerprint = document => { if(documentKeys.has(document))return documentKeys.get(document);const source=document.source;let n=2166136261;for(let i=0;i<source.length;i++)n=Math.imul(n^source.charCodeAt(i),16777619);const key=(n>>>0).toString(16);documentKeys.set(document,key);return key }
const rangeMax = entries => entries.some(e=>e.si===null)?null:Math.max(0,...entries.map(e=>e.si))
const completeRange = entries => {const max=rangeMax(entries);return max!==null&&max<=255&&entries.length===max+1&&new Set(entries.map(e=>e.si)).size===max+1}
const previewEntry = (si,name,rawType,bits,rawValue,access,source,options={}) => {
  const type=sourceType(rawType,bits,options.typeMap)
  return {id:source.key,si,name:name||'未命名成员',rawType:rawType??'',type,logicalBits:type.bits,declaredBits:bits,declaredOffset:options.offset??null,access:access||null,source,role:options.role||'value',value:{...sourceDefault(rawValue,type,{hexData:options.hexData,basis:options.basis||'default'}),encoding:options.hexData?'DefaultData':'literal'},callback:options.callback||null}
}

export function applicationAccessObject(context) {
  const {workbook,sheet,row}=context,object=row?.object
  if(!object)return null
  const key=`APP:${workbook.id}:${sheet.id}:${object.row.number}`,source={surface:'APP',key,document:workbook.filename,path:`${sheet.name} › 对象行 ${object.row.number}`,scope:sheet.role==='module'?'模块模板（未作槽位展开）':'当前工作表定义',version:null,sourceType:workbook.sourceType||'reference'}
  const entrySource=(r,field='E')=>({...source,key:`${key}:row:${r.number}`,path:`${sheet.name} › ${field}${r.number}`,row:r.number,field,typePath:`${sheet.name} › E${r.number}`,defaultPath:`${sheet.name} › G${r.number}`,accessPath:`${sheet.name} › L${r.number}`})
  const entries=[]
  const code=['VARIABLE','ARRAY','RECORD'].includes(object.code)?object.code:'UNKNOWN'
  if(code==='VARIABLE')entries.push(previewEntry(0,object.name,object.row.values.E,null,object.row.values.G,object.row.values.L,entrySource(object.row),{callback:{read:object.row.values.N,write:object.row.values.O}}))
  else {
    if(['ARRAY','RECORD'].includes(code)) {
      const max=object.members.every(r=>numeric(r.values.D)!==null)?Math.max(0,...object.members.map(r=>numeric(r.values.D))):null
      const s={...source,key:`${key}:generated:0`,path:`${sheet.name} › ObjectCode行 ${object.row.number} › SI0生成规则`,generated:true}
      entries.push(previewEntry(0,object.index===0xF030?'配置列表长度（生成预览）':'最高子索引（生成预览）',si0Protocol.type,si0Protocol.logicalBits,max,object.row.values.L,s,{role:'header',basis:'generated'}))
    }
    for(const member of object.members)entries.push(previewEntry(numeric(member.values.D),member.values.F,member.values.E,null,member.values.G,member.values.L,entrySource(member),{callback:{read:member.values.N,write:member.values.O}}))
  }
  return {id:key,source,index:object.index,name:object.name||'未命名对象',code,codeBasis:'当前工作表ObjectCode',compound:['ARRAY','RECORD'].includes(code),entries,declaredMax:rangeMax(entries),complete:completeRange(entries),totalBits:null,layoutOrigin:'ssc-sequence',capability:{device:null,object:null,actual:null,source:'工作表没有声明CA实际支持'},initialSI:row.kind==='member'||row.kind==='generated'?numeric(row.values.D)??0:0,notes:workbook.sourceType==='teaching'?['当前工作表本身是教学定义；以下采用它实际列出的字段与默认值。']:[]}
}

function esiSource(context,node) {
  const owner=context.ownerScope?.owner||context.scope?.device
  return {surface:'ESI',key:`ESI:${context.documentId}:${fingerprint(context.document)}:${owner?.id}:${node.id}`,document:context.filename,path:node.id,scope:context.ownerScope?.kind==='module'?`Module ${owner?.name||''} › 当前模板`:`Device ${context.scope?.device.name||''} › Revision ${context.scope?.device.revision||'未声明'}`,version:context.document.version,sourceType:context.local?'local-file':'built-in-xml'}
}
function defaultInfo(objectNode,member) {
  const info=child(objectNode,'Info'),items=children(info,'SubItem')
  const exact=items.filter(n=>numeric(text(n,'SubIdx'))!==null&&numeric(text(n,'SubIdx'))===member.subIndex || member.name&&text(n,'Name')===member.name || text(n,'Name').match(/^SubIndex\s+(\d+)$/i)?.[1]!==undefined&&Number(text(n,'Name').match(/^SubIndex\s+(\d+)$/i)[1])===member.subIndex)
  if(exact.length!==1)return null
  const data=child(child(exact[0],'Info'),'DefaultData')
  return data?{raw:data.value,node:data}:null
}

export function esiAccessObject(context,object=null,datatype=null) {
  const scope=context.ownerScope||context.scope
  datatype=datatype||object?.datatype
  const root=object?.node||datatype
  if(!root)return null
  const source=esiSource(context,root),members=children(datatype,'SubItem'),entries=[]
  const deviceCoE=child(context.scope?.mailbox,'CoE'),deviceRaw=attr(deviceCoE,'CompleteAccess'),objectRaw=text(child(object?.node,'Flags'),'SdoAccess')
  let objectCA=null
  if(objectRaw==='CompleteAccess')objectCA=true
  else if(objectRaw==='SubIndexAccess')objectCA=false
  const capability={device:deviceRaw===undefined?null:esiBool(deviceRaw),object:objectCA,actual:null,source:deviceRaw===undefined?'CoE/@CompleteAccess未声明':`CoE/@CompleteAccess=${deviceRaw}`,raw:deviceRaw,objectRaw:objectRaw||null}
  const typeMap=scope?.typeMap
  if(members.length) {
    for(const node of members) {
      const si=numeric(text(node,'SubIdx')),name=text(node,'Name'),bits=numeric(text(node,'BitSize')),offset=numeric(text(node,'BitOffs'))
      const member={subIndex:si,name},def=object?defaultInfo(object.node,member):null
      const entry=previewEntry(si,name,text(node,'Type'),bits,def?.raw??null,text(child(node,'Flags'),'Access'),{...esiSource(context,node),typePath:child(node,'Type')?.id,bitSizePath:child(node,'BitSize')?.id,offsetPath:child(node,'BitOffs')?.id,accessPath:child(child(node,'Flags'),'Access')?.id,defaultPath:def?.node.id||null},{typeMap,offset,hexData:!!def,role:si===0?'header':'value'})
      entries.push(entry)
    }
  } else if(object) {
    const rawType=object.type,type=sourceType(rawType,object.bits,typeMap)
    if(type.bits!==null&&type.kind!=='structured'&&type.kind!=='unknown')entries.push(previewEntry(0,object.name,rawType,object.bits,object.defaultData||null,object.access,{...source,key:source.key+':0',defaultPath:child(child(object.node,'Info'),'DefaultData')?.id||null},{typeMap,hexData:!!object.defaultData}))
  }
  // A whole-object DefaultData is only usable when its complete declared buffer is present.
  const totalBits=object?.bits??numeric(text(datatype,'BitSize')),whole=object?.defaultData
  if(whole&&totalBits!==null&&/^(?:[\da-f]{2})+$/i.test(whole)&&whole.length/2===Math.ceil(totalBits/8)) {
    const all=whole.match(/../g).reduce((n,b,i)=>n+(BigInt(parseInt(b,16))<<BigInt(i*8)),0n)
    for(const entry of entries)if(entry.logicalBits!==null&&entry.declaredOffset!==null&&entry.declaredOffset+entry.logicalBits<=totalBits){
      const bitsValue=(all>>BigInt(entry.declaredOffset))&((1n<<BigInt(entry.logicalBits))-1n)
      if(entry.value.known&&entry.value.bitsValue!==bitsValue)entry.value={...entry.value,known:false,state:'unparsed',bitsValue:null,reason:'成员DefaultData与对象DefaultData的对应位段冲突，未任选一个。'}
      else if(entry.value.state==='unknown')entry.value={known:true,raw:whole,state:'default',encoding:'DefaultData',bitsValue,reason:'来自对象DefaultData的明确位段',sourcePath:child(child(object.node,'Info'),'DefaultData')?.id}
    }
  }
  const current=entries.find(e=>context.node.id===e.source.path||context.node.id.startsWith(e.source.path+'/')||e.source.defaultPath&&(context.node.id===e.source.defaultPath||e.source.defaultPath.startsWith(context.node.id+'/')))
  return {id:source.key,source,index:object?.index??null,name:object?.name||text(datatype,'Name')||'未命名类型',code:members.length?'COMPOSITE':entries.length?'VARIABLE':'UNKNOWN',codeBasis:members.length?'XML SubItem复合结构；具体ObjectCode待固件核对':entries.length?'标准标量类型':'类型结构未展开',compound:members.length>0,entries,declaredMax:rangeMax(entries),complete:completeRange(entries),totalBits,layoutOrigin:'xml-offsets',capability,initialSI:current?.si??0,notes:[!object?'当前为类型定义，未绑定具体Object实例；不读取其他实例的默认值。':null,scope?.externalDictionary?'文档引用外部DictionaryFile，当前字典可能不完整。':null].filter(Boolean)}
}

export function sscAccessContext(entry) {
  const effects={
    'complete-access-supported':{title:'完整访问能力',enabled:'为复合对象提供CA访问路径；起点0/1、对象实现及权限仍须分别满足。',disabled:'不提供此CA能力；单项SDO路径还由CoE及对象权限决定。'},
    'coe-supported':{title:'CoE协议能力',enabled:'为SDO、SDO Info和PDO相关CoE服务提供协议前提，各子能力仍分别配置。',disabled:'不提供CoE服务；ESI声明与固件协议实现须一致。'},
    'sdo-res-interface':{title:'SDO响应接口',enabled:'为应用接入相应SDO响应处理机制，具体接口和Pending路径按SSC版本实现。',disabled:'按所用SSC的常规处理路径接入；不会改变条目类型、CA起点或SI0位长。'},
  }
  return {kind:'rules',surface:'SSC',source:{surface:'SSC',key:`SSC:${entry.id}`,document:'配置查阅知识库',path:entry.sources.find(s=>s.kind==='SSC')?.path||entry.name,scope:'配置规则；未载入工程Config.xml'},entryId:entry.id,name:entry.name,value:null,valueLabel:entry.facts.find(f=>f.label==='默认值')?.value||'工程配置值未知',effect:effects[entry.id]||effects['complete-access-supported'],objects:[]}
}

export function resolveSdoContext(binding, selectedObjectId='') {
  if(binding.surface==='APP')return {kind:'object',object:applicationAccessObject(binding.context),objects:[],source:null}
  if(binding.surface==='SSC')return sscAccessContext(binding.entry)
  const context=binding.context,scope=context.ownerScope||context.scope
  const objects=(scope?.objects||[]).map(o=>({id:o.id,index:o.index,name:o.name}))
  let object=scope?.objects.find(o=>o.id===selectedObjectId)
  if(!object)object=scope?.objects.find(o=>context.node.id===o.id||context.node.id.startsWith(o.id+'/'))
  const pdoEntry=!object&&!selectedObjectId?scope?.pdos.flatMap(p=>p.entries).find(e=>context.node.id===e.id||context.node.id.startsWith(e.id+'/')):null
  if(pdoEntry?.object)object=pdoEntry.object
  let datatype=scope?.types.find(t=>context.node.id===t.id||context.node.id.startsWith(t.id+'/'))
  if(!object&&datatype) {const owners=scope.objects.filter(o=>o.datatype?.id===datatype.id);if(owners.length===1)object=owners[0]}
  if(object)datatype=object.datatype
  if(object||datatype){const resolved=esiAccessObject(context,object,datatype);if(pdoEntry?.object&&pdoEntry.subIndex!==null)resolved.initialSI=pdoEntry.subIndex;return {kind:'object',object:resolved,objects,source:esiSource(context,context.node)}}
  const raw=attr(child(context.scope?.mailbox,'CoE'),'CompleteAccess')
  return {kind:'rules',surface:'ESI',source:esiSource(context,context.node),name:'CompleteAccess声明与对象访问',value:raw===undefined?null:esiBool(raw),valueLabel:raw===undefined?'未声明':raw,objects,effect:{title:'当前XML能力声明',enabled:'XML声明支持CA；各对象实现、访问方式、权限和布局仍需核对。',disabled:'XML声明不支持CA；对象单项访问与其权限另行判断。'}}
}

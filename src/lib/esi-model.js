export const children=(node,name)=>(node?.children||[]).filter(child=>!name||child.name===name)
export const child=(node,name)=>children(node,name)[0]
export const text=(node,name)=>name?child(node,name)?.value??'':node?.value??''
export const attr=(node,name)=>node?.attributes.find(item=>item.name===name)?.value
export function esiNumber(raw){if(raw===undefined||raw===null||String(raw).trim()==='')return null;const value=String(raw).trim();if(!/^(?:#x[\da-f]+|0x[\da-f]+|\d+)$/i.test(value))return null;const number=Number(value.replace(/^#x/i,'0x'));return Number.isSafeInteger(number)?number:null}
export const esiHex=(n,width=4)=>n===null||n===undefined?'未解析':`0x${n.toString(16).toUpperCase().padStart(width,'0')}`
export const esiBool=raw=>['1','true'].includes(String(raw).trim())?true:['0','false'].includes(String(raw).trim())?false:null
const descendants=(node,name)=>children(node).flatMap(item=>[...(item.name===name?[item]:[]),...descendants(item,name)])

/** Quote-aware source binding; discard all spans if DOM and source disagree. */
export function xmlSourceSpans(source){
  const all=[],stack=[];let pos=0
  while(pos<source.length){
    const start=source.indexOf('<',pos);if(start<0)break
    if(source.startsWith('<!--',start)){const end=source.indexOf('-->',start+4);if(end<0)return [];pos=end+3;continue}
    if(source.startsWith('<![CDATA[',start)){const end=source.indexOf(']]>',start+9);if(end<0)return [];pos=end+3;continue}
    if(source.startsWith('<?',start)){const end=source.indexOf('?>',start+2);if(end<0)return [];pos=end+2;continue}
    let end=start+1,quote=null
    for(;end<source.length;end++){const c=source[end];if(quote){if(c===quote)quote=null}else if(c==='"'||c==="'")quote=c;else if(c==='>')break}
    if(end===source.length)return []
    const token=source.slice(start,end+1),closing=/^<\//.test(token),name=token.match(/^<\/?([^\s/>]+)/)?.[1]
    if(!name||name.startsWith('!'))return []
    if(closing){const open=stack.pop();if(!open||open.qualifiedName!==name)return [];open.end=end+1;open.closeStart=start}
    else{const item={qualifiedName:name,name:name.split(':').at(-1),start,openEnd:end+1,end:/\/\s*>$/.test(token)?end+1:null,closeStart:/\/\s*>$/.test(token)?end+1:null,lexicalAttributes:[]};const re=/([^\s=/>]+)\s*=\s*(["'])([\s\S]*?)\2/g;let m;while((m=re.exec(token)))item.lexicalAttributes.push({name:m[1],raw:m[3],start:start+m.index});all.push(item);if(item.end===null)stack.push(item)}
    pos=end+1
  }
  return stack.length?[]:all
}

/** DOM is injected for tests; application uses the browser's native XML parser. */
export function parseEsiXml(source,Parser=globalThis.DOMParser){
  if(typeof source!=='string'||!source.trim())throw new Error('文件为空，请选择 ESI XML。')
  if(source.length>10*1024*1024)throw new Error('当前工具支持最多 10 MiB 的 ESI。')
  if(/<!DOCTYPE/i.test(source))throw new Error('当前只读解析不接受 DTD / 实体声明。请使用不含 DOCTYPE 的 ESI。')
  if(!Parser)throw new Error('当前运行环境不支持浏览器 XML 解析。')
  const doc=new Parser().parseFromString(source,'application/xml')
  if(doc.getElementsByTagName('parsererror').length||doc.documentElement?.localName==='parsererror')throw new Error('XML 语法不完整或格式有误；未替换当前文档。')
  if(doc.documentElement?.localName!=='EtherCATInfo')throw new Error('根元素应为 EtherCATInfo。')
  const nodes=[],byId=new Map(),lineStarts=[0]
  for(let i=0;i<source.length;i++)if(source[i]==='\n')lineStarts.push(i+1)
  function lineAt(pos){let a=0,b=lineStarts.length;while(a<b){const mid=(a+b)>>1;if(lineStarts[mid]<=pos)a=mid+1;else b=mid}return a}
  function walk(el,path){
    if(nodes.length>=25000)throw new Error('元素超过 25000 个；请缩小文档后再读取。')
    const node={id:path,name:el.localName,qualifiedName:el.nodeName,attributes:Array.from(el.attributes).map(a=>({name:a.name,value:a.value,raw:a.value})),value:Array.from(el.childNodes).filter(n=>n.nodeType===3||n.nodeType===4).map(n=>n.nodeValue).join('').trim(),children:[],parentId:path.slice(0,path.lastIndexOf('/'))||null}
    nodes.push(node);byId.set(path,node)
    const counts={}
    for(const c of Array.from(el.childNodes).filter(n=>n.nodeType===1)){const n=c.localName;counts[n]=(counts[n]||0)+1;node.children.push(walk(c,`${path}/${n}[${counts[n]}]`))}
    return node
  }
  const root=walk(doc.documentElement,'/EtherCATInfo[1]'),spans=xmlSourceSpans(source)
  if(spans.length===nodes.length&&spans.every((s,i)=>s.qualifiedName===nodes[i].qualifiedName))spans.forEach((s,i)=>{nodes[i].span={start:s.start,end:s.end,openEnd:s.openEnd,closeStart:s.closeStart,line:lineAt(s.start),endLine:lineAt(s.end-1)};nodes[i].attributes.forEach(a=>{const lex=s.lexicalAttributes.find(v=>v.name===a.name);if(lex){a.raw=lex.raw;a.line=lineAt(lex.start)}})})
  return buildEsiDocument(root,{source,nodes,byId,sourceBound:!!root.span})
}

export function buildEsiDocument(root,{source='',nodes,byId,sourceBound=false}={}){
  nodes=nodes||[root,...(function flatten(n){return children(n).flatMap(c=>[c,...flatten(c)])})(root)]
  byId=byId||new Map(nodes.map(n=>[n.id,n]))
  const descriptions=child(root,'Descriptions'),devices=children(child(descriptions,'Devices'),'Device').map((n,i)=>{
    const type=child(n,'Type'),profile=child(n,'Profile')
    return {id:n.id,ordinal:i+1,node:n,name:text(n,'Name')||text(type)||`Device ${i+1}`,product:attr(type,'ProductCode'),revision:attr(type,'RevisionNo'),profileNo:esiNumber(text(profile,'ProfileNo')),profileNode:profile}
  })
  const modules=children(child(descriptions,'Modules'),'Module').map(n=>({id:n.id,node:n,name:text(n,'Name')||text(n,'Type'),ident:esiNumber(attr(child(n,'Type'),'ModuleIdent')??attr(n,'ModuleIdent')),rawIdent:attr(child(n,'Type'),'ModuleIdent')??attr(n,'ModuleIdent')}))
  return {root,source,nodes,byId,devices,modules,version:attr(root,'Version'),vendor:child(root,'Vendor'),sourceBound}
}
export function esiScope(document,deviceId){
  const device=document.devices.find(d=>d.id===deviceId)||document.devices[0]
  if(!device)return null
  const node=device.node,dict=child(child(node,'Profile'),'Dictionary'),types=children(child(dict,'DataTypes'),'DataType')
  const typeMap=new Map(types.map(t=>[text(t,'Name'),t]))
  const objects=children(child(dict,'Objects'),'Object').map(n=>objectModel(n,typeMap))
  const pdos=['Rx','Tx'].flatMap(direction=>children(node,`${direction}Pdo`).map(n=>pdoModel(n,direction,objects)))
  const slotsNode=child(node,'Slots')
  const slots=children(slotsNode,'Slot').map((n,i)=>({id:n.id,node:n,ordinal:i+1,name:text(n,'Name')||`Slot ${i+1}`,min:attr(n,'MinInstances'),max:attr(n,'MaxInstances'),allowed:children(n,'ModuleIdent').map(m=>({node:m,value:esiNumber(text(m)),raw:text(m),isDefault:esiBool(attr(m,'Default'))===true})),indexIncrement:attr(n,'SlotIndexIncrement')??attr(slotsNode,'SlotIndexIncrement'),pdoIncrement:attr(n,'SlotPdoIncrement')??attr(slotsNode,'SlotPdoIncrement')}))
  const previewable=slots.every(s=>esiNumber(s.max)===1&&esiNumber(s.min)!==null&&esiNumber(s.min)<=1&&attr(s.node,'SlotGroup')===undefined)&&!children(slotsNode).some(n=>!['Slot'].includes(n.name))
  slots.forEach(s=>{s.previewable=previewable})
  slots.forEach(s=>{s.indexSourceNode=attr(s.node,'SlotIndexIncrement')!==undefined?s.node:slotsNode;s.pdoSourceNode=attr(s.node,'SlotPdoIncrement')!==undefined?s.node:slotsNode})
  return {device,objects,types,typeMap,pdos,slots,slotsNode,sms:children(node,'Sm'),dc:child(node,'Dc'),mailbox:child(node,'Mailbox'),externalDictionary:child(child(node,'Profile'),'DictionaryFile'),dictionary:dict}
}
function objectModel(n,typeMap){
  const type=text(n,'Type'),datatype=typeMap.get(type),members=children(datatype,'SubItem').map(s=>({node:s,subIndex:esiNumber(text(s,'SubIdx')),name:text(s,'Name'),type:text(s,'Type'),bits:esiNumber(text(s,'BitSize')),bitOffset:esiNumber(text(s,'BitOffs')),access:text(child(s,'Flags'),'Access'),pdo:text(child(s,'Flags'),'PdoMapping')}))
  return {id:n.id,node:n,index:esiNumber(text(n,'Index')),rawIndex:text(n,'Index'),name:text(n,'Name'),type,bits:esiNumber(text(n,'BitSize')),datatype,members,access:text(child(n,'Flags'),'Access'),pdo:text(child(n,'Flags'),'PdoMapping'),defaultData:text(child(n,'Info'),'DefaultData')}
}
function pdoModel(n,direction,objects){
  let offset=0
  const entries=children(n,'Entry').map(e=>{
    const index=esiNumber(text(e,'Index')),subIndex=esiNumber(text(e,'SubIndex')),bits=esiNumber(text(e,'BitLen')),object=objects.find(o=>o.index===index),member=object?.members.find(m=>m.subIndex===subIndex),padding=index===0
    const value={id:e.id,node:e,index,subIndex,bits,offset,name:text(e,'Name'),type:text(e,'DataType'),object,member,padding,resolved:padding||!!object&&(subIndex===0&&!object.members.length||!!member)}
    offset=offset!==null&&bits!==null?offset+bits:null
    return value
  })
  return {id:n.id,node:n,direction,index:esiNumber(text(n,'Index')),name:text(n,'Name'),sm:attr(n,'Sm'),fixed:attr(n,'Fixed'),mandatory:attr(n,'Mandatory'),exclude:attr(n,'Exclude'),entries,bits:offset}
}
export function moduleInstance(document,slot,ident){
  if(!slot.previewable)return {valid:false,error:'此槽位包含重复实例、SlotGroup 或尚未覆盖的结构；保留原文，暂不计算实例索引。'}
  const allowed=slot.allowed.find(a=>a.value===ident),module=document.modules.find(m=>m.ident===ident)
  if(!allowed)return {valid:false,error:'该 ModuleIdent 不在此 Slot 的允许列表中。'}
  if(!module)return {valid:false,error:ident===0?'空槽标识，无模块模板。':'当前文档未提供对应 Module 模板。'}
  const indexStep=esiNumber(slot.indexIncrement),pdoStep=esiNumber(slot.pdoIncrement),ordinal=slot.ordinal-1
  const resolve=(n,base,step,flag)=>{const group=esiBool(attr(n,'DependOnSlotGroup')),dependent=esiBool(attr(n,flag)),value=group===true?null:dependent===true?base!==null&&step!==null?base+step*ordinal:null:base;return{base,step,ordinal,dependent,resolved:value!==null&&value<=65535?value:null,unresolvedGroup:group===true}}
  const objects=descendants(module.node,'Object').map(n=>({node:n,name:text(n,'Name'),...resolve(child(n,'Index'),esiNumber(text(n,'Index')),indexStep,'DependOnSlot')}))
  const pdos=['Rx','Tx'].flatMap(d=>children(module.node,`${d}Pdo`).map(n=>({node:n,name:text(n,'Name'),direction:d,...resolve(child(n,'Index'),esiNumber(text(n,'Index')),pdoStep,'DependOnSlot'),entries:children(n,'Entry').map(e=>({node:e,...resolve(child(e,'Index'),esiNumber(text(e,'Index')),indexStep,'DependOnSlot')}))})))
  return {valid:true,module,objects,pdos,indexStep,pdoStep,ordinal,scope:'仅对本例直接 Slot 步长作规则预览；SlotGroup、复合槽位或未覆盖扩展保留原文，需按版本核对。'}
}
export function esiSlotSelection(slot,choices={}){
  if(Object.hasOwn(choices,slot.id))return {ident:choices[slot.id],source:'preview',requiredMissing:choices[slot.id]===null&&esiNumber(slot.min)>0}
  const defaults=slot.allowed.filter(a=>a.isDefault)
  return {ident:defaults.length===1?defaults[0].value:null,source:defaults.length===1?'default':defaults.length>1?'conflict':'missing',requiredMissing:false}
}

export const esiEntryLocators={
  'esi-vendor-id':['Vendor','Id'],'esi-product-code':['Device','Type','@ProductCode'],'esi-revision-no':['Device','Type','@RevisionNo'],'esi-serial-no':['Device','Type','@SerialNo'],'esi-device-name':['Device','Name'],'esi-type':['Device','Type'],'esi-sm':['Device','Sm'],'esi-control-byte':['Device','Sm','@ControlByte'],'esi-mailbox':['Device','Mailbox'],'esi-coe':['Device','Mailbox','CoE'],'esi-rxpdo':['Device','RxPdo'],'esi-txpdo':['Device','TxPdo'],'esi-dc':['Device','Dc'],'esi-assign-activate':['Device','Dc','OpMode','AssignActivate'],'esi-dictionary':['Device','Profile','Dictionary'],'esi-profile':['Device','Profile'],'esi-eeprom':['Device','Eeprom'],'esi-slots':['Device','Slots'],'esi-modules':['Modules'],
}
Object.assign(esiEntryLocators,{'esi-root':[],'esi-vendor':['Vendor'],'esi-groups':['Descriptions','Groups'],'esi-device':['Device'],'esi-name':['Device','Name'],'esi-fmmu':['Device','Fmmu'],'esi-pdoassign':['Device','Mailbox','CoE','@PdoAssign'],'esi-pdoconfig':['Device','Mailbox','CoE','@PdoConfig'],'esi-entry':['Device','RxPdo','Entry'],'esi-pdo-flags':['Device','RxPdo','@Fixed'],'esi-datatypes':['Device','Profile','Dictionary','DataTypes'],'esi-objects':['Device','Profile','Dictionary','Objects'],'esi-slot-increments':['Device','Slots','@SlotIndexIncrement'],'esi-configdata':['Device','Eeprom','ConfigData']})
export function locateEsiEntry(document,scope,id){
  const parts=esiEntryLocators[id];if(!parts)return {node:scope?.device.node||document.root,attribute:null,missing:false}
  if(!parts.length)return{node:document.root,attribute:null,missing:false}
  let node=parts[0]==='Device'?scope?.device.node:parts[0]==='Vendor'?document.vendor:parts[0]==='Descriptions'?child(document.root,'Descriptions'):child(child(document.root,'Descriptions'),'Modules')
  for(const part of parts.slice(1)){if(part.startsWith('@'))return {node:node||scope?.device.node,attribute:part.slice(1),missing:attr(node,part.slice(1))===undefined};const next=child(node,part);if(!next)return{node:node||document.root,missing:true,expected:parts.join('/')};node=next}
  return {node:node||document.root,attribute:null,missing:!node}
}

export function esiRelations({document,node,ownerScope,scope}){
  const nodes=[],edges=[]
  const add=(n,label,detail,kind='source')=>{if(!n)return null;if(!nodes.some(item=>item.id===n.id))nodes.push({id:n.id,node:n,label,detail,kind});return n.id}
  const connect=(a,b,label)=>{if(a&&b&&a!==b&&!edges.some(e=>e.source===a&&e.target===b))edges.push({id:`${a}->${b}`,source:a,target:b,label})}
  const selected=add(node,node.name,node.value||text(node,'Name')||'当前 XML 节点')
  const pdo=ownerScope?.pdos.find(p=>node.id===p.id||node.id.startsWith(p.id+'/'))
  const entry=pdo?.entries.find(e=>node.id===e.id||node.id.startsWith(e.id+'/'))
  const object=entry?.object||ownerScope?.objects.find(o=>node.id===o.id||node.id.startsWith(o.id+'/'))
  if(pdo){const p=add(pdo.node,`${pdo.direction}PDO ${esiHex(pdo.index)}`,pdo.name,'pdo');connect(p,selected,'包含');const smIndex=esiNumber(pdo.sm),sm=scope?.sms[smIndex];if(smIndex!==null&&sm){connect(add(sm,`SM${smIndex} · ${sm.value}`,'默认分配的 SyncManager','sm'),p,'默认分配')}}
  if(object){const target=add(object.node,`${esiHex(object.index)} · ${object.name}`,`字典对象 · ${object.type}`,'object');connect(selected,target,entry?`引用 ${esiHex(entry.index)}:${esiHex(entry.subIndex,2).slice(2)}`:'属于对象');if(object.datatype)connect(target,add(object.datatype,object.type,'当前作用域的 DataType','datatype'),'Type 引用');ownerScope.pdos.flatMap(p=>p.entries).filter(e=>e.object?.id===object.id&&e.id!==entry?.id).slice(0,4).forEach(e=>connect(add(e.node,`${esiHex(e.index)}:${esiHex(e.subIndex,2).slice(2)}`,e.name||'PDO Entry','pdo'),target,'映射引用'))}
  if(!pdo&&!object){const parent=document.byId.get(node.parentId);if(parent)connect(add(parent,parent.name,text(parent,'Name')||'XML 父元素','parent'),selected,'包含');node.children.slice(0,5).forEach(n=>connect(selected,add(n,n.name,n.value||text(n,'Name')||'XML 子元素','child'),'包含'))}
  return {nodes,edges,unresolved:!!entry&&!entry.resolved&&!entry.padding,padding:entry?.padding||false}
}

/** ESI defaults only. No inference about online drive state or supported runtime modes. */
export function decodeDriveModes(defaultData,type){
  if(type!=='UDINT'||!/^([\da-f]{2}){4}$/i.test(defaultData||''))return null
  const bytes=defaultData.match(/../g).map(v=>parseInt(v,16)),mask=bytes.reduce((n,b,i)=>n+b*2**(i*8),0)
  const known=[[1,'PP · 轮廓位置'],[2,'VL · 速度模式'],[3,'PV · 轮廓速度'],[4,'TQ · 轮廓转矩'],[6,'HM · 回零'],[7,'IP · 插补位置'],[8,'CSP'],[9,'CSV'],[10,'CST']]
  return {mask,modes:known.filter(([mode])=>mask&2**(mode-1)).map(([mode,name])=>({mode,name,bit:mode-1})),source:'ESI / Info / DefaultData · UDINT little-endian'}
}

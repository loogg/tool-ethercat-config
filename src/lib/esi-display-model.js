import { attr, child, children, esiHex, esiNumber, text } from './esi-model.js'
import { checkEsiField, esiFieldRule } from '../data/esi-field-rules.js'
import { crossSourceContracts } from '../data/cross-source-contracts.js'

const entityNames=new Set(['EtherCATInfo','Vendor','Device','Type','Profile','Dictionary','Objects','Object','DataTypes','DataType','SubItem','Sm','Mailbox','CoE','Fmmu','RxPdo','TxPdo','Entry','Dc','OpMode','Slots','Slot','Modules','Module','Eeprom'])
const parentName=n=>n?.parentId?.split('/').at(-1)?.replace(/\[\d+\]$/,'')||''
const shortLabels={EtherCATInfo:'ESI 文档',Vendor:'厂商身份',Device:'设备定义',Profile:'设备 Profile',Dictionary:'对象字典',Objects:'对象定义',DataTypes:'类型定义',Sm:'SyncManager',Mailbox:'邮箱协议',CoE:'CoE 能力',Dc:'DC 同步',Slots:'槽位与步长',Slot:'槽位',Modules:'模块模板库',Module:'模块模板',Eeprom:'SII / EEPROM'}
export const esiSubIndexLabel=n=>n===null||n===undefined?'??':n.toString(16).toUpperCase().padStart(2,'0')
export const esiDisplayMatch=(value,query)=>String(value??'').toLowerCase().replace(/#x/g,'0x').includes(String(query??'').trim().toLowerCase().replace(/#x/g,'0x'))
export function esiEntity(context){
  let n=context.node
  while(n&&!entityNames.has(n.name)){
    if(n.children.length&&!['Flags','Info'].includes(n.name))break
    n=context.document.byId.get(n.parentId)
  }
  if(n?.name==='Type'&&!['Device','Module'].includes(parentName(n)))n=context.document.byId.get(n.parentId)
  if(n?.name==='DataType'&&parentName(n)!=='DataTypes')n=context.document.byId.get(n.parentId)
  return n||context.node
}
export function esiItemTitle(n,context){
  const index=esiNumber(text(n,'Index')),name=text(n,'Name')
  if(['RxPdo','TxPdo'].includes(n.name))return `${esiHex(index)} · ${name||n.name}`
  if(n.name==='Entry')return `${esiHex(index)}:${esiSubIndexLabel(esiNumber(text(n,'SubIndex')))} · ${name||'PDO Entry'}`
  if(n.name==='Object')return `${esiHex(index)} · ${name||'对象'}`
  if(n.name==='DataType')return text(n,'Name')||'DataType'
  if(n.name==='SubItem')return `${text(n,'SubIdx')?`SI ${text(n,'SubIdx')}`:'类型成员'} · ${name||text(n,'Type')}`
  if(n.name==='Sm'){const i=context.scope?.sms.findIndex(s=>s.id===n.id);return `${i>=0?`SM${i}`:'SM'} · ${n.value||'通道'}`}
  if(n.name==='Device')return context.scope?.device.name||name||'设备定义'
  if(n.name==='Type')return parentName(n)==='Module'?'模块身份':'设备身份'
  if(n.name==='Slot'||n.name==='Module')return name||shortLabels[n.name]
  return shortLabels[n.name]||n.name
}
export function esiItemBrief(context,entity=esiEntity(context)){
  if(entity.name==='Object'&&context.scope?.device.profileNo===402){
    const index=esiNumber(text(entity,'Index')),offsets=!context.local&&context.example?.axisGroups?context.example.axisGroups.map(g=>g.offset):[0]
    const notes={0x6040:['主站发给驱动的控制命令位；进入状态仍取决于驱动条件。','drive'],0x6041:['驱动返回的状态位，应按掩码判定；EtherCAT OP 不保证驱动已使能。','drive'],0x6060:['驱动运行模式请求，例如 CSP / CSV / CST；与 DC 同步模式分别解释。'],0x6061:['驱动报告的当前运行模式，需要与 0x6060 请求值对照。'],0x607A:['目标位置；单位、缩放与有效条件由设备和模式决定。'],0x6064:['实际位置反馈；数值类型、单位和缩放按设备核对。'],0x6502:['支持的驱动模式位图。ESI 默认字节不是在线读取结果。']}
    const base=Object.keys(notes).map(Number).find(n=>offsets.some(offset=>index===n+offset))
    if(base)return {meaning:notes[base][0],lesson:notes[base][1]}
  }
  const rule=esiFieldRule(entity)
  return {meaning:rule.covered?rule.meaning.split('；')[0]:'保留原始 XML 字段，按文档版本查阅。'}
}
export function esiItemScopeLabel(context,entity=esiEntity(context)){
  const inside=id=>id&&(entity.id===id||entity.id.startsWith(id+'/'))
  if(context.ownerScope?.kind==='module'&&inside(context.ownerScope.owner.id))return 'MODULE 模板'
  if(inside(context.scope?.device.id))return 'DEVICE 本体'
  return 'DOCUMENT 文档'
}
export function esiBreadcrumbs(context,entity=esiEntity(context)){
  const list=[];let n=entity
  while(n){if(['Device','Module','Dictionary','Objects','DataTypes','Object','DataType','RxPdo','TxPdo','Entry','Slots','Slot','Mailbox','Dc'].includes(n.name))list.unshift({id:n.id,title:esiItemTitle(n,context)});n=context.document.byId.get(n.parentId)}
  return list.length?list.slice(-4):[{id:entity.id,title:esiItemTitle(entity,context)}]
}

function target(contractId,id,extra={}){
  const contract=crossSourceContracts.find(c=>c.id===contractId),field=contract?.fields.find(f=>f.id===id)
  if(!field)return null
  const edges=contract.relations.filter(e=>e.source===id||e.target===id)
  return {...field,id:`${contractId}:${id}`,contractId,condition:edges[0]?.condition||contract.summary,relationKind:edges[0]?.kind||'describe',references:contract.evidence,...extra}
}
const appTarget=(entryId,title,path,field,rule)=>({id:`app:${entryId}:${field}`,surface:'APP',title,path,entryId,field,relationKind:'generate',condition:'同一生成链中的字段规则对应；当前未绑定应用文件。',references:rule.references})
const sscTarget=(entryId,title,path,rule,condition)=>({id:`ssc:${entryId}`,surface:'SSC',title,path,entryId,relationKind:'describe',condition,references:rule.references})
export function esiFieldAssociations(node,attribute,context){
  const name=attribute||node.name,p=parentName(node),rule=esiFieldRule(node,attribute),list=[]
  const add=t=>{if(t)list.push(t)}
  const direction=context.ownerScope?.pdos.find(o=>node.id===o.id||node.id.startsWith(o.id+'/'))?.direction|| (context.scope?.sms.some(s=>s.id===node.id&&s.value==='Inputs')?'Tx':'Rx')
  const pdoContract=direction==='Tx'?'pdo-input':'pdo-output'
  if(name==='ControlByte')add(target('watchdog','ssc'))
  else if(['ProductCode','RevisionNo','SerialNo'].includes(name)||(name==='Id'&&p==='Vendor'))add(target('identity','ssc'))
  else if(['SlotIndexIncrement','SlotPdoIncrement'].includes(name))add(target('modules','base',{title:name==='SlotIndexIncrement'?'IndexIncrement':'PdoIndexIncrement',field:`header:${name==='SlotIndexIncrement'?'IndexIncrement':'PdoIndexIncrement'}`,sheet:'Base_Device'}))
  else if(name==='DependOnSlot'){const header=['RxPdo','TxPdo'].includes(p)?'PdoIndexIncrement':'IndexIncrement';add(target('modules','module',{title:`模块表 ${header}`,field:`header:${header}`,sheet:'Digital_Input',relationKind:'generate',condition:'模块表对应增量字段用于声明槽位依赖；实际步长来自基础表。此属性属于对应的 Index 元素。'}))}
  else if(name==='ModuleIdent'&&attribute)add(target('modules','module',{title:'Module Ident',field:'header:Module Ident',sheet:'Digital_Input',relationKind:'generate',condition:'同一生成链中的模块类型标识；不等于某个 Slot 实例。'}))
  else if(name==='Default'&&node.name==='ModuleIdent')add({...appTarget('xlsx-default','G · 默认 ModuleIdent','基础设备 › 0xF030成员 › Default Value','G',rule),relationKind:'derive',condition:'Default=1 表示此 ModuleIdent 被选为默认模块；G列存放模块标识，不是把默认标志1写入G列。'})
  else if(name==='ModuleIdent')add(appTarget('xlsx-description','P · ModuleIds 允许列表','基础设备 › 0xF030成员 › Description','P',rule))
  else if(name==='ProfileNo')add(target('profile','app',{field:'header:Device Profile',sheet:'Base_Device'}))
  else if(name==='Index'&&p==='Object')add(target('address','app-index'))
  else if(name==='Index'&&p==='Entry'&&esiNumber(text(node))!==0)add(target('address','app-index'))
  else if(['SubIndex','SubIdx'].includes(name))add(target('address','app-si'))
  else if(name==='Access')add(target('access','app'))
  else if(name==='PdoMapping'){add(target(node.value==='T'?'pdo-input':'pdo-output','app',{title:'M · rx/tx 可映射方向'}))}
  else if(name==='BitLen'){add(target('types','app-type'));add(target(pdoContract,'ssc',{title:direction==='Tx'?'输入容量约束':'输出容量约束'}))}
  else if(name==='BitOffs'){add(target('types','app-type',{title:'E · DataType / Padding'}))}
  else if((name==='DataType'&&p==='Entry')||name==='BitSize'||(name==='Type'&&['Object','SubItem'].includes(p))){add(target('types','app-type'));if(p==='Object')add(target('types','app-code'))}
  else if(name==='Name'&&['Object','SubItem','Entry'].includes(p))add(appTarget('xlsx-name','F · Name','应用工作表 › 对象或成员 › Name','F',rule))
  else if(name==='DefaultData')add(appTarget('xlsx-default','G · Default Value','应用工作表 › 对象或成员 › 默认值','G',rule))
  else if(['DefaultSize','MinSize','MaxSize'].includes(name)&&node.name==='Sm'&&['Inputs','Outputs'].includes(node.value)){add(target(pdoContract,'ssc',{title:'过程数据容量约束'}));add(target(pdoContract,'app',{title:'应用过程数据布局'}))}
  else if(name==='StartAddress'&&node.name==='Sm'){
    const input=node.value==='Inputs',output=node.value==='Outputs'
    if(input||output)list.push({id:'ssc-sm-address',surface:'SSC',title:input?'DEF_PD_READ_ADDRESS':'DEF_PD_WRITE_ADDRESS',path:'Application › ProcessData › 默认过程数据地址',entryId:input?'def-pd-read-address':'def-pd-write-address',condition:'核对同一设备及方向的默认地址；主站最终配置另行确认。',relationKind:'describe',references:rule.references})
    else if(['MBoxOut','MBoxIn'].includes(node.value)){const receiving=node.value==='MBoxOut';add(sscTarget(receiving?'def-mbx-write-address':'def-mbx-read-address',receiving?'DEF_MBX_WRITE_ADDRESS':'DEF_MBX_READ_ADDRESS','Mailbox › 默认邮箱地址',rule,'按同一设备的邮箱方向核对默认地址；MBoxOut 表示主站输出、从站接收。'))}
  }else if(name==='DefaultSize'&&node.name==='Sm'&&['MBoxOut','MBoxIn'].includes(node.value)){add(sscTarget('def-mbx-size','DEF_MBX_SIZE','Mailbox › 默认邮箱长度',rule,'默认邮箱长度按同一工程核对，不等于 MAX_MBX_SIZE 最大容量。'))}
  else if(name==='MaxSize'&&node.name==='Sm'&&['MBoxOut','MBoxIn'].includes(node.value)){add(sscTarget('max-mbx-size','MAX_MBX_SIZE','Mailbox › 最大邮箱容量',rule,'核对固件支持的最大邮箱容量；默认大小仍是独立描述。'))}
  else if(name==='CompleteAccess'){add(target('coe','ssc',{title:'COMPLETE_ACCESS_SUPPORTED',entryId:'complete-access-supported',relationKind:'constrain',condition:'ESI 能力声明与固件 Complete Access 实现需要一致；对象权限和访问范围仍需核对。'}))}
  else if(['PdoAssign','PdoConfig','SdoInfo'].includes(name)||node.name==='CoE'){add(target('coe','ssc'))}
  else if(['AssignActivate','CycleTimeSync0','ShiftTimeSync0'].includes(name)){add(target('synchronisation','ssc'));add(target('synchronisation','fixed'))}
  return list.filter((t,i)=>list.findIndex(o=>o.id===t.id)===i)
}
function fieldUnit(node,attribute){const name=attribute||node.name;if(['BitLen','BitSize','BitOffs'].includes(name))return 'bit';if(['DefaultSize','MinSize','MaxSize','ByteSize'].includes(name))return 'Byte';if(['CycleTimeSync0','ShiftTimeSync0'].includes(name))return 'ns';if(name==='ControlByte')return '8 bit';if(name==='Index')return '16 bit';if(['SubIndex','SubIdx'].includes(name))return '8 bit';return ''}
export function esiFieldRows(context,entity=esiEntity(context)){
  const rows=[]
  function add(n,a,prefix=''){
    const rule=esiFieldRule(n,a),state=checkEsiField(n,a),raw=a?n.attributes.find(f=>f.name===a)?.raw:n.value
    const container=!a&&n.children.length>0
    const name=a?`${prefix}@${a}`:prefix+n.name
    rows.push({key:`${n.id}${a?'/@'+a:''}`,node:n,attribute:a,label:name,title:rule.title,raw,value:container?(text(n,'Name')||`${n.children.length} 个子元素`):raw,state,rule,unit:fieldUnit(n,a),container,associations:esiFieldAssociations(n,a,context),presenter:a==='ControlByte'?'bitfield':n.name==='Index'?'index':'plain',line:a?n.attributes.find(f=>f.name===a)?.line:n.span?.line})
  }
  entity.attributes.forEach(a=>add(entity,a.name))
  if(entity.value&&!entity.children.length)add(entity,null)
  function append(n,prefix=''){
    add(n,null,prefix)
    if(!entityNames.has(n.name)||(n.name==='DataType'&&parentName(n)==='Entry')||(n.name==='Type'&&['Object','SubItem'].includes(parentName(n))))n.attributes.forEach(a=>add(n,a.name,`${prefix}${n.name} / `))
  }
  children(entity).forEach(n=>{
    if(['Entry','SubItem'].includes(n.name))return
    if(['Flags','Info'].includes(n.name)&&n.children.length){children(n).forEach(c=>append(c,n.name+' / '));n.attributes.forEach(a=>add(n,a.name,n.name+' / '))}
    else append(n)
  })
  if(context.attribute&&context.node.id===entity.id&&!entity.attributes.some(a=>a.name===context.attribute))add(entity,context.attribute)
  return rows
}
export function esiSelectedRow(context,rows){return rows.find(r=>r.node.id===context.node.id&&(r.attribute||'')===(context.attribute||''))||null}
export function esiItemAssociations(context,entity=esiEntity(context)){
  if(entity.name==='RxPdo'||entity.name==='TxPdo')return [target(entity.name==='TxPdo'?'pdo-input':'pdo-output','app'),target(entity.name==='TxPdo'?'pdo-input':'pdo-output','ssc')]
  if(entity.name==='Device'||(entity.name==='Type'&&parentName(entity)==='Device'))return [target('identity','ssc')]
  if(entity.name==='Dc'||entity.name==='OpMode')return [target('synchronisation','ssc'),target('synchronisation','fixed')]
  const list=esiFieldRows(context,entity).flatMap(r=>r.associations)
  return list.filter((t,i)=>list.findIndex(o=>o.id===t.id)===i)
}
const navItem=(node,title,mode='structure',meta='')=>node?{id:node.id,node,title,mode,meta}:null
export function esiNavigationGroups(context){
  const {document,scope}=context,owner=context.ownerScope||scope;if(context.expired)return []
  if(!scope)return [{id:'document',title:'文档结构',items:[navItem(document.root,'XML 根元素')]}]
  const d=scope.device.node,modules=child(child(document.root,'Descriptions'),'Modules')
  return [
    {id:'identity',title:'身份与识别',items:[navItem(document.vendor,'厂商身份'),navItem(child(d,'Type'),'设备身份'),navItem(child(d,'Name'),'设备名称')]},
    {id:'communication',title:'通信配置',items:[...scope.sms.map((n,i)=>navItem(n,`SM${i} · ${n.value}`, 'structure',`${attr(n,'StartAddress')??'—'} · ${attr(n,'DefaultSize')??'—'} B`)),navItem(scope.mailbox,'Mailbox / CoE'),navItem(scope.dc,'DC 同步'),...children(d,'Fmmu').map((n,i)=>navItem(n,`FMMU${i} · ${n.value}`))]},
    {id:'dictionary',title:'对象字典',items:[navItem(child(owner.dictionary,'Objects'),`Objects · ${owner.objects.length} 个对象`,'dictionary'),navItem(child(owner.dictionary,'DataTypes'),`DataTypes · ${owner.types.length} 个类型`)]},
    {id:'pdo',title:'过程数据 PDO',items:owner.pdos.map(p=>({...navItem(p.node,`${p.direction==='Rx'?'Rx':'Tx'} · ${esiHex(p.index)}`, 'structure',p.name),children:p.entries.map(e=>navItem(e.node,`${esiHex(e.index)}:${e.subIndex??'?'} · ${e.name||'Entry'}`))}))},
    {id:'modules',title:scope.device.profileNo===402?'驱动与轴 / 模块':'模块与槽位',items:[navItem(scope.slotsNode,`Slots · ${scope.slots.length} 个槽位`,'profile'),...(scope.device.profileNo===402?[navItem(child(d,'Profile'),'CiA402 轴对象','profile')]:[]),...document.modules.map(m=>navItem(m.node,m.name,'structure',m.rawIdent)),...(modules&&!document.modules.length?[navItem(modules,'模块模板库')]:[])]},
    {id:'eeprom',title:'SII / EEPROM',items:[navItem(child(d,'Eeprom'),'EEPROM 描述')]},
  ].map(g=>({...g,items:g.items.filter(Boolean)})).filter(g=>g.items.length)
}

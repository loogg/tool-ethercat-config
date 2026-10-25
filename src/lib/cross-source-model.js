import { crossSourceContracts } from '../data/cross-source-contracts.js'

export function contractsForEntry(id){return crossSourceContracts.filter(c=>c.entryIds.includes(id)||c.fields.some(f=>f.entryId===id)).sort((a,b)=>Number(b.entryIds.includes(id))-Number(a.entryIds.includes(id)))}
export function contractsForEsi(context){
  const n=context.node,a=context.attribute,p=n.id.split('/').slice(-3).join('/')
  let ids
  if(a==='ControlByte')ids=['watchdog','pdo-output','pdo-input']
  else if(['ProductCode','RevisionNo','SerialNo'].includes(a)||n.name==='Vendor'||p.includes('/Vendor[')||(n.name==='Type'&&n.id.split('/').at(-2)?.startsWith('Device[')))ids=['identity']
  else if(a?.includes('Increment')||a?.includes('DependOnSlot')||['Slots','Slot','Modules','Module','ModuleIdent'].includes(n.name))ids=['modules']
  else if(['Access','PdoMapping'].includes(n.name))ids=n.name==='Access'?['access']:['pdo-output','pdo-input']
  else if(['Coe','CoE','Mailbox'].includes(n.name)||['PdoAssign','PdoConfig','CompleteAccess','SdoInfo'].includes(a))ids=['coe']
  else if(n.name==='RxPdo'||p.includes('/RxPdo['))ids=['pdo-output','address','types']
  else if(n.name==='TxPdo'||p.includes('/TxPdo['))ids=['pdo-input','address','types']
  else if(['Object','Objects','Dictionary','Index','SubIndex','SubIdx'].includes(n.name))ids=['address','types','access']
  else if(['DataType','DataTypes','Type','SubItem','BitLen','BitSize','BitOffs'].includes(n.name))ids=['types','address']
  else if(['Profile','ProfileNo','Device'].includes(n.name))ids=['profile','identity']
  else if(n.name==='Sm')ids=n.value==='Inputs'?['pdo-input','watchdog']:['pdo-output','watchdog']
  else if(['Dc','OpMode','AssignActivate','CycleTimeSync0','ShiftTimeSync0'].includes(n.name))ids=['synchronisation']
  return ids?ids.map(id=>crossSourceContracts.find(c=>c.id===id)):[]
}
export function crossSourceSelection({entryId,esiContext,applicationContext}={}){
  if(esiContext){const n=esiContext.node;return {contracts:contractsForEsi(esiContext),origin:{surface:'ESI',artifactId:esiContext.documentId,title:esiContext.filename,scope:esiContext.ownerScope?.owner.id||esiContext.scope?.device.id,path:`${n.id}${esiContext.attribute?'/@'+esiContext.attribute:''}`,role:'occurrence',rawValue:esiContext.attribute?n.attributes.find(a=>a.name===esiContext.attribute)?.raw:n.value,paired:false}}}
  if(applicationContext){const c=applicationContext,header=c.sheet.metadata.find(h=>`header:${h.name}`===c.field),contracts=contractsForEntry(entryId);if(c.field==='header:Device Profile')contracts.sort((a,b)=>Number(b.id==='profile')-Number(a.id==='profile'));return {contracts,origin:{surface:'APP',artifactId:c.workbook.id,title:c.workbook.filename,scope:c.sheet.id,path:`${c.sheet.name}!${header?header.cell:c.field+(c.row?.number||'')}`,role:'occurrence',rawValue:header?header.value:c.row?.values[c.field],paired:false}}}
  return {contracts:contractsForEntry(entryId),origin:{surface:'SSC',title:'SSC 配置参考',path:entryId,role:'definition',paired:false}}
}
export function buildCrossSourceGraph(contract){
  const fields=contract.fields.map(f=>({...f,id:`${contract.id}:${f.id}`}))
  const edges=contract.relations.map((r,i)=>({...r,id:`${contract.id}:relation:${i}`,source:`${contract.id}:${r.source}`,target:`${contract.id}:${r.target}`,role:'rule',status:'rule-only',evidence:contract.evidence}))
  return {conceptId:contract.id,nodes:fields,edges,bindingStatus:'unbound',scope:contract.versionScope}
}
export function crossRelationsForField(contract,fieldId){return buildCrossSourceGraph(contract).edges.filter(e=>e.source===fieldId||e.target===fieldId).map(e=>({...e,incoming:e.target===fieldId}))}

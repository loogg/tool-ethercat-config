import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Code2, FileCode2, FileUp, GitBranch, Info, X } from 'lucide-react'
import { esiExamples } from '../data/esi-examples.js'
import { child } from '../lib/esi-model.js'
import { esiEntity, esiItemTitle } from '../lib/esi-display-model.js'
import EsiItemSheet from './EsiItemSheet.jsx'
import { Dictionary, Types, Pdos, SlotProfile, DriveProfile, Source } from './EsiCollectionPanels.jsx'
import EsiRelations from './EsiRelations.jsx'
import { TimingDialog } from './TimingWorkbench.jsx'
import './esi-workbench.css'
import './esi-item.css'

function EsiContextDialog({type,context,onClose,onLocate,onFeedback}){
  const dialog=useRef(null)
  useEffect(()=>{const previous=document.activeElement;dialog.current?.showModal();return()=>previous?.focus?.({preventScroll:true})},[])
  return <dialog ref={dialog} className="esi-context-dialog" aria-label={type==='source'?'ESI XML 原文':'当前 XML 引用'} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><header><span>{type==='source'?<Code2 size={15}/>:<GitBranch size={15}/>}</span><strong>{type==='source'?'XML 原文':'当前文件的结构与引用'}</strong><small>{context.filename}</small><button className="icon-button" aria-label={type==='source'?'关闭 XML 原文':'关闭 XML 引用'} onClick={onClose}><X size={18}/></button></header><div>{type==='source'?<Source key={context.node.id} context={context} onFeedback={onFeedback}/>:<EsiRelations context={context} onLocate={onLocate}/>}</div></dialog>
}

export default function EsiWorkbench({context,entry,onContext,onFile,error,onFeedback,onNavigate,onReference}){
  const [query,setQuery]=useState(''),[timing,setTiming]=useState(''),[overlay,setOverlay]=useState(null)
  const file=useRef(null),body=useRef(null),entity=esiEntity(context)
  const contextKey=[context.documentId,context.scope?.device.id,context.node.id,context.attribute,context.mode].join('|')
  const legacyOverlay=context.mode==='xml'?{type:'source',node:context.node}:context.mode==='relations'?{type:'references',node:context.node}:null
  const currentOverlay=overlay?.contextKey===contextKey?overlay:null
  const visibleOverlay=context.expired?null:currentOverlay||legacyOverlay
  const view=['dictionary','pdo','profile'].includes(context.mode)?context.mode:entity.name==='DataTypes'?'types':'item'
  const options=[...esiExamples,...(context.local||context.expired?[{id:'local',title:context.expired?'本地文件待恢复':context.filename}]:[])]
  useEffect(()=>{body.current?.scrollTo({top:0})},[entity.id,view])
  function locate(id,attribute='',pane){
    const node=context.document.byId.get(id)
    const sameProfileItem=context.mode==='profile'&&node&&esiEntity({...context,node,attribute}).id===entity.id
    const mode=pane||(sameProfileItem?'profile':!attribute&&['Dictionary','Objects'].includes(node?.name)?'dictionary':!attribute&&node?.name==='Slots'?'profile':'structure')
    setQuery('');setOverlay(null);onContext({esiNode:id,esiAttr:attribute||'',esiPane:mode})
  }
  function closeOverlay(){setOverlay(null);if(legacyOverlay)onContext({esiPane:'structure'})}
  function showSource(node){setOverlay({type:'source',node,contextKey})}
  function showReferences(node){setOverlay({type:'references',node,contextKey})}
  const sourceContext=visibleOverlay?{...context,node:visibleOverlay.node,attribute:visibleOverlay.node.id===context.node.id?context.attribute:null}:null
  function reference(target){if(onReference)onReference(target);else onNavigate(target.entryId)}
  const dictionaryNode=child(context.ownerScope?.dictionary,'Objects')
  const sectionLabel=view==='dictionary'?'对象字典':view==='types'?'类型定义':view==='pdo'?'PDO 目录':view==='profile'?(context.scope?.device.profileNo===402?'驱动与轴 / 模块':'槽位与模块'):'当前条目'
  return <section className="esi-workspace esi-item-workspace" aria-label="ESI 条目查阅工作台"><header className="esi-compact-header"><div className="esi-compact-title"><FileCode2 size={17}/><h1>ESI 设备描述</h1></div><label><span className="sr-only">ESI 文档</span><select aria-label="ESI 文档示例" value={context.expired?'local':context.documentId} onChange={e=>{setQuery('');setOverlay(null);onContext({esi:e.target.value,device:'',esiNode:'',esiAttr:'',esiPane:'structure'})}}>{options.map(o=><option value={o.id} key={o.id}>{o.title}</option>)}</select></label><button onClick={()=>file.current?.click()}><FileUp size={14}/>本地 XML</button><input ref={file} type="file" accept=".xml,text/xml,application/xml" className="sr-only" aria-label="打开本地 ESI XML 文件" onChange={e=>{const selected=e.target.files?.[0];if(selected)onFile(selected);e.target.value=''}}/><details className="esi-document-info"><summary><Info size={14}/><span>文档信息</span></summary><div><strong>{context.expired?'本地 XML（需要恢复）':context.filename}</strong><span>{context.expired?'需重新打开本地文件':context.local?'本地内存 · 只读':'通用教学示例'}</span><span>ESI声明版本 {context.expired?'来源未恢复':context.document.version||'未声明'}</span><p>{context.expired?'源文件未恢复，读取状态未知。':'XML可解析；完整XSD有效性与固件一致性未验证。'}</p></div></details></header>{!context.expired&&<div className="esi-compact-device"><label><span>Device / Revision</span><select aria-label="选择 ESI 设备与修订" value={context.scope?.device.id||''} disabled={!context.document.devices.length} onChange={e=>{setQuery('');setOverlay(null);onContext({device:e.target.value,esiNode:'',esiAttr:'',esiPane:'structure'})}}>{context.document.devices.map(d=><option value={d.id} key={d.id}>{d.name} · {d.revision||'修订未声明'}</option>)}</select></label><span>Profile <b>{context.scope?.device.profileNo??'未知'}</b></span>{context.ownerScope?.kind==='module'&&<button onClick={()=>locate(context.scope.device.id)}>模块模板：{context.ownerScope.owner.name}<ArrowLeft size={12}/>设备本体</button>}</div>}{error&&<div className="esi-error" role="alert"><Info size={14}/>{error}</div>}{context.expired?<div className="esi-expired"><FileUp size={30}/><h2>重新打开本地 XML</h2><p>文件只在本次页面内存中保留，重新打开后可继续定位。</p><button className="primary-button" onClick={()=>file.current?.click()}>选择原 ESI 文件</button></div>:<div className="esi-single-content" ref={body}>{(context.missingNode||context.missingDevice||context.missingLocator)&&<p className="esi-context-warning">{context.missingLocator?'当前设备未声明链接中的字段，已定位到存在的父级。':context.missingDevice?'未找到链接中的设备，当前显示第一个Device。':'链接中的节点不在当前作用域，已回到设备。'}</p>}{view!=='item'&&<div className="esi-catalog-context"><span>{context.ownerScope?.kind==='module'?`Module · ${context.ownerScope.owner.name}`:context.scope?.device.name} / {sectionLabel}</span><div><button onClick={()=>locate(entity.id,'','structure')}><FileCode2 size={13}/>字段与配置</button><button onClick={()=>showSource(context.node)}><Code2 size={13}/>原文</button></div></div>}{view==='dictionary'?<Dictionary context={context} onLocate={locate} query={query} setQuery={setQuery}/>:view==='types'?<Types context={context} onLocate={locate} query={query} setQuery={setQuery}/>:view==='pdo'?<Pdos context={context} onLocate={locate} query={query} setQuery={setQuery} onTiming={setTiming}/>:view==='profile'?<><div className="esi-profile-page-heading"><span>Profile {context.scope?.device.profileNo??'未知'}</span><h2>{sectionLabel}</h2><p>模板、允许选择与实例索引分别表达；选择字段可查来源与条件。</p></div>{context.scope?.device.profileNo===402&&<DriveProfile key={context.documentId+context.scope.device.id} context={context} onLocate={locate} onTiming={setTiming}/>}<EsiItemSheet key={entity.id} context={context} onLocate={locate} onReference={reference} onSource={showSource} onTiming={setTiming} onFileReferences={showReferences}/>{context.scope?.slots.length>0&&<SlotProfile key={context.documentId+context.scope.device.id} context={context} onLocate={locate}/>}</>:<><EsiItemSheet key={entity.id} context={context} onLocate={locate} onReference={reference} onSource={showSource} onTiming={setTiming} onFileReferences={showReferences}/>{dictionaryNode&&['Object','SubItem','DataType'].includes(entity.name)&&<button className="esi-back-catalog" onClick={()=>locate(dictionaryNode.id,'','dictionary')}><ArrowLeft size={13}/>返回对象字典目录</button>}</>}</div>}{visibleOverlay&&<EsiContextDialog key={visibleOverlay.type+visibleOverlay.node.id} type={visibleOverlay.type} context={sourceContext} onClose={closeOverlay} onLocate={id=>{setOverlay(null);locate(id)}} onFeedback={onFeedback}/>} {timing&&<TimingDialog key={timing} lesson={timing} contextLabel="独立教学输入，未从 ESI 推断时序数值" onClose={()=>setTiming('')}/>}<span className="sr-only">{context.expired?'本地文件待恢复':entry.name+' · '+esiItemTitle(entity,context)}</span></section>
}

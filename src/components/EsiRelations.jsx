import { useMemo, useRef, useState } from 'react'
import { Background, Controls, Handle, Position, ReactFlow, MarkerType } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { ArrowRight, Code2, List, Workflow } from 'lucide-react'
import { esiRelations } from '../lib/esi-model.js'
import { esiItemTitle } from '../lib/esi-display-model.js'
import '@xyflow/react/dist/style.css'
function RelationNode({data}){return <div className={`esi-relation-node ${data.focal?'focal':''}`}>{['left','right','top','bottom'].map(side=><Handle key={'in'+side} id={'in-'+side} type="target" position={Position[side[0].toUpperCase()+side.slice(1)]}/>)}<small>{data.node.parentId?.split('/').slice(-3).join(' / ')||'ESI'}</small><strong>{data.label}</strong><span>{data.detail}</span><em>{data.node.span?`XML L${data.node.span.line}`:'XML 路径定位'}</em>{['left','right','top','bottom'].map(side=><Handle key={'out'+side} id={'out-'+side} type="source" position={Position[side[0].toUpperCase()+side.slice(1)]}/>)}</div>}
const types={esi:RelationNode}
export default function EsiRelations({context,onLocate}){
  const [view,setView]=useState(()=>window.matchMedia('(max-width:720px)').matches?'list':'graph'),api=useRef(null)
  const model=useMemo(()=>esiRelations(context),[context])
  const graph=useMemo(()=>{
    const g=new dagre.graphlib.Graph().setDefaultEdgeLabel(()=>({}));g.setGraph({rankdir:'LR',ranksep:65,nodesep:25,marginx:20,marginy:20})
    model.nodes.forEach(n=>g.setNode(n.id,{width:230,height:128}));model.edges.forEach(e=>g.setEdge(e.source,e.target));dagre.layout(g)
    const linear=model.edges.length===model.nodes.length-1&&model.nodes.every(n=>model.edges.filter(e=>e.source===n.id).length<=1&&model.edges.filter(e=>e.target===n.id).length<=1)
    const positions=new Map()
    if(linear){let n=model.nodes.find(n=>!model.edges.some(e=>e.target===n.id)),i=0;while(n&&i<model.nodes.length){const row=Math.floor(i/2),col=row%2?1-i%2:i%2;positions.set(n.id,{x:col*295,y:row*186});const next=model.edges.find(e=>e.source===n.id)?.target;n=model.nodes.find(n=>n.id===next);i++}}
    const nodes=model.nodes.map(n=>({id:n.id,type:'esi',position:positions.get(n.id)||{x:g.node(n.id).x-115,y:g.node(n.id).y-64},data:{...n,label:n.id===context.node.id?esiItemTitle(n.node,context):n.label,focal:n.id===context.node.id},draggable:false}))
    const edges=model.edges.map(e=>{const a=nodes.find(n=>n.id===e.source).position,b=nodes.find(n=>n.id===e.target).position,vertical=a.y!==b.y,side=vertical?'bottom':b.x>a.x?'right':'left',target=vertical?'top':b.x>a.x?'left':'right';return {...e,type:'smoothstep',sourceHandle:'out-'+side,targetHandle:'in-'+target,markerEnd:{type:MarkerType.ArrowClosed,width:15,height:15,color:'#6689bb'},style:{stroke:'#6689bb'},labelStyle:{fontSize:11,fill:'#55749c'},labelBgStyle:{fill:'#fff'}}})
    return {nodes,edges}
  },[model,context])
  return <section className="esi-relationship-pane"><div className="esi-section-heading"><span><Workflow size={15}/>当前节点的结构与引用</span><div><button aria-pressed={view==='graph'} onClick={()=>setView('graph')}><Workflow size={13}/>图</button><button aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={13}/>列表</button></div></div>{model.unresolved&&<p className="esi-inline-note">当前作用域内未解析到字典成员；可能需要外部 DictionaryFile 或尚未展开的类型。请查原文。</p>}{model.padding&&<p className="esi-inline-note">Index = 0：这是 PDO 填充位，不引用对象字典。</p>}{view==='graph'?<div className="esi-relation-canvas"><ReactFlow nodes={graph.nodes} edges={graph.edges} nodeTypes={types} fitView fitViewOptions={{padding:.10,minZoom:.8,maxZoom:1}} minZoom={.35} maxZoom={1.4} nodesDraggable={false} nodesConnectable={false} onNodeDoubleClick={(_,n)=>onLocate(n.id)} ariaLabelConfig={{'controls.zoomIn.ariaLabel':'放大 XML 关系图','controls.zoomOut.ariaLabel':'缩小 XML 关系图','controls.fitView.ariaLabel':'适应 XML 关系图'}} deleteKeyCode={null} onInit={flow=>{api.current=flow}} onNodeClick={(_,n)=>onLocate(n.id)} panOnScroll zoomOnScroll={false} zoomOnDoubleClick={false}><Background gap={22} color="#dce3ee"/><Controls showInteractive={false}/></ReactFlow></div>:<div className="esi-relation-list">{model.edges.map(e=><div key={e.id}><button onClick={()=>onLocate(e.source)}>{model.nodes.find(n=>n.id===e.source)?.label}</button><span>{e.label}<ArrowRight size={13}/></span><button onClick={()=>onLocate(e.target)}>{model.nodes.find(n=>n.id===e.target)?.label}</button></div>)}{!model.edges.length&&<p>当前节点没有已记录的引用，原文结构仍可查阅。</p>}</div>}<div className="esi-relationship-tip"><Code2 size={13}/>点击节点选择并查看字段说明；“XML 原文”可定位来源。连线仅来自当前 Device 或 Module 的实际结构和引用。</div></section>
}

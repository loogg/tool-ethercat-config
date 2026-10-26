import { useMemo, useState } from 'react'
import { Background, ReactFlow, ReactFlowProvider, MarkerType } from '@xyflow/react'
import { useResponsiveDiagram } from '../lib/use-responsive-diagram.js'
import { RoutedHandles, ResponsiveViewport, DiagramStatus, DiagramControls } from './RoutedDiagram.jsx'
import { diagramNodes, diagramEdges, routedEdgeTypes } from './diagram-types.js'
import { ArrowRight, Code2, List, Workflow } from 'lucide-react'
import { esiRelations } from '../lib/esi-model.js'
import { esiItemTitle } from '../lib/esi-display-model.js'
import '@xyflow/react/dist/style.css'
function RelationNode({data}){return <><RoutedHandles ports={data.ports}/><div className={`esi-relation-node ${data.focal?'focal':''}`}><small>{data.node.parentId?.split('/').slice(-3).join(' / ')||'ESI'}</small><strong>{data.label}</strong><span>{data.detail}</span><em>{data.node.span?`XML L${data.node.span.line}`:'XML 路径定位'}</em></div></>}
const types={esi:RelationNode}
export default function EsiRelations({context,onLocate}){
  const [view,setView]=useState(()=>window.matchMedia('(max-width:720px)').matches?'list':'graph')
  const model=useMemo(()=>esiRelations(context),[context])
  const geometry=useMemo(()=>({nodes:model.nodes.map(n=>({id:n.id,width:230,height:128})),edges:model.edges.map(e=>({...e,labelFontSize:11}))}),[model])
  const {attachCanvas,...diagram}=useResponsiveDiagram(geometry,{enabled:view==='graph'})
  const graph={nodes:diagramNodes(model.nodes.map(n=>({id:n.id,type:'esi',data:{...n,label:n.id===context.node.id?esiItemTitle(n.node,context):n.label,focal:n.id===context.node.id},draggable:false})),diagram.layout),edges:diagramEdges(model.edges.map(e=>({...e,markerEnd:{type:MarkerType.ArrowClosed,width:15,height:15,color:'#6689bb'},style:{stroke:'#6689bb'},labelStyle:{fontSize:11,fill:'#55749c'},labelBgStyle:{fill:'#fff'}})),diagram.layout)}

  return <section className="esi-relationship-pane"><div className="esi-section-heading"><span><Workflow size={15}/>当前节点的结构与引用</span><div><button aria-pressed={view==='graph'} onClick={()=>{setView('graph');diagram.resumeAuto()}}><Workflow size={13}/>图</button><button aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={13}/>列表</button></div></div>{model.unresolved&&<p className="esi-inline-note">当前作用域内未解析到字典成员；可能需要外部 DictionaryFile 或尚未展开的类型。请查原文。</p>}{model.padding&&<p className="esi-inline-note">Index = 0：这是 PDO 填充位，不引用对象字典。</p>}{view==='graph'?<div className="esi-relation-canvas diagram-canvas" ref={attachCanvas}><DiagramStatus diagram={diagram}/><ReactFlowProvider><ReactFlow nodes={graph.nodes} edges={graph.edges} nodeTypes={types} edgeTypes={routedEdgeTypes} onMove={diagram.onMove} minZoom={.1} maxZoom={1.4} nodesDraggable={false} nodesConnectable={false} onNodeDoubleClick={(_,n)=>onLocate(n.id)} ariaLabelConfig={{'controls.zoomIn.ariaLabel':'放大 XML 关系图','controls.zoomOut.ariaLabel':'缩小 XML 关系图','controls.fitView.ariaLabel':'适应 XML 关系图'}} deleteKeyCode={null} onNodeClick={(_,n)=>onLocate(n.id)} panOnScroll zoomOnScroll={false} zoomOnDoubleClick={false}><ResponsiveViewport diagram={diagram}/><Background gap={22} color="#dce3ee"/><DiagramControls diagram={diagram} fitLabel="适应 XML 关系图"/></ReactFlow></ReactFlowProvider></div>:<div className="esi-relation-list">{model.edges.map(e=><div key={e.id}><button onClick={()=>onLocate(e.source)}>{model.nodes.find(n=>n.id===e.source)?.label}</button><span>{e.label}<ArrowRight size={13}/></span><button onClick={()=>onLocate(e.target)}>{model.nodes.find(n=>n.id===e.target)?.label}</button></div>)}{!model.edges.length&&<p>当前节点没有已记录的引用，原文结构仍可查阅。</p>}</div>}<div className="esi-relationship-tip"><Code2 size={13}/>点击节点选择并查看字段说明；“XML 原文”可定位来源。连线仅来自当前 Device 或 Module 的实际结构和引用。</div></section>
}

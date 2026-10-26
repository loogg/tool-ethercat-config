import { useMemo, useState } from 'react'
import { Background, MarkerType, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { ArrowRight, BookOpen, GitBranch, List } from 'lucide-react'
import { buildEsiFieldGraph, esiFieldDiagram } from '../lib/esi-field-graph.js'
import { useResponsiveDiagram } from '../lib/use-responsive-diagram.js'
import { RoutedHandles, ResponsiveViewport, DiagramStatus, DiagramControls } from './RoutedDiagram.jsx'
import { diagramNodes, diagramEdges, routedEdgeTypes } from './diagram-types.js'

function FieldNode({data}){const n=data.item,path=n.focal?n.path.split('/').filter(Boolean).slice(-4).join(' / ').replaceAll('[1]',''):n.path;return <><RoutedHandles ports={data.ports}/><div className={`esi-local-node ${n.focal?'focal':''}`}><small>{n.surface}<span>{n.role}</span></small><strong>{n.title}</strong><span className="esi-local-path" title={n.path}>{path}</span>{n.value!==undefined&&<code title={String(n.value)}>{String(n.value)}</code>}</div></>}
const nodeTypes={field:FieldNode}
export default function EsiFieldRelationGraph({row,context,onReference}){
  const model=useMemo(()=>buildEsiFieldGraph(row,context),[row,context])
  const [view,setView]=useState(()=>matchMedia('(max-width:720px)').matches?'list':'graph'),[selected,setSelected]=useState(null)
  const geometry=useMemo(()=>esiFieldDiagram(model),[model])
  const {attachCanvas,...diagram}=useResponsiveDiagram(geometry,{enabled:view==='graph'})
  const layout={nodes:diagramNodes(model.nodes.map(n=>({id:n.id,type:'field',data:{item:n},draggable:false})),diagram.layout),edges:diagramEdges(model.edges.map(e=>({...e,markerEnd:e.kind==='describe'?undefined:{type:MarkerType.ArrowClosed,width:14,height:14,color:'#6588b9'},style:{stroke:'#7896bd',strokeDasharray:e.kind==='describe'?'5 4':undefined},labelStyle:{fontSize:11,fill:'#557197'},labelBgStyle:{fill:'#fff'}})),diagram.layout)}

  const edge=model.edges.find(e=>e.id===selected)||model.edges[0]
  return <section className="esi-local-relations" aria-label="当前字段局部关系"><header><span><GitBranch size={14}/>只看当前字段</span><div><button aria-pressed={view==='graph'} onClick={()=>{setView('graph');diagram.resumeAuto()}}><GitBranch size={13}/>图</button><button aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={13}/>对应表</button></div></header>{view==='graph'?<div className="esi-local-canvas diagram-canvas" ref={attachCanvas}><DiagramStatus diagram={diagram}/><ReactFlowProvider><ReactFlow key={row.key} nodes={layout.nodes} edges={layout.edges} nodeTypes={nodeTypes} edgeTypes={routedEdgeTypes} onMove={diagram.onMove} minZoom={.1} maxZoom={1.4} nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null} onEdgeClick={(_,e)=>setSelected(e.id)} onNodeClick={(_,n)=>{const e=model.edges.find(e=>e.source===n.id||e.target===n.id);if(e)setSelected(e.id)}} zoomOnScroll={false} panOnScroll ariaLabelConfig={{'controls.zoomIn.ariaLabel':'放大当前字段关系','controls.zoomOut.ariaLabel':'缩小当前字段关系','controls.fitView.ariaLabel':'适应当前字段关系'}}><ResponsiveViewport diagram={diagram}/><Background gap={22} color="#dfe6ef"/><DiagramControls diagram={diagram} fitLabel="适应字段关系图"/></ReactFlow></ReactFlowProvider></div>:<div className="esi-local-list">{model.edges.map(e=><button key={e.id} className={edge?.id===e.id?'selected':''} onClick={()=>setSelected(e.id)}><span>{model.nodes.find(n=>n.id===e.source)?.title}</span><b>{e.label}<ArrowRight size={12}/></b><span>{model.nodes.find(n=>n.id===e.target)?.title}</span></button>)}</div>}{edge&&<div className="esi-local-condition"><strong>{edge.label}</strong><p>{edge.condition}</p>{edge.targetRef&&<button onClick={()=>onReference(edge.targetRef)}><BookOpen size={13}/>查看 {edge.targetRef.surface==='APP'?'应用定义':'SSC Tool'} 字段规则<ArrowRight size={12}/></button>}</div>}<small className="esi-inline-footnote">中心值来自当前 ESI；外部节点表示字段规则，对应工程尚未绑定。</small></section>
}

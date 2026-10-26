import { ConceptText } from './ConceptHelp.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, ControlButton, MarkerType } from '@xyflow/react'
import { ArrowRight, ArrowUpRight, Bookmark, BookOpen, Calculator, ChevronDown, Crosshair, Focus, GitBranch, Info, Layers3, List, PanelRightClose, PanelRightOpen, RotateCcw, Workflow, X } from 'lucide-react'
import { buildConfigGraph, filterConfigGraph, entryNode, configDiagram, matchGraphNode, nodeKindLabels, relationKinds } from '../lib/config-graph.js'
import { CopyButton } from './Article.jsx'
import Calculators from './Calculators.jsx'
import TimingWorkbench from './TimingWorkbench.jsx'
import { getTimingLesson } from '../lib/timing-scenes.js'
import { CrossSourceDialog } from './CrossSourceReferences.jsx'
import { contractsForEntry, crossSourceSelection } from '../lib/cross-source-model.js'
import '@xyflow/react/dist/style.css'
import './config-graph.css'
import { useResponsiveDiagram } from '../lib/use-responsive-diagram.js'
import { RoutedHandles, ResponsiveViewport, DiagramStatus, DiagramControls } from './RoutedDiagram.jsx'
import { routedEdgeTypes, nodeHandles } from './diagram-types.js'

function FieldNode({ data }) {
  const item = data.item
  return <><RoutedHandles ports={item.ports} /><div className={`field-node kind-${item.kind} ${data.focal ? 'focal-node' : ''} ${data.dimmed ? 'dimmed-node' : ''} ${item.compact ? 'compact-subentry' : ''} ${item.status ? 'error-node' : ''}`} style={{ height: item.nodeHeight || 148 }}>
    <div className="field-node-top"><span className="node-surface">{item.position.surface}</span><span className="node-kind">{item.status === 'over-capacity' ? '容量不足' : item.status === 'invalid' ? '输入待修正' : data.focal ? '当前配置' : nodeKindLabels[item.kind]}</span></div>
    <div className="node-parent" title={item.position.parent}>{item.position.parent}</div>
    <strong className="node-key" title={item.name}>{item.name}</strong>
    <div className="node-fields">{item.fields.slice(0, 2).map((field, i) => <div key={i}><span>{field.label}</span><strong title={field.value}>{field.value}</strong></div>)}</div>
  </div></>
}
function ObjectContainer({ data }) {
  const item = data.item
  return <><RoutedHandles ports={item.ports} /><div className={`object-container ${data.dimmed ? 'dimmed-node' : ''}`}><div className="object-container-type"><span>CoE 对象 · Index 16 bit</span><span>{item.scope}</span></div><strong>{item.name}</strong><div className="object-index-bytes"><span>15:8 <b>0x{(item.addressParts.index >> 8).toString(16).toUpperCase().padStart(2, '0')}</b></span><span>7:0 <b>0x{(item.addressParts.index & 255).toString(16).toUpperCase().padStart(2, '0')}</b></span><small>↓ 子索引 SubIndex</small></div></div></>
}
const nodeTypes = { field: FieldNode, objectContainer: ObjectContainer }

function AddressBreakdown({ node }) {
  if (!node.addressParts) return null
  const { index, subIndex } = node.addressParts
  const hex = value => `0x${value.toString(16).toUpperCase().padStart(2, '0')}`
  return <section className="address-breakdown"><h3>地址组成</h3><div className="index-breakdown"><span><small>Index 高字节 · 15:8</small><strong>{hex(index >> 8)}</strong></span><span><small>Index 低字节 · 7:0</small><strong>{hex(index & 255)}</strong></span></div>{subIndex !== undefined && <div className="subindex-breakdown"><span>SubIndex · 独立的 8 bit</span><strong>{hex(subIndex)}</strong></div>}<p>Index 的两个字节组成对象索引；冒号后的 SubIndex 选择对象内的子项。</p>{node.valueBits !== null && node.valueBits !== undefined && <><h3>UINT32 数值位段</h3><code>0x{node.valueBits.toString(16).toUpperCase().padStart(8, '0')}</code><div className="value-byte-breakdown">{[24, 16, 8, 0].map(shift => <span key={shift}><small>{shift + 7}:{shift}</small><strong>{hex(Math.floor(node.valueBits / 2 ** shift) % 256)}</strong></span>)}</div><p>按高位到低位展示数值分段，传输字节顺序需另按协议判断。</p></>}</section>
}

function BufferBreakdown({ model, settings, onChange }) {
  const hex = value => `0x${value.toString(16).toUpperCase().padStart(4, '0')}`
  return <section className="buffer-breakdown"><h3>SM 缓冲与预留</h3><div className="buffer-settings"><label>缓冲模式<select aria-label="SM 演算缓冲模式" value={settings.buffers} onChange={e => onChange('buffers', e.target.value)}><option value="3">三缓冲 × 3</option><option value="1">单缓冲 × 1</option></select></label><label>ESC 内部处理宽度<select aria-label="SM 演算内部字宽" value={settings.internalWidth} onChange={e => onChange('internalWidth', e.target.value)}><option value="8">8 bit</option><option value="16">16 bit</option><option value="32">32 bit</option><option value="64">64 bit</option></select></label><label>SM 起始地址 A<input aria-label="SM 演算起始地址" value={settings.start} onChange={e => onChange('start', e.target.value)} /></label></div>{model.valid ? <><dl><div><dt>SM Length · 当前活动长度</dt><dd>{model.actual.length} Byte</dd></div><div><dt>每缓冲物理跨度 B</dt><dd>{model.actual.bufferSpan} Byte</dd></div><div><dt>实际物理占用</dt><dd>{model.actual.bufferSpan} × {model.actual.effectiveBuffers} = {model.actual.allocated} Byte</dd></div><div><dt>按最大容量 {model.reserved.length} Byte 预留</dt><dd>{model.reserved.bufferSpan} × {model.reserved.effectiveBuffers} = {model.reserved.allocated} Byte</dd></div></dl><div className="buffer-banks">{Array.from({ length: model.actual.effectiveBuffers }, (_, i) => <div key={i}><span>缓冲 {i}</span><strong>{model.actual.bufferSpan} B</strong><small>{hex(model.actual.physicalStart + i * model.actual.bufferSpan)}–{hex(model.actual.physicalStart + (i + 1) * model.actual.bufferSpan)}</small></div>)}</div><div className="buffer-formula"><code>W = 内部字宽 / 8 = {model.wordBytes} B</code><code>A₀ = floor(A / W) × W</code><code>B = ceil((A + L) / W) × W − A₀</code><code>总占用 = B × 有效缓冲数</code></div><p>三缓冲增加 ESC 存储占用，不表示每周期发送三份 PDO。Length 字段仍写 L。</p>{model.actual.singleByteMode && <p className="buffer-exception">Length = 1 时额外两个缓冲不使用；本例有效缓冲数为 1。</p>}{!model.actual.active && <p className="buffer-exception">Length = 0：该方向停用，不占缓冲空间。</p>}<p>地址上界不包含。内部字宽需查具体ESC，不等于MCU/PDI访问宽度；这里只演算单通道，多通道重叠和实际RAM容量请用完整计算器检查。</p></> : <p className="scenario-error" role="alert">{model.error}</p>}</section>
}

function MappingBreakdown({ parts }) {
  if (!parts) return null
  const hex = (value, width) => `0x${value.toString(16).toUpperCase().padStart(width, '0')}`
  return <section className="mapping-breakdown"><h3>32 bit 映射条目</h3><div className="mapping-parts"><div><small>31:16 · Index</small><strong>{hex(parts.index, 4)}</strong><span>16 bit</span></div><div><small>15:8 · SI</small><strong>{hex(parts.subIndex, 2)}</strong><span>8 bit</span></div><div><small>7:0 · BitLen</small><strong>{hex(parts.bitLength, 2)}</strong><span>{parts.bitLength} bit</span></div></div><code>(Index × 65536) + (SubIndex × 256) + BitLen</code><p>Index内部还可拆高/低字节；它与独立的SubIndex、BitLen字段分别解释。位域分段不等于传输字节顺序。</p></section>
}

function ControlByteBreakdown({ decoded }) {
  if (!decoded) return null
  return <section className="control-byte-breakdown"><h3>控制字节 · {decoded.hex}</h3><div className="control-byte-bits">{decoded.bits.map(bit => <span key={bit.bit} className={bit.value ? 'set-bit' : ''}><small>{bit.bit}</small><strong>{bit.value}</strong></span>)}</div><dl><div><dt>bits 1:0</dt><dd>{decoded.modeLabel}</dd></div><div><dt>bits 3:2</dt><dd>{decoded.directionLabel}</dd></div><div><dt>bit 4 / 5</dt><dd>ECAT事件{decoded.ecatEvent ? '开' : '关'} / AL事件{decoded.alEvent ? '开' : '关'}</dd></div><div><dt>bit 6</dt><dd>{decoded.watchdogTrigger ? '允许触发过程数据看门狗' : '不触发看门狗'}</dd></div><div><dt>bit 7</dt><dd>按型号和Feature能力判断</dd></div></dl></section>
}

function CalculatorDialog({ tool, onClose, onNavigate, initialContext }) {
  const dialog = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    dialog.current?.showModal()
    return () => { previous?.focus?.({ preventScroll: true }) }
  }, [])
  return <dialog ref={dialog} className="calculator-dialog" aria-label="配置计算器" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}><div className="calculator-dialog-top"><span><Calculator size={17} />配置计算器</span><button className="icon-button" aria-label="关闭计算器" onClick={onClose}><X size={19} /></button></div><div className="calculator-dialog-content"><Calculators initialTool={tool} initialContext={initialContext} onNavigate={id => { onClose(); onNavigate(id) }} embedded /></div></dialog>
}

function ReferenceDetails({ references = [] }) {
  return <details className="inspector-references"><summary><BookOpen size={14} />来源与版本<ChevronDown size={13} /></summary>{references.map((ref, i) => <a key={i} href={ref.url} target="_blank" rel="noreferrer"><span>{ref.title}{ref.note && <small>{ref.note}</small>}</span><ArrowUpRight size={13} /></a>)}</details>
}

function Inspector({ node, link, graph, entry, onSelect, onNavigate, onCalculate, onClose, onFeedback, memorySettings, onMemoryChange }) {
  if (link) {
    const source = graph.nodes.find(n => n.id === link.source)
    const target = graph.nodes.find(n => n.id === link.target)
    return <aside className="graph-inspector" aria-label="关系检查器"><div className="inspector-top"><span><GitBranch size={15} />关系</span><button className="icon-button" aria-label="收起检查器" onClick={onClose}><PanelRightClose size={17} /></button></div><span className={`relation-kind kind-${link.kind}`}>{relationKinds[link.kind].label}</span><h2>{link.label}</h2><div className="inspector-endpoints"><button onClick={() => onSelect({ type: 'node', id: source.id })}><small>{source.position.surface} · {source.position.parent}</small><strong>{source.name}</strong></button><ArrowRight size={16} /><button onClick={() => onSelect({ type: 'node', id: target.id })}><small>{target.position.surface} · {target.position.parent}</small><strong>{target.name}</strong></button></div><p>{link.description}</p>{link.condition && <div className="inspector-condition"><Info size={14} /><span>{link.condition}</span></div>}<ReferenceDetails references={link.references} /></aside>
  }
  return <aside className="graph-inspector" aria-label="节点检查器"><div className="inspector-top"><span><Info size={15} />{node.id === graph.rootId ? '当前配置' : nodeKindLabels[node.kind]}</span><button className="icon-button" aria-label="收起检查器" onClick={onClose}><PanelRightClose size={17} /></button></div><div className="inspector-path">{node.position.surface}<ChevronDown size={11} /><span>{node.position.parent}</span></div><h2>{node.name}</h2><p className="inspector-summary"><ConceptText>{node.brief}</ConceptText></p><dl className="inspector-facts">{node.fields.map((f, i) => <div key={i}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
    {node.rules.length > 0 && <section className="inspector-rules"><h3>关键条件</h3><ul>{node.rules.slice(0, 2).map((rule, i) => <li key={i}>{rule.replace(/^典型误用：/, '注意：')}</li>)}</ul></section>}
    {node.entryId && node.entryId !== entry.id && <button className="inspector-primary" onClick={() => onNavigate(node.entryId)}>以此配置为中心<ArrowRight size={14} /></button>}
    {(node.id === graph.rootId || node.bufferModel || node.mappingParts || node.controlByte || (node.kind === 'calculation' && entry.calculator === 'watchdog')) && (entry.calculator || graph.calculator) && <button className="inspector-primary" onClick={() => onCalculate(node.mappingParts ? 'mapping' : node.controlByte ? 'control' : node.bufferModel ? 'memory' : entry.calculator || graph.calculator)}><Calculator size={15} />打开完整计算器</button>}
    <AddressBreakdown node={node} />
    <MappingBreakdown parts={node.mappingParts} />
    <ControlByteBreakdown decoded={node.controlByte} />
    {node.bufferModel && <BufferBreakdown model={node.bufferModel} settings={memorySettings} onChange={onMemoryChange} />}
    <div className="inspector-copy"><CopyButton text={node.identifier || node.name} label="复制标识" onFeedback={onFeedback} /></div>
    {node.entry && <details className="inspector-more"><summary>更多说明<ChevronDown size={13} /></summary><h3>位置</h3>{node.entry.sources.map((source, i) => <code key={i}>{source.path}</code>)}{node.entry.details?.map((text, i) => <p key={i}>{text}</p>)}{node.rules.slice(2).map((text, i) => <p key={i}>{text}</p>)}{node.entry.example && <div className="inspector-example"><div><span>配置示例</span><CopyButton text={node.entry.example.code} iconOnly label="复制示例" onFeedback={onFeedback} /></div><pre>{node.entry.example.code}</pre><small>{node.entry.example.caption}</small></div>}</details>}
    <ReferenceDetails references={node.references} />
  </aside>
}

function ScenarioBar({ graph, cycleValue, setCycleValue, bitLengths, setBitLengths, capacity, setCapacity }) {
  if (!graph.sample) return null
  const scenario = graph.scenario
  return <section className={`graph-scenario ${!scenario.valid ? 'has-error' : ''}`} aria-label="关系演算示例"><div className="scenario-label"><Calculator size={15} /><span>演算示例</span></div>
    {graph.sample === 'cycle' ? <><label>宏值 · ns<input aria-label={`${graph.rootId.replaceAll('-', '_').toUpperCase()} 演算值`} value={cycleValue} onChange={e => setCycleValue(e.target.value)} inputMode="numeric" /></label><div className="scenario-presets"><button aria-pressed={scenario.valid && !scenario.measured} onClick={() => setCycleValue('100000')}>固定值</button>{graph.supportsMeasurement !== false && <button aria-pressed={scenario.measured} onClick={() => setCycleValue('0')}>0 · 运行测量</button>}</div>{scenario.valid && <output>{scenario.measured ? '0 选择测量路径，不表示耗时为 0' : `${scenario.ns.toLocaleString('en-US')} ns = ${scenario.microseconds.toLocaleString('en-US')} µs`}</output>}</> : <><label>活动字段 · bit<input aria-label="活动字段位长" value={bitLengths} onChange={e => setBitLengths(e.target.value)} placeholder="16, 32" /></label><label>容量 · Byte<input aria-label="容量上限（Byte）" value={capacity} onChange={e => setCapacity(e.target.value)} inputMode="numeric" /></label>{scenario.valid && <output className={scenario.fits ? 'scenario-pass' : 'scenario-fail'}>{scenario.totalBits} bit → {scenario.bytes} B · {scenario.bytes} {scenario.fits ? '≤' : '>'} {scenario.capacity} B<span>{scenario.fits ? '容量满足' : '超出容量'}</span></output>}</>}
    {!scenario.valid && <p role="alert" className="scenario-error">{scenario.error}</p>}
  </section>
}

function GraphContent({ entry, entries, onNavigate, saved, onSave, onFeedback, highlightQuery = '' }) {
  const [expanded, setExpanded] = useState(false)
  const [cycleValue, setCycleValue] = useState('100000')
  const [bitLengths, setBitLengths] = useState('16, 32')
  const [capacity, setCapacity] = useState('16')
  const [memory, setMemory] = useState({ buffers: '3', internalWidth: '8', start: '0x1200' })
  const [preference, setPreference] = useState('auto')
  const [view, setView] = useState(() => entry.id === 'esc-sm-wd-supported' ? 'timing' : window.matchMedia('(max-width: 720px)').matches ? 'list' : 'graph')
  const timingLesson = getTimingLesson(entry.id)
  const [showInspector, setShowInspector] = useState(false)
  const [calculatorTool, setCalculatorTool] = useState('')
  const [watchdogContext, setWatchdogContext] = useState(null)
  const [crossOpen, setCrossOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [selection, setSelection] = useState(() => ({ type: 'node', id: null }))
  const flowRef = useRef(null)
  const graph = useMemo(() => buildConfigGraph(entry, entries, { expanded, cycleValue, bitLengths, capacity, memory }), [entry, entries, expanded, cycleValue, bitLengths, capacity, memory])
  const filtered = useMemo(() => filterConfigGraph(graph, filter), [graph, filter])
  const model = useMemo(() => configDiagram(filtered), [filtered])
  const { attachCanvas, ...diagram } = useResponsiveDiagram(model, { preference, enabled: view === 'graph' })
  const layout = useMemo(() => {
    if (!diagram.layout) return { direction: diagram.direction, width: 0, height: 0, nodes: [], edges: [] }
    const byId = new Map(diagram.layout.nodes.map(node => [node.id, node]))
    return { ...diagram.layout, nodes: filtered.nodes.map(node => ({ ...node, ...byId.get(node.id) })) }
  }, [diagram.layout, diagram.direction, filtered])
  const selectedId = selection.id || matchGraphNode(graph, highlightQuery) || graph.rootId
  const selectedEdge = selection.type === 'edge' ? filtered.edges.find(e => e.id === selectedId) : null
  const selectedNode = filtered.nodes.find(n => n.id === selectedId) || graph.nodes.find(n => n.id === graph.rootId)
  const emphasized = selectedEdge ? new Set([selectedEdge.source, selectedEdge.target]) : null
  const nodes = layout.nodes.map(item => ({ id: item.id, type: item.isGroup ? 'objectContainer' : 'field', parentId: item.parentId, extent: item.parentId ? 'parent' : undefined, style: { width: item.width, height: item.height }, initialWidth: item.width, initialHeight: item.height, handles: nodeHandles(item), position: { x: item.x, y: item.y }, data: { item, focal: item.id === graph.rootId, dimmed: emphasized && !emphasized.has(item.id) && !graph.nodes.some(child => child.parentId === item.id && emphasized.has(child.id)) }, selected: !selectedEdge && item.id === selectedNode.id, draggable: false, connectable: false, selectable: true, ariaLabel: `${item.position.surface} ${item.position.parent} ${item.name}` }))
  const edges = layout.edges.map(route => { const link = filtered.edges.find(edge => edge.id === route.id); return ({ id: link.id, source: link.source, target: link.target, sourceHandle: route.sourceHandle, targetHandle: route.targetHandle, type: 'routed', data: { route }, label: link.label, selected: link.id === selectedEdge?.id, style: { stroke: link.failed ? '#bd5b42' : link.id === selectedEdge?.id ? '#2563eb' : relationKinds[link.kind].color, strokeWidth: link.id === selectedEdge?.id ? 2.4 : 1.5, strokeDasharray: relationKinds[link.kind].directed ? undefined : '5 4' }, markerEnd: relationKinds[link.kind].directed ? { type: MarkerType.ArrowClosed, color: link.failed ? '#bd5b42' : relationKinds[link.kind].color, width: 16, height: 16 } : undefined, labelStyle: { fill: '#4d6079', fontSize: 12, fontWeight: 500 }, labelBgStyle: { fill: '#fff', fillOpacity: .96 }, labelBgPadding: [7, 5], labelBgBorderRadius: 4, interactionWidth: 24, ariaLabel: `${link.label}：${(graph.nodes.find(n => n.id === link.source)?.identifier || graph.nodes.find(n => n.id === link.source)?.name)} 到 ${(graph.nodes.find(n => n.id === link.target)?.identifier || graph.nodes.find(n => n.id === link.target)?.name)}` }) })


  function select(next) { setSelection(next); setShowInspector(true) }
  function openCalculator(tool, parameters = null) { setWatchdogContext(parameters); setCalculatorTool(tool) }
  function handleCanvasKey(event) {
    if (!['Enter', ' '].includes(event.key)) return
    const node = event.target.closest?.('.react-flow__node')
    const link = event.target.closest?.('.react-flow__edge')
    if (!node && !link) return
    event.preventDefault(); event.stopPropagation()
    select({ type: node ? 'node' : 'edge', id: (node || link).getAttribute('data-id') })
  }
  function focusCurrent() {
    setSelection({ type: 'node', id: graph.rootId })
    const root = layout.nodes.find(n => n.id === graph.rootId)
    if (!root) return
    diagram.pauseAuto()
    flowRef.current?.setCenter(root.x + 129, root.y + 74, { zoom: 1, duration: 180 })
  }
  const header = entryNode(entry)
  const calculatorContext = { watchdog: watchdogContext, mappingWord: graph.nodes.find(node => node.mappingParts)?.mappingParts.word !== undefined ? `0x${graph.nodes.find(node => node.mappingParts).mappingParts.word.toString(16)}` : undefined, controlByte: graph.nodes.find(node => node.controlByte)?.controlByte.hex, memory: graph.buffer?.valid ? { ...memory, smIndex: entry.id === 'max-pd-input-size' ? 3 : 2, length: String(graph.scenario.bytes) } : undefined }
  return <section className={`config-workspace ${showInspector ? '' : 'inspector-hidden'}`} aria-label="配置关系工作台">
    <header className="config-titlebar"><div><h1>{entry.name}</h1><span>{entry.title.replace(`${entry.name}：`, '')}</span></div><div className="config-title-actions">{contractsForEntry(entry.id).length>0&&<button className="config-cross-trigger" onClick={()=>setCrossOpen(true)}><GitBranch size={14}/>跨文件对应</button>}<button className={`icon-button ${saved ? 'is-saved' : ''}`} onClick={() => onSave(entry.id)} aria-label={saved ? '取消收藏此配置' : '收藏此配置'} aria-pressed={saved}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button><CopyButton iconOnly text={`${location.href.split('#')[0]}#/entry/${entry.id}`} label="复制配置链接" onFeedback={onFeedback} /></div></header>
    <div className="graph-workbench"><div className="graph-main"><div className="graph-toolbar"><span className="graph-title"><Workflow size={15} />{view === 'timing' ? '时序理解' : '配置关系'}<span title={graph.profile.rationale}>{graph.profile.label}</span>{view !== 'timing' && <span>{filtered.nodes.length} 节点</span>}</span><div className="graph-view-switch" aria-label="关系呈现"><button aria-pressed={view === 'graph'} onClick={() => { setView('graph'); diagram.resumeAuto() }}><GitBranch size={14} />图</button><button aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={14} />列表</button>{timingLesson && <button aria-pressed={view === 'timing'} onClick={() => { setView('timing'); setShowInspector(false) }}>时序图示</button>}</div>{view !== 'timing' && <><label className="graph-direction"><span className="sr-only">排列方向</span><select aria-label="排列方向" value={preference} onChange={e => setPreference(e.target.value)}><option value="auto">自动 · {layout.direction === 'LR' ? '横向' : '纵向'}</option><option value="horizontal">横向 →</option><option value="vertical">纵向 ↓</option></select></label><label className="graph-filter"><span className="sr-only">关系筛选</span><select aria-label="关系筛选" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部关系</option><option value="directed">有向关系</option><option value="described">描述与对应</option></select></label><button className="icon-button" aria-label={showInspector ? '收起检查器' : '展开检查器'} onClick={() => setShowInspector(!showInspector)}>{showInspector ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}</button></>}</div>
      <div className={`graph-canvas diagram-canvas ${view === 'list' ? 'outline-mode' : view === 'timing' ? 'watchdog-timing-mode' : ''}`} ref={attachCanvas} onKeyDownCapture={handleCanvasKey}>
        {view === 'timing' ? <TimingWorkbench key={timingLesson} lesson={timingLesson} focusId={entry.id} onCalculate={parameters => openCalculator('watchdog', parameters)} /> : view === 'graph' ? <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={routedEdgeTypes} onMove={diagram.onMove} minZoom={.1} maxZoom={1.6} onInit={api => { flowRef.current = api }} onNodeClick={(_, node) => select({ type: 'node', id: node.id })} onEdgeClick={(_, link) => select({ type: 'edge', id: link.id })} onNodeDoubleClick={(_, node) => node.data.item.entryId && node.id !== graph.rootId && onNavigate(node.data.item.entryId)} onPaneClick={() => setSelection({ type: 'node', id: graph.rootId })} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} panOnScroll zoomOnScroll={false} zoomOnDoubleClick={false} elevateEdgesOnSelect edgesFocusable nodesFocusable ariaLabelConfig={{ 'node.a11yDescription.default': '按 Enter 选择节点；使用列表视图阅读全部关系。', 'edge.a11yDescription.default': '按 Enter 选择关系；可在检查器阅读条件。', 'controls.zoomIn.ariaLabel': '放大关系图', 'controls.zoomOut.ariaLabel': '缩小关系图', 'controls.fitView.ariaLabel': '适应视图' }}>
          <ResponsiveViewport diagram={diagram} /><Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d7dee8" /><DiagramControls diagram={diagram}><ControlButton onClick={focusCurrent} title="定位当前配置" aria-label="定位当前配置"><Crosshair size={16} /></ControlButton><ControlButton onClick={() => { diagram.pauseAuto(); flowRef.current?.zoomTo(1) }} title="100% 阅读" aria-label="100% 阅读"><Focus size={15} /></ControlButton></DiagramControls>
        </ReactFlow> : <div className="graph-outline"><div className="outline-root"><small>{header.position.surface} › {header.position.parent}</small><strong>{entry.name}</strong><p>{header.brief}</p></div>{filtered.edges.map(link => <button className={`outline-relation ${selectedEdge?.id === link.id || (!selectedEdge && selectedNode.id !== graph.rootId && [link.source, link.target].includes(selectedNode.id)) ? 'selected' : ''}`} key={link.id} onClick={() => select({ type: 'edge', id: link.id })}><span className="relation-kind">{link.label}</span><span>{graph.nodes.find(n => n.id === link.source)?.name}<ArrowRight size={13} />{graph.nodes.find(n => n.id === link.target)?.name}</span><small className="outline-paths">{graph.nodes.find(n => n.id === link.source)?.position.surface} › {graph.nodes.find(n => n.id === link.source)?.position.parent} → {graph.nodes.find(n => n.id === link.target)?.position.surface} › {graph.nodes.find(n => n.id === link.target)?.position.parent}</small><small>{link.description}</small></button>)}{!filtered.edges.length && <p className="graph-empty">当前筛选下没有关联；可选择“全部关系”或查阅右侧说明。</p>}</div>}
        {view === 'graph' && <DiagramStatus diagram={diagram} />}
        {view === 'graph' && !filtered.edges.length && <div className="graph-empty-floating">本项暂无已记录的直接连线。说明与来源可在检查器中查看。</div>}
        {graph.extraCount > 0 && <button className="graph-expand" onClick={() => setExpanded(true)}>展开更多{graph.sample === 'capacity' ? '来源' : '关联'}<span>+{graph.extraCount}</span></button>}
        {expanded && <button className="graph-expand" onClick={() => setExpanded(false)}><RotateCcw size={13} />回到直接关系</button>}
      </div>
      {view !== 'timing' && <div className="graph-caption"><span><i className="legend-line" />有向关系</span><span><i className="legend-line dashed" />描述 / 对应</span><span className="graph-caption-hint">点击节点或连线查看详情 · 拖动画布浏览</span></div>}
      {view !== 'timing' && <ScenarioBar graph={graph} cycleValue={cycleValue} setCycleValue={setCycleValue} bitLengths={bitLengths} setBitLengths={setBitLengths} capacity={capacity} setCapacity={setCapacity} />}
      {view !== 'timing' && graph.buffer && <button className="graph-memory-summary" aria-label="查看 SM 缓冲占用计算" onClick={() => select({ type: 'node', id: 'rule-active-length' })}><Layers3 size={15} /><span>SM 缓冲</span>{graph.buffer.valid ? <><span>实际 <strong>{graph.buffer.actual.bufferSpan} × {graph.buffer.actual.effectiveBuffers} = {graph.buffer.actual.allocated} B</strong></span><span>按容量预留 <strong>{graph.buffer.reserved.bufferSpan} × {graph.buffer.reserved.effectiveBuffers} = {graph.buffer.reserved.allocated} B</strong></span></> : <span className="scenario-error">{graph.buffer.error}</span>}<ArrowRight size={14} /></button>}
      <div className="graph-context-note"><Info size={13} /><span>{graph.contextNote}</span></div>
    </div>{showInspector && <Inspector node={selectedNode} link={selectedEdge} graph={graph} entry={entry} onSelect={select} onNavigate={onNavigate} onCalculate={tool => openCalculator(tool)} onClose={() => setShowInspector(false)} onFeedback={onFeedback} memorySettings={memory} onMemoryChange={(key, value) => setMemory(previous => ({ ...previous, [key]: value }))} />}</div>
    {crossOpen&&<CrossSourceDialog selection={crossSourceSelection({entryId:entry.id})} onClose={()=>setCrossOpen(false)} onNavigate={onNavigate}/>} {calculatorTool && <CalculatorDialog tool={calculatorTool} initialContext={calculatorContext} onClose={() => setCalculatorTool('')} onNavigate={onNavigate} />}
  </section>
}

export default function ConfigGraph(props) { return <ReactFlowProvider><GraphContent {...props} /></ReactFlowProvider> }

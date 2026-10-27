import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, Check, Info, RotateCcw, X } from 'lucide-react'
import { sdoAccessEvidence, sdoRequestDefaults, sdoTeachingObject } from '../data/sdo-access.js'
import { byteText, deriveSdoAccess, subIndexText, valueText, requestForSdoMember, requestForSdoMode } from '../lib/sdo-access-model.js'
import './sdo-access.css'

function Payload({ plan, selected, paddingSelected, onSelect, onPadding }) {
  if (!plan.valid) return <div className="sdo-no-payload"><Info size={20}/><strong>{plan.kind === 'abort' ? '访问已中止' : '尚无可展示的载荷'}</strong><p>协议条目和本地占位仍可查阅；此请求没有成功的数据载荷。</p></div>
  const columns = `repeat(${plan.byteLength}, var(--sdo-byte-width))`
  return <><div className="sdo-payload-grid" role="group" aria-label="载荷逐字节布局"><p className="sdo-byte-scale">每格 1 Byte</p><div className="sdo-byte-axis" style={{ gridTemplateColumns: columns }}>{plan.bytes.map((_, i) => <span key={i}>Byte {i}</span>)}</div><div className="sdo-byte-track" style={{ gridTemplateColumns: columns }} aria-label="SDO对象数据字节">
    {plan.segments.flatMap(segment => segment.bytes.map((byte, i) => {
      const padding = segment.role === 'ca-padding', active = padding ? paddingSelected : !paddingSelected && segment.subIndex === selected
      return <button key={`${segment.id}-${i}`} className={`${padding ? 'padding-byte' : ''} ${active ? 'selected' : ''}`} aria-pressed={active} aria-label={`载荷Byte ${segment.byteOffset + i}：${padding ? 'CA对齐填充' : subIndexText(segment.subIndex)}，${byteText(byte)}`} onClick={padding ? onPadding : () => onSelect(segment.subIndex)} title={`${segment.name} · Byte ${segment.byteOffset + i}`}><strong>{byteText(byte)}</strong><small>{padding ? '填充' : subIndexText(segment.subIndex)}</small></button>
    }))}
  </div><div className="sdo-segment-labels" style={{ gridTemplateColumns: columns }}>{plan.segments.map(segment => <span key={segment.id} className={segment.role === 'ca-padding' ? 'padding-label' : ''} style={{ gridColumn: `span ${segment.byteLength}` }}>{segment.role === 'ca-padding' ? '对齐' : subIndexText(segment.subIndex)}<small>{segment.byteLength} Byte</small></span>)}</div></div><p className="sdo-hex-line"><span>小端对象数据</span><code>{plan.bytes.map(byteText).join(' ')}</code></p></>
}

function CurrentMember({ selected, local, transfer, plan, paddingSelected, request }) {
  if (!selected) return <section className="sdo-selected-detail" aria-label="当前成员三层对应"><h3>当前请求未定位到条目</h3><p>{plan.start === null ? '请输入有效的起始SI，再查看该成员的对应关系。' : `当前对象没有${subIndexText(plan.start)}，不会以SI0代替显示。`}</p></section>
  const hasPadding = plan.segments.some(segment => segment.role === 'ca-padding')
  return <section className="sdo-selected-detail" aria-label="当前成员三层对应"><h3>{paddingSelected ? `CA对齐填充 · ${hasPadding ? '独立派生段' : '本次未传'}` : `${subIndexText(selected.subIndex)} ${selected.name}`}<span>{request.mode === 'single' ? '当前单项请求的成员' : '当前查看的成员 · CA范围由上方起点决定'}</span></h3>{paddingSelected ? <p>{!hasPadding && '当前请求没有这一填充段。'}这个零字节只出现在包含SI0的CA载荷中；它不是新子索引，也不是SI0额外的有效值位，更不会自动加入PDO。</p> : <dl><div><dt>协议定义</dt><dd>{selected.type} · {selected.logicalBits} bit</dd></div><div><dt>本次载荷</dt><dd>{!plan.valid ? '访问未成功' : transfer ? `偏移 ${transfer.byteOffset} · ${transfer.byteLength} Byte有效值${selected.role === 'header' && hasPadding ? ' + 1 Byte填充' : ''}` : '本次不传此项'}</dd></div><div><dt>本地分配</dt><dd>{local.cType} · {local.allocatedBits} bit · 偏移 {local.byteOffset}</dd></div></dl>}</section>
}

export default function SdoAccessWorkbench({ initialShape = 'RECORD', origin = '', values, onValues }) {
  const interactionId = useId()
  const initial = ['ARRAY', 'RECORD', 'VARIABLE'].includes(initialShape) ? initialShape : 'RECORD'
  const [localShape, setLocalShape] = useState(initial)
  const shape = values?.shape && ['ARRAY', 'RECORD', 'VARIABLE'].includes(values.shape) ? values.shape : localShape
  const [localRequest, setLocalRequest] = useState(() => ({ ...sdoRequestDefaults, mode: initial === 'VARIABLE' ? 'single' : 'complete' }))
  const request = values ? Object.fromEntries(Object.keys(sdoRequestDefaults).map(key => [key, values[key] ?? sdoRequestDefaults[key]])) : localRequest
  function setRequest(update) { const next = typeof update === 'function' ? update(request) : update; if (onValues) onValues(next); else setLocalRequest(next) }
  function setShape(next) { if (onValues) onValues({shape: next}); else setLocalShape(next); setSelection('entry-0') }
  const [selection, setSelection] = useState(() => {
    const start = Number(values?.start ?? 0)
    return `entry-${[0, 1, 2].includes(start) && (shape !== 'VARIABLE' || start === 0) ? start : 0}`
  })
  const object = sdoTeachingObject(shape), plan = deriveSdoAccess(object, request)
  const paddingSelected = request.mode === 'complete' && selection === 'padding'
  const focused = object.entries.find(entry => `entry-${entry.subIndex}` === selection) || object.entries[0]
  const selected = request.mode === 'single' ? object.entries.find(entry => entry.subIndex === plan.start) : focused
  const local = plan.storage.rows.find(row => row.subIndex === selected?.subIndex)
  const transfer = plan.segments.find(segment => segment.role === 'entry' && segment.subIndex === selected?.subIndex)
  function selectMember(si) { setSelection(`entry-${si}`); if (request.mode === 'single') setRequest(previous => requestForSdoMember(previous, si)) }
  function changeMode(mode) { setRequest(previous => requestForSdoMode(previous, mode, selected?.subIndex)); if (selected) setSelection(`entry-${selected.subIndex}`) }
  function patch(key, value) { setRequest(previous => ({ ...previous, [key]: value })) }
  function scenario(mode, start) { setRequest(previous => ({ ...previous, mode, start: String(start) })); setSelection(`entry-${start}`) }
  function reset() {
    const next = { ...sdoRequestDefaults, mode: initial === 'VARIABLE' ? 'single' : 'complete' }
    if (onValues) onValues({ shape: initial, ...next })
    else { setLocalShape(initial); setLocalRequest(next) }
    setSelection('entry-0')
  }
  return <section className="sdo-access-workbench" aria-label="SDO访问与布局工作台"><header className="sdo-workbench-heading"><div><h2>同一条目，三种占位</h2><p>先看条目定义，再用请求决定传什么；本地存储单独核对。</p></div><button className="sdo-reset" onClick={reset}><RotateCcw size={13}/>恢复教学值</button></header>
    <div className="sdo-example-scope"><Info size={14}/><span>{origin && <>查阅入口：<strong>{origin}</strong>。 </>}下方是独立教学对象 <code>0x{object.index.toString(16).toUpperCase()}</code>，使用教学值，未绑定当前工程或设备。</span></div>
    <div className="sdo-request-controls"><label>对象组织<select aria-label="SDO教学对象组织" value={shape} onChange={event => setShape(event.target.value)}><option>RECORD</option><option>ARRAY</option><option>VARIABLE</option></select></label><fieldset><legend>访问方式</legend><div><button aria-pressed={request.mode === 'single'} onClick={() => changeMode('single')}>单项访问</button><button aria-pressed={request.mode === 'complete'} onClick={() => changeMode('complete')}>完整访问 CA</button></div></fieldset><label>起始SI · 0…255<input title="支持十进制或0x十六进制" placeholder="0 / 0x00" aria-label="SDO起始子索引" value={request.start} inputMode="numeric" onChange={event => patch('start', event.target.value)} spellCheck={false}/></label><label>操作<select aria-label="SDO读写操作" value={request.operation} onChange={event => patch('operation', event.target.value)}><option value="read">Upload · 读</option><option value="write">Download · 写</option></select></label></div>
    <div className="sdo-request-tools"><div className="sdo-request-presets" aria-label="访问场景快捷选择"><button onClick={() => scenario('single', 0)}>单项 SI0</button><button onClick={() => scenario('complete', 0)}>CA 从 0</button><button onClick={() => scenario('complete', 1)}>CA 从 1</button><button onClick={() => scenario('complete', 2)}>验证 CA 从 2</button><button onClick={() => scenario('single', 2)}>对比单项 SI2</button></div>
    <details className="sdo-preconditions"><summary>访问前提 <span>{request.completeSupported ? 'CA开关开' : 'CA开关关'} · {request.permission} · {request.state}</span></summary><div><label><input type="checkbox" checked={request.completeSupported} onChange={event => patch('completeSupported', event.target.checked)}/>示例栈已启用CA能力</label><label>统一权限<select aria-label="SDO教学权限" value={request.permission} onChange={event => patch('permission', event.target.value)}><option value="rw">rw · 可读写</option><option value="ro">ro · 只读</option><option value="wo">wo · 只写</option><option value="rw_preop">读不限，写仅PREOP</option></select></label><label>当前状态<select aria-label="SDO教学状态" value={request.state} onChange={event => patch('state', event.target.value)}>{['PREOP', 'SAFEOP', 'OP'].map(state => <option key={state}>{state}</option>)}</select></label></div><p>本例的权限统一作用于各子项。真实对象可逐项不同；ESI中的能力声明不能替代固件实现。</p></details></div>
    <div className={`sdo-access-result result-${plan.kind}`} role="status" aria-live="polite"><span>{plan.valid ? <Check size={16}/> : <Info size={16}/>}<strong>{plan.valid ? `${request.mode === 'single' ? '单项' : 'CA从'}${subIndexText(plan.start)} · ${plan.byteLength} Byte 有效对象数据` : plan.abortCode ? `SDO Abort ${plan.abortCode}` : plan.kind === 'input' ? '输入待修正' : plan.kind === 'precondition' ? '访问前提未满足' : '布局未建模'}</strong></span><p>{plan.message}</p></div>
    <ol className="sdo-validation-path" aria-label="访问校验路径">{plan.checks.map(check => <li key={check.id} className={`check-${check.status}`} title={check.detail}><i>{check.status === 'pass' ? '✓' : check.status === 'skip' ? '—' : '×'}</i>{check.label}</li>)}</ol>
    <p className="sdo-member-interaction" id={interactionId}>{request.mode === 'single' ? '单项模式：点协议条目或本地成员，同步切换请求SI和载荷。' : 'CA模式：点成员只定位；起点和访问范围仍由上方请求决定。'}</p>
    <div className="sdo-projections"><section className="sdo-definition-panel"><h3><small>01</small>协议条目定义</h3><p className="sdo-panel-caption">{shape} · {object.name} · <span>逻辑位长</span></p><table className="sdo-definition-table"><thead><tr><th>SI</th><th>类型</th><th>bit</th><th>示例值</th></tr></thead><tbody>{object.entries.map(entry => <tr key={entry.subIndex} className={entry.subIndex === selected?.subIndex ? 'selected' : ''} onClick={event => { if (!event.target.closest?.('button')) selectMember(entry.subIndex) }}><th><button aria-label={`选择协议条目 ${subIndexText(entry.subIndex)}`} aria-pressed={entry.subIndex === selected?.subIndex} aria-describedby={interactionId} onClick={() => selectMember(entry.subIndex)}>{subIndexText(entry.subIndex)}</button></th><td><code>{entry.type}</code></td><td>{entry.logicalBits}</td><td><code title={`${entry.name} = ${entry.value}`}>{valueText(entry)}</code></td></tr>)}</tbody></table><div className="sdo-definition-note">{shape === 'VARIABLE' ? <><strong>:00 是变量值</strong><p>本例为UNSIGNED16，不是计数头，单项有效数据为2Byte。</p></> : <><strong>SI0按UNSIGNED8（UINT8）描述</strong><p>本例成员连续，SI0值为2。CA填充和本地16bit分配不会把它的协议类型改成UNSIGNED16。</p></>}</div></section>
      <section className="sdo-payload-panel"><h3><small>02</small>SDO对象数据载荷 <span>{request.operation === 'read' ? '期望返回数据' : '教学写入数据'}</span></h3><Payload plan={plan} selected={selected?.subIndex} paddingSelected={paddingSelected} onSelect={selectMember} onPadding={() => setSelection('padding')}/><p className="sdo-panel-footnote">只计有效对象数据；不计Mailbox、CoE、SDO报文头或传输容器未用字节。</p></section>
      <section className="sdo-storage-panel"><h3><small>03</small>SSC默认本地占位 <span>相对偏移 · 以8bit Byte计</span></h3><div className="sdo-memory-track" style={{ gridTemplateColumns: `repeat(${plan.storage.totalBits / 8}, minmax(0, 1fr))` }} aria-label="SSC本地成员占位">{plan.storage.rows.map(row => <button key={row.subIndex} style={{ gridColumn: `span ${row.allocatedBits / 8}` }} className={row.subIndex === selected?.subIndex ? 'selected' : ''} aria-label={`选择本地成员 ${subIndexText(row.subIndex)}`} aria-pressed={row.subIndex === selected?.subIndex} aria-describedby={interactionId} onClick={() => selectMember(row.subIndex)} title={`${row.cType} ${row.cName}，bit ${row.bitOffset}起，分配${row.allocatedBits}bit`}><b>{subIndexText(row.subIndex)} · {row.cType}</b><code>{row.cName}</code><small>偏移 {row.byteOffset} · {row.allocatedBits / 8} Byte</small></button>)}</div><p className="sdo-panel-footnote">本地SI0在CA从1开始时仍然存在。这里只展示默认占位，实际编译器填充、寻址单位和端序须按平台与生成代码核对。</p></section>
    </div>
    <CurrentMember selected={selected} local={local} transfer={transfer} plan={plan} paddingSelected={paddingSelected} request={request}/>
    <details className="sdo-evidence"><summary>规则依据与适用范围</summary><p>厂商官方说明和SSC默认实现分层引用；未直接取得ETG规范原文条款。本模型选用连续、定长无符号成员和统一权限，不模拟空洞、混合访问权限、位字段、字符串、分段传输或设备专属回调。</p><p>CA填充、本地保留空间与PDO显式映射不同；不能把整个C结构体的sizeof或直接memcpy视为通用CA序列化方式。实际访问还须核对对象当前SI0、声明上限和专属规则。</p>{sdoAccessEvidence.map(reference => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer"><strong>{reference.title}</strong><span>{reference.scope}</span><ArrowRight size={13}/></a>)}</details>
  </section>
}

export function SdoAccessDialog({ initialShape, origin, onClose }) {
  const dialog = useRef(null), heading = useRef(null), id = useId()
  useEffect(() => {
    const previous = document.activeElement, element = dialog.current
    element.showModal(); heading.current?.focus({ preventScroll: true })
    return () => { if (element.open) element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  return <dialog className="sdo-access-dialog" ref={dialog} aria-labelledby={id} onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation() }} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}><header><h2 id={id} ref={heading} tabIndex={-1}>SDO访问与布局</h2><button className="icon-button" aria-label="关闭SDO访问与布局" onClick={onClose}><X size={18}/></button></header><SdoAccessWorkbench initialShape={initialShape} origin={origin}/></dialog>
}

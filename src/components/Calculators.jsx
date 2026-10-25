import { useId, useRef, useState } from 'react'
import { ArrowRight, Binary, Check, Copy, ExternalLink, Grid2X2, Info, Layers3, Plus, RotateCcw, Timer, Trash2, TriangleAlert } from 'lucide-react'
import {
  CalculationError, formatHex, decodePdoMapping, encodePdoMapping,
  calculateBitLayout, planSmMemory, calculateWatchdogs, decodeSmControl,
} from '../lib/calculations.js'
import './calculators.css'
import { analyzeSscObjectLayout } from '../lib/ssc-object-layout.js'

const REGISTER_SOURCE = 'https://download.beckhoff.com/download/Document/io/ethercat-development-products/ethercat_esc_datasheet_sec2_registers_3i0.pdf'
const REGISTER_V33_SOURCE = 'https://download.beckhoff.com/download/Document/io/ethercat-development-products/ethercat_esc_datasheet_sec2_registers_v3.3.pdf'
const TECHNOLOGY_SOURCE = 'https://download.beckhoff.com/download/document/io/ethercat-development-products/ethercat_esc_datasheet_sec1_technology_v2.5.pdf'
const SM_SOURCE = 'https://infosys.beckhoff.com/content/1033/tc3_io_intro/4981170059.html'
const SSC_SOURCE = 'https://download.beckhoff.com/download/document/io/ethercat-development-products/an_et9300_v1i10.pdf'
const TOOLS = [
  { id: 'mapping', label: 'PDO 映射', Icon: Binary },
  { id: 'layout', label: '位布局', Icon: Grid2X2 },
  { id: 'memory', label: 'SM 内存', Icon: Layers3 },
  { id: 'watchdog', label: '看门狗', Icon: Timer },
  { id: 'control', label: 'ControlByte', Icon: Binary },
]

function evaluate(calculate) {
  try { return { result: calculate(), error: null } } catch (error) {
    if (!(error instanceof CalculationError)) throw error
    return { result: null, error }
  }
}

function fieldError(error, field) {
  return error?.issues.find(issue => issue.field === field)?.message
}

function Field({ label, hint, value, onChange, error, children }) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return <div className="calc-field">
    <label htmlFor={id}>{label}</label>
    {children ? <select id={id} value={value} onChange={event => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy}>{children}</select>
      : <input id={id} type="text" value={value} onChange={event => onChange(event.target.value)} autoComplete="off" spellCheck="false" aria-invalid={Boolean(error)} aria-describedby={describedBy} />}
    {hint && <span className="calc-hint" id={`${id}-hint`}>{hint}</span>}
    {error && <span className="calc-field-error" id={`${id}-error`}>{error}</span>}
  </div>
}

function InputCell({ id, label, value, onChange, error, text = false }) {
  return <>
    <label className="calc-sr-only" htmlFor={id}>{label}</label>
    <input id={id} className={`calc-cell-input${text ? ' calc-name-input' : ''}`} type="text" value={value} onChange={event => onChange(event.target.value)} autoComplete="off" spellCheck="false" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
    {error && <span className="calc-field-error" id={`${id}-error`}>{error}</span>}
  </>
}

function ErrorResult({ error }) {
  if (!error) return null
  return <div className="calc-notice calc-error" role="alert">
    <TriangleAlert size={17} aria-hidden="true" />
    <div><strong>请修正输入</strong><ul>{error.issues.map((issue, i) => <li key={`${issue.field}-${i}`}>{issue.message}</li>)}</ul><p>有效结果会在修正后自动更新。</p></div>
  </div>
}

function Notice({ children, warning = false }) {
  const Icon = warning ? TriangleAlert : Info
  return <div className={`calc-notice${warning ? ' calc-warning' : ''}`}><Icon size={17} aria-hidden="true" /><div>{children}</div></div>
}

function ToolHeading({ title, description, onReset }) {
  return <div className="calc-tool-heading">
    <div><h3>{title}</h3><p>{description}</p></div>
    <button type="button" className="calc-button calc-reset" onClick={onReset}><RotateCcw size={14} aria-hidden="true" />重置示例</button>
  </div>
}

function ContextLink({ onNavigate, entry, children }) {
  if (!onNavigate) return null
  return <button type="button" className="calc-context-link" onClick={() => onNavigate(entry)}>{children}<ArrowRight size={14} aria-hidden="true" /></button>
}

function SourceNote({ children, register = false, href }) {
  return <p className="calc-source">{children}<a href={href ?? (register ? REGISTER_SOURCE : SM_SOURCE)} target="_blank" rel="noreferrer">Beckhoff 官方说明<ExternalLink size={12} aria-hidden="true" /><span className="calc-sr-only">（新窗口）</span></a></p>
}

function CopyValue({ value }) {
  const [feedback, setFeedback] = useState(null)
  const status = feedback?.value === value ? feedback.status : ''
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setFeedback({ value, status: 'copied' })
    } catch {
      setFeedback({ value, status: 'failed' })
    }
  }
  return <div className="calc-copy-row">
    <code className="calc-code-value">{value}</code>
    <button type="button" className="calc-icon-button" onClick={copy} aria-label={status === 'copied' ? '已复制计算值' : '复制计算值'} title="复制计算值">{status === 'copied' ? <Check size={16} /> : <Copy size={16} />}</button>
    <span className="calc-copy-feedback" role="status">{status === 'copied' ? '已复制' : status === 'failed' ? '复制未成功，可选中文本复制' : ''}</span>
  </div>
}

function MappingTool({ onNavigate, initialWord = '0x60400010' }) {
  const [mode, setMode] = useState('decode')
  const [word, setWord] = useState(initialWord)
  const [parts, setParts] = useState({ index: '0x6040', subIndex: '0', bitLength: '16' })
  const { result, error } = evaluate(() => mode === 'decode' ? decodePdoMapping(word) : encodePdoMapping(parts))
  function reset() {
    setMode('decode'); setWord(initialWord); setParts({ index: '0x6040', subIndex: '0', bitLength: '16' })
  }
  function changeMode(next) {
    if (result) {
      if (next === 'encode') setParts({ index: result.indexHex, subIndex: String(result.subIndex), bitLength: String(result.bitLength) })
      else setWord(result.hex)
    }
    setMode(next)
  }
  return <section className="calc-tool">
    <ToolHeading title="32 位 PDO 映射编解码" description="查看一个映射值如何拆成对象索引、子索引和位长。输入后实时计算。" onReset={reset} />
    <div className="calc-segment" role="group" aria-label="PDO 映射计算方向">
      <button type="button" aria-pressed={mode === 'decode'} onClick={() => changeMode('decode')}>解码映射值</button>
      <button type="button" aria-pressed={mode === 'encode'} onClick={() => changeMode('encode')}>编码映射值</button>
    </div>
    {mode === 'decode' ? <div className="calc-narrow"><Field label="32 位映射值" hint="支持十进制、0x 十六进制、ESI #x 形式。" value={word} onChange={setWord} error={fieldError(error, 'word')} /></div>
      : <div className="calc-fields calc-fields-three">{[['index', 'Index · 16 bit', '0–65535'], ['subIndex', 'SubIndex · 8 bit', '0–255'], ['bitLength', 'BitLength · 8 bit', '1–255 bit']].map(([key, label, hint]) => <Field key={key} label={label} hint={hint} value={parts[key]} onChange={value => setParts(previous => ({ ...previous, [key]: value }))} error={fieldError(error, key)} />)}</div>}
    <ErrorResult error={error} />
    {result && <div className="calc-result" aria-live="polite" aria-atomic="true">
      <div className="calc-result-caption">{mode === 'decode' ? '解码结果' : '编码结果'}</div>
      <CopyValue value={result.hex} />
      <div className="calc-mapping-strip">
        <div className="calc-map-index"><span>31 … 16 · Index</span><strong>{result.indexHex}</strong><small>{result.index}（十进制）</small></div>
        <div><span>15 … 8 · SubIndex</span><strong>{result.subIndexHex}</strong><small>{result.subIndex}（十进制）</small></div>
        <div><span>7 … 0 · BitLength</span><strong>{result.lengthHex}</strong><small>{result.bitLength} bit</small></div>
      </div>
      <div className="calc-formula"><span>编码公式</span><code>Index × 2¹⁶ + SubIndex × 2⁸ + BitLength</code><code>{result.indexHex} × 65536 + {result.subIndex} × 256 + {result.bitLength} = {result.hex}</code></div>
      {result.padding && <Notice warning><p>Index 为 0：此项表示 padding / 空隙，不指向实际对象字典条目。是否允许以及长度限制仍需核对设备和 SSC 配置。</p>{result.subIndex !== 0 && <p>当前 SubIndex 非 0，请检查设备要求；常见 padding 示例使用 SubIndex = 0。</p>}</Notice>}
    </div>}
    <div className="calc-footer"><p>字段分配固定为 16 / 8 / 8 bit。位长 0 不能作为有效映射项。</p><ContextLink onNavigate={onNavigate} entry="pdo-mapping">查阅 PDO Mapping</ContextLink></div>
  </section>
}

const INITIAL_FIELDS = [
  { id: 1, name: 'Controlword', bits: '16' },
  { id: 2, name: 'Target position', bits: '32' },
  { id: 3, name: 'Mode of operation', bits: '8' },
]

function LayoutTool({ onNavigate }) {
  const [fields, setFields] = useState(INITIAL_FIELDS)
  const [checkSscLayout, setCheckSscLayout] = useState(false)
  const nextId = useRef(4)
  const id = useId()
  const { result, error } = evaluate(() => calculateBitLayout(fields))
  const sscAnalysis = result && checkSscLayout ? analyzeSscObjectLayout(fields) : null
  function update(rowId, key, value) { setFields(previous => previous.map(field => field.id === rowId ? { ...field, [key]: value } : field)) }
  function addField() {
    const rowId = nextId.current++
    setFields(previous => [...previous, { id: rowId, name: `字段 ${previous.length + 1}`, bits: '8' }])
  }
  return <section className="calc-tool">
    <ToolHeading title="PDO 字段位布局" description="按列表顺序连续排列字段，显示 bit / byte 偏移；不自动插入对齐或 padding。" onReset={() => { setFields(INITIAL_FIELDS); setCheckSscLayout(false) }} />
    <label className="calc-check-label"><input type="checkbox" checked={checkSscLayout} onChange={event => setCheckSscLayout(event.target.checked)} />附带检查：同一 SSC 复合对象的本地成员布局</label>
    {checkSscLayout && <Notice><p>仅当列表表示同一个 SSC 对象的本地成员、偏移从该对象起点计算时，才使用下面的 SSC 边界提示。跨对象的 PDO 位流不能据此判为 SSC 布局错误。对象的 SubIndex 0 等本地成员也须按实际结构纳入。</p></Notice>}
    <div className="calc-table-scroll"><table className="calc-table calc-layout-input"><caption className="calc-sr-only">待计算的 PDO 字段</caption><thead><tr><th scope="col">字段名称</th><th scope="col">位长 · bit</th><th scope="col"><span className="calc-sr-only">操作</span></th></tr></thead><tbody>
      {fields.map((field, i) => <tr key={field.id}>
        <td><InputCell text id={`${id}-name-${field.id}`} label={`第 ${i + 1} 个字段名称`} value={field.name} onChange={value => update(field.id, 'name', value)} /></td>
        <td><InputCell id={`${id}-bits-${field.id}`} label={`第 ${i + 1} 个字段位长`} value={field.bits} onChange={value => update(field.id, 'bits', value)} error={fieldError(error, `fields.${i}.bits`)} /></td>
        <td><button type="button" className="calc-icon-button" onClick={() => setFields(previous => previous.filter(item => item.id !== field.id))} aria-label={`删除第 ${i + 1} 个字段 ${field.name}`} title="删除字段"><Trash2 size={15} aria-hidden="true" /></button></td>
      </tr>)}
    </tbody></table></div>
    {!fields.length && <p className="calc-empty">还没有字段。添加字段后即可查看布局。</p>}
    <div className="calc-inline-actions"><button type="button" className="calc-button" onClick={addField}><Plus size={15} aria-hidden="true" />添加字段</button><span className="calc-hint">单个映射项位长：1–255 bit</span></div>
    <ErrorResult error={error} />
    {result && fields.length > 0 && <div className="calc-result">
      <div className="calc-stats" aria-live="polite"><div><span>总位长</span><strong>{result.totalBits}<small> bit</small></strong></div><div><span>占用字节</span><strong>{result.totalBytes}<small> B</small></strong></div><div><span>末字节剩余</span><strong>{result.unusedBits}<small> bit</small></strong></div></div>
      <div className="calc-layout-band" role="img" aria-label={`顺序排列 ${fields.length} 个字段，共 ${result.totalBits} 位`}>{result.rows.map((row, i) => <span key={row.id} className={`calc-tone-${i % 4}`} style={{ flexGrow: row.bitLength }} title={`${row.name}：bit ${row.bitOffset}–${row.endBitExclusive - 1}`} />)}</div>
      <div className="calc-table-scroll"><table className="calc-table"><caption className="calc-sr-only">计算得到的字段偏移</caption><thead><tr><th scope="col">字段</th><th scope="col" className="calc-numeric">位长</th><th scope="col" className="calc-numeric">Bit offset</th><th scope="col" className="calc-numeric">Byte offset</th><th scope="col">字节内起始位</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td className="calc-numeric">{row.bitLength}</td><td className="calc-numeric">{row.bitOffset}</td><td className="calc-numeric">{row.byteOffset}</td><td>bit {row.bitInByte}{checkSscLayout && row.smallFieldCrossesByte && <span className="calc-inline-warning">跨字节</span>}{checkSscLayout && row.largeFieldUnalignedWord && <span className="calc-inline-warning">非 WORD 对齐</span>}</td></tr>)}</tbody></table></div>
      <div className="calc-formula"><span>字节数</span><code>ceil(总位长 ÷ 8) = ceil({result.totalBits} ÷ 8) = {result.totalBytes} B</code><span>偏移从 0 开始。表内 Byte offset = floor(Bit offset ÷ 8)。</span></div>
      {!result.byteAligned && <Notice><p>总长不是整字节，最后一个字节还剩 {result.unusedBits} bit。这里仅向上取整计算存储字节数，不会自动生成 padding 映射项。</p></Notice>}
      {sscAnalysis && sscAnalysis.issues.length > 0 && <Notice warning><p>按 SSC 默认对象本地布局规则检查：</p><ul>{sscAnalysis.issues.map((issue,i) => <li key={i}>{issue.message}</li>)}</ul><p>检查每个小成员组的起点与完整性，不只检查对象末尾。此结果不用于否定连续 PDO 位流。</p></Notice>}
      {checkSscLayout && <p className="calc-source">适用范围与规则依据：<a href={SSC_SOURCE} target="_blank" rel="noreferrer">AN_ET9300 §7.1 Structure/Alignment Rules<ExternalLink size={12} aria-hidden="true" /></a></p>}
    </div>}
    <div className="calc-footer"><p>结果表示过程数据位流，不等同于编译器 C 结构体的 sizeof 或内存对齐。</p><ContextLink onNavigate={onNavigate} entry="object-dictionary">查阅对象字典与类型</ContextLink></div>
  </section>
}

const INITIAL_CHANNELS = [
  { name: 'SM0', role: 'Mailbox Rx', start: '0x1000', length: '128', buffers: '1' },
  { name: 'SM1', role: 'Mailbox Tx', start: '0x1080', length: '128', buffers: '1' },
  { name: 'SM2', role: 'Process Rx', start: '0x1100', length: '12', buffers: '3' },
  { name: 'SM3', role: 'Process Tx', start: '0x1124', length: '12', buffers: '3' },
]

function MemoryTool({ onNavigate, initialMemory }) {
  const [baseline] = useState(() => ({ internalWidth: initialMemory?.internalWidth || '8', alignment: initialMemory ? '1' : '4', checkLengthAlignment: !initialMemory, ramEnd: initialMemory ? '0x10000' : '0x3000', channels: INITIAL_CHANNELS.map((channel, i) => initialMemory && i === initialMemory.smIndex ? { ...channel, start: initialMemory.start, length: initialMemory.length, buffers: initialMemory.buffers } : { ...channel }) }))
  const [ramStart, setRamStart] = useState('0x1000')
  const [ramEnd, setRamEnd] = useState(baseline.ramEnd)
  const [alignment, setAlignment] = useState(baseline.alignment)
  const [checkLengthAlignment, setCheckLengthAlignment] = useState(baseline.checkLengthAlignment)
  const [internalWidth, setInternalWidth] = useState(baseline.internalWidth)
  const [channels, setChannels] = useState(baseline.channels)
  const id = useId()
  const { result, error } = evaluate(() => planSmMemory({ ramStart, ramEnd, alignment, checkLengthAlignment, internalWidth, channels }))
  function update(index, key, value) { setChannels(previous => previous.map((channel, i) => i === index ? { ...channel, [key]: value } : channel)) }
  function reset() { setRamStart('0x1000'); setRamEnd(baseline.ramEnd); setAlignment(baseline.alignment); setCheckLengthAlignment(baseline.checkLengthAlignment); setInternalWidth(baseline.internalWidth); setChannels(baseline.channels) }
  function loadWideExample() {
    setRamStart('0x1000'); setRamEnd('0x3000'); setAlignment('1'); setCheckLengthAlignment(false); setInternalWidth('32')
    setChannels(INITIAL_CHANNELS.map((channel, i) => ({ ...channel, start: i === 0 ? '0x1003' : channel.start, length: i === 0 ? '0xFA' : '0', buffers: i === 0 ? '3' : channel.buffers, role: i === 0 ? 'Buffered example' : channel.role })))
  }
  return <section className="calc-tool">
    <ToolHeading title="SyncManager 内存规划" description="检查完整物理缓冲区的占用、重叠与边界。地址范围统一使用左闭右开区间。" onReset={reset} />
    {initialMemory && <Notice>已带入关系图的 SM{initialMemory.smIndex} 演算值；其他通道及 RAM 范围仍为示例，请按实际设备核对。</Notice>}
    <div className="calc-fields calc-fields-three">
      <Field label="RAM 起始地址" value={ramStart} onChange={setRamStart} hint="示例从 ESC 过程数据 RAM 0x1000 开始。" error={fieldError(error, 'ramStart')} />
      <Field label="RAM 结束地址（不含）" value={ramEnd} onChange={setRamEnd} hint="最大 0x10000；按实际 ESC RAM 容量修改。" error={fieldError(error, 'ramEnd')} />
      <Field label="对齐检查单位" value={alignment} onChange={setAlignment} hint="检查起始地址；可选择同时检查 Length。" error={fieldError(error, 'alignment')}><option value="1">1 字节</option><option value="2">2 字节</option><option value="4">4 字节</option></Field>
    </div>
    <div className="calc-memory-model"><Field label="ESC 内部处理宽度" value={internalWidth} onChange={setInternalWidth} hint="这是 ESC 内部处理字宽，不是 PDI / MCU 访问宽度。" error={fieldError(error, 'internalWidth')}><option value="8">8 bit · 1 字节</option><option value="16">16 bit · 2 字节</option><option value="32">32 bit · 4 字节</option><option value="64">64 bit · 8 字节</option></Field><button type="button" className="calc-button" onClick={loadWideExample}>载入 32 bit 内存示例</button></div>
    <label className="calc-check-label"><input type="checkbox" checked={checkLengthAlignment} onChange={event => setCheckLengthAlignment(event.target.checked)} />同时检查单缓冲 Length 对齐<span>SSC / 硬件条件检查</span></label>
    <div className="calc-table-scroll"><table className="calc-table calc-memory-input"><caption className="calc-sr-only">SyncManager 内存规划输入</caption><thead><tr><th scope="col">SyncManager</th><th scope="col">起始地址</th><th scope="col">单缓冲长度 L · B</th><th scope="col">缓冲模式</th></tr></thead><tbody>{channels.map((channel, i) => <tr key={channel.name}>
      <th scope="row">{channel.name}<span className="calc-cell-helper">{channel.role}</span></th>
      <td><InputCell id={`${id}-start-${i}`} label={`${channel.name} 起始地址`} value={channel.start} onChange={value => update(i, 'start', value)} error={fieldError(error, `channels.${i}.start`)} /></td>
      <td><InputCell id={`${id}-length-${i}`} label={`${channel.name} 单缓冲长度`} value={channel.length} onChange={value => update(i, 'length', value)} error={fieldError(error, `channels.${i}.length`)} /></td>
      <td><label className="calc-sr-only" htmlFor={`${id}-mode-${i}`}>{channel.name} 缓冲模式</label><select id={`${id}-mode-${i}`} value={channel.buffers} onChange={event => update(i, 'buffers', event.target.value)}><option value="1">单缓冲 × 1</option><option value="3">三缓冲 × 3</option></select></td>
    </tr>)}</tbody></table></div>
    <p className="calc-hint">长度设为 0 即停用该 SM。当前 SM 分工、RAM 大小与对齐均是可修改示例，并非设备通用默认值。对齐条件应依据实际 SSC / PDI 配置选择，不等价于完整 CHECK_SM_PARAM_ALIGNMENT 检查。</p>
    <ErrorResult error={error} />
    {result && <div className="calc-result">
      <div className="calc-stats" aria-live="polite"><div><span>RAM 容量</span><strong>{result.capacity}<small> B</small></strong></div><div><span>已分配</span><strong>{result.usedBytes}<small> B</small></strong></div><div><span>剩余可用</span><strong>{result.freeBytes}<small> B</small></strong></div></div>
      <div className="calc-address-labels"><code>{formatHex(result.ramStart)}</code><span>实际地址比例</span><code>{formatHex(result.ramEnd)}（不含）</code></div>
      <div className="calc-memory-track" role="img" aria-label={`RAM 地址分配：已使用 ${result.usedBytes} 字节，空闲 ${result.freeBytes} 字节；具体区间见下表`}>{result.rows.filter(row => row.active).map(row => <span key={row.name} className={`calc-memory-block calc-tone-${row.sourceIndex}`} style={{ left: `${(row.physicalStart - result.ramStart) / result.capacity * 100}%`, width: `${row.allocated / result.capacity * 100}%` }} title={`${row.name} [${formatHex(row.physicalStart)}, ${formatHex(row.end)}) · ${row.allocated} B`} />)}</div>
      <div className="calc-memory-legend">{result.rows.map(row => <span key={row.name}><i className={`calc-tone-${row.sourceIndex}`} aria-hidden="true" />{row.name} · {row.active ? `${row.allocated} B` : '停用'}</span>)}</div>
      <div className="calc-table-scroll"><table className="calc-table calc-memory-result"><caption className="calc-sr-only">SyncManager 完整物理占用计算结果</caption><thead><tr><th scope="col">SM</th><th scope="col">Length / 可见区间</th><th scope="col">单缓冲预留</th><th scope="col">总物理占用</th><th scope="col">完整物理区间 [起始, 结束)</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.name}><th scope="row">{row.name}</th><td><code>{row.length} B</code>{row.active && <span className="calc-cell-helper"><code>[{formatHex(row.start)}, {formatHex(row.visibleEnd)})</code></span>}</td><td>{row.bufferSpan} B</td><td>{row.active ? `${row.bufferSpan} × ${row.effectiveBuffers} = ${row.allocated} B` : '停用'}{row.singleByteMode && <span className="calc-cell-helper">Length = 1 特殊模式</span>}</td><td><code>{row.active ? `[${formatHex(row.physicalStart)}, ${formatHex(row.end)})` : '不占用 RAM'}</code></td></tr>)}</tbody></table></div>
      <div className="calc-formula"><span>物理分配公式 · W = 内部处理宽度 / 8 = {result.wordBytes} B，A = 配置起始地址</span><code>物理起点 A₀ = floor(A / W) × W</code><code>单缓冲预留 B = ceil((A + L) / W) × W − A₀</code><code>总物理占用 = B × N；结束地址（不含）= A₀ + B × N</code><span>正常单/三缓冲 N = 1/3；Length = 1 时 N = 1；Length = 0 时不占用。</span></div>
      {result.rows.some(row => row.singleByteMode) && <Notice warning><p>Length = 1 会绕过缓冲机制，三缓冲的额外 buffer 1 / 2 不使用。仍按内部字宽预留一个缓冲范围。它仍可能产生看门狗 / 中断触发；部分 ESC 的 mailbox 触发行为依赖交替读写，需按设备手册核对。</p></Notice>}
      <details className="calc-details"><summary>查看空闲地址区间（{result.gaps.length}）</summary>{result.gaps.length ? <ul>{result.gaps.map(gap => <li key={gap.start}><code>[{formatHex(gap.start)}, {formatHex(gap.end)})</code><span>{gap.length} B</span></li>)}</ul> : <p>当前 RAM 已全部分配。</p>}</details>
    </div>}
    <Notice><p>SM Length 仍写可见单缓冲长度 L，不写三缓冲总占用。内部字宽大于 8 bit 时，先对可见区间首尾向外取整，再计入缓冲数量；不允许其他 SM 占用这些扩展字节。此物理分配与上方可选的 SSC 地址 / Length 对齐检查是两件事。</p></Notice>
    <div className="calc-footer"><SourceNote href={TECHNOLOGY_SOURCE}>Technology v2.5 §8.1.2 / §8.2.2 / §8.5：</SourceNote><ContextLink onNavigate={onNavigate} entry="def-pd-write-address">查阅过程数据起始地址</ContextLink></div>
  </section>
}

function displayNumber(value) { return value.toLocaleString('en-US', { maximumFractionDigits: 9 }) }
function unitLabel(unit) { return unit === 'us' ? 'µs' : unit }

function WatchdogTool({ onNavigate, initialWatchdog }) {
  const [baseline] = useState(() => ({ divider: String(initialWatchdog?.divider ?? 2498), smCount: String(initialWatchdog?.smCount ?? 1000), pdiCount: String(initialWatchdog?.pdiCount ?? 1000), unit: 'ms' }))
  const [values, setValues] = useState(baseline)
  const { result, error } = evaluate(() => calculateWatchdogs(values))
  const update = (key, value) => setValues(previous => ({ ...previous, [key]: value }))
  return <section className="calc-tool">
    <ToolHeading title="ESC 看门狗时间" description="SM 和 PDI 看门狗共享 Divider，使用各自的 16 位 Count。" onReset={() => setValues(baseline)} />
    {initialWatchdog && <p className="calc-hint">已带入时序教学参数；换算结果不回写示例或设备。</p>}
    <div className="calc-fields calc-fields-three">
      <Field label="Divider · 0x0400" hint="16 bit：0–65535" value={values.divider} onChange={value => update('divider', value)} error={fieldError(error, 'divider')} />
      <Field label="SM Count · 0x0420" hint="16 bit：0–65535；0 表示禁用。" value={values.smCount} onChange={value => update('smCount', value)} error={fieldError(error, 'smCount')} />
      <Field label="PDI Count · 0x0410" hint="16 bit：0–65535；0 表示禁用。" value={values.pdiCount} onChange={value => update('pdiCount', value)} error={fieldError(error, 'pdiCount')} />
    </div>
    <div className="calc-unit-field"><Field label="结果显示单位" value={values.unit} onChange={value => update('unit', value)}><option value="ns">纳秒 ns</option><option value="us">微秒 µs</option><option value="ms">毫秒 ms</option><option value="s">秒 s</option></Field></div>
    <ErrorResult error={error} />
    {result && <div className="calc-result">
      <div className="calc-formula"><span>共同计时步长</span><code>tick = (Divider + 2) × 40 ns</code><code>({result.divider} + 2) × 40 ns = {displayNumber(result.tickNs)} ns = {displayNumber(result.tick)} {unitLabel(result.unit)}</code></div>
      <div className="calc-watchdog-results" aria-live="polite">{[['SM', result.sm], ['PDI', result.pdi]].map(([name, timer]) => <div className={`calc-timer-result${timer.enabled ? '' : ' is-disabled'}`} key={name}><span>{name} 看门狗</span><output>{timer.enabled ? <>{displayNumber(timer.value)}<small> {unitLabel(result.unit)}</small></> : '已禁用'}</output><p>{timer.enabled ? `${timer.count} × ${displayNumber(result.tickNs)} ns = ${displayNumber(timer.timeoutNs)} ns` : 'Count = 0，不表示 0 秒超时。'}</p></div>)}</div>
      <p className="calc-hint">示例 Divider = 2498、Count = 1000 对应 100 ms。改动显示单位不会改变寄存器值。</p>
    </div>}
    <Notice><p>采用基础周期 40 ns 的 ESC 寄存器模型。结果为标称估算，实际到期存在与时基有关的量化范围，不是纳秒级精确波形。SM 看门狗的实际触发还与 SyncManager Control、有效过程数据写入及设备实现有关；PDI 看门狗需对应硬件支持。Count = 0 在该模型中表示禁用，具体终端固件是否允许应另行核对。</p></Notice>
    <div className="calc-footer"><SourceNote register>ESC 寄存器 0x0400 / 0x0410 / 0x0420：</SourceNote><ContextLink onNavigate={onNavigate} entry="esc-sm-wd-supported">查阅 SM 看门狗支持</ContextLink></div>
  </section>
}

const CONTROL_PRESETS = [
  { value: '0x26', label: 'Mailbox Rx' },
  { value: '0x22', label: 'Mailbox Tx' },
  { value: '0x64', label: 'Process Rx' },
  { value: '0x20', label: 'Process Tx' },
]

function ControlTool({ onNavigate, initialValue = '0x26' }) {
  const [value, setValue] = useState(initialValue)
  const [sequentialSupported, setSequentialSupported] = useState(false)
  const { result, error } = evaluate(() => decodeSmControl(value, { sequentialSupported }))
  const rows = result ? [
    { bits: '1:0', label: '缓冲模式', value: result.mode.toString(2).padStart(2, '0'), meaning: result.modeLabel, reserved: !result.modeValid },
    { bits: '3:2', label: '数据方向', value: result.direction.toString(2).padStart(2, '0'), meaning: result.directionLabel, reserved: !result.directionValid },
    { bits: '4', label: 'ECAT 事件使能', value: Number(result.ecatEvent), meaning: result.ecatEvent ? '启用 ECAT 事件' : '禁用 ECAT 事件' },
    { bits: '5', label: 'AL 事件使能', value: Number(result.alEvent), meaning: result.alEvent ? '启用 AL 事件（中断仍受掩码等配置影响）' : '禁用 AL 事件' },
    { bits: '6', label: '看门狗触发', value: Number(result.watchdogTrigger), meaning: result.watchdogTrigger ? '允许触发过程数据看门狗' : '不通过本 SM 触发过程数据看门狗' },
    { bits: '7', label: sequentialSupported ? 'Sequential mode' : '保留位（传统 ESC）', value: Number(result.bit7), meaning: sequentialSupported ? (result.sequentialMode ? '启用顺序模式；以具体 ESC 手册的适用条件为准' : '未启用顺序模式') : (result.reservedBit ? '未声明顺序模式支持，按传统 ESC 规则应置 0' : '按传统 ESC 规则置 0'), reserved: result.reservedBit },
  ] : []
  return <section className="calc-tool">
    <ToolHeading title="SyncManager ControlByte 解码" description="逐字段查看一个控制字节的缓冲模式、方向、事件和看门狗配置。" onReset={() => { setValue(initialValue); setSequentialSupported(false) }} />
    <div className="calc-narrow"><Field label="ControlByte · 8 bit" hint="0–255，可使用 0x 或 #x 十六进制形式。" value={value} onChange={setValue} error={fieldError(error, 'control')} /></div>
    <div className="calc-narrow"><Field label="Bit 7 的设备能力" value={sequentialSupported ? 'supported' : 'legacy'} onChange={next => setSequentialSupported(next === 'supported')} hint="按具体 ESC 手册和 Feature 寄存器 0x0008 的 bit 12 判断。"><option value="legacy">传统 ESC / 未声明顺序模式支持</option><option value="supported">设备已声明 Sequential mode 支持</option></Field></div>
    <div className="calc-preset-label">常见示例</div><div className="calc-presets" role="group" aria-label="ControlByte 示例">{CONTROL_PRESETS.map(preset => <button type="button" className="calc-button" key={preset.value} onClick={() => setValue(preset.value)} aria-pressed={result?.hex === preset.value}><code>{preset.value}</code><span>{preset.label}</span></button>)}</div>
    <ErrorResult error={error} />
    {result && <div className="calc-result">
      <div className="calc-result-caption">{result.hex} · <code>0b{result.binary}</code></div>
      <div className="calc-bit-grid" role="img" aria-label={`从 bit 7 到 bit 0：${result.binary.split('').join(' ')}`}>{result.bits.map(bit => <div key={bit.bit} className={`${bit.value ? 'is-set' : ''}${bit.bit === 7 && result.reservedBit ? ' is-reserved' : ''}`}><span>bit {bit.bit}</span><strong>{bit.value}</strong></div>)}</div>
      {result.warnings.length > 0 && <div className="calc-notice calc-warning" role="status"><TriangleAlert size={17} aria-hidden="true" /><div><strong>包含保留值</strong><ul>{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div></div>}
      <div className="calc-table-scroll"><table className="calc-table calc-control-table"><caption className="calc-sr-only">SyncManager ControlByte 各字段解释</caption><thead><tr><th scope="col">Bit</th><th scope="col">字段</th><th scope="col">值</th><th scope="col">含义</th></tr></thead><tbody>{rows.map(row => <tr key={row.bits} className={row.reserved ? 'calc-reserved-row' : ''}><td><code>{row.bits}</code></td><th scope="row">{row.label}</th><td><code>{row.value}</code></td><td>{row.meaning}</td></tr>)}</tbody></table></div>
      <div className="calc-formula"><span>有效编码</span><code>bits 1:0：00 = 三缓冲 · 10 = 单缓冲</code><code>bits 3:2：00 = ECAT 读 / PDI 写 · 01 = ECAT 写 / PDI 读</code></div>
    </div>}
    <Notice><p>Rx / Tx 示例以从站接收 / 发送为方向。四个字节值用于理解字段组合，具体值应依据设备功能和 ESC 支持选择；本工具不写入寄存器。</p><p>Bit 7 与型号有关：传统 ESC 保留；ET1150 / IP Core ≥ 4.0 等支持设备可用于 Sequential mode。该模式只作用于 ECAT 写入侧，要求从起始字节按序写完整个 SM，不改变 ECAT 读方向行为。选择能力不会证明设备兼容，请以对应 ESC Feature 和手册为准。</p></Notice>
    <div className="calc-footer"><SourceNote href={REGISTER_V33_SOURCE}>ESC Register Description v3.3 §2.14.3，Control Register（SM 起始 + 4）：</SourceNote><ContextLink onNavigate={onNavigate} entry="esi-sm">查阅 ESI Sm</ContextLink></div>
  </section>
}

export default function Calculators({ initialTool = 'mapping', onNavigate, embedded = false, initialContext }) {
  const [active, setActive] = useState(() => TOOLS.some(tool => tool.id === initialTool) ? initialTool : 'mapping')
  const id = useId()
  function handleTabKey(event) {
    const current = TOOLS.findIndex(tool => tool.id === active)
    let next
    if (event.key === 'ArrowRight') next = (current + 1) % TOOLS.length
    else if (event.key === 'ArrowLeft') next = (current + TOOLS.length - 1) % TOOLS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = TOOLS.length - 1
    else return
    event.preventDefault()
    setActive(TOOLS[next].id)
    event.currentTarget.querySelectorAll('[role="tab"]')[next].focus()
  }
  return <div className={`calculators${embedded ? ' calculators-embedded' : ''}`}>
    {!embedded && <div className="calc-intro"><span className="calc-eyebrow">CONFIGURATION WORKBENCH</span><h2>把配置算清楚</h2><p>从字段到内存，从寄存器到时间。每个结果都展开计算依据。</p></div>}
    <div className="calc-tabs" role="tablist" aria-label="配置计算工具" onKeyDown={handleTabKey}>{TOOLS.map(tool => <button type="button" key={tool.id} id={`${id}-tab-${tool.id}`} role="tab" tabIndex={active === tool.id ? 0 : -1} aria-selected={active === tool.id} aria-controls={`${id}-panel-${tool.id}`} onClick={() => setActive(tool.id)}><tool.Icon size={16} aria-hidden="true" /><span>{tool.label}</span></button>)}</div>
    <div role="tabpanel" id={`${id}-panel-${active}`} aria-labelledby={`${id}-tab-${active}`} tabIndex={0} className="calc-tabpanel">
      {active === 'mapping' && <MappingTool onNavigate={onNavigate} initialWord={initialContext?.mappingWord} />}
      {active === 'layout' && <LayoutTool onNavigate={onNavigate} />}
      {active === 'memory' && <MemoryTool onNavigate={onNavigate} initialMemory={initialContext?.memory} />}
      {active === 'watchdog' && <WatchdogTool onNavigate={onNavigate} initialWatchdog={initialContext?.watchdog} />}
      {active === 'control' && <ControlTool onNavigate={onNavigate} initialValue={initialContext?.controlByte} />}
    </div>
  </div>
}

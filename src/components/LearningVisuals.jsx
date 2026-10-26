import { useEffect, useId, useState } from 'react'
import { ArrowLeft, ArrowRight, Cable, Check, Cpu, Database, FileCode2, HardDrive, Layers3, Network, Pause, Play, Radio, RotateCcw, Server } from 'lucide-react'
import { alStates, errorIndicators, learningEvidence, ledPatterns, objectShapes } from '../data/learning.js'
import { fmmuLesson, learningTypes, ledTimeline, pdoLesson, synchronizationLesson, watchdogLesson } from '../lib/learning-model.js'
import { watchdogScenarios } from '../lib/watchdog-timing.js'
import SscObjectAlignment from './SscObjectAlignment.jsx'

function DiagramNode({ eyebrow, title, children, active = false, onClick, icon: Icon }) {
  const Tag = onClick ? 'button' : 'div'
  return <Tag className={`learn-node ${active ? 'is-current' : ''}`} onClick={onClick} aria-pressed={onClick ? active : undefined} type={onClick ? 'button' : undefined}>
    <span className="learn-node-eyebrow">{Icon && <Icon size={15} />}{eyebrow}</span><strong>{title}</strong><span className="learn-node-description">{children}</span>
  </Tag>
}
function Connector({ reverse = false, label }) {
  const Icon = reverse ? ArrowLeft : ArrowRight
  return <span className={`learn-connector ${reverse ? 'reverse' : ''}`} aria-hidden="true">{label && <small>{label}</small>}<Icon size={19} /></span>
}
function FigureNote({ children }) { return <p className="learn-figure-note">{children}</p> }
function DirectionControl({ direction, onDirection }) {
  return <div className="learn-direction" role="group" aria-label="教学数据方向"><button aria-pressed={direction === 'rx'} onClick={() => onDirection('rx')}><ArrowRight size={14} /><span>主站输出<small>从站 RxPDO</small></span></button><button aria-pressed={direction === 'tx'} onClick={() => onDirection('tx')}><ArrowLeft size={14} /><span>主站输入<small>从站 TxPDO</small></span></button></div>
}

function RolesVisual({ context, onStep, onDirection }) {
  const tx = context.direction === 'tx'
  return <div className="learn-visual learn-role-visual"><DirectionControl direction={context.direction} onDirection={onDirection} />
    <div className="learn-role-map" aria-label={`${tx ? '从站发送到主站' : '主站发送到从站'}的逻辑角色图`}>
      <DiagramNode eyebrow="网络另一端" title="主站" icon={Server} active={context.step === 0} onClick={() => onStep(0)}>{tx ? '接收 Inputs' : '发出 Outputs'}</DiagramNode>
      <Connector reverse={tx} label="EtherCAT" />
      <div className="learn-slave-boundary"><span className="learn-boundary-label">从站 · 逻辑边界</span><div className="learn-node-rail">
        <DiagramNode eyebrow="通信侧" title="ESC" icon={Network} active={context.step === 1} onClick={() => onStep(1)}>报文处理<small>FMMU映射 · SM交接</small></DiagramNode><Connector reverse={tx} />
        <DiagramNode eyebrow="本地接口" title="PDI" icon={Cable} active={context.step === 2} onClick={() => onStep(2)}>{tx ? '应用写入数据' : '应用读取数据'}<small>接口类型依硬件</small></DiagramNode><Connector reverse={tx} />
        <DiagramNode eyebrow="业务侧" title="应用控制器" icon={Cpu} active={context.step === 3} onClick={() => onStep(3)}>{tx ? '采集输入 / 准备数据' : '处理数据 / 控制输出'}<small>MCU、处理器或集成逻辑</small></DiagramNode>
      </div></div>
    </div><FigureNote>图表示职责与数据方向。ESC和应用控制器可以集成；应用处理与EtherCAT报文处理分别理解。</FigureNote>
  </div>
}

function BitRibbon({ label, fields, total = 32, note }) {
  return <div className="learn-bit-ribbon"><div><strong>{label}</strong><span>{note}</span></div><div className="learn-bit-axis" aria-hidden="true">{Array.from({ length: total / 8 }, (_, i) => <span key={i}>Byte {i}</span>)}</div><div className="learn-bit-track" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} role="img" aria-label={`${label}：${fields.map(field => `${field.name}从bit ${field.start}开始，占${field.bits}bit`).join('；')}`}>
    {fields.map(field => <span key={field.name} className={`ribbon-${field.padding ? 'padding' : field.name === 'BOOL' ? 0 : 1}`} style={{ gridColumn: `${field.start + 1} / span ${field.bits}` }} title={`${field.name} · bit ${field.start}–${field.start + field.bits - 1}`}>{field.bits < 6 ? 'B' : field.name}</span>)}
  </div></div>
}
function ObjectsVisual({ context, values, onValues }) {
  const [address, setAddress] = useState('dictionary')
  const shapeKey = Object.hasOwn(objectShapes, values.shape) ? values.shape : 'RECORD', shape = objectShapes[shapeKey]
  if (context.step === 0) return <div className="learn-visual"><div className="learn-address-grid">
    <DiagramNode eyebrow="对象字典" title="0x7000:01" icon={Database} active={address === 'dictionary'} onClick={() => setAddress('dictionary')}>Index 0x7000 + SubIndex 01<small>定位网络可访问的数据成员</small></DiagramNode>
    <DiagramNode eyebrow="ESC寄存器" title="0x0810" icon={Network} active={address === 'esc'} onClick={() => setAddress('esc')}>SM2起始地址寄存器<small>示例内容：0x1100</small></DiagramNode>
    <DiagramNode eyebrow="应用本地内存" title="Outputs.Command" icon={Cpu} active={address === 'local'} onClick={() => setAddress('local')}>程序访问的变量或结构成员<small>RAM地址由实现决定</small></DiagramNode>
  </div><div className="learn-inline-explanation" role="status">{address === 'dictionary' ? '0x7000定位对象，:01定位成员。主站可以通过SDO按这个对象地址访问，也可以在配置中把成员加入PDO。' : address === 'esc' ? '0x0810在ESC寄存器空间内；它保存的0x1100才是本例数据区的起始地址。寄存器位置与寄存器里的数值分别解释。' : 'Outputs.Command是本地程序中的数据。它可以为对象成员提供存储；网络对象地址和程序内存地址通过实现联系。'}</div></div>
  if (context.step === 1) return <div className="learn-visual"><div className="learn-segmented" role="group" aria-label="对象组织形式">{Object.keys(objectShapes).map(key => <button key={key} aria-pressed={shapeKey === key} onClick={() => onValues({ shape: key })}>{key}</button>)}</div><div className="learn-object-heading"><Database size={20} /><div><strong>{shape.index} · {shape.name}</strong><span>{shape.caption}</span></div></div>
    <div className="learn-table-scroll"><table className="learn-table"><thead><tr><th>SubIndex</th><th>名称</th><th>协议类型</th><th>示例值</th><th>含义</th></tr></thead><tbody>{shape.members.map(member => <tr key={member.si} className={member.si === '00' ? 'learn-header-member' : ''}><th><code>:{member.si}</code></th><td>{member.name}</td><td><code>{member.type}</code></td><td><code>{member.value}</code></td><td>{member.role}</td></tr>)}</tbody></table></div><FigureNote>{shapeKey === 'VARIABLE' ? 'VARIABLE的:00就是变量值。' : '本例成员连续，所以最高子索引与成员数量相等；存在空洞时需分别核对。表中为协议描述，本地SI0的存储形式见下一步。'}</FigureNote></div>
  return <div className="learn-visual"><div className="learn-layout-compare"><BitRibbon label="PDO活动位流" note="BOOL + UINT16 · 17 bit → 3 Byte" fields={[{ name: 'BOOL', start: 0, bits: 1 }, { name: 'UINT16', start: 1, bits: 16 }]} /><BitRibbon label="SSC默认本地布局示意段" note="BOOL + 显式填充 + UINT16 · 32 bit" fields={[{ name: 'BOOL', start: 0, bits: 1 }, { name: 'pad_7', start: 1, bits: 7, padding: true }, { name: 'pad_8', start: 8, bits: 8, padding: true }, { name: 'UINT16', start: 16, bits: 16 }]} /></div>
    <div className="learn-ribbon-key"><span><i className="blue-key" />B = BOOL，1 bit</span><span><i className="soft-key" />UINT16，16 bit</span><span><i className="pad-key" />本地填充</span></div>
    <div className="learn-inline-explanation">上图UINT16从bit 1紧接映射。下图用pad_7和pad_8分别填充，先填满16 bit块，UINT16再从WORD边界开始；该演示段未加入完整对象的SI0。只有明确映射的padding才进入PDO。</div><details className="learn-deeper"><summary>展开完整SSC边界图解与原排布 / 补齐比较</summary><SscObjectAlignment /></details>
  </div>
}

function PdoChain({ model, step, onStep }) {
  return <div className="learn-reference-chain"><div className="learn-diagram-label">配置引用链 <small>箭头表示分配、引用和映射</small></div><div className="learn-node-rail">
    <DiagramNode eyebrow="ESC / SyncManager" title={`SM${model.sm}`} active={step === 0} onClick={() => onStep(0)}>{model.master}<small>{model.slave} · {model.pdo}</small></DiagramNode><Connector label="分配" />
    <DiagramNode eyebrow="CoE / Assignment对象" title={model.assignment} active={step === 1} onClick={() => onStep(1)}><code>:00 = {model.active.length ? 1 : 0}</code><small>{model.active.length ? `:01 → ${model.mappingIndex}` : '未分配活动PDO'}</small></DiagramNode><Connector label="引用" />
    <DiagramNode eyebrow="CoE / Mapping对象" title={model.mappingIndex} active={step === 2} onClick={() => onStep(2)}><code>:00 = {model.active.length}</code><small>{model.active.length} 个活动映射项</small></DiagramNode><Connector label="映射" />
    <DiagramNode eyebrow="应用对象 / 成员" title={model.objectIndex} onClick={() => onStep(2)}>{model.rows.map(row => <small key={row.id}>:{String(row.si).padStart(2, '0')} {row.name} · {row.bits} bit</small>)}</DiagramNode>
  </div></div>
}
function MappingBits({ model }) {
  const [memberId, setMemberId] = useState('member-0'), [part, setPart] = useState('index')
  const row = model.active.find(item => item.id === memberId) || model.active[0]
  if (!row) return <div className="learn-inline-explanation">当前没有活动映射项。进入“容量”步骤选择成员后，可在这里查看编码。</div>
  const parts = row.mapping
  return <div className="learn-mapping-detail"><div className="learn-table-scroll"><table className="learn-table"><thead><tr><th>Mapping位置</th><th>32-bit映射值</th><th>被映射成员</th></tr></thead><tbody>{model.active.map((item, i) => <tr key={item.id} className={item.id === row.id ? 'selected' : ''}><th><button aria-pressed={item.id === row.id} onClick={() => setMemberId(item.id)}>{model.mappingIndex}:{String(i + 1).padStart(2, '0')}</button></th><td><code>{item.mapping.hex}</code></td><td><code>{model.objectIndex}:{String(item.si).padStart(2, '0')}</code> · {item.name}</td></tr>)}</tbody></table></div>
    <div className="learn-bit-value"><span>点位段看含义</span><strong>{parts.hex}</strong></div><div className="learn-mapping-bits" role="group" aria-label="32位PDO映射拆解">{[['index', '31…16 · Index', parts.indexHex], ['subindex', '15…8 · SubIndex', parts.subIndexHex], ['length', '7…0 · BitLength', parts.lengthHex]].map(([id, label, value]) => <button key={id} aria-pressed={part === id} onClick={() => setPart(id)}><small>{label}</small><strong>{value}</strong></button>)}</div>
    <p className="learn-inline-explanation" role="status">{part === 'index' ? `Index ${parts.indexHex}：定位被映射的应用对象，而Mapping对象自己的索引仍是${model.mappingIndex}。` : part === 'subindex' ? `SubIndex ${parts.subIndexHex}：定位对象中的${row.name}成员；它与Mapping表中“第几个条目”的编号分开。` : `BitLength ${parts.lengthHex} = ${parts.bitLength} bit：这个成员加入PDO时使用的协议位长。`}</p>
  </div>
}
function PdoCapacity({ values, onValues, model, error, onReset, direction }) {
  const fallback = pdoLesson({ direction })
  return <div className="learn-capacity"><div className="learn-diagram-label">调整教学映射 <small>改变选择与类型，观察长度和占用</small></div><div className="learn-table-scroll"><table className="learn-table"><thead><tr><th>对象成员</th><th>协议类型</th><th>活动映射</th><th>PDO位偏移</th></tr></thead><tbody>{(model || fallback).rows.map((row, i) => <tr key={row.id}><th>{row.name}</th><td><select aria-label={`${row.name} 协议类型`} value={values.members[i].type} onChange={event => onValues({ members: values.members.map((member, index) => index === i ? { ...member, type: event.target.value } : member) })}>{learningTypes.map(type => <option key={type}>{type}</option>)}</select></td><td><label className="learn-check"><input type="checkbox" aria-label={`映射 ${row.name}`} checked={values.members[i].mapped} onChange={event => onValues({ members: values.members.map((member, index) => index === i ? { ...member, mapped: event.target.checked } : member) })} />加入</label></td><td><code>{model?.layout.rows.find(item => item.id === row.id)?.bitOffset ?? '—'}</code></td></tr>)}</tbody></table></div>
    <div className="learn-input-grid"><label>容量上限<input inputMode="numeric" aria-label="教学容量上限 Byte" value={values.capacity} onChange={event => onValues({ capacity: event.target.value })} /><small>Byte · 对照SSC容量</small></label><label>SM缓冲模式<select aria-label="教学SM缓冲模式" value={values.buffers} onChange={event => onValues({ buffers: event.target.value })}><option value="3">Buffered · 三缓冲</option><option value="1">Single · 单缓冲</option></select></label><label>ESC内部处理宽度<select aria-label="教学ESC内部字宽" value={values.internalWidth} onChange={event => onValues({ internalWidth: event.target.value })}>{[8, 16, 32, 64].map(width => <option key={width} value={width}>{width} bit</option>)}</select></label></div>
    {error ? <LearningError error={error} onReset={onReset} /> : <><div className="learn-calculation-chain"><div><small>活动映射</small><strong>{model.layout.totalBits}<em>bit</em></strong><span>{model.active.length ? model.active.map(row => row.bits).join(' + ') : '没有活动成员'}</span></div><Connector /><div><small>PDO长度 L</small><strong>{model.layout.totalBytes}<em>Byte</em></strong><span>ceil(Σbit / 8)</span></div><Connector /><div><small>SM物理占用</small><strong>{model.memory.allocated}<em>Byte</em></strong><span>{model.memory.bufferSpan} B × {model.memory.effectiveBuffers} 份</span></div></div>
      <div className={`learn-capacity-result ${model.fits ? 'passes' : 'fails'}`} role="status">{model.fits ? <Check size={15} /> : <Radio size={15} />}<strong>{model.layout.totalBytes} {model.fits ? '≤' : '>'} {model.capacity} B · {model.fits ? '容量满足' : '容量不足'}</strong><span>容量比较使用PDO长度；物理RAM占用另计。</span></div>
      <FigureNote>{!model.memory.active ? 'Length=0，本演示SM数据区停用。' : model.memory.singleByteMode ? 'Length=1：本模型不使用额外两个缓冲，物理跨度仍按内部字宽核对。' : `每份跨度按${values.internalWidth} bit内部字宽向外取整。本例起始地址0x1100；${values.buffers === '3' ? '三份是存储占用，不是发送三份PDO。' : '当前演示一份存储。'}`}</FigureNote></>}
  </div>
}
function LearningError({ error, onReset }) { return <div className="learn-error" role="alert"><strong>参数需要修正</strong><p>{error}</p><button onClick={onReset}><RotateCcw size={13} />恢复教学值</button></div> }

function PdoVisual({ context, values, onValues, onStep, onDirection, onReset }) {
  let model, error
  try { model = pdoLesson({ ...values, direction: context.direction }) } catch (reason) { error = reason.message }
  const fallback = model || pdoLesson({ direction: context.direction })
  return <div className="learn-visual"><DirectionControl direction={context.direction} onDirection={onDirection} />
    {context.step === 0 ? <div className="learn-direction-map"><DiagramNode eyebrow={fallback.master} title="主站" icon={Server}>{context.direction === 'rx' ? '发出控制 / 目标数据' : '接收状态 / 采集数据'}</DiagramNode><Connector reverse={context.direction === 'tx'} label={fallback.pdo} /><DiagramNode eyebrow={fallback.slave} title="从站" icon={Cpu}>{context.direction === 'rx' ? 'RxPDO · 接收' : 'TxPDO · 发送'}</DiagramNode></div> : context.step < 3 ? <><PdoChain model={fallback} step={context.step} onStep={onStep} />{error && <LearningError error={error} onReset={onReset} />}{context.step === 2 && !error && <MappingBits model={model} />}</> : <PdoCapacity direction={context.direction} values={values} onValues={onValues} model={model} error={error} onReset={onReset} />}
    <FigureNote>常见带邮箱CoE从站的教学示例。可用描述、可映射属性与已选择的活动映射分别核对；当前数值不来自实际设备。</FigureNote>
  </div>
}

function ChannelsVisual({ context, values, onValues, onScene, onTiming }) {
  const requested = Number(values.channel), selected = [0, 1, 2, 3].includes(requested) ? requested : context.channel
  const [upload, setUpload] = useState(true)
  const channels = [
    ['SM0', 'Mailbox Out', '主站 → 从站', '邮箱写入 / 请求'], ['SM1', 'Mailbox In', '从站 → 主站', '邮箱读取 / 响应'],
    ['SM2', 'Outputs / RxPDO', '主站 → 从站', '过程数据交接'], ['SM3', 'Inputs / TxPDO', '从站 → 主站', '过程数据交接'],
  ]
  return <div className="learn-visual"><div className="learn-diagram-label">典型四SM CoE设备 <small>选择通道查看职责</small></div><div className="learn-table-scroll"><table className="learn-table"><thead><tr><th>SM通道</th><th>常见用途</th><th>数据方向</th><th>交接内容</th></tr></thead><tbody>{channels.map((channel, i) => <tr key={channel[0]} className={selected === i ? 'selected' : ''}><th><button aria-pressed={selected === i} onClick={() => onValues({ channel: String(i) })}>{channel[0]}</button></th>{channel.slice(1).map(value => <td key={value}>{value}</td>)}</tr>)}</tbody></table></div>
    {context.step === 1 ? <div className="learn-mailbox-example"><div className="learn-segmented" role="group" aria-label="SDO访问示例"><button aria-pressed={upload} onClick={() => setUpload(true)}>SDO Upload · 读参数</button><button aria-pressed={!upload} onClick={() => setUpload(false)}>SDO Download · 写参数</button></div><div className="learn-message-row"><span>主站</span><ArrowRight size={17} /><strong>SM0 · 请求</strong><code>0x2000:00{upload ? '' : ' = 10'}</code><ArrowRight size={17} /><span>从站</span></div><div className="learn-message-row"><span>主站</span><ArrowLeft size={17} /><strong>SM1 · 响应</strong><code>{upload ? '值 = 10' : '确认 / 错误应答'}</code><ArrowLeft size={17} /><span>从站</span></div><FigureNote>读参数也需要主站发请求；Upload/Download的命名与SM邮箱本身的数据方向分开理解。</FigureNote></div> : <div className="learn-inline-explanation"><code>0x1C00:{String(selected + 1).padStart(2, '0')} = 0x0{selected + 1}</code> 将{channels[selected][0]}标为{['Mailbox Write','Mailbox Read','Process Data Output','Process Data Input'][selected]}。{selected < 2 ? '本例用两条相反方向的邮箱通道交接请求与响应。' : '成员和位长在映射中确定，运行时按配置交接数据区。'}<small>本例0x1C00:00=4，:01…:04分别对应SM0…SM3。</small></div>}
    {context.step === 2 && <div className="learn-two-actions"><button onClick={() => onScene('buffer')}><Layers3 size={15} />看三缓冲怎样交接<ArrowRight size={14} /></button><button onClick={() => onTiming('sdo')}><Play size={15} />看SDO请求与回调时序<ArrowRight size={14} /></button></div>}
    <FigureNote>无邮箱设备或其他实现可能采用不同SM分配；这里的编号不能代替ESI与硬件核对。</FigureNote>
  </div>
}

function FmmuVisual({ values, onValues, onReset }) {
  let model
  try { model = fmmuLesson(values.logicalBit) } catch (error) { return <LearningError error={error.message} onReset={onReset} /> }
  const bit = model.offset, physical = model.physicalOffset
  return <div className="learn-visual"><div className="learn-diagram-label">位级地址映射 <small>本例逻辑起点0x00010000，物理起点0x1100.bit3</small></div><label className="learn-range">选择逻辑位 <strong>{bit}</strong><input type="range" aria-label="FMMU教学逻辑位" min="0" max="15" value={bit} onChange={event => onValues({ logicalBit: event.target.value })} /></label>
    <div className="learn-fmmu-map"><div><small>EtherCAT逻辑空间 · 所选位置</small><strong>{model.logicalAddress} · bit {model.logicalBit}</strong><div className="learn-memory-bits">{Array.from({ length: 16 }, (_, i) => <button key={i} aria-label={`逻辑bit ${i}`} aria-pressed={bit === i} onClick={() => onValues({ logicalBit: String(i) })}>{i}</button>)}</div></div><Connector label="FMMU" /><div><small>ESC物理内存 · 所选位置</small><strong>{model.physicalAddress} · bit {model.physicalBit}</strong><div className="learn-memory-bits physical">{Array.from({ length: 24 }, (_, i) => <span key={i} className={physical === i ? 'selected' : i < 3 || i > 18 ? 'outside' : ''}>{i % 8}</span>)}</div></div></div>
    <div className="learn-inline-explanation" role="status">逻辑位偏移{bit} → 物理位偏移{physical}：落在ESC地址{model.physicalAddress}的bit {model.physicalBit}。SM管理这一带数据区的交接；对象Index仍是另一种标识。</div><FigureNote>本图只演示16个位的映射关系，地址为教学值；不生成或写入FMMU寄存器。</FigureNote>
  </div>
}

function BufferVisual({ onTiming, onScene }) {
  return <div className="learn-visual"><div className="learn-buffer-roles"><DiagramNode eyebrow="生产端" title="W · 写入" icon={Database}>准备完整的新数据</DiagramNode><Connector label="发布后交换" /><DiagramNode eyebrow="交接区" title="F · 待交换" icon={Layers3}>最新完成或空闲的一份</DiagramNode><Connector label="获取后交换" /><DiagramNode eyebrow="消费端" title="R · 读取" icon={Cpu}>本次读取期间保持一致</DiagramNode></div><div className="learn-two-actions"><button onClick={() => onTiming('buffer')}><Play size={15} />逐步观察三份缓冲轮换<ArrowRight size={14} /></button><button onClick={() => onScene('pdo', 3)}>把活动位长带入容量演算<ArrowRight size={14} /></button></div><FigureNote>上图表达交接角色；实际寄存器与触发方式按ESC。交接过程可在时序工作台逐步前进、回退和播放。</FigureNote></div>
}

function ProcessVisual(props) {
  if (props.context.scene.id === 'channels') return <ChannelsVisual {...props} />
  if (props.context.scene.id === 'fmmu') return <FmmuVisual {...props} />
  if (props.context.scene.id === 'buffer') return <BufferVisual {...props} />
  return <PdoVisual {...props} />
}

function PulseTrack({ name, caption, pulses, end, current, tone = 'blue' }) {
  return <div className={`learn-wave-row ${current ? 'is-current' : ''} tone-${tone}`}><div className="learn-wave-label"><strong>{name}</strong><small>{caption}</small></div><div className="learn-wave-track" role="img" aria-label={`${name}：${pulses.map(time => `${time}µs`).join('、')}`}><svg viewBox="0 0 1000 58" preserveAspectRatio="none" aria-hidden="true"><path d="M0 43 H1000" className="learn-wave-base" vectorEffect="non-scaling-stroke" />{pulses.map(time => { const x = time / end * 1000; return <path key={time} d={`M${x} 43 V17 H${Math.min(x + 12, 1000)} V43`} className="learn-wave-pulse" vectorEffect="non-scaling-stroke" /> })}</svg>{pulses.map(time => <span className={`learn-wave-time ${time / end > .95 ? 'at-end' : time === 0 ? 'at-start' : ''}`} key={time} style={{ left: `${time / end * 100}%` }}>{Number(time.toFixed(2))}</span>)}</div></div>
}
function SyncModesVisual({ context, onStep, onScene }) {
  const modes = [
    { name: 'FreeRun', source: '本地主循环 / 定时', role: '应用自主调度', note: '与总线周期没有固定相位关系' },
    { name: 'SM Sync', source: '所用SM事件', role: '按事件组织执行', note: '事件通知与软件处理共同影响时序' },
    { name: 'DC Sync', source: 'DC同步事件', role: '以同步时钟触发', note: '数据就绪、处理余量和物理延迟另核对' },
  ]
  const selected = modes[context.step]
  return <div className="learn-visual"><div className="learn-address-grid">{modes.map((mode, index) => <DiagramNode key={mode.name} eyebrow="同步方式" title={mode.name} active={context.step === index} onClick={() => onStep(index)}>{mode.role}<small>{mode.note}</small></DiagramNode>)}</div><div className="learn-sync-mode-flow"><span>{selected.source}</span><ArrowRight size={17} /><strong>应用处理</strong><ArrowRight size={17} /><span>准备 / 消费过程数据</span></div><FigureNote>图仅表达典型触发来源，具体支持、调用顺序和通知机制按所用SSC、ESC与配置。FreeRun仍需保证数据一致访问。</FigureNote><button className="learn-inline-action" onClick={() => onScene('sync')}><Radio size={14} />继续看SYNC与LATCH事件<ArrowRight size={14} /></button></div>
}
function SyncVisual({ context, values, onValues, onReset, onTiming }) {
  let model, error
  try { model = synchronizationLesson(values) } catch (reason) { error = reason.message }
  const fields = [['period', '周期', 'µs'], ['phase', 'SYNC1偏移', 'µs'], ['latch', '外部边沿', 'µs'], ['latency', '应用读取延迟', 'µs']]
  return <div className="learn-visual"><div className="learn-input-grid sync-inputs">{fields.map(([key, label, unit]) => <label key={key}>{label}<span><input type="number" aria-label={`同步教学 ${label}`} value={values[key]} min={key === 'period' ? 100 : 0} onChange={event => onValues({ [key]: event.target.value })} /><small>{unit}</small></span></label>)}</div>
    {error ? <LearningError error={error} onReset={onReset} /> : <><div className="learn-waveform" aria-label="SYNC输出与LATCH捕获的共用时间轴"><div className="learn-wave-axis"><span>DC时间 · µs</span><div>{[0, model.end / 2, model.end].map(time => <span key={time}>{Number(time.toFixed(1))}</span>)}</div></div>
      <PulseTrack name="SYNC0" caption="ESC → 应用 / 外设" pulses={model.sync0} end={model.end} current={context.step === 1} />
      <PulseTrack name="SYNC1" caption={`相对偏移 ${model.phase} µs`} pulses={model.sync1} end={model.end} current={context.step === 1} />
      <PulseTrack name="LATCH" caption="外部边沿 → ESC" pulses={[model.latch]} end={model.end} current={context.step === 2} tone="green" />
      <PulseTrack name="应用读取" caption="稍后获知 / 读取" pulses={[model.readAt]} end={model.end} current={context.step === 2} tone="muted" />
    </div><div className="learn-timestamp-readouts"><div><small>捕获的DC时间戳</small><strong>{model.captured}<em>µs</em></strong><span>记录外部边沿发生时刻</span></div><div><small>应用读取时刻</small><strong>{model.readAt}<em>µs</em></strong><span>晚 {model.latency} µs，不改变捕获值</span></div></div><button className="learn-inline-action" onClick={() => onTiming('sync-latch', values)}><Play size={14} />用完整时序逐事件查看<ArrowRight size={14} /></button><FigureNote>{model.scope}本例SYNC0/1是否输出到引脚、LATCH支持与边沿设置均需按ESC核对。</FigureNote></>}
  </div>
}

function WatchdogVisual({ context, values, onValues, onReset, onTiming }) {
  let model, error
  try { model = watchdogLesson(values) } catch (reason) { error = reason.message }
  return <div className="learn-visual"><div className="learn-watch-controls"><label>教学触发场景<select aria-label="概念看门狗场景" value={values.watchScenario} onChange={event => onValues({ watchScenario: event.target.value })}>{watchdogScenarios.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>观察时刻 <strong>{model ? model.time : values.watchTime} ms</strong><input type="range" aria-label="概念看门狗观察时刻" min="0" max="220" step="10" value={model ? model.time : 0} onChange={event => onValues({ watchTime: event.target.value })} /></label></div>
    {error ? <LearningError error={error} onReset={onReset} /> : <><div className="learn-watch-timebase">共享分频 <code>0x0400 · D=2498</code><span>tick = (D + 2) × 40 ns = 0.1 ms</span></div><div className="learn-watch-lanes">{model.lanes.map(lane => <div key={lane.id} className={`learn-watch-lane ${lane.state === 'expired' ? 'expired' : ''}`}><div className="learn-node-eyebrow">ESC / Watchdog / {lane.address}</div><h3>{lane.title}</h3><p className="learn-watch-path">{lane.id === 'pdi' ? '应用控制器 → PDI → ESC' : '主站 → 启用WD触发的SM → ESC'}</p><div className="learn-watch-counter"><span>Count = {lane.count}</span><strong>{lane.timeout} ms</strong></div><progress max={lane.timeout} value={Math.min(lane.timeout, lane.remaining)} aria-label={`${lane.title}剩余标称时间`} /><div className="learn-watch-status"><strong>{lane.state === 'expired' ? '已到标称期限' : lane.interrupted ? '停止刷新，尚未超时' : '持续触发，重新计时'}</strong><span>剩余 {lane.remaining} ms</span></div>{context.step === 1 && <dl><div><dt>最后有效触发</dt><dd>{lane.lastTrigger} ms</dd></div><div><dt>标称期限</dt><dd>{lane.deadline} ms</dd></div></dl>}</div>)}</div><button className="learn-inline-action" onClick={() => onTiming('watchdog', { divider: 2498, pdiCount: 1000, smCount: 1000, triggerInterval: 20, stopTime: 60, end: 220 }, { initialScenario: values.watchScenario, initialTime: model.time })}><Play size={14} />带入完整时序逐事件查看<ArrowRight size={14} /></button><FigureNote>本例每20 ms触发，选择中断的一侧在60 ms后不再刷新；两个Count分别为1000。这里只演示40 ns时基下的名义监控状态，超时后的处理依ESC/固件；SSC软件计时路径另查对应配置。</FigureNote></>}
  </div>
}

function LedTrack({ name, colour, track, cursor, windowMs }) {
  const { pattern, intervals, on } = track
  return <div className={`learn-led-track colour-${colour}`}>
    <div className="learn-led-identification"><span className={`learn-led ${on ? 'is-on' : ''}`} aria-hidden="true" /><div><strong>{name}<em className="learn-led-current">{on ? '亮' : '灭'}</em></strong><small>{pattern.label}</small></div></div>
    <div className="learn-led-signal"><div className="learn-led-wave" role="img" aria-label={`${name}，${pattern.text}，当前${on ? '亮' : '灭'}`}>{intervals.map(([start, end]) => <span key={start} style={{ left: `${start / windowMs * 100}%`, width: `${(end - start) / windowMs * 100}%` }} />)}<i style={{ left: `${cursor / windowMs * 100}%` }} /></div><small>{pattern.text}</small></div>
  </div>
}
function StateVisual({ context, values, onValues, onStep, onTiming }) {
  const state = alStates[context.step], selectedError = errorIndicators.find(item => item.id === values.error)
  const error = selectedError || errorIndicators[0], run = values.bootstrap ? 'flicker' : state.run
  const clockKey = `${values.error}:${run}`, errorGroup = useId()
  const [clock, setClock] = useState({ key: clockKey, playing: false, time: 0 })
  if (clock.key !== clockKey) setClock({ key: clockKey, playing: false, time: 0 })
  const { playing, time } = clock.key === clockKey ? clock : { playing: false, time: 0 }
  const model = ledTimeline({ run, error: error.pattern, time })
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => { setReduced(media.matches); if (media.matches) setClock(previous => ({ ...previous, playing: false })) }
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    if (!playing || reduced || !selectedError) return
    const timer = setInterval(() => setClock(previous => ({ key: clockKey, playing: true, time: ((previous.key === clockKey ? previous.time : 0) + 25) % model.windowMs })), 25)
    return () => clearInterval(timer)
  }, [playing, reduced, selectedError, clockKey, model.windowMs])
  function updateClock(patch) { setClock(previous => ({ ...(previous.key === clockKey ? previous : { key: clockKey, playing: false, time: 0 }), ...patch })) }
  function selectError(id) { setClock({ key: `${id}:${run}`, playing: false, time: 0 }); onValues({ error: id }) }
  return <div className="learn-visual"><div className="learn-al-chain">{alStates.map((item, i) => <DiagramNode key={item.id} eyebrow={item.label} title={item.id} active={!values.bootstrap && context.step === i} onClick={() => onStep(i)}>{['通信初始化', '邮箱参数通信', '输入可用 / 输出安全', '正常过程数据'][i]}</DiagramNode>)}</div>
    <div className="learn-state-tools"><span>当前 <strong>{values.bootstrap ? 'BOOT · 升级分支' : state.id}</strong></span><button aria-pressed={values.bootstrap} onClick={() => onValues({ bootstrap: !values.bootstrap })}>BOOT · 支持时的升级分支</button></div>
    <div className="learn-state-capabilities">{values.bootstrap ? <><span>升级通信按固件支持</span><span>不进入正常周期输出</span></> : <><span className={state.mailbox ? 'available' : ''}>邮箱 {state.mailbox ? '可用' : '未开放'}</span><span className={state.inputs ? 'available' : ''}>过程输入 {state.inputs ? '可更新' : '未开放'}</span><span className={state.outputs ? 'available' : ''}>过程输出 {state.outputs ? '可运行' : '保持安全'}</span></>}</div>
    <div className="learn-led-lab">
      <div className="learn-diagram-label">观察灯态 <small>RUN看通信状态 · ERR看错误类型</small></div>
      <fieldset className="learn-error-scenes"><legend>ERR 故障场景</legend><div>{errorIndicators.map(item => <label key={item.id} className={values.error === item.id ? 'is-selected' : ''}><input type="radio" name={errorGroup} checked={values.error === item.id} onChange={() => selectError(item.id)} aria-label={`${item.label} · ${ledPatterns[item.pattern].shortLabel}`} /><span><strong>{item.label}</strong><small>ERR {ledPatterns[item.pattern].shortLabel}</small></span></label>)}</div></fieldset>
      {!selectedError ? <LearningError error="链接中的ERR场景未识别，请选择上方六种场景之一。" onReset={() => selectError('none')} /> : <>
        <div className={`learn-led-explanation ${error.id === 'none' ? '' : 'has-error'}`} role="status"><strong>{error.label} → ERR {ledPatterns[error.pattern].shortLabel}</strong><p>{error.explanation}</p></div>
        <div className="learn-led-axis"><span>共用时间轴 · ms</span><div>{[0, model.windowMs / 2, model.windowMs].map(at => <span key={at}>{at}</span>)}</div></div>
        <LedTrack name="RUN · 绿色" colour="green" track={model.tracks[0]} cursor={model.cursor} windowMs={model.windowMs} />
        <LedTrack name="ERR · 红色" colour="red" track={model.tracks[1]} cursor={model.cursor} windowMs={model.windowMs} />
        <div className="learn-led-controls"><button disabled={reduced} onClick={() => updateClock({ playing: !playing })}>{playing ? <Pause size={14} /> : <Play size={14} />}{reduced ? '减少动画：手动观察' : playing ? '暂停灯效' : '播放灯效'}</button><label>观察时刻<input type="range" min="0" max={model.windowMs - 1} value={Math.floor(model.cursor)} aria-label="灯效观察时刻" onChange={event => updateClock({ playing: false, time: Number(event.target.value) })} /><output>{Math.floor(model.cursor)} ms</output></label><button aria-label="灯效回到起点" onClick={() => updateClock({ playing: false, time: 0 })}><RotateCcw size={14} /></button></div>
        <p className="learn-led-clock-status">{reduced ? '减少动画已开启，可拖动时间手动观察。' : playing ? '正在播放，可暂停或拖动时间逐点查看。' : '已暂停；点击“播放灯效”观察闪烁，或拖动时间查看亮灭。'}<span>亮带表示点亮，竖线表示观察时刻；每轮 {model.windowMs} ms。</span></p>
      </>}
      <details className="learn-deeper learn-led-scope"><summary>规范、硬件实现与状态迁移</summary><p>指示与标识规范为ETG.1300。本页按公开的Beckhoff灯态表和厂商节奏资料作对照；两条轨道分别演示RUN与ERR，不模拟故障引起的AL状态回退，也不模拟共用双色灯的优先显示。</p><p>真实灯态可能由MCU驱动，或由支持该功能的ESC自动产生，并受0x0139覆盖控制及芯片能力影响。结合AL Status Code与设备手册判断；PDI看门狗和过程数据看门狗不能一律用同一种灯态解释。</p><a href={learningEvidence.led.url} target="_blank" rel="noreferrer">Beckhoff §2.5.5 · ERR灯态与覆盖</a><a href={learningEvidence.ledTiming.url} target="_blank" rel="noreferrer">快闪／慢闪／单闪／双闪节奏</a></details>
    </div><details className="learn-deeper"><summary>EtherCAT OP与CiA402驱动使能怎样区分？</summary><p>AL状态描述通信；CiA402的PDS状态描述驱动控制。通信在OP时，驱动仍可能处于Switch on disabled或Fault。</p><button className="learn-inline-action" onClick={() => onTiming('drive')}><Play size={14} />对照控制字、状态字和驱动状态</button></details><FigureNote>教学故障由你独立选择，切换AL步骤不会自动改变ERR类型。灯态是查阅入口，具体错误仍需结合AL Status Code与设备手册。</FigureNote>
  </div>
}

const fileRoles = [
  { id: 'esi', name: 'ESI', form: 'XML设备描述', owner: '主站工程', icon: FileCode2, role: '描述身份、通信资源、可用PDO与能力，帮助工程工具选择和配置设备。' },
  { id: 'sii', name: 'SII', form: '设备信息内容 / 接口', owner: 'ESC与主站读取', icon: Database, role: '提供在线发现和初始化所需的设备信息，具体分类与内容按适用规范和实现。' },
  { id: 'eeprom', name: 'EEPROM', form: '非易失存储介质', owner: '设备端', icon: HardDrive, role: '常用于保存SII。支持的设备也可由固件仿真相应信息访问。' },
  { id: 'firmware', name: '固件', form: '控制器上的程序', owner: '设备应用', icon: Cpu, role: '实现协议栈适配与应用行为。生成了描述文件后，设备实现仍需与描述匹配。' },
]
function StartupVisual({ context, values, onValues, onNavigate, onTiming }) {
  const [selected, setSelected] = useState('esi')
  if (context.step === 0) return <div className="learn-visual"><div className="learn-file-grid">{fileRoles.map(file => <DiagramNode key={file.id} eyebrow={file.owner} title={file.name} icon={file.icon} active={selected === file.id} onClick={() => setSelected(file.id)}>{file.form}</DiagramNode>)}</div><p className="learn-inline-explanation" role="status">{fileRoles.find(file => file.id === selected).role}</p><FigureNote>应用定义与SSC配置可参与生成多份产物；描述文件、设备信息与固件实现须核对一致，生成与部署步骤按工具和硬件。</FigureNote></div>
  if (context.step === 1) return <div className="learn-visual"><div className="learn-segmented" role="group" aria-label="SII信息来源"><button aria-pressed={!values.emulation} onClick={() => onValues({ emulation: false })}>EEPROM存储示意</button><button aria-pressed={values.emulation} onClick={() => onValues({ emulation: true })}>EEPROM仿真示意</button></div><div className="learn-node-rail learn-startup-chain"><DiagramNode eyebrow="设备端 · SII来源" title={values.emulation ? '固件仿真实现' : 'EEPROM'} icon={values.emulation ? Cpu : HardDrive}>{values.emulation ? '由支持的实现提供信息' : '保存SII内容'}</DiagramNode><Connector label="加载 / 提供" /><DiagramNode eyebrow="EtherCAT通信侧" title="ESC" icon={Network}>初始化设备信息接口<small>具体启动由硬件决定</small></DiagramNode><Connector label="在线读取" /><DiagramNode eyebrow="主站工程侧" title="身份与能力" icon={Server}>选择匹配的ESI<small>核对Vendor / Product / Revision</small></DiagramNode></div><div className="learn-inline-explanation">ESI在主站工程中提供描述，SII通过设备端接口提供信息，固件负责实际实现。修改ESI文件不会自动改变已部署的设备身份或行为。</div><FigureNote>这是资料与读取关系图，不规定所有设备的完整上电时序。EEPROM仿真、重载和PDI就绪条件应按具体ESC文档。</FigureNote></div>
  return <div className="learn-visual"><div className="learn-profile-grid"><DiagramNode eyebrow="ETG.5001 · MDP" title="模块化组织" icon={Layers3}>模块 / 槽位 / 实例<small>对象与PDO索引展开规则</small></DiagramNode><DiagramNode eyebrow="CiA402 · Drive profile" title="驱动控制行为" icon={Cpu}>控制字 / 状态字 / PDS<small>使能流程与运行模式</small></DiagramNode></div><div className="learn-inline-explanation">两种Profile关注的方面不同。模块化结构、实例数量、模块Profile和驱动行为应分别核对，不能仅靠“普通I/O / 伺服”的二选一判断。</div><div className="learn-two-actions"><button onClick={() => onNavigate('xlsx-modular')}><Layers3 size={14} />查看模块与索引步长<ArrowRight size={14} /></button><button onClick={() => onTiming('drive')}><Play size={14} />看CiA402状态示意<ArrowRight size={14} /></button></div><FigureNote>单实例模块仍可以保留IndexIncrement与PdoIndexIncrement；是否展开和采用哪种Profile，以定义文件及生成结果为准。</FigureNote></div>
}

export default function LearningVisuals(props) {
  const topic = props.context.topic.id
  if (topic === 'roles') return <RolesVisual {...props} />
  if (topic === 'objects') return <ObjectsVisual {...props} />
  if (topic === 'process') return <ProcessVisual {...props} />
  if (topic === 'sync') return props.context.scene.id === 'modes' ? <SyncModesVisual {...props} /> : <SyncVisual {...props} />
  if (topic === 'state') return props.context.scene.id === 'watchdog' ? <WatchdogVisual {...props} /> : <StateVisual {...props} />
  if (topic === 'startup') return <StartupVisual {...props} />
  return null
}

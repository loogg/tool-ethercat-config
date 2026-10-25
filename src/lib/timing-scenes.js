import { watchdogTiming, watchdogScenarios } from './watchdog-timing.js'

const SSC = { title: 'Beckhoff ET9300 · SSC V1.10', url: 'https://download.beckhoff.com/download/Document/io/ethercat-development-products/an_et9300_v1i10.pdf' }
const ESC = { title: 'Beckhoff ESC · Technology §8.5 / §13', url: 'https://download.beckhoff.com/download/document/io/ethercat-development-products/ethercat_esc_datasheet_sec1_technology_v2.5.pdf' }
const DRIVE = { title: 'TI · CiA402 drive example', url: 'https://software-dl.ti.com/processor-industrial-sw/esd/ind_comms_sdk/am243x/latest/docs/am243x/ethercat_subdevice/example2.html' }
const field = (key, label, value, unit, extra = {}) => ({ key, label, value, unit, ...extra })
export const timingLessons = {
  watchdog: { title: '看门狗：触发、倒计时与超时', subtitle: 'PDI 与 SM 共用时基，各自计数；沿同一时间轴对比。', unit: 'ms', references: [ESC, SSC], fields: [field('divider', 'Divider · 0x0400', 2498, '', { integer: true, max: 65535 }), field('pdiCount', 'PDI Count · 0x0410', 1000, '', { integer: true, max: 65535 }), field('smCount', 'SM Count · 0x0420', 1000, '', { integer: true, max: 65535 }), field('triggerInterval', '触发间隔', 20, 'ms', { min: .001 }), field('stopTime', '最后触发时间上限', 60, 'ms'), field('end', '观察窗口', 220, 'ms', { min: .001 })], scenarios: watchdogScenarios, initialScenario: 'pdi-stop', scope: '40 ns ESC 时基的标称教学模型。计数器量化和实际超时处理依 ESC / 固件；本图不是采样波形。' },
  cycle: { title: '周期预算与数据更新', subtitle: '一次周期中，输出处理、应用和输入准备占用多少时间。', unit: 'µs', references: [SSC], fields: [field('cycle', '周期预算', 1000, 'µs', { min: 1 }), field('output', '输出计算与拷贝', 120, 'µs'), field('application', '应用处理', 400, 'µs'), field('input', '输入计算与拷贝', 160, 'µs')], scenarios: [{ id: 'sm', label: 'SM 事件触发' }, { id: 'dc', label: 'DC SYNC0 触发' }], initialScenario: 'sm', scope: '串行执行顺序是本教学场景的假设，非所有 SSC 同步模式的固定调度。宏值 0 可能请求运行测量；这里的数值是独立教学输入。物理输出延迟不当作 CPU 拷贝时间相加。' },
  al: { title: 'AL 状态切换与等待条件', subtitle: '状态请求已到达，并不代表所有进入条件已经满足。', unit: 'ms', references: [SSC], fields: [field('timeout', '允许等待时间', 100, 'ms', { min: .01 }), field('ready', '应用就绪时间', 40, 'ms'), field('output', '首帧有效输出时间', 65, 'ms')], scenarios: [{ id: 'output', label: 'SAFEOP → OP · 需要输出' }, { id: 'no-output', label: 'SAFEOP → OP · 不等待输出' }, { id: 'preop', label: 'INIT → PREOP' }], initialScenario: 'output', scope: '简化 SSC 进入条件，演示请求、等待和超时；完整状态校验还包含 SM、同步和应用错误等条件。等待值示意，不代表通用默认值。' },
  sdo: { title: 'SDO 请求与异步回调', subtitle: '主站发起一次请求，本地多次推进同一个未完成服务。', unit: 'ms', references: [SSC], fields: [field('work', '本地处理耗时', 30, 'ms', { min: .1 }), field('poll', '本地推进间隔', 10, 'ms', { min: .1 }), field('limit', '演示等待上限', 80, 'ms', { min: 3 })], scenarios: [{ id: 'pending', label: '异步处理中 → 完成' }, { id: 'abort', label: '对象检查拒绝' }, { id: 'timeout', label: '等待超时' }], initialScenario: 'pending', scope: '回调时序教学，具体返回码和调用点须匹配 SSC 版本。SDO_RES_INTERFACE 与本地实现共同决定异步响应能力；不把本地轮询画成主站反复重发。等待上限是演示输入。' },
  buffer: { title: '三缓冲：写入、发布与读取', subtitle: '三份存储轮换角色，每次读取的是已发布的一份一致数据。', unit: '步', references: [ESC], fields: [], scenarios: [{ id: 'normal', label: '交替发布与读取' }, { id: 'writer-fast', label: '生产端更快' }], initialScenario: 'normal', scope: '逻辑步骤，不表示固定总线时间。发布/获取表示完整缓冲访问的交接；具体 ESC 触发条件按手册。三缓冲不等于每周期传三份 PDO；Length=0 停用、Length=1 例外和单缓冲模式不使用本图。' },
  drive: { title: 'CiA402：控制命令与驱动状态', subtitle: '对照 0x6040 / 0x6041，区分 EtherCAT OP 和驱动使能。', unit: '步', references: [DRIVE, SSC], fields: [], scenarios: [{ id: 'enable', label: '正常使能流程' }, { id: 'fault', label: '故障与复位流程' }], initialScenario: 'enable', scope: '逻辑 FSA 教学片段，不是驱动仿真。状态字仅展示本例相关状态位；实际状态判定要应用掩码，其他位可能变化。EtherCAT OP 不保证 Operation enabled；命令并不绕过设备进入条件。' },
  delay: { title:'物理 I/O 延迟描述',subtitle:'观察相关触发与物理事件之间的间隔。',unit:'ns',references:[SSC],fields:[field('delay','物理延迟教学值',20000,'ns'),field('window','观察窗口',100000,'ns',{min:1})],scenarios:[{id:'output',label:'输出实际生效'},{id:'input',label:'输入采集 / 锁存'}],initialScenario:'output',scope:'延迟取决于 ADC、滤波、驱动器与实际触发链路，必须由具体硬件测定。本图只说明 Delay Time 描述哪段间隔；设置宏不会自动插入等待或补偿。0 是固定描述值，不切换到运行测量。'},
}

const lessonEntries = {
  watchdog: ['esc-sm-wd-supported'],
  cycle: ['min-pd-cycle-time', 'max-pd-cycle-time', 'pd-output-calc-and-copy-time', 'pd-input-calc-and-copy-time', 'dc-supported', 'esi-dc', 'esi-assign-activate'],
  delay: ['pd-output-delay-time','pd-input-delay-time'],
  al: ['preoptimeout', 'safeop2optimeout', 'op-pd-required'],
  sdo: ['sdo-res-interface', 'xlsx-coe-read', 'xlsx-coe-write'],
  buffer: ['max-pd-output-size', 'max-pd-input-size', 'sm2', 'sm3', 'esi-sm', 'esi-control-byte'],
}
export const timingCoverage = Object.entries(lessonEntries).flatMap(([lesson, ids]) => ids.map(id => ({ id, lesson })))
export function getTimingLesson(id) { return timingCoverage.find(item => item.id === id)?.lesson || null }
export function timingDefaults(lesson) { return Object.fromEntries(timingLessons[lesson].fields.map(item => [item.key, item.value])) }
const event = (id, track, at, title, detail, tone = 'blue') => ({ id, track, at, title, detail, tone })
const segment = (start, end, label, tone = 'blue') => ({ start, end, label, tone })
const lastAt = (events, time) => events.filter(item => item.at <= time).at(-1)

function validate(lesson, input) {
  const values = {}
  for (const item of lesson.fields) {
    const raw = input[item.key] ?? item.value
    const value = Number(raw)
    if (String(raw).trim() === '' || !Number.isFinite(value) || value < (item.min ?? 0) || value > (item.max ?? 100000) || (item.integer && !Number.isInteger(value))) throw new Error(`${item.label}：请输入 ${item.min ?? 0}–${item.max ?? 100000} 范围内的${item.integer ? '整数' : '数值'}。`)
    values[item.key] = value
  }
  return values
}

function watchdogScene(p, scenario) {
  const model = watchdogTiming({ ...p, scenario })
  const events = [], tracks = []
  for (const lane of model.lanes) {
    const name = lane.id === 'pdi' ? 'PDI' : 'SM'
    tracks.push({ id: `${lane.id}-feed`, name: `${name} 触发`, caption: lane.id === 'pdi' ? 'MCU → PDI → ESC' : '主站 → 启用 WD 的 SM', type: 'pulse', pulses: lane.scheduled })
    const boundaries = [...new Set([0, ...lane.scheduled, ...lane.expiries, model.end])].sort((a,b) => a-b)
    const bands = boundaries.slice(0,-1).map((t,i) => {
      const now = (t+boundaries[i+1])/2
      const last = lane.scheduled[Math.min(Math.floor(now/model.triggerInterval),lane.scheduled.length-1)]
      const state = !lane.enabled ? 'disabled' : now >= last+lane.timeout ? 'expired' : 'waiting'
      return segment(t, boundaries[i+1], state === 'disabled' ? '禁用' : state === 'expired' ? '超时' : '计时中', state === 'expired' ? 'red' : state === 'disabled' ? 'gray' : 'green')
    })
    tracks.push({ id: `${lane.id}-timer`, name: `${name} 倒计时 / 状态`, caption: `${lane.id === 'pdi' ? '0x0410' : '0x0420'} · ${lane.enabled?`${lane.timeout.toLocaleString()} ms`:'Count = 0 · 禁用'}`, type: 'countdown', triggers: lane.scheduled, timeout: lane.timeout, enabled: lane.enabled, bands: bands.filter(b=>b.tone==='red') })
    lane.scheduled.forEach((at,i) => events.push(event(`${lane.id}-feed-${i}`, `${lane.id}-feed`, at, `${name} 触发 #${i+1}`, lane.enabled ? `本次有效触发重新计时；标称期限 ${Number((at+lane.timeout).toFixed(6))} ms。` : '本侧 Count = 0，触发不启动看门狗计时。')))
    lane.expiries.forEach((at,i) => events.push(event(`${lane.id}-expiry-${i}`, `${lane.id}-timer`, at, `${name} 标称期限到达`, '上次触发以后没有及时刷新。本图表示名义计时状态；后续故障处理、锁存与恢复由 ESC / 固件决定。', 'red')))
  }
  return { end: model.end, tracks, events, initialTime: Math.min(180,model.end), summary: `时基 (${model.parameters.divider} + 2) × 40 ns = ${model.parameters.tick} ms；PDI / SM 分别计数。`, snapshot: time => model.lanes.map(lane => {
    const last=lane.scheduled[Math.min(Math.floor(time/model.triggerInterval),lane.scheduled.length-1)],deadline=last+lane.timeout,expired=lane.enabled&&time>=deadline
    return {name:`${lane.id.toUpperCase()} 看门狗`,value:!lane.enabled?'禁用':expired?'已超时':`剩余 ${Math.max(0,deadline-time).toLocaleString(undefined,{maximumFractionDigits:3})} ms`,tone:!lane.enabled?'gray':expired?'red':'green',detail:`上次触发 ${last} ms${lane.enabled?` · 期限 ${Number(deadline.toFixed(6))} ms`:''}`}
  }), calculator: { divider: model.parameters.divider, pdiCount: model.parameters.pdi.count, smCount: model.parameters.sm.count } }
}

function cycleScene(p, scenario) {
  const used = p.output+p.application+p.input, end = Math.max(p.cycle*2,used*1.2,1)
  const labels = [['output','输出计算与拷贝',p.output],['app','应用处理',p.application],['input','输入计算与拷贝',p.input]]
  let at = 0
  const events = [event('trigger','trigger',0,scenario === 'dc' ? 'SYNC0 到达' : 'SM 事件到达','本例从此处开始串行处理；实际触发及相位由同步模式决定。')]
  const tracks = [{ id:'trigger',name:scenario === 'dc' ? 'DC SYNC0' : 'SM 事件',caption:'所选教学触发源',type:'pulse',pulses:[0,p.cycle] }]
  for (const [id,name,length] of labels) { tracks.push({id,name,caption:`教学耗时 ${length} µs`,type:'state',segments:[segment(at,at+length,name,id==='app'?'purple':'blue')]}); at+=length; events.push(event(`${id}-done`,id,at,`${name}完成`,`${at} µs；本段耗时 ${length} µs。`)) }
  tracks.push({id:'budget',name:'周期预算',caption:`${p.cycle} µs`,type:'state',segments:[segment(0,Math.min(used,p.cycle),'已用','blue'),...(used < p.cycle ? [segment(used,p.cycle,'余量','green')] : []),...(used > p.cycle ? [segment(p.cycle,used,'超出预算','red')] : [])]})
  events.push(event('cycle-boundary','budget',p.cycle,'下一周期边界',used>p.cycle ? `本例串行处理超出 ${used-p.cycle} µs。` : `本例留有 ${p.cycle-used} µs 预算余量。`,used>p.cycle?'red':'green'))
  return {end,tracks,events,initialTime:Math.min(used,end),summary:`示例总耗时 ${p.output} + ${p.application} + ${p.input} = ${used} µs / 预算 ${p.cycle} µs`,snapshot:time=>[{name:'当前阶段',value:time< p.output?'输出计算与拷贝':time<p.output+p.application?'应用处理':time<used?'输入计算与拷贝':'本轮完成',detail:'演示单轮，下一周期不自动复制所有阶段。'},{name:'预算检查',value:used>p.cycle?`超出 ${used-p.cycle} µs`:`余量 ${p.cycle-used} µs`,tone:used>p.cycle?'red':'green',detail:'只对当前教学顺序成立；不能替代最坏执行时间测量。'}]}
}

function alScene(p, scenario) {
  const needsOutput = scenario === 'output', done = Math.max(p.ready,needsOutput?p.output:0), success=done<=p.timeout, end=Math.max(p.timeout,done)*1.25
  const transition=scenario==='preop'?'INIT → PREOP':'SAFEOP → OP'
  const finish=success?done:p.timeout
  const events=[event('request','request',0,`${transition} 请求`,'AL 状态请求到达，开始检查与等待应用条件。'),event('ready','app',p.ready,'应用已就绪','仅表示本教学应用条件满足。'),event('deadline','state',p.timeout,'等待期限',success?'已在期限内完成。':'条件未及时满足，报告切换错误并保留原状态。',success?'gray':'red')]
  if(needsOutput) events.push(event('outputs','output',p.output,'首帧有效输出','OP_PD_REQUIRED 的输出条件在本例中满足。'))
  if(success) events.push(event('transition','state',done,'完成状态切换','本例列出的进入条件全部满足。','green'))
  const tracks=[{id:'request',name:'AL 请求',caption:transition,type:'pulse',pulses:[0]},{id:'app',name:'应用条件',caption:'应用就绪',type:'state',segments:[segment(0,p.ready,'等待','gray'),segment(p.ready,end,'就绪','green')]},...(needsOutput?[{id:'output',name:'过程输出条件',caption:'OP_PD_REQUIRED = 1',type:'state',segments:[segment(0,p.output,'等待输出','gray'),segment(p.output,end,'有效输出','green')]}]:[]),{id:'state',name:'AL 当前状态',caption:`等待上限 ${p.timeout} ms`,type:'state',segments:[segment(0,finish,scenario==='preop'?'INIT':'SAFEOP','blue'),segment(finish,end,success?(scenario==='preop'?'PREOP':'OP'):'切换失败 / 原状态',success?'green':'red')]}]
  return {end,tracks,events,initialTime:finish,summary:`${transition} · ${needsOutput?'应用与输出都须就绪':'本例只等待应用就绪'} · 上限 ${p.timeout} ms`,snapshot:time=>[{name:'AL 状态',value:time<finish?(scenario==='preop'?'INIT · 正在等待':'SAFEOP · 正在等待'):success?(scenario==='preop'?'PREOP':'OP'):'原状态 · 切换错误',tone:time>=finish&&!success?'red':'blue',detail:needsOutput?'就绪时间 = max(应用，首帧输出)':'演示不等待输出的条件分支。'}]}
}

function sdoScene(p, scenario) {
  if(p.limit/p.poll>500) throw new Error('本地推进最多展示 500 次，请调大推进间隔。')
  const complete=2+Math.ceil(p.work/p.poll)*p.poll, failed=scenario==='timeout'||complete>p.limit, aborted=scenario==='abort'
  const at=aborted?2:failed?p.limit:complete, end=Math.max(p.limit,at+10)*1.15
  const polls=aborted?[]:Array.from({length:Math.floor((at-2)/p.poll)},(_,i)=>2+(i+1)*p.poll).filter(t=>t<=at)
  const result=aborted?'Abort':failed?'等待超时':'SDO 响应'
  const events=[event('request','master',0,'主站发起一次请求','此后是同一服务的本地推进，不是主站重发。'),event('check','service',1,'对象与权限检查','核对 Index、SubIndex、访问权限和长度。'),...polls.map((t,i)=>event(`poll-${i}`,'callback',t,`本地推进 #${i+1}`,t>=complete&&!failed?'本地工作完成，可产生响应。':'工作尚未完成；保留待处理服务。')),event('response','master',at,result,aborted?'对象检查拒绝；具体 Abort Code 依失败原因。':failed?'到达演示等待上限。实际超时策略依主站/实现。':'本地完成后发送该请求的响应。',aborted||failed?'red':'green')]
  return {end,events,tracks:[{id:'master',name:'主站 / 邮箱',caption:'单次请求与响应',type:'pulse',pulses:[0,at]},{id:'service',name:'SDO 服务',caption:'同一服务上下文',type:'state',segments:[segment(0,Math.min(2,at),'检查','blue'),...(!aborted?[segment(2,at,'待处理','purple')]:[]),segment(at,end,result,aborted||failed?'red':'green')]},{id:'callback',name:'对象回调',caption:'SSC 本地推进',type:'pulse',pulses:polls}],initialTime:at,summary:`一次请求 → ${aborted?'检查失败':`${polls.length} 次本地推进`} → ${result}`,snapshot:time=>[{name:'服务状态',value:time<1?'收到请求':time<at?'处理中':result,tone:time>=at&&(failed||aborted)?'red':time>=at?'green':'blue',detail:'异步回调能力需在 SSC 与应用两侧实现。'}]}
}

function bufferScene(scenario) {
  const actions=scenario==='writer-fast'?['写入 W','发布','写入 W','发布','获取最新','读取 R']:['写入 W','发布','获取最新','读取 R','写入 W','发布','获取最新']
  let roles={w:0,r:1,f:2}
  const states=[{...roles}],events=[]
  actions.forEach((action,i)=>{
    if(action==='发布') roles={...roles,w:roles.f,f:roles.w}
    if(action==='获取最新') roles={...roles,r:roles.f,f:roles.r}
    states.push({...roles}); events.push(event(`buffer-${i}`,'action',i+1,action,`完成这一步后：W=缓冲${roles.w}，R=缓冲${roles.r}，F=缓冲${roles.f}。${action==='发布'?'已完成数据成为最新发布缓冲，尚未改变读方正在读的缓冲。':action==='获取最新'?'读方获取最新已发布数据，释放之前的读缓冲。':'当前角色保持。'}`))
  })
  const end=actions.length+1
  const tracks=[{id:'action',name:'交接动作',caption:'逻辑步骤 · 无物理时间',type:'state',segments:[segment(0,1,'起始','gray'),...actions.map((a,i)=>segment(i+1,i+2,a,'blue'))]},...[0,1,2].map(bank=>({id:`bank-${bank}`,name:`缓冲 ${bank}`,caption:'W 写 / R 读 / F 待交换',type:'state',segments:states.map((r,i)=>segment(i,i+1,r.w===bank?'W · 写入':r.r===bank?'R · 读取':'F · 待交换',r.w===bank?'blue':r.r===bank?'green':'gray'))}))]
  return {end,tracks,events,initialTime:0,summary:'在交接点交换角色，单次读取期间读缓冲保持稳定。',snapshot:time=>{const r=states[Math.min(Math.floor(time),states.length-1)];return[{name:'当前缓冲角色',value:`W ${r.w} / R ${r.r} / F ${r.f}`,detail:'W：生产端；R：消费端；F：可交换的最新发布或空闲缓冲。'},{name:'存储与传输',value:'3 份存储 ≠ 3 次 PDO',detail:'RAM 规划仍需计入内部字宽；本图只解释缓冲交接。'}]}}
}

function driveScene(scenario) {
  const fault=scenario==='fault'
  const states=fault?['Operation enabled','Fault reaction active','Fault','Switch on disabled','Ready to switch on']:['Switch on disabled','Ready to switch on','Switched on','Operation enabled']
  const commands=fault?['发生故障','故障反应完成','0x0080 · Fault reset','0x0006 · Shutdown']:['0x0006 · Shutdown','0x0007 · Switch on','0x000F · Enable operation']
  const words=fault?['0x0027','0x000F','0x0008','0x0040','0x0021']:['0x0040','0x0021','0x0023','0x0027']
  const end=states.length
  const events=commands.map((c,i)=>event(`drive-${i}`,'control',i+1,c,`本例条件满足后进入 ${states[i+1]}；示例状态位 ${words[i+1]}。${fault&&i===2?'复位命令需要按设备要求形成有效边沿。':''}`,fault&&i<2?'red':'blue'))
  return {end,events,tracks:[{id:'al',name:'EtherCAT AL',caption:'通信层状态',type:'state',segments:[segment(0,end,'OP · 已有过程数据通信','blue')]},{id:'control',name:'0x6040 / 命令',caption:'RxPDO · 主站 → 驱动',type:'state',segments:[segment(0,1,'初始条件','gray'),...commands.map((c,i)=>segment(i+1,i+2,c,'blue'))]},{id:'pds',name:'CiA402 PDS',caption:'驱动控制状态机',type:'state',segments:states.map((s,i)=>segment(i,i+1,s,s==='Fault'||s==='Fault reaction active'?'red':s==='Operation enabled'?'green':'purple'))},{id:'status',name:'0x6041 / 状态',caption:'TxPDO · 驱动 → 主站',type:'state',segments:words.map((s,i)=>segment(i,i+1,s,'gray'))}],initialTime:0,summary:'上方 AL 通信状态和下方 PDS 驱动状态独立解释；本例不模拟运动。',snapshot:time=>{const i=Math.min(Math.floor(time),states.length-1);return[{name:'EtherCAT 状态',value:'OP',detail:'仍不能据此判断驱动已使能。'},{name:'驱动状态 / 0x6041',value:states[i],tone:states[i].startsWith('Fault')?'red':'blue',detail:`示例相关位：${words[i]}；实际须掩码判定。`}]}}
}

function delayScene(p,scenario){
  const input=scenario==='input',end=Math.max(p.window,p.delay*1.25,1),label=input?'物理输入已采集 / 锁存':'物理输出已生效',address=input?'0x1C33:09':'0x1C32:09'
  return {end,initialTime:p.delay,events:[event('trigger','trigger',0,'相关触发到达','触发源取决于同步方式和硬件实现；本例设为观察起点。'),event('physical','physical',p.delay,label,`${address} 的 Delay Time 描述触发到本次物理事件的间隔；不生成等待代码。`,'green')],tracks:[{id:'trigger',name:'相关触发',caption:'t = 0 · 教学参考点',type:'pulse',pulses:[0]},{id:'physical',name:input?'物理输入事件':'物理输出事件',caption:`${address} · Delay Time`,type:'state',segments:[...(p.delay>0?[segment(0,p.delay,'物理链路进行中','gray')]:[]),segment(p.delay,end,input?'已采集 / 锁存':'输出已生效','green')]}],summary:`Delay Time = ${p.delay.toLocaleString()} ns · 相关触发 → ${input?'物理采集 / 锁存':'输出实际生效'}`,snapshot:time=>[{name:'观察结果',value:time<p.delay?'尚未到物理事件':label,tone:time<p.delay?'blue':'green',detail:`描述间隔 ${p.delay} ns；当前观察点 ${Number(time.toFixed(3))} ns。`},{name:'宏的作用',value:'描述，不自动补偿',detail:'不会把此数值当作 CPU 拷贝耗时加进周期预算。'}]}
}

/** All numbers are teaching input. No scene writes to a controller. */
export function buildTimingScene(id, input = {}, scenarioId) {
  const lesson=timingLessons[id]
  if(!lesson) throw new Error('不存在的时序模型。')
  const p=validate(lesson,input), scenario=lesson.scenarios.some(s=>s.id===scenarioId)?scenarioId:lesson.initialScenario
  const scene=id==='watchdog'?watchdogScene(p,scenario):id==='cycle'?cycleScene(p,scenario):id==='al'?alScene(p,scenario):id==='sdo'?sdoScene(p,scenario):id==='buffer'?bufferScene(scenario):id==='delay'?delayScene(p,scenario):driveScene(scenario)
  scene.events.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))
  return {...scene,id,lesson,parameters:p,scenario,checkpoints:[...new Set([0,...scene.events.map(e=>e.at),scene.end])].sort((a,b)=>a-b),eventAt:time=>lastAt(scene.events,time)}
}

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, Boxes, CircleDot, ExternalLink, Files, GitBranch, Network, RotateCcw, Timer } from 'lucide-react'
import { learningTopics, learningConcepts, learningEvidence } from '../data/learning.js'
import { bindingsForStep, learningContext, learningInputs } from '../lib/learning-model.js'
import { getRelations, normalize } from '../lib/library.js'
import { ConceptButton, ConceptText } from './ConceptHelp.jsx'
import { CopyButton } from './Article.jsx'
import { TimingDialog } from './TimingWorkbench.jsx'
import LearningVisuals from './LearningVisuals.jsx'
import './learning.css'

const icons = { Network, Boxes, GitBranch, Timer, CircleDot, Files }

function Glossary() {
  const [query, setQuery] = useState('')
  const terms = learningConcepts.filter(concept => normalize([concept.label, concept.definition, ...concept.aliases].join(' ')).includes(normalize(query)))
  return <details className="learn-glossary"><summary><BookOpen size={15} />按术语查找<span>{learningConcepts.length}</span></summary><div><label className="sr-only" htmlFor="learn-term-query">查找基础术语</label><input id="learn-term-query" placeholder="ESC、PDI、SDO、EEPROM…" value={query} onChange={event => setQuery(event.target.value)} /><div className="learn-glossary-results">{terms.map(term => <div key={term.id}><ConceptButton id={term.id}>{term.label}</ConceptButton><p>{term.definition}</p></div>)}{!terms.length && <p className="learn-no-results">没有匹配的术语。<button onClick={() => setQuery('')}>清除筛选</button></p>}</div></div></details>
}

function LearningHome({ onNavigate }) {
  return <section className="learning-page learning-home" aria-label="基础概念总览"><header className="learn-home-heading"><span>从问题出发</span><h1>把配置背后的原理看明白。</h1><p>先认清角色，再看数据如何组织、传递和运行。也可以直接查一个陌生术语。</p></header><div className="learn-topic-grid">{learningTopics.map(topic => {
    const Icon = icons[topic.icon]
    return <button className="learn-topic" key={topic.id} onClick={() => onNavigate(topic.entryId)}><span className="learn-topic-number">{topic.number}</span><div><span><Icon size={17} />{topic.title}</span><strong>{topic.question}</strong><small>{topic.summary}</small></div><ArrowRight size={17} /></button>
  })}</div><div className="learn-home-route"><BookOpen size={16} /><p>查配置时，点击带点线的术语，可以原位看解释，再返回原来的字段。</p></div><Glossary /></section>
}

function ConfigurationBindings({ context, onBinding }) {
  const bindings = bindingsForStep(context)
  if (!bindings.length) return null
  const labels = { SSC: 'SSC Tool', APP: '应用对象字典定义', ESI: 'ESI 设备描述' }
  return <section className="learn-bindings" aria-label="本步骤关联配置"><header><h2>关联配置</h2><span>字段规则与示例位置</span></header><div className="learn-binding-groups">{['SSC', 'APP', 'ESI'].map(surface => {
    const items = bindings.filter(item => item.surface === surface)
    return items.length ? <div className="learn-binding-group" key={surface}><h3>{labels[surface]}</h3>{items.map(binding => <button className="learn-binding" key={binding.id} onClick={() => onBinding(binding)}><span><strong>{binding.title}</strong><small>{binding.path}</small><em>{binding.role}</em>{binding.condition && <small className="learn-binding-condition">{binding.condition}</small>}</span><ArrowRight size={14} /></button>)}</div> : null
  })}</div></section>
}

function TechnicalDetails({ entry, entries, onNavigate, onFeedback }) {
  if (entry.id.startsWith('learn-')) return null
  const relations = getRelations(entry, entries)
  return <details className="learn-technical-details"><summary><BookOpen size={13} /><span>{entry.name} · 技术要点与示例</span></summary><div>
    {entry.facts?.length > 0 && <dl>{entry.facts.map((fact, i) => <div key={i}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
    {entry.details?.map((text, i) => <p key={i}><ConceptText>{text}</ConceptText></p>)}
    {entry.rules?.length > 0 && <ul>{entry.rules.map((text, i) => <li key={i}><ConceptText>{text}</ConceptText></li>)}</ul>}
    {entry.example && <div className="learn-technical-code"><header><span>配置示例</span><CopyButton text={entry.example.code} label="复制参考示例" onFeedback={onFeedback} /></header><pre>{entry.example.code}</pre><small>{entry.example.caption}</small></div>}
    {relations.length > 0 && <div className="learn-technical-links">{relations.map((relation, i) => <button key={`${relation.target}:${i}`} onClick={() => onNavigate(relation.target)}><small>{relation.type}</small><span>{relation.entry.name}</span><ArrowRight size={12} /></button>)}</div>}
    <div className="learn-technical-sources">{entry.references?.map((reference, i) => <a key={i} href={reference.url} target="_blank" rel="noreferrer">{reference.title}<ExternalLink size={11} /></a>)}</div>
  </div></details>
}

export default function LearningWorkbench({ entry, entries, route, onContext, onNavigate, onBinding, saved, onSave, onFeedback }) {
  const [timing, setTiming] = useState(null)
  const page = useRef(null), stageTitle = useRef(null), focusStep = useRef(true)
  const context = learningContext(route, entry.id)
  const { topic, scene, step } = context
  const input = learningInputs(topic.id, route.learnData), values = input.values
  if (topic.id === 'process' && !route.learnData) values.channel = String(context.channel)
  useEffect(() => { page.current?.scrollTo({ top: 0 }); if (focusStep.current) { stageTitle.current?.focus({ preventScroll: true }); focusStep.current = false } }, [step, scene.id])
  if (entry.id === 'learn-overview') return <LearningHome onNavigate={onNavigate} />
  const topicIndex = learningTopics.findIndex(item => item.id === topic.id)
  const isBoot = topic.id === 'state' && scene.id === 'state' && values.bootstrap
  const current = isBoot ? { question: 'BOOT升级分支做什么？', explanation: '支持Bootstrap的设备可在此执行相应升级服务。正常周期过程数据和物理输出不在这个分支运行，典型RUN灯为快闪。具体支持按固件。' } : context.current
  function changeValues(patch) { const channel = Number(patch.channel); onContext({ learnData: JSON.stringify({ ...values, ...patch }), ...(topic.id === 'process' && [2, 3].includes(channel) ? { learnDir: channel === 3 ? 'tx' : 'rx', ...(scene.id === 'channels' && step === 1 ? { learnStep: '0' } : {}) } : {}) }, true) }
  function changeStep(next) { focusStep.current = true; const mailboxFocus = topic.id === 'process' && scene.id === 'channels' && next === 1 && Number(values.channel) > 1; onContext({ learnStep: String(next), ...(mailboxFocus ? { learnData: JSON.stringify({ ...values, channel: '0' }) } : topic.id === 'state' && values.bootstrap ? { learnData: JSON.stringify({ ...values, bootstrap: false }) } : {}) }, true) }
  function changeScene(id, initialStep = 0) { focusStep.current = true; onContext({ learnScene: id, learnStep: String(initialStep) }, true) }
  function restore() { onContext({ learnData: '' }, true) }
  function next() {
    if (step < scene.steps.length - 1) changeStep(step + 1)
    else onNavigate(learningTopics[topicIndex + 1]?.entryId || 'learn-overview')
  }
  const headerTitle = scene.id === topic.scenes[0].id ? topic.title : scene.label
  const bindingContext = { ...context, inputs: values, ...(isBoot ? { current: { bindings: ['bootstrap', 'esi-mailbox'] } } : {}) }
  return <section ref={page} className="learning-page learning-topic-page" aria-label={`${topic.title}概念工作台`}>
    <header className="learn-topic-heading"><h1>{headerTitle}</h1><div className="learn-heading-actions"><button className="icon-button" aria-label={saved ? '取消收藏概念' : '收藏概念'} aria-pressed={saved} onClick={() => onSave(entry.id)}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button><CopyButton text={location.href} label="复制本步骤链接" iconOnly onFeedback={onFeedback} /></div></header>
    {scene && topic.scenes.length > 1 && <div className="learn-scene-select" role="group" aria-label={`${topic.title}场景选择`}>{topic.scenes.map(item => <button key={item.id} aria-pressed={scene.id === item.id} onClick={() => changeScene(item.id)}>{item.label}</button>)}</div>}
    <nav className="learn-steps" aria-label="讲解步骤">{scene.steps.map((item, index) => <button key={item.label} aria-current={step === index && !isBoot ? 'step' : undefined} onClick={() => changeStep(index)}><span>{index + 1}</span>{item.label}</button>)}</nav>
    <div className="learn-stage-intro"><div><h2 tabIndex={-1} ref={stageTitle}>{current.question}</h2><p><ConceptText>{current.explanation}</ConceptText></p></div><button className="learn-reset" onClick={restore} title="恢复本主题教学值"><RotateCcw size={13} /><span>恢复教学值</span></button></div>
    {input.recovered && <p className="learn-link-recovery" role="status">链接中的演示参数无法读取，已使用教学初值。<button onClick={restore}>清理参数</button></p>}
    <TechnicalDetails entry={entry} entries={entries} onNavigate={onNavigate} onFeedback={onFeedback} />
    <LearningVisuals context={context} entryId={entry.id} values={values} onValues={changeValues} onReset={restore} onStep={changeStep} onScene={changeScene} onDirection={direction => onContext({ learnDir: direction, learnData: JSON.stringify({ ...values, channel: direction === 'tx' ? '3' : '2' }) }, true)} onNavigate={onNavigate} onTiming={(id, initialValues, options = {}) => setTiming({ id, initialValues, ...options })} />
    <div className="learn-pager"><button disabled={isBoot || step === 0} onClick={() => changeStep(step - 1)}><ArrowLeft size={15} />上一步</button><span>{isBoot ? '升级分支 · 可选择正常状态返回' : `${step + 1} / ${scene.steps.length} · ${scene.label}`}</span><button className="learn-next" onClick={() => isBoot ? changeStep(0) : next()}>{isBoot ? '回到正常状态链' : step < scene.steps.length - 1 ? '下一步' : topicIndex < learningTopics.length - 1 ? '下一个主题' : '回到概念总览'}<ArrowRight size={15} /></button></div>
    <ConfigurationBindings context={bindingContext} onBinding={onBinding} />
    <footer className="learn-topic-footer"><div className="learn-topic-terms"><small>本节概念</small>{topic.terms.map(id => <ConceptButton key={id} id={id} className="concept-chip" />)}</div><details className="learn-references"><summary>依据与适用范围</summary>{topic.evidence.map(id => <a key={id} href={learningEvidence[id].url} target="_blank" rel="noreferrer"><span><strong>{learningEvidence[id].title}</strong><small>{learningEvidence[id].scope}</small></span><ExternalLink size={13} /></a>)}</details></footer>
    {timing && <TimingDialog lesson={timing.id} initialValues={timing.initialValues} initialScenario={timing.initialScenario} initialTime={timing.initialTime} contextLabel={timing.initialValues ? '本页教学参数' : '独立教学示例'} onClose={() => setTiming(null)} />}
  </section>
}

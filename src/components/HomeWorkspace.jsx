import { BookOpen, Calculator, ChevronRight, Clock3, Cpu, FileCode2, FileSpreadsheet, ArrowRight } from 'lucide-react'
import { homeModel } from '../lib/home-model.js'
import './home-workspace.css'

const icons = { concepts: BookOpen, SSC: Cpu, APP: FileSpreadsheet, ESI: FileCode2 }
function HomeLink({ target, onOpen, children, className = '', label }) {
  return <a className={className} href={target.href} aria-label={label} onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpen(target) }}>{children}</a>
}
export default function HomeWorkspace({ entries, recent, onNavigate, onCalculator, onRecent }) {
  const model = homeModel(entries, recent)
  function open(target) { if (target.kind === 'calculator') onCalculator(target.id); else onNavigate(target.id) }
  return <section className="home-workspace" aria-label="工具首页"><header className="home-heading"><h1>EtherCAT 配置查阅工具</h1><p>先理解原理，或直接查配置的含义、关系与计算。</p></header>
    <div className="home-entry-grid" aria-label="四个主要入口">{model.entrypoints.map(item => {
      const Icon = icons[item.id]
      return <HomeLink key={item.id} target={item.target} onOpen={open} label={`进入${item.title}`} className={`home-entry home-entry-${item.id}`}><span className="home-entry-icon"><Icon size={20} /></span><h2>{item.title}</h2><p>{item.description}</p><span className="home-entry-action">{item.id === 'concepts' ? '开始理解' : '进入查阅'}<ArrowRight size={14} /></span></HomeLink>
    })}</div>
    <section className="home-topics"><header><h2>从一个问题开始</h2><HomeLink target={model.entrypoints[0].target} onOpen={open}>全部概念<ChevronRight size={13} /></HomeLink></header><div>{model.topics.map(topic => <HomeLink key={topic.id} target={topic.target} onOpen={open} className="home-topic"><span>{topic.number}</span><div><small>{topic.title}</small><strong>{topic.question}</strong></div><ChevronRight size={14} /></HomeLink>)}</div></section>
    <section className="home-calculators"><h2><Calculator size={15} />配置计算</h2><div>{model.calculators.map(item => <HomeLink key={item.id} target={item.target} onOpen={open}>{item.title}<ArrowRight size={12} /></HomeLink>)}</div></section>
    {model.recent.length > 0 && <section className="home-recent"><header><h2><Clock3 size={15} />最近查阅</h2><button onClick={onRecent}>查看全部<ChevronRight size={13} /></button></header><div>{model.recent.map(item => <HomeLink key={item.id} target={item.target} onOpen={open}><small>{item.collection}</small><span title={item.description}>{item.title}</span><ChevronRight size={12} /></HomeLink>)}</div></section>}
  </section>
}

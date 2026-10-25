import { useState } from 'react'
import { ArrowRight, ArrowUpRight, Bookmark, Check, Copy, Link2, Calculator, BookOpen, Network, CornerDownRight, FileCode2, Info } from 'lucide-react'
import { categories, sourceLabels, calculatorLabels, getRelations, getCollectionGroups } from '../lib/library.js'
import { collections } from '../data/navigation.js'
import Calculators from './Calculators.jsx'

export function SourceBadge({ kind }) { return <span className="source-badge">{sourceLabels[kind] || kind}</span> }

export function CopyButton({ text, label = '复制', iconOnly = false, onFeedback }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
      onFeedback?.('已复制到剪贴板')
    } catch { onFeedback?.('复制未成功，请选中文本后使用 Ctrl+C。') }
  }
  return <button className={iconOnly ? 'icon-button' : 'text-button'} onClick={copy} title={label} aria-label={copied ? '已复制' : label}>{copied ? <Check size={15} /> : <Copy size={15} />}{!iconOnly && <span>{copied ? '已复制' : label}</span>}</button>
}

function RelationList({ relations, onNavigate, compact = false }) {
  return <div className={compact ? 'relation-list compact' : 'relation-list'}>{relations.map((r, i) =>
    <button key={`${r.target}-${i}`} className="relation-item" onClick={() => onNavigate(r.target)}>
      <span className="relation-type">{r.incoming ? <CornerDownRight size={12} /> : <Link2 size={12} />}{r.type}</span>
      <span className="relation-name">{r.entry.name}</span>
      <span className="relation-description">{r.description}</span><ArrowUpRight size={14} className="relation-arrow" />
    </button>,
  )}</div>
}

export default function Article({ entry, entries, onNavigate, saved, onSave, onFeedback }) {
  const [tab, setTab] = useState('overview')
  const relations = getRelations(entry, entries)
  const category = categories.find(c => c.id === entry.category)
  const collection = collections.find(c => c.id === entry.collection)
  const groupLabel = entry.group === 'Application/ProcessData' ? 'Application / ProcessData' : getCollectionGroups(entry.collection).find(group => group.id === entry.group)?.label
  const kinds = [...new Set(entry.sources.map(s => s.kind))]
  const link = `${location.href.split('#')[0]}#/entry/${entry.id}`
  function handleTabKeys(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')]
    const current = tabs.indexOf(document.activeElement)
    if (current < 0) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    tabs[next].focus(); tabs[next].click()
  }
  return <article className="article" aria-labelledby="entry-heading">
    <header className="article-header">
      <div className="article-topline"><span className="eyebrow">{collection?.shortLabel || category?.label || '配置参考'}<span className="eyebrow-divider">/</span>{groupLabel || 'REFERENCE'}</span><div className="article-actions"><button className={`icon-button ${saved ? 'is-saved' : ''}`} onClick={() => onSave(entry.id)} aria-label={saved ? '取消收藏此条目' : '收藏此条目'} aria-pressed={saved} title={saved ? '取消收藏' : '收藏'}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button><CopyButton text={link} label="复制条目链接" iconOnly onFeedback={onFeedback} /></div></div>
      <div className="article-badges">{kinds.map(k => <SourceBadge key={k} kind={k} />)}</div>
      <h2 id="entry-heading" className="entry-name" tabIndex={-1}>{entry.name}</h2>
      <div className="entry-subtitle"><span>{entry.title}</span><CopyButton text={entry.name} label="复制标识" onFeedback={onFeedback} /></div>
      <p className="entry-summary">{entry.summary}</p>
    </header>
    <div className="article-tabs" role="tablist" aria-label="条目内容" onKeyDown={handleTabKeys}>
      <button id="tab-overview" role="tab" tabIndex={tab === 'overview' ? 0 : -1} aria-selected={tab === 'overview'} aria-controls="article-panel" className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><BookOpen size={15} />说明与配置</button>
      <button id="tab-relations" role="tab" tabIndex={tab === 'relations' ? 0 : -1} aria-selected={tab === 'relations'} aria-controls="article-panel" className={tab === 'relations' ? 'active' : ''} onClick={() => setTab('relations')}><Network size={15} />关联关系<span className="count">{relations.length}</span></button>
      {entry.calculator && <button id="tab-calculator" role="tab" tabIndex={tab === 'calculator' ? 0 : -1} aria-selected={tab === 'calculator'} aria-controls="article-panel" className={tab === 'calculator' ? 'active' : ''} onClick={() => setTab('calculator')}><Calculator size={15} />就地计算</button>}
    </div>
    <div id="article-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="article-panel">
      {tab === 'overview' && <div className="article-columns"><div className="article-body">
        {entry.facts?.length > 0 && <dl className="facts-grid">{entry.facts.map((f, i) => <div key={i}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>}
        <section className="article-section"><h3><FileCode2 size={17} />在哪里配置</h3><div className="location-list">{entry.sources.map((s, i) => <div key={i}><SourceBadge kind={s.kind} /><code>{s.path}</code></div>)}</div></section>
        {entry.details?.length > 0 && <section className="article-section"><h3>理解这个配置</h3>{entry.details.map((text, i) => <p key={i}>{text}</p>)}</section>}
        {entry.rules?.length > 0 && <section className="article-section"><h3>配置规则与注意事项</h3><ul className="rule-list">{entry.rules.map((text, i) => <li key={i}>{text}</li>)}</ul></section>}
        {entry.example && <section className="article-section"><div className="section-heading"><h3>配置示例</h3><CopyButton text={entry.example.code} label="复制示例" onFeedback={onFeedback} /></div><div className="code-block"><div className="code-label"><span>{entry.example.language || '示例'}</span><span>示例值 · 请按设备调整</span></div><pre><code>{entry.example.code}</code></pre></div>{entry.example.caption && <p className="caption">{entry.example.caption}</p>}</section>}
        {entry.calculator && <button className="calculation-callout" onClick={() => setTab('calculator')}><span className="callout-icon"><Calculator size={20} /></span><span><strong>用实际参数算一遍</strong><small>{calculatorLabels[entry.calculator]} · 公式、步骤与校验</small></span><ArrowRight size={18} /></button>}
        <section className="article-section sources-section"><h3>依据与适用范围</h3><p className="caption">示例不代表所有设备的默认值。SSC 版本、ESC 型号和主站配置可能改变具体行为。</p>{(entry.references || []).map((ref, i) => <a className="reference-link" key={i} href={ref.url} target="_blank" rel="noreferrer"><span><strong>{ref.title}</strong>{ref.note && <small>{ref.note}</small>}</span><ArrowUpRight size={15} /></a>)}</section>
      </div><aside className="article-aside" aria-label="关联速览"><div className="aside-sticky"><div className="section-heading"><h3>关联速览</h3><span className="subtle-number">{relations.length.toString().padStart(2, '0')}</span></div><p className="aside-intro">沿着配置关系继续查阅</p>{relations.length ? <RelationList relations={relations.slice(0, 5)} onNavigate={onNavigate} compact /> : <p className="caption">当前条目暂无直接关联。</p>}{relations.length > 5 && <button className="text-button blue" onClick={() => setTab('relations')}>查看全部 {relations.length} 项<ArrowRight size={14} /></button>}<div className="reading-note"><Info size={15} /><p>Rx / Tx 以从站为参照。输入 / 输出通常以主站为参照。</p></div></div></aside></div>}
      {tab === 'relations' && <section className="relationships-panel"><div className="section-heading"><h3>这项配置与什么有关</h3><span className="source-badge">双向关联</span></div><p className="caption">“被引用 / 被影响”由其他条目的关联自动汇总。点击任一项查看其解释和配置位置。</p><div className="relation-origin"><Network size={22} /><span>{entry.name}</span><span className="count">{relations.length} 项关联</span></div>{relations.length ? <RelationList relations={relations} onNavigate={onNavigate} /> : <div className="empty-state"><Link2 size={28} /><h3>暂无直接关联</h3><p>可以通过搜索查找相同主题，或查看本条的参考资料。</p></div>}</section>}
      {tab === 'calculator' && entry.calculator && <Calculators key={entry.calculator} initialTool={entry.calculator} onNavigate={onNavigate} embedded />}
    </div>
  </article>
}

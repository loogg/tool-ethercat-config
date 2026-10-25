import { Fragment, useContext, useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, BookOpen, ExternalLink, Info, X } from 'lucide-react'
import { learningTopics, learningEvidence } from '../data/learning.js'
import { bindingsForStep, conceptTokens, conceptsForEntry, learningConceptMap, learningContext } from '../lib/learning-model.js'
import { ConceptHelpContext } from '../lib/concept-help-context.js'
import './learning.css'

function ConceptDialog({ concept, onSelect, onClose, onNavigate, onBinding }) {
  const dialog = useRef(null), title = useRef(null), titleId = useId()
  const topic = learningTopics.find(item => item.id === concept.topic)
  const context = learningContext({ learnScene: concept.scene, learnStep: concept.step }, concept.entryId)
  const bindings = bindingsForStep(context).slice(0, 3)
  useEffect(() => {
    const previous = document.activeElement, element = dialog.current
    element.showModal(); title.current?.focus({ preventScroll: true })
    return () => { if (element.open) element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  function openLesson() { onClose(); onNavigate(concept.entryId, '', { learnScene: concept.scene, learnStep: concept.step }) }
  return <dialog ref={dialog} className="concept-help-dialog" aria-labelledby={titleId} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <header><span><BookOpen size={15} />概念速查 · {topic.title}</span><button className="icon-button" aria-label="关闭概念说明" onClick={onClose}><X size={18} /></button></header>
    <div className="concept-help-body"><h2 id={titleId} tabIndex={-1} ref={title}>{concept.label}</h2><p className="concept-definition">{concept.definition}</p>
      {concept.misconception && <div className="concept-clarification"><Info size={15} /><p>{concept.misconception}</p></div>}
      {concept.prerequisites.length > 0 && <div className="concept-prerequisites"><small>先理解</small>{concept.prerequisites.map(id => <button key={id} onClick={() => onSelect(id)}>{learningConceptMap.get(id).label}<ArrowRight size={12} /></button>)}</div>}
      <button className="concept-open-lesson" onClick={openLesson}><span><strong>用图解看懂</strong><small>{context.current.question}</small></span><ArrowRight size={17} /></button>
      {bindings.length > 0 && <section className="concept-quick-bindings"><h3>相关配置 · 字段规则</h3>{bindings.map(binding => <button key={binding.id} onClick={() => { onClose(); onBinding(binding) }}><small>{binding.surface === 'APP' ? '应用定义' : binding.surface === 'SSC' ? 'SSC Tool' : binding.surface}</small><span><strong>{binding.title}</strong><small>{binding.path}</small></span><ArrowRight size={13} /></button>)}</section>}
      <details className="concept-evidence"><summary>依据与适用范围</summary>{concept.evidence.map(id => <a href={learningEvidence[id].url} key={id} target="_blank" rel="noreferrer"><span>{learningEvidence[id].title}<small>{learningEvidence[id].scope}</small></span><ExternalLink size={12} /></a>)}</details>
    </div>
  </dialog>
}

export function ConceptHelpProvider({ children, onNavigate, onBinding }) {
  const [activeId, setActiveId] = useState(null)
  const active = learningConceptMap.get(activeId)
  return <ConceptHelpContext.Provider value={setActiveId}>{children}{active && <ConceptDialog key={active.id} concept={active} onSelect={setActiveId} onClose={() => setActiveId(null)} onNavigate={onNavigate} onBinding={onBinding} />}</ConceptHelpContext.Provider>
}

export function ConceptButton({ id, children, className = '' }) {
  const open = useContext(ConceptHelpContext), concept = learningConceptMap.get(id)
  if (!open || !concept) return children || concept?.label || null
  return <button type="button" className={`concept-term ${className}`} aria-label={`解释 ${concept.label}`} onClick={() => open(id)}>{children || concept.label}</button>
}

export function ConceptText({ children }) {
  if (typeof children !== 'string') return children
  const seen = new Set()
  return conceptTokens(children).map((token, index) => {
    if (!token.conceptId || seen.has(token.conceptId)) return <Fragment key={index}>{token.text}</Fragment>
    seen.add(token.conceptId)
    return <ConceptButton key={index} id={token.conceptId}>{token.text}</ConceptButton>
  })
}

export function ConceptStrip({ entry }) {
  const terms = conceptsForEntry(entry)
  if (!terms.length) return null
  return <div className="concept-strip" aria-label="当前配置相关概念"><span><BookOpen size={13} />先理解</span>{terms.map(term => <ConceptButton key={term.id} id={term.id} className="concept-chip">{term.label}</ConceptButton>)}</div>
}

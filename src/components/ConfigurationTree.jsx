import { useState } from 'react'
import { ChevronRight, Cpu, FileCode2, FileSpreadsheet, BookOpen } from 'lucide-react'
import { collections } from '../data/navigation.js'
import { isEntryInScope } from '../lib/library.js'
import { ApplicationNavigation } from './ApplicationDefinition.jsx'
import { EsiNavigation } from './EsiNavigation.jsx'

const icons = { SSC: Cpu, APP: FileSpreadsheet, ESI: FileCode2 }

function TreeGroups({ groups, entries, collection, activeId, activeGroup, onNavigate, depth = 0 }) {
  const [expanded, setExpanded] = useState(() => Object.fromEntries(groups.map(group => [group.id, activeGroup === group.id || activeGroup.startsWith(`${group.id}/`)])))
  return <div className={`configuration-groups ${depth ? 'nested-groups' : ''}`}>{groups.map(group => {
    const children = entries.filter(entry => !entry.overview && isEntryInScope(entry, { collection, group: group.id }) && !group.children?.length)
    const overview = entries.find(entry => entry.overview && entry.collection === collection && entry.group === group.id)
    const count = entries.filter(entry => !entry.overview && isEntryInScope(entry, { collection, group: group.id })).length
    const open = expanded[group.id]
    return <section key={group.id} className={`configuration-group ${open ? 'expanded-group' : ''}`}><button className="configuration-group-toggle" aria-expanded={Boolean(open)} onClick={() => setExpanded(prev => ({ ...prev, [group.id]: !prev[group.id] }))}><ChevronRight size={12} className={open ? 'rotated' : ''} /><span>{group.label}</span><small>{count || '说明'}</small></button>{open && <div className="configuration-group-content">{group.children ? <TreeGroups groups={group.children} entries={entries} collection={collection} activeId={activeId} activeGroup={activeGroup} onNavigate={onNavigate} depth={depth + 1} /> : children.length ? children.map(entry => <button className={`configuration-leaf ${entry.id === activeId ? 'selected' : ''}`} aria-current={entry.id === activeId ? 'page' : undefined} key={entry.id} onClick={() => onNavigate(entry.id)}><strong title={entry.name}>{entry.name}</strong><span>{entry.title.replace(`${entry.name}：`, '')}</span></button>) : overview && <button className={`configuration-leaf ${overview.id === activeId ? 'selected' : ''}`} onClick={() => onNavigate(overview.id)}><span>编译适配说明</span></button>}</div>}</section>
  })}</div>
}

export default function ConfigurationTree({ entries, activeId, activeCollection, activeGroup, onNavigate, onOverview, applicationContext, onApplicationContext, esiContext, onEsiContext }) {
  const [expanded, setExpanded] = useState(() => ({ SSC: activeCollection === 'SSC' || !activeCollection, APP: activeCollection === 'APP', ESI: activeCollection === 'ESI', concepts: activeCollection === 'concepts' }))
  return <nav className="configuration-tree" aria-label="配置目录"><div className="tree-section-label">配置目录</div>{collections.filter(c => c.id !== 'concepts').map(collection => {
    const Icon = icons[collection.id]
    return <section key={collection.id} className="configuration-collection"><div className={`configuration-collection-row ${collection.id === activeCollection ? 'active-collection' : ''}`}><button className="tree-fold" aria-label={`${expanded[collection.id] ? '折叠' : '展开'} ${collection.label}`} aria-expanded={Boolean(expanded[collection.id])} onClick={() => setExpanded(prev => ({ ...prev, [collection.id]: !prev[collection.id] }))}><ChevronRight size={13} className={expanded[collection.id] ? 'rotated' : ''} /></button><button className="collection-open" onClick={() => { setExpanded(prev => ({ ...prev, [collection.id]: true })); onOverview(collection.id) }}><Icon size={16} /><span>{collection.label}</span></button></div>{expanded[collection.id] && (collection.id === 'APP' ? <ApplicationNavigation key={applicationContext.workbook.id} context={applicationContext} entries={entries} onContext={onApplicationContext} onNavigate={onNavigate} /> : collection.id === 'ESI' ? <EsiNavigation key={esiContext.documentId + esiContext.scope?.device.id} context={esiContext} onContext={onEsiContext} entries={entries} onNavigate={onNavigate} /> : <TreeGroups key={`${collection.id}:${activeGroup}`} groups={collection.groups} entries={entries} collection={collection.id} activeId={activeId} activeGroup={activeGroup || ''} onNavigate={onNavigate} />)}</section>
  })}<section className="configuration-reference"><button className="configuration-group-toggle" aria-expanded={Boolean(expanded.concepts)} onClick={() => setExpanded(prev => ({ ...prev, concepts: !prev.concepts }))}><ChevronRight size={12} className={expanded.concepts ? 'rotated' : ''} /><BookOpen size={14} /><span>协议参考</span></button>{expanded.concepts && <div className="reference-leaves">{entries.filter(entry => entry.collection === 'concepts').map(entry => <button key={entry.id} className={`reference-leaf ${activeId === entry.id ? 'selected' : ''}`} onClick={() => onNavigate(entry.id)}>{entry.title.replace(/^.*?：/, '')}</button>)}</div>}</section></nav>
}

import { useId, useState } from 'react'
import { BookOpen, ChevronRight, Cpu, FileCode2, FileSpreadsheet, Search } from 'lucide-react'
import { collections } from '../data/navigation.js'
import { isEntryInScope, isListedConfiguration } from '../lib/library.js'
import './entity-navigation.css'

const ICONS = { SSC: Cpu, APP: FileSpreadsheet, ESI: FileCode2, concepts: BookOpen }

function Groups({ groups, collection, entries, activeGroup, onSelect, expanded, onToggle, prefix, depth = 0 }) {
  return <ul className={`entity-groups${depth ? ' entity-subgroups' : ''}`}>
    {groups.map(group => {
      const matches = entries.filter(entry => isEntryInScope(entry, { collection, group: group.id }))
      const count = matches.filter(isListedConfiguration).length
      const hasChildren = Boolean(group.children?.length)
      const open = expanded[group.id] !== false
      const regionId = `${prefix}-${group.id.replace(/[^a-z0-9]/gi, '-')}`
      return <li key={group.id}>
        <div className={`entity-group-row${activeGroup === group.id ? ' selected' : ''}`}>
          {hasChildren ? <button type="button" className="entity-toggle" aria-label={`${open ? '折叠' : '展开'} ${group.label}`} aria-expanded={open} aria-controls={regionId} onClick={() => onToggle(group.id)}><ChevronRight size={12} className={open ? 'expanded' : ''} /></button> : <span className="entity-branch-dot" aria-hidden="true" />}
          <button type="button" className="entity-group-label" onClick={() => onSelect(collection, group.id)} aria-current={activeGroup === group.id ? 'page' : undefined}><span>{group.label}</span><small>{count || (matches.length ? '说明' : '0')}</small></button>
        </div>
        {hasChildren && <div id={regionId} hidden={!open}><Groups groups={group.children} collection={collection} entries={entries} activeGroup={activeGroup} onSelect={onSelect} expanded={expanded} onToggle={onToggle} prefix={prefix} depth={depth + 1} /></div>}
      </li>
    })}
  </ul>
}

export default function EntityNavigation({ entries, activeCollection, activeGroup, view, onSelect, onSearchAll }) {
  const id = useId()
  const [expanded, setExpanded] = useState(() => Object.fromEntries(collections.map(collection => [collection.id, collection.id === (activeCollection || 'SSC')])))
  const [expandedGroups, setExpandedGroups] = useState({ Application: true })
  const concepts = collections.find(collection => collection.id === 'concepts')
  return <div className="entity-navigation">
    <div className="sidebar-label">配置实体</div>
    <nav aria-label="配置实体目录">
      {collections.filter(collection => collection.id !== 'concepts').map(collection => {
        const Icon = ICONS[collection.id]
        const selected = activeCollection === collection.id
        const count = entries.filter(entry => entry.collection === collection.id && isListedConfiguration(entry)).length
        const regionId = `${id}-${collection.id}`
        return <div className={`entity-collection${selected ? ' active-collection' : ''}`} key={collection.id}>
          <div className={`entity-collection-row${selected && !activeGroup ? ' selected' : ''}`}>
            <button type="button" className="entity-toggle" aria-label={`${expanded[collection.id] ? '折叠' : '展开'} ${collection.label} 目录`} aria-expanded={expanded[collection.id]} aria-controls={regionId} onClick={() => setExpanded(previous => ({ ...previous, [collection.id]: !previous[collection.id] }))}><ChevronRight size={13} className={expanded[collection.id] ? 'expanded' : ''} /></button>
            <button type="button" className="entity-collection-label" aria-current={selected && !activeGroup ? 'page' : undefined} onClick={() => { setExpanded(previous => ({ ...previous, [collection.id]: true })); onSelect(collection.id, '') }}><Icon size={16} /><span>{collection.label}{collection.id === 'APP' && <small>Excel 应用定义</small>}</span><em>{count}</em></button>
          </div>
          <div id={regionId} hidden={!expanded[collection.id]}><Groups groups={collection.groups} collection={collection.id} entries={entries} activeGroup={selected ? activeGroup : ''} onSelect={onSelect} expanded={expandedGroups} onToggle={group => setExpandedGroups(previous => ({ ...previous, [group]: previous[group] === false }))} prefix={id} /></div>
        </div>
      })}
    </nav>
    <div className="entity-auxiliary"><div className="sidebar-label">辅助知识</div><button type="button" className={`side-item${activeCollection === 'concepts' ? ' active' : ''}`} aria-current={activeCollection === 'concepts' ? 'page' : undefined} onClick={() => onSelect('concepts', '')}><BookOpen size={16} /><span>{concepts.label}</span><small>{entries.filter(entry => entry.collection === 'concepts').length}</small></button><button type="button" className={`side-item${view === 'search' && !activeCollection ? ' active' : ''}`} onClick={onSearchAll}><Search size={16} /><span>搜索全部资料</span></button></div>
  </div>
}

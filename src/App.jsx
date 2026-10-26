import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bookmark, BookOpen, Calculator, Check, ChevronRight, CircleHelp, Clock3, Command, FileCode2, Menu, Search, X } from 'lucide-react'
import { entries, entryMap } from './data/index.js'
import { collections } from './data/navigation.js'
import { createSearchIndex, searchEntries, parseRoute, resolveRoute, routeHash, getEntryScope, getCollectionGroups, initialRecentList, readStoredList, writeStoredList, isEntryInScope } from './lib/library.js'
import ConfigGraph from './components/ConfigGraph.jsx'
import ConfigurationTree from './components/ConfigurationTree.jsx'
import ApplicationDefinition from './components/ApplicationDefinition.jsx'
import { applicationColumns, applicationContext } from './lib/application-model.js'
import Calculators from './components/Calculators.jsx'
import { SourceBadge } from './components/Article.jsx'
const EsiWorkbench = lazy(() => import('./components/EsiWorkbench.jsx'))
const LearningWorkbench = lazy(() => import('./components/LearningWorkbench.jsx'))
const HomeWorkspace = lazy(() => import('./components/HomeWorkspace.jsx'))
import { ConceptHelpProvider, ConceptStrip } from './components/ConceptHelp.jsx'
import { learningSearchContext } from './lib/learning-model.js'
import { esiContext, decodeEsiBytes } from './lib/esi-context.js'
import { parseEsiXml } from './lib/esi-model.js'
import './graph-app.css'

const searchIndex = createSearchIndex(entries)
const SAVED_KEY = 'ethercat-atlas:saved:v1'
const RECENT_KEY = 'ethercat-atlas:recent:v1'
function currentRoute() {
  if (!location.hash) return resolveRoute(parseRoute(''), entryMap)
  const route = resolveRoute(parseRoute(location.hash), entryMap)
  return route.view === 'entry' ? { ...route, pane: 'detail' } : route
}

function CollectionHome({ collection, onNavigate, onGroup }) {
  const fields = entries.filter(entry => !entry.overview && entry.collection === collection.id)
  return <section className="collection-home"><header><span>{collection.id === 'APP' ? 'Excel 应用定义' : collection.id === 'ESI' ? 'XML 设备描述' : 'Slave Project Navigation'}</span><h1>{collection.label}</h1><p>选择一个配置，查看它的位置、关联与计算。</p></header><div className="collection-index">{getCollectionGroups(collection.id).filter(group => !group.children?.length).map(group => <section key={group.id}><h2><button onClick={() => onGroup(collection.id, group.id)}>{group.id === 'Application/ProcessData' ? 'Application / ProcessData' : group.label}<ChevronRight size={14} /></button></h2><div>{fields.filter(entry => isEntryInScope(entry, { collection: collection.id, group: group.id })).map(entry => <button key={entry.id} onClick={() => onNavigate(entry.id)}><strong>{entry.name}</strong><span>{entry.title.replace(`${entry.name}：`, '')}</span><ChevronRight size={13} /></button>)}{!fields.some(entry => entry.group === group.id) && <button onClick={() => onNavigate('ssc-compiler-overview')}>编译适配说明<ChevronRight size={13} /></button>}</div></section>)}</div></section>
}

function ResultList({ results, title, onNavigate, onClose, query, currentId }) {
  return <section className="compact-results" aria-label={title}><header><span>{title}<small>{results.length} 项</small></span>{onClose && <button className="icon-button" aria-label="关闭搜索结果" onClick={onClose}><X size={15} /></button>}</header>{results.length ? <div className="compact-result-rows">{results.map(entry => <button key={entry.id} className={currentId === entry.id ? 'selected' : ''} onClick={() => onNavigate(entry.id, query)}><SourceBadge kind={entry.sources[0].kind} /><span><strong>{entry.name}</strong><small>{entry.title.replace(`${entry.name}：`, '')}</small></span><ChevronRight size={14} /></button>)}</div> : <div className="compact-empty"><Search size={27} /><h2>{query ? '没有找到匹配项' : '这里还没有配置'}</h2><p>{query ? '试试宏名、中文用途或对象索引。' : '在配置右上角点击书签，或先打开一个配置。'}</p></div>}</section>
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)
  const [saved, setSaved] = useState(() => readStoredList(SAVED_KEY).filter(id => entryMap.has(id)))
  const [recent, setRecent] = useState(() => initialRecentList(readStoredList(RECENT_KEY), currentRoute(), entryMap))
  const [navOpen, setNavOpen] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const [searchOpen, setSearchOpen] = useState(route.view === 'search')
  const [searchBackground, setSearchBackground] = useState(() => currentRoute().view === 'entry' ? 'entry' : 'home')
  const [focusQuery, setFocusQuery] = useState('')
  const [lastEntryId, setLastEntryId] = useState(() => entryMap.has(currentRoute().id) ? currentRoute().id : '')
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 720px)').matches)
  const [feedback, setFeedback] = useState('')
  const [localEsi, setLocalEsi] = useState(null)
  const [esiError, setEsiError] = useState('')
  const searchRef = useRef(null)
  const searchContainer = useRef(null)
  const remember = useCallback(id => { if (entryMap.has(id)) setRecent(prev => [id, ...prev.filter(value => value !== id)].slice(0, 20)) }, [])
  const updateRoute = useCallback((next, replace = false) => {
    const resolved = resolveRoute({ ...parseRoute(''), ...next, pane: 'detail' }, entryMap)
    const hash = routeHash(resolved)
    if (hash !== location.hash) { if (replace) history.replaceState(history.state, '', hash); else history.pushState({ atlasFrom: location.hash }, '', hash) }
    setRoute(resolved); setNavOpen(false)
    if (resolved.view === 'entry' && entryMap.has(resolved.id)) setLastEntryId(resolved.id)
    if (['entry', 'search', 'saved', 'recent'].includes(resolved.view)) remember(resolved.id)
  }, [remember])
  const navigate = useCallback((id, query = '', extra = {}) => {
    const target = entryMap.get(id)
    setFocusQuery(query); setSearchOpen(false); setSearchBackground('entry')
    const context = target?.collection === 'ESI' && route.esi ? { esi: route.esi, device: route.device } : {}
    updateRoute({ view: 'entry', id, ...getEntryScope(target), query: '', ...context, ...learningSearchContext(id, query), ...extra })
  }, [updateRoute, route.esi, route.device])
  function navigateView(view, calculatorId = 'mapping') { setSearchOpen(false); setFocusQuery(''); setSearchBackground(view === 'home' ? 'home' : 'entry'); updateRoute({ view, id: view === 'calculators' ? calculatorId : '', collection: 'all', group: '', query: '' }) }
  function selectCollection(id, group = '') {
    const collection = collections.find(c => c.id === id)
    const first = group ? entries.find(entry => !entry.overview && isEntryInScope(entry, { collection: id, group })) : entryMap.get(collection.overview)
    navigate(first?.id || 'ssc-compiler-overview')
  }
  function changeQuery(value) { if (route.view !== 'search') setSearchBackground(route.view === 'home' ? 'home' : 'entry'); setSearchOpen(true); updateRoute({ ...route, view: 'search', id: '', collection: 'all', group: '', query: value }, route.view === 'search') }
  function toggleSaved(id) {
    const next = saved.includes(id) ? saved.filter(v => v !== id) : [...saved, id]
    setSaved(next)
    setFeedback(writeStoredList(SAVED_KEY, next) ? next.includes(id) ? '已收藏此条目' : '已取消收藏' : '浏览器存储不可用，本次收藏仍可使用。')
  }
  useEffect(() => {
    function sync() { const next = currentRoute(); setRoute(next); setFocusQuery(''); setSearchOpen(next.view === 'search'); setSearchBackground(next.view === 'entry' ? 'entry' : next.view === 'search' && history.state?.atlasFrom && parseRoute(history.state.atlasFrom).view === 'entry' ? 'entry' : 'home'); setNavOpen(false); if (next.view === 'entry' && entryMap.has(next.id)) setLastEntryId(next.id); if (['entry', 'saved', 'recent'].includes(next.view)) remember(next.id) }
    window.addEventListener('popstate', sync); window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [remember])
  useEffect(() => { writeStoredList(RECENT_KEY, recent) }, [recent])
  useEffect(() => { const media = window.matchMedia('(max-width: 720px)'); const changed = () => setNarrow(media.matches); media.addEventListener('change', changed); return () => media.removeEventListener('change', changed) }, [])
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(''), 2400); return () => clearTimeout(timer) }, [feedback])
  useEffect(() => {
    function key(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); searchRef.current?.focus() }
      if (event.key === 'Escape') { if (event.target === searchRef.current) event.preventDefault(); setSearchOpen(false); setNavOpen(false) }
    }
    function outside(event) { if (searchContainer.current && !searchContainer.current.contains(event.target)) setSearchOpen(false) }
    window.addEventListener('keydown', key); document.addEventListener('pointerdown', outside)
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside) }
  }, [])
  const selected = entryMap.get(route.id) || (route.view === 'search' && searchBackground === 'entry' ? entryMap.get(lastEntryId) : undefined)
  const homeView = route.view === 'home' || (route.view === 'search' && searchBackground === 'home' && !route.id)
  const invalidEntry = route.view === 'entry' && route.id && !entryMap.has(route.id)
  const activeCollection = selected?.collection || (route.collection !== 'all' ? route.collection : '')
  const activeGroup = selected?.group || route.group || ''
  useEffect(() => { document.getElementById('app-sidebar')?.scrollTo({ top: 0 }) }, [activeCollection])
  const collection = collections.find(c => c.id === activeCollection)
  const group = getCollectionGroups(activeCollection).find(g => g.id === activeGroup)
  const appContext = applicationContext(route, selected?.collection === 'APP' ? selected.id : 'application-overview')
  const esiCtx = useMemo(() => esiContext(route, selected?.collection === 'ESI' ? selected.id : 'esi-overview', localEsi), [route, selected, localEsi])
  function updateEsiContext(change) {
    if (Object.hasOwn(change, 'esi')) setEsiError('')
    const id = Object.hasOwn(change, 'esi') ? 'esi-overview' : selected?.collection === 'ESI' ? selected.id : 'esi-overview'
    updateRoute({ view: 'entry', id, ...getEntryScope(entryMap.get(id)), esi: esiCtx.documentId, device: esiCtx.scope?.device.id, esiNode: route.esiNode || '', esiAttr: route.esiAttr || '', esiPane: esiCtx.mode, ...change })
  }
  function openEsiReference(target) {
    if (target.surface === 'APP' && target.field) {
      setSearchOpen(false)
      updateRoute({ view: 'entry', id: target.entryId, ...getEntryScope(entryMap.get(target.entryId)), workbook: target.sheet ? 'mdp-io' : 'direct-io', sheet: target.sheet || 'Profile', field: target.field, appPane: 'table' })
    } else navigate(target.entryId)
  }
  async function openEsiFile(file) {
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('当前支持最多 10 MiB 的 ESI XML。')
      const document = parseEsiXml(decodeEsiBytes(await file.arrayBuffer()))
      setLocalEsi({ filename: file.name, document }); setEsiError('')
      updateRoute({ view: 'entry', id: 'esi-overview', collection: 'ESI', esi: 'local', device: esiCtx.expired ? route.device : '', esiNode: esiCtx.expired ? route.esiNode : '', esiAttr: esiCtx.expired ? route.esiAttr : '', esiPane: esiCtx.expired ? route.esiPane : 'structure' })
      setFeedback('已在浏览器内存中读取 XML')
    } catch (error) { setEsiError(error.message) }
  }
  function updateApplicationContext(change) {
    const switching = Object.hasOwn(change, 'workbook') || Object.hasOwn(change, 'sheet')
    const context = { workbook: appContext.workbook.id, sheet: appContext.sheet.id, field: switching ? '' : route.field || (selected?.collection === 'APP' && !selected.overview ? appContext.field : ''), row: switching ? '' : route.row || '', appPane: switching ? 'table' : appContext.mode, ...change }
    const id = context.field ? applicationColumns.find(column => column.key === context.field)?.entryId || 'xlsx-modular' : 'application-overview'
    setSearchOpen(false)
    updateRoute({ view: 'entry', id, ...getEntryScope(entryMap.get(id)), query: '', ...context })
  }
  function updateLearningContext(change, replace = false) {
    setSearchOpen(false)
    updateRoute({ ...route, view: 'entry', id: selected.id, ...getEntryScope(selected), query: '', ...change }, replace)
  }
  function openLearningBinding(binding) { navigate(binding.entryId, '', binding.route) }
  const results = searchEntries(searchIndex, { query: route.query })
  const quickResults = route.query ? results : recent.slice(0, 8).map(id => entryMap.get(id)).filter(Boolean)
  const shelfResults = (route.view === 'saved' ? saved : recent).map(id => entryMap.get(id)).filter(Boolean)
  function toggleDirectory() { if (narrow) setNavOpen(!navOpen); else setSidebarHidden(!sidebarHidden) }

  return <ConceptHelpProvider onNavigate={navigate} onBinding={openLearningBinding}><div className={`app graph-app ${navOpen ? 'nav-open' : ''} ${sidebarHidden ? 'sidebar-hidden' : ''}`}><a href="#main-content" className="skip-link" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>跳到主要内容</a>
    <header className="app-header"><button className="icon-button directory-trigger" aria-label={navOpen || !sidebarHidden ? '切换配置目录' : '展开配置目录'} aria-controls="app-sidebar" aria-expanded={narrow ? navOpen : !sidebarHidden} onClick={toggleDirectory}><Menu size={19} /></button><button className="brand" aria-label="EtherCAT 配置查阅工具 首页" onClick={() => navigateView('home')}><img src={`${import.meta.env.BASE_URL}favicon.svg`} width="28" height="28" alt="" /><span>EtherCAT <strong>配置查阅工具</strong></span></button>
      <div className="global-search" ref={searchContainer}><Search size={16} /><input ref={searchRef} aria-label="搜索配置或关联对象" role="searchbox" type="text" value={route.query || ''} placeholder="搜索配置、对象索引或中文含义" onFocus={() => setSearchOpen(true)} onChange={e => changeQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSearchOpen(false); e.currentTarget.blur() } else if (e.key === 'Enter' && quickResults.length) navigate(quickResults[0].id, route.query) }} />{route.query ? <button className="icon-button" aria-label="清除搜索" onClick={() => changeQuery('')}><X size={14} /></button> : <kbd>Ctrl K</kbd>}{searchOpen && <ResultList title={route.query ? '搜索全部资料' : '快速查找'} results={quickResults} query={route.query} onNavigate={navigate} onClose={() => setSearchOpen(false)} />}</div>
      <nav className="graph-header-nav" aria-label="主导航"><button className={activeCollection === 'concepts' ? 'active' : ''} onClick={() => navigate('learn-overview')} aria-label="基础概念"><BookOpen size={17} /><span>基础概念</span></button><button className={route.view === 'calculators' ? 'active' : ''} onClick={() => navigateView('calculators')}><Calculator size={17} /><span>计算工具</span></button><button aria-label="使用说明" className={route.view === 'about' ? 'active' : ''} onClick={() => navigateView('about')}><CircleHelp size={18} /></button></nav></header>
    {navOpen && <button className="nav-scrim" aria-label="关闭配置目录" onClick={() => setNavOpen(false)} />}
    <aside className="app-sidebar" id="app-sidebar" aria-label="配置目录与工作台"><ConfigurationTree key={`${activeCollection}:${activeGroup}`} isHome={homeView} onHome={() => navigateView('home')} entries={entries} activeId={selected?.id} activeCollection={activeCollection} activeGroup={activeGroup} onNavigate={navigate} onOverview={selectCollection} applicationContext={appContext} onApplicationContext={updateApplicationContext} esiContext={esiCtx} onEsiContext={updateEsiContext} /><div className="tree-workbench"><button className={route.view === 'saved' ? 'active' : ''} onClick={() => navigateView('saved')}><Bookmark size={15} />我的收藏<small>{saved.length}</small></button><button className={route.view === 'recent' ? 'active' : ''} onClick={() => navigateView('recent')}><Clock3 size={15} />最近查阅<small>{recent.length}</small></button><div className="tree-local"><span />浏览器本地查阅 <small>v{import.meta.env.APP_VERSION}</small></div></div></aside>
    <main id="main-content" className="main-content graph-main-content" tabIndex={-1}>
      <div className="compact-contextbar"><button className="icon-button" aria-label="返回上一处" onClick={() => history.back()}><ArrowLeft size={16} /></button>{collection && selected ? <><button onClick={() => selectCollection(collection.id)}>{collection.label}</button>{activeGroup && <><ChevronRight size={12} /><span>{activeGroup === 'Application/ProcessData' ? 'Application / ProcessData' : group?.label}</span></>}</> : <span>{homeView ? '首页' : route.view === 'calculators' ? '计算工具' : route.view === 'saved' ? '我的收藏' : route.view === 'recent' ? '最近查阅' : route.view === 'about' ? '使用说明' : '全局搜索'}</span>}<span className="contextbar-end">配置 · 关系 · 计算</span></div>
      {selected && !selected.overview && selected.collection !== 'concepts' && <ConceptStrip entry={selected} />}
      {invalidEntry ? <div className="compact-empty"><Search size={28} /><h1>未找到这个配置</h1><p>链接中的标识可能有误，可以搜索配置名或回到配置目录。</p><button className="primary-button" onClick={() => navigateView('home')}>回到首页</button></div> : homeView ? <Suspense fallback={<div className="esi-loading" role="status">正在打开首页…</div>}><HomeWorkspace entries={entries} recent={recent} onNavigate={navigate} onCalculator={id => navigateView('calculators', id)} onRecent={() => navigateView('recent')} /></Suspense> : selected?.collection === 'concepts' && route.view !== 'calculators' ? <Suspense fallback={<div className="esi-loading" role="status">正在打开基础概念…</div>}><LearningWorkbench key={selected.id} entry={selected} entries={entries} route={route} onContext={updateLearningContext} onNavigate={navigate} onBinding={openLearningBinding} saved={saved.includes(selected.id)} onSave={toggleSaved} onFeedback={setFeedback} /></Suspense> : selected?.collection === 'ESI' && route.view !== 'calculators' ? <Suspense fallback={<div className="esi-loading" role="status">正在打开 ESI 条目…</div>}><EsiWorkbench key={esiCtx.documentId + esiCtx.scope?.device.id + selected.id} context={esiCtx} entry={selected} onContext={updateEsiContext} onFile={openEsiFile} onReference={openEsiReference} error={esiError} onFeedback={setFeedback} onNavigate={navigate} /></Suspense> : selected?.collection === 'APP' && route.view !== 'calculators' ? <ApplicationDefinition key={`${appContext.workbook.id}:${appContext.sheet.id}`} context={appContext} entry={selected} entries={entries} onContext={updateApplicationContext} onNavigate={navigate} saved={saved.includes(selected.id)} onSave={toggleSaved} onFeedback={setFeedback} /> : selected && route.view !== 'calculators' && !selected.overview ? <ConfigGraph key={`${selected.id}:${focusQuery}`} entry={selected} entries={entries} onNavigate={navigate} saved={saved.includes(selected.id)} onSave={toggleSaved} onFeedback={setFeedback} highlightQuery={focusQuery} /> : selected?.overview && !selected.group ? <CollectionHome collection={collection} onNavigate={navigate} onGroup={selectCollection} /> : selected?.overview ? <div className="group-note"><FileCode2 size={24} /><h1>{selected.title}</h1><p>{selected.summary}</p><ul>{selected.details?.map((text, i) => <li key={i}>{text}</li>)}</ul><div>{selected.references?.map((ref, i) => <a key={i} href={ref.url} target="_blank" rel="noreferrer">{ref.title}</a>)}</div></div> : route.view === 'calculators' ? <div className="standalone-calculators"><Calculators key={route.id} initialTool={route.id || 'mapping'} onNavigate={navigate} /></div> : ['saved', 'recent'].includes(route.view) ? <div className="shelf-page"><h1>{route.view === 'saved' ? '我的收藏' : '最近查阅'}</h1><ResultList title={route.view === 'saved' ? '收藏配置' : '阅读记录'} results={shelfResults} onNavigate={navigate} /></div> : route.view === 'about' ? <div className="graph-about"><h1>从配置出发，沿关系查阅。</h1><div><section><h2>找配置</h2><p>SSC Tool 与 ESI 按分组查阅；应用对象字典按工作簿与工作表查阅，选择单元格阅读字段说明。全局搜索也支持对象索引，找到相关配置后会高亮图中端点。</p></section><section><h2>读关系</h2><p>节点内保留父级路径。实线箭头表示有向关系，虚线表示描述或对应。点击节点查看要点，点击连线查看条件与依据。</p></section><section><h2>调整视图</h2><p>自动方向会根据图的层数及可用空间选择横向或纵向。可手动切换、缩放、定位当前项；“列表”提供可按键盘阅读的关系。</p></section><section><h2>验证理解</h2><p>演算区只改变本地示例，数字会同步到图中；完整计算工具支持映射、位布局、内存、看门狗和控制字节。</p></section></div><p className="graph-about-footer">知识与计算随应用提供，收藏和阅读记录仅保存在当前浏览器。示例、默认描述与在线配置分别表达。</p></div> : <div className="search-page"><ResultList title="全部搜索结果" results={results} query={route.query} onNavigate={navigate} /></div>}
    </main><div className={`toast ${feedback ? 'visible' : ''}`} role="status">{feedback}</div>
  </div></ConceptHelpProvider>
}

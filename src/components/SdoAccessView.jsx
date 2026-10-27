import { lazy, Suspense } from 'react'
const Dialog = lazy(() => import('./SdoAccessWorkbench.jsx').then(module => ({ default: module.SdoAccessDialog })))
const ContextDialog = lazy(() => import('./SdoContextWorkbench.jsx'))
const Lesson = lazy(() => import('./SdoAccessWorkbench.jsx'))
const loading = <p className="esi-loading" role="status">正在打开SDO访问与布局…</p>
export function SdoAccessDialog(props) { return <Suspense fallback={loading}>{props.binding ? <ContextDialog {...props}/> : <Dialog {...props}/>}</Suspense> }
export function SdoAccessLesson(props) { return <div className="sdo-lesson"><Suspense fallback={loading}><Lesson {...props}/></Suspense></div> }

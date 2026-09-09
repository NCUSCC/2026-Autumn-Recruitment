import { CheckCheck, Download, FilePlus2, FolderOpen, LayoutPanelTop, Save, Undo2, Redo2 } from 'lucide-react'

interface ToolbarProps {
  mapName: string
  dirty: boolean
  onMapNameChange: (name: string) => void
  onNew: () => void
  onSave: () => void
  onValidate: () => void
  onExport: () => void
  onImport: (file: File) => void
  onFitView: () => void
}

export function Toolbar(props: ToolbarProps) {
  return (
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark">M</div><div><strong>Maproom</strong><span>招新考核编排器</span></div></div>
      <div className="map-name-wrap"><span className="crumb">MAP /</span><input value={props.mapName} onChange={(event) => props.onMapNameChange(event.target.value)} aria-label="地图名称" /><span className={`save-state ${props.dirty ? 'is-dirty' : ''}`}>{props.dirty ? '未保存' : '已保存'}</span></div>
      <div className="toolbar-actions">
        <button className="icon-button" title="新建地图" onClick={props.onNew}><FilePlus2 size={17} /></button>
        <button className="icon-button muted-action" title="撤销（预留）" disabled><Undo2 size={17} /></button>
        <button className="icon-button muted-action" title="重做（预留）" disabled><Redo2 size={17} /></button>
        <span className="toolbar-divider" />
        <button className="tool-button" onClick={props.onSave}><Save size={15} />保存草稿</button>
        <label className="tool-button"><FolderOpen size={15} />导入<input type="file" accept="application/json,.json" hidden onChange={(event) => event.target.files?.[0] && props.onImport(event.target.files[0])} /></label>
        <button className="tool-button" onClick={props.onExport}><Download size={15} />导出</button>
        <button className="tool-button primary-tool" onClick={props.onValidate}><CheckCheck size={15} />校验</button>
        <button className="icon-button" title="适应画布" onClick={props.onFitView}><LayoutPanelTop size={17} /></button>
      </div>
    </header>
  )
}

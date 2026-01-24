export default function SectionTitle({ title, subtitle, icon, className = '' }) {
  return (
    <div className={`section-header ${className}`}>
      {icon && <div className="section-icon">{icon}</div>}
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

export function Subheader({ children, className = '' }) {
  return <p className={`text-sm text-slate-400 ${className}`}>{children}</p>
}

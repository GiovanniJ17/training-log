export default function EmptyState({
  icon,
  title,
  description,
  action
}) {
  return (
    <div className="text-center">
      {icon && (
        <div className="mx-auto icon-tile icon-tile-lg mb-3 shadow-lg shadow-slate-900/40">
          {icon}
        </div>
      )}
      {title && <p className="text-gray-100 text-base sm:text-lg">{title}</p>}
      {description && <p className="soft-muted text-sm mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

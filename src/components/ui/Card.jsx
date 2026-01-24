export function Card({ className = '', children }) {
  return (
    <div className={`glass-card ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children }) {
  return <div className={`mb-4 ${className}`}>{children}</div>
}

export function CardBody({ className = '', children }) {
  return <div className={className}>{children}</div>
}

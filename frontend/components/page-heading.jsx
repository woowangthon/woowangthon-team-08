import "./page-heading.css"
export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <header className="page-heading">
      <div className="page-heading-text">
        <h1 className="page-heading-title">{title}</h1>
        <p className="page-heading-description">{description}</p>
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </header>
  )
}

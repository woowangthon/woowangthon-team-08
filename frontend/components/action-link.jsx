import Link from "next/link"
import "./action-link.css"
export function ActionLink({ href, variant = "primary", className, children, ...props }) {
  return (
    <Link
      href={href}
      data-variant={variant}
      className={["action-link", "focus-ring-offset", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </Link>
  )
}

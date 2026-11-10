import * as React from "react"
import { cn } from "cn"
import "./ui.css"

function Textarea({ className, ...props }) {
  return <textarea data-slot="textarea" className={cn("ui-textarea", className)} {...props} />
}

export { Textarea }

"use client"
import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import "./ui.css"

function InputGroup({ className, ...props }) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn("ui-input-group", className)}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva("ui-input-group-addon", {
  variants: {
    align: {
      "inline-start": "ui-input-group-addon--inline-start",
      "inline-end": "ui-input-group-addon--inline-end",
      "block-start": "ui-input-group-addon--block-start",
      "block-end": "ui-input-group-addon--block-end",
    },
  },
  defaultVariants: {
    align: "inline-start",
  },
})

function InputGroupAddon({ className, align = "inline-start", ...props }) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if (e.target.closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva("ui-input-group-button", {
  variants: {
    size: {
      xs: "ui-input-group-button--xs",
      sm: "",
      "icon-xs": "ui-input-group-button--icon-xs",
      "icon-sm": "ui-input-group-button--icon-sm",
    },
  },
  defaultVariants: {
    size: "xs",
  },
})

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }) {
  return <span className={cn("ui-input-group-text", className)} {...props} />
}

function InputGroupInput({ className, ...props }) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn("ui-input-group-control", className)}
      {...props}
    />
  )
}

function InputGroupTextarea({ className, ...props }) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn("ui-input-group-control", className)}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}

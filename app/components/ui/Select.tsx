import * as React from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  onValueChange?: (value: string) => void
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, onValueChange, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChange) onChange(e)
      if (onValueChange) onValueChange(e.target.value)
    }

    return (
      <select
        className={className}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    )
  }
)

Select.displayName = 'Select' 
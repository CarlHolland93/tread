import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils/cn'

type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  /** Optional explicit fill colour (e.g. a score colour var). Defaults to accent. */
  indicatorColor?: string
}

export const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorColor, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-3', className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 rounded-full transition-transform duration-500 ease-out"
      style={{
        transform: `translateX(-${100 - (value ?? 0)}%)`,
        backgroundColor: indicatorColor ?? 'var(--color-accent)',
      }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = 'Progress'

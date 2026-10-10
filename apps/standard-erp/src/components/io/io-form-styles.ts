export const IO_FIELD_LABEL =
  'text-xs font-medium text-muted md:uppercase md:tracking-[0.12em]'

export const IO_INPUT =
  'input min-h-0 h-11 w-full rounded-lg border-border/60 bg-panel px-3 text-sm shadow-none'

export function ioInputClass(invalid?: boolean) {
  return `${IO_INPUT}${invalid ? ' border-red-400/80' : ''}`
}

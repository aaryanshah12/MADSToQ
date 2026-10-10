/** Master format: PREFIX/001/26 (prefix from numbering config; 3-digit seq; 2-digit year). */
export type IoNumberFormat = 'standard' | 'slash_pad3'

/** UI labels for `io_numbering_config.number_format` (DB: standard | slash_pad3). */
export const IO_NUMBER_FORMAT_OPTIONS: ReadonlyArray<{
  value: IoNumberFormat
  pattern: string
  example: string
}> = [
  { value: 'standard', pattern: 'prefix seq / mm / yy', example: 'dfg 1/06/26' },
  { value: 'slash_pad3', pattern: 'prefix / 001 / yy', example: 'dfg/003/26' },
]

export function ioNumberFormatLabel(format: IoNumberFormat): string {
  const opt = IO_NUMBER_FORMAT_OPTIONS.find((o) => o.value === format)
  return opt ? `${opt.pattern} (e.g. ${opt.example})` : format
}

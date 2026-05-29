'use client'

import { ListSearchField } from '@/components/layout/ListSearchToolbar'

type PmcListSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/** PMC-styled search field for use inside {@link ListSearchToolbar}. */
export function PmcListSearch({ value, onChange, placeholder }: PmcListSearchProps) {
  return (
    <ListSearchField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      inputClassName="pmc-focus"
    />
  )
}

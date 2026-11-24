import { SEARCH_INPUT_ID } from '@/state/uiStore'

interface SearchFieldProps {
  value: string
  onChange(value: string): void
  placeholder: string
  label: string
}

/**
 * The search box of whichever tab has one. It carries `SEARCH_INPUT_ID` (the `/` shortcut finds it), so only one may be on screen
 * at a time: the spells tab and the Feats & traits tab each render theirs and never together. Esc clears the text, and then leaves the box.
 */
export function SearchField({ value, onChange, placeholder, label }: SearchFieldProps): React.JSX.Element {
  return (
    <input
      id={SEARCH_INPUT_ID}
      className="field field--search"
      type="search"
      placeholder={placeholder}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        if (value !== '') onChange('')
        else e.currentTarget.blur()
      }}
    />
  )
}

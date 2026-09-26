import { Check } from 'lucide-react'

const STEPS = [
  'Basic Info',
  'Location',
  'Land Details',
  'Amenities',
  'Pricing',
  'Booking',
  'Documents',
  'Review',
]

export function WizardProgress({
  current,
  onJump,
}: {
  current: number
  onJump?: (step: number) => void
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-1 sm:gap-2">
        {STEPS.map((label, index) => {
          const done = index < current
          const active = index === current
          return (
            <li key={label} className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                disabled={!onJump || index > current}
                onClick={() => onJump?.(index)}
                className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-left transition ${
                  active
                    ? 'bg-brand text-brand-ink'
                    : done
                      ? 'bg-brand-soft text-brand'
                      : 'bg-surface-2 text-ink-faint'
                } ${onJump && index <= current ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    active
                      ? 'bg-white/20'
                      : done
                        ? 'bg-brand text-brand-ink'
                        : 'bg-surface text-ink-faint'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="hidden text-xs font-semibold sm:inline md:text-sm">
                  {label}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <span
                  className={`h-px w-3 sm:w-5 ${
                    done ? 'bg-brand' : 'bg-line'
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export { STEPS }

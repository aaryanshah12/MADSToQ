/** Chart colors and tooltip chrome shared by every portal. */
export const chartColors = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const

export const chartTick = { fill: 'var(--color-muted)', fontSize: 10 }

export const chartTooltip = {
  contentStyle: {
    background: 'var(--color-panel)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--color-text)',
  },
  labelStyle: { color: 'var(--color-text)' },
}

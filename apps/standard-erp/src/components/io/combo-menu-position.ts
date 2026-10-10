import type { CSSProperties } from 'react'

export type ComboMenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

type ComboMenuPositionOptions = {
  preferredHeight?: number
  minHeight?: number
  gap?: number
  viewportPadding?: number
  flipThreshold?: number
}

export function computeComboMenuPosition(
  rect: DOMRect,
  {
    preferredHeight = 180,
    minHeight = 96,
    gap = 4,
    viewportPadding = 12,
    flipThreshold = 120,
  }: ComboMenuPositionOptions = {},
): ComboMenuPosition {
  const vv = window.visualViewport
  const viewportTop = vv?.offsetTop ?? 0
  const viewportBottom = viewportTop + (vv?.height ?? window.innerHeight)
  const viewportWidth = vv?.width ?? window.innerWidth

  const spaceBelow = viewportBottom - rect.bottom - viewportPadding
  const spaceAbove = rect.top - viewportTop - viewportPadding
  const showAbove = spaceBelow < flipThreshold && spaceAbove > spaceBelow

  const left = Math.max(
    viewportPadding,
    Math.min(rect.left, viewportWidth - rect.width - viewportPadding),
  )

  if (showAbove) {
    return {
      // Anchor the bottom edge of the menu to just above the input.
      // Components apply translateY(-100%) so short menus stay attached to the field.
      top: rect.top - gap,
      left,
      width: rect.width,
      maxHeight: Math.min(preferredHeight, Math.max(minHeight, spaceAbove - gap)),
      placement: 'above',
    }
  }

  return {
    top: rect.bottom + gap,
    left,
    width: rect.width,
    maxHeight: Math.min(preferredHeight, Math.max(minHeight, spaceBelow - gap)),
    placement: 'below',
  }
}

export function comboMenuStyle(position: ComboMenuPosition): CSSProperties {
  return {
    top: position.top,
    left: position.left,
    width: position.width,
    maxHeight: position.maxHeight,
    transform: position.placement === 'above' ? 'translateY(-100%)' : undefined,
  }
}

export function bindComboMenuPositionListeners(update: () => void) {
  update()
  const raf = requestAnimationFrame(update)
  window.addEventListener('resize', update)
  window.addEventListener('scroll', update, true)
  const vv = window.visualViewport
  vv?.addEventListener('resize', update)
  vv?.addEventListener('scroll', update)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', update)
    window.removeEventListener('scroll', update, true)
    vv?.removeEventListener('resize', update)
    vv?.removeEventListener('scroll', update)
  }
}

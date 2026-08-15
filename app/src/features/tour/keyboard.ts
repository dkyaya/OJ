const TEXT_ENTRY_ROLES = new Set(['combobox', 'searchbox', 'spinbutton', 'textbox']);

export function isEditableTourKeyTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;

  let element: Element | null = target;
  while (element) {
    if (element.matches('input, textarea, select')) return true;
    const contentEditable = element.getAttribute('contenteditable');
    if (contentEditable !== null) return contentEditable.toLowerCase() !== 'false';
    if (TEXT_ENTRY_ROLES.has(element.getAttribute('role')?.toLowerCase() || '')) return true;
    element = element.parentElement;
  }

  return false;
}

export function hasTourArrowModifier(event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey'>): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}

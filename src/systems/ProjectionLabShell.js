const EDITABLE_SELECTOR = 'input, select, textarea, [contenteditable]:not([contenteditable="false"])';

export function projectionLabRequested(search = '') {
  return new URLSearchParams(search).get('lab') === '1';
}

export function isProjectionLabShortcut(event = {}) {
  if (event.isComposing === true || event.repeat === true) return false;
  if (event.altKey === true || event.metaKey === true) return false;
  const f2 = event.code === 'F2' && event.ctrlKey !== true && event.shiftKey !== true;
  const chord = event.code === 'KeyL' && event.ctrlKey === true && event.shiftKey === true;
  return f2 || chord;
}

export function isEditableControl(target) {
  return typeof target?.closest === 'function' && !!target.closest(EDITABLE_SELECTOR);
}

export function setProjectionLabOpen(panel, body, open) {
  const visible = !!open;
  panel.hidden = !visible;
  panel.setAttribute('aria-hidden', String(!visible));
  body.classList.toggle('projection-lab-open', visible);
  return visible;
}

export function installProjectionLabToggle({ panel, body, windowTarget, search = '' }) {
  let open = setProjectionLabOpen(panel, body, projectionLabRequested(search));

  const onKeyDown = (event) => {
    if (!isProjectionLabShortcut(event)) return;
    if (isEditableControl(event.target)) return;

    // Reserve the shortcut so it can never reach Phaser as gameplay input.
    event.preventDefault();
    event.stopImmediatePropagation();
    open = setProjectionLabOpen(panel, body, !open);
  };

  windowTarget.addEventListener('keydown', onKeyDown, { capture: true });
  return () => windowTarget.removeEventListener('keydown', onKeyDown, { capture: true });
}

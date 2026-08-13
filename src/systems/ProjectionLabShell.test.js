import assert from 'node:assert/strict';
import test from 'node:test';
import {
  installProjectionLabToggle,
  isEditableControl,
  isProjectionLabShortcut,
  projectionLabRequested,
  setProjectionLabOpen,
} from './ProjectionLabShell.js';

test('Projection Lab query gate only accepts lab=1', () => {
  assert.equal(projectionLabRequested('?lab=1'), true);
  assert.equal(projectionLabRequested('?fps=60&lab=1'), true);
  assert.equal(projectionLabRequested('?lab=0'), false);
  assert.equal(projectionLabRequested(''), false);
});

test('Projection Lab shortcut accepts exact F2 or Ctrl+Shift+L without repeats', () => {
  const chord = { code: 'KeyL', ctrlKey: true, shiftKey: true };
  assert.equal(isProjectionLabShortcut(chord), true);
  assert.equal(isProjectionLabShortcut({ code: 'F2' }), true);
  assert.equal(isProjectionLabShortcut({ code: 'F2', ctrlKey: true }), false);
  assert.equal(isProjectionLabShortcut({ code: 'F2', shiftKey: true }), false);
  assert.equal(isProjectionLabShortcut({ ...chord, repeat: true }), false);
  assert.equal(isProjectionLabShortcut({ ...chord, altKey: true }), false);
  assert.equal(isProjectionLabShortcut({ ...chord, metaKey: true }), false);
  assert.equal(isProjectionLabShortcut({ ...chord, shiftKey: false }), false);
  assert.equal(isProjectionLabShortcut({ ...chord, code: 'KeyK' }), false);
});

test('editable controls include nested targets inside an editable ancestor', () => {
  assert.equal(isEditableControl({ closest: (selector) => selector ? { tag: 'select' } : null }), true);
  assert.equal(isEditableControl({ closest: () => null }), false);
  assert.equal(isEditableControl(null), false);
});

function fakeShell() {
  const classes = new Set();
  const panel = {
    hidden: false,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const body = {
    classList: {
      toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
  };
  return { panel, body };
}

test('setProjectionLabOpen synchronizes hidden, aria, and layout state', () => {
  const { panel, body } = fakeShell();
  setProjectionLabOpen(panel, body, true);
  assert.equal(panel.hidden, false);
  assert.equal(panel.attributes['aria-hidden'], 'false');
  assert.equal(body.classList.contains('projection-lab-open'), true);
  setProjectionLabOpen(panel, body, false);
  assert.equal(panel.hidden, true);
  assert.equal(panel.attributes['aria-hidden'], 'true');
  assert.equal(body.classList.contains('projection-lab-open'), false);
});

test('installed shortcut toggles, consumes the chord, and ignores editable targets', () => {
  const { panel, body } = fakeShell();
  let listener;
  const windowTarget = {
    addEventListener(_type, callback) { listener = callback; },
    removeEventListener() {},
  };
  installProjectionLabToggle({ panel, body, windowTarget, search: '' });

  const event = {
    code: 'KeyL', ctrlKey: true, shiftKey: true,
    target: { closest: () => null },
    preventDefaultCalled: false,
    stopped: false,
    preventDefault() { this.preventDefaultCalled = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  listener(event);
  assert.equal(panel.hidden, false);
  assert.equal(event.preventDefaultCalled, true);
  assert.equal(event.stopped, true);

  const editableEvent = {
    ...event,
    preventDefaultCalled: false,
    stopped: false,
    target: { closest: () => ({ tag: 'input' }) },
  };
  listener(editableEvent);
  assert.equal(panel.hidden, false, 'focused Lab controls must not toggle the panel');
  assert.equal(editableEvent.preventDefaultCalled, false, 'editable controls keep their native shortcut handling');
  assert.equal(editableEvent.stopped, false);
});

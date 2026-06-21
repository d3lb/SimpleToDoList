export function hasSelectedText(input) {
  if (!input) return false;

  return (input.selectionEnd ?? 0) > (input.selectionStart ?? 0);
}

export async function copyInputText(input) {
  if (!input) return;

  const text = getSelectedText(input);
  if (!text) return;

  await navigator.clipboard.writeText(text);
}

export async function cutInputText(input) {
  if (!input) return;

  const text = getSelectedText(input);
  if (!text) return;

  await navigator.clipboard.writeText(text);
  replaceSelectedText(input, "");
}

export async function pasteInputText(input) {
  if (!input) return;

  const text = await navigator.clipboard.readText();
  if (!text) return;

  replaceSelectedText(input, text);
}

function getSelectedText(input) {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;

  return input.value.slice(start, end);
}

function replaceSelectedText(input, text) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const nextValue = input.value.slice(0, start) + text + input.value.slice(end);
  const nextCursor = start + text.length;

  setNativeInputValue(input, nextValue);
  input.focus();
  input.setSelectionRange(nextCursor, nextCursor);
}

function setNativeInputValue(input, value) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  valueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
export function getInputSelection(input) {
  if (!input) return null;

  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;

  return {
    start,
    end,
    text: input.value.slice(start, end)
  };
}

export function hasSelectedText(selection) {
  return !!selection && selection.end > selection.start;
}

export async function copyInputText(input, selection) {
  if (!input || !hasSelectedText(selection)) return;

  await navigator.clipboard.writeText(selection.text);
}

export async function cutInputText(input, selection) {
  if (!input || !hasSelectedText(selection)) return;

  await navigator.clipboard.writeText(selection.text);
  replaceInputRange(input, "", selection);
}

export async function pasteInputText(input, selection) {
  if (!input) return;

  const text = await navigator.clipboard.readText();
  if (!text) return;

  replaceInputRange(input, text, selection ?? getInputSelection(input));
}

function replaceInputRange(input, text, selection) {
  const start = selection?.start ?? input.selectionStart ?? input.value.length;
  const end = selection?.end ?? input.selectionEnd ?? input.value.length;
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
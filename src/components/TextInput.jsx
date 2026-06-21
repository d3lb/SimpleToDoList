import { Item, Menu, Separator, useContextMenu } from "react-contexify";
import { useEffect, useRef } from "react";

function TextInput({
  value,
  onValueChange,
  className,
  wrapperClassName = "",
  contextItems = [],
  autoFocusSelect = false,
  onRightClickStart,
  onAfterMenuAction,
  ...props
}) {
  const inputRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0, text: "" });
  const pasteMenuId = useRef(`input-paste-${Math.random().toString(36).slice(2)}`).current;
  const fullMenuId = useRef(`input-full-${Math.random().toString(36).slice(2)}`).current;
  const { show: showPasteMenu } = useContextMenu({ id: pasteMenuId });
  const { show: showFullMenu } = useContextMenu({ id: fullMenuId });

  useEffect(() => {
    if (!autoFocusSelect) return;

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
      saveSelection();
    });
  }, [autoFocusSelect]);

  function getCurrentSelection() {
    const input = inputRef.current;
    if (!input) return { start: 0, end: 0, text: "" };

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;

    return {
      start,
      end,
      text: input.value.slice(start, end)
    };
  }

  function saveSelection() {
    selectionRef.current = getCurrentSelection();
  }

  function updateSelectionIfReal() {
    const selection = getCurrentSelection();

    if (selection.end > selection.start) {
      selectionRef.current = selection;
    }
  }

  function hasSelection() {
    const selection = selectionRef.current;
    return selection.end > selection.start && selection.text.length > 0;
  }

  function openMenu(e) {
    e.preventDefault();
    e.stopPropagation();

    onRightClickStart?.();
    updateSelectionIfReal();

    const show = hasSelection() ? showFullMenu : showPasteMenu;

    show({
      event: e,
      props: {
        input: inputRef.current,
        selection: selectionRef.current
      }
    });
  }

  async function copyText() {
    if (!hasSelection()) return;

    await writeClipboard(selectionRef.current.text);
    onAfterMenuAction?.();
  }

  async function cutText() {
    if (!hasSelection()) return;

    await writeClipboard(selectionRef.current.text);
    replaceRange("");
    onAfterMenuAction?.();
  }

  async function pasteText() {
    const text = await readClipboard();
    if (!text) return;

    replaceRange(text);
    onAfterMenuAction?.();
  }

  function replaceRange(text) {
    const input = inputRef.current;
    if (!input) return;

    const selection = selectionRef.current;
    const start = selection.start ?? input.selectionStart ?? input.value.length;
    const end = selection.end ?? input.selectionEnd ?? input.value.length;
    const nextValue = value.slice(0, start) + text + value.slice(end);
    const nextCursor = start + text.length;

    onValueChange(nextValue);

    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
      saveSelection();
    });
  }

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  async function readClipboard() {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  }

  function renderExtraItems() {
    if (!contextItems.length) return null;

    return (
      <>
        <Separator className="contextMenuSeparator" />

        {contextItems.map(item => (
          <Item
            className={item.danger ? "contextMenuItem dangerMenuItem" : "contextMenuItem"}
            key={item.label}
            onClick={() => {
              item.onClick();
              onAfterMenuAction?.();
            }}
          >
            {item.label}
          </Item>
        ))}
      </>
    );
  }

  return (
    <span className={`textInputWrap ${wrapperClassName}`}>
      <input
        {...props}
        ref={inputRef}
        className={className}
        value={value}
        onChange={e => onValueChange(e.target.value)}
        onSelect={saveSelection}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onContextMenu={openMenu}
      />

      <Menu id={fullMenuId} className="contextMenu" animation={false}>
        <Item className="contextMenuItem" onClick={cutText}>Cut</Item>
        <Item className="contextMenuItem" onClick={copyText}>Copy</Item>
        <Item className="contextMenuItem" onClick={pasteText}>Paste</Item>
        {renderExtraItems()}
      </Menu>

      <Menu id={pasteMenuId} className="contextMenu" animation={false}>
        <Item className="contextMenuItem" onClick={pasteText}>Paste</Item>
        {renderExtraItems()}
      </Menu>
    </span>
  );
}

export default TextInput;
import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TextInput from "./TextInput";

function TaskRow({
  task,
  isSubtask,
  isFocused,
  dropHint,
  onFocusHandled,
  onToggle,
  onDelete,
  onTextChange,
  onCommit,
  onSubmit,
  onBackspaceEmpty,
  onToggleIndent
}) {
  const skipBlurRef = useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const classNames = ["taskLine"];
  if (isSubtask) classNames.push("subtaskLine");
  if (isDragging) classNames.push("draggingLine");
  if (dropHint) classNames.push(`drop-${dropHint}`);

  function handleKeyDown(e) {
    if (e.key === "Tab") {
      e.preventDefault();

      // Re-parenting can move this row in the DOM, which fires a blur that
      // would otherwise be read as leaving the field.
      skipBlurRef.current = true;
      setTimeout(() => {
        skipBlurRef.current = false;
      }, 0);

      onToggleIndent(task.id);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit(task.id);
      return;
    }

    if (e.key === "Escape") {
      e.currentTarget.blur();
      return;
    }

    if (e.key === "Backspace" && task.text === "") {
      e.preventDefault();
      onBackspaceEmpty(task.id);
    }
  }

  function handleBlur() {
    // A right-click inside the input blurs it; that shouldn't count as leaving.
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }

    onCommit(task.id);
  }

  return (
    <div ref={setNodeRef} style={style} className={classNames.join(" ")}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="dragHandle"
        aria-label="Reorder task"
        {...attributes}
        {...listeners}
        tabIndex={-1}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <input
        className="taskCheckbox"
        type="checkbox"
        checked={task.done}
        aria-label={task.text ? `Mark "${task.text}" as done` : "Mark task as done"}
        onChange={() => onToggle(task.id)}
      />

      <TextInput
        className={task.done ? "taskTextInput doneText" : "taskTextInput"}
        value={task.text}
        onValueChange={text => onTextChange(task.id, text)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        focusSignal={isFocused}
        onFocusHandled={onFocusHandled}
        onRightClickStart={() => {
          skipBlurRef.current = true;
        }}
        onAfterMenuAction={() => {
          skipBlurRef.current = false;
        }}
        placeholder={isSubtask ? "Write a subtask" : "Write a task"}
        contextItems={[
          { label: isSubtask ? "Make a task" : "Make a subtask", onClick: () => onToggleIndent(task.id) },
          { label: "Delete", danger: true, onClick: () => onDelete(task.id) }
        ]}
      />

      <button className="deleteBtn" aria-label="Delete task" onClick={() => onDelete(task.id)}>
        ×
      </button>
    </div>
  );
}

export default TaskRow;

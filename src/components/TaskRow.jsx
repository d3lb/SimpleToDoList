import { useContextMenu } from "react-contexify";
import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TASK_MENU_ID } from "../utils/contextMenuIds";
import TextInput from "./TextInput";

function TaskRow({
  task,
  isEditing,
  editingText,
  setEditingText,
  onToggle,
  onDelete,
  onStartEdit,
  onSaveEdit,
  onEditKeyDown
}) {
  const skipBlurRef = useRef(false);
  const { show } = useContextMenu({ id: TASK_MENU_ID });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  function openTaskMenu(e) {
    e.preventDefault();
    e.stopPropagation();
  
    show({
      event: e,
      props: { task }
    });
  }

  function handleEditBlur() {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }

    onSaveEdit(task.id);
  }

  function startInputContextMenu() {
    skipBlurRef.current = true;
  }

  function afterInputMenuAction() {
    skipBlurRef.current = false;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isEditing ? "taskLine editingLine" : "taskLine"}
      onDoubleClick={() => onStartEdit(task)}
      onContextMenu={openTaskMenu}
      {...attributes}
      {...listeners}
    >
      <input
        className="taskCheckbox"
        type="checkbox"
        checked={task.done}
        onChange={() => onToggle(task.id)}
        onPointerDown={e => e.stopPropagation()}
        onDoubleClick={e => e.stopPropagation()}
        onContextMenu={e => e.stopPropagation()}
      />

      {isEditing ? (
        <TextInput
          className="editTaskInput"
          value={editingText}
          onValueChange={setEditingText}
          onKeyDown={e => onEditKeyDown(e, task.id)}
          onBlur={handleEditBlur}
          onPointerDown={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          onRightClickStart={startInputContextMenu}
          onAfterMenuAction={afterInputMenuAction}
          autoFocusSelect
          contextItems={[
            { label: "Edit", onClick: () => onStartEdit(task) },
            { label: "Delete", danger: true, onClick: () => onDelete(task.id) }
          ]}
        />
      ) : (
        <span className={task.done ? "doneText" : ""}>{task.text}</span>
      )}

      <button
        className="deleteBtn"
        onClick={e => {
          e.stopPropagation();
          onDelete(task.id);
        }}
        onPointerDown={e => e.stopPropagation()}
        onDoubleClick={e => e.stopPropagation()}
        onContextMenu={e => e.stopPropagation()}
      >
        ×
      </button>
    </div>
  );
}

export default TaskRow;
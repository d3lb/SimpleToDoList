import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TaskRow from "./TaskRow";

function TaskList({
  tasks,
  editingId,
  editingText,
  setEditingText,
  onToggle,
  onDelete,
  onStartEdit,
  onSaveEdit,
  onEditKeyDown
}) {
  return (
    <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
      {tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          isEditing={editingId === task.id}
          editingText={editingText}
          setEditingText={setEditingText}
          onToggle={onToggle}
          onDelete={onDelete}
          onStartEdit={onStartEdit}
          onSaveEdit={onSaveEdit}
          onEditKeyDown={onEditKeyDown}
        />
      ))}
    </SortableContext>
  );
}

export default TaskList;
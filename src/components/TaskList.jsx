import TaskRow from "./TaskRow";

function TaskList({
  entries,
  focusTaskId,
  dropTarget,
  onFocusHandled,
  onToggle,
  onDelete,
  onTextChange,
  onCommit,
  onSubmit,
  onBackspaceEmpty,
  onToggleIndent,
  onNudge
}) {
  return entries.map(({ task, isSubtask }) => (
    <TaskRow
      key={task.id}
      task={task}
      isSubtask={isSubtask}
      isFocused={focusTaskId === task.id}
      dropHint={dropTarget?.id === task.id ? dropTarget.mode : null}
      onFocusHandled={onFocusHandled}
      onToggle={onToggle}
      onDelete={onDelete}
      onTextChange={onTextChange}
      onCommit={onCommit}
      onSubmit={onSubmit}
      onBackspaceEmpty={onBackspaceEmpty}
      onToggleIndent={onToggleIndent}
      onNudge={onNudge}
    />
  ));
}

export default TaskList;

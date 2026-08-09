function NewTaskLine({ onAdd }) {
  return (
    <button type="button" className="taskLine newLine" onClick={onAdd}>
      <span className="dragHandleSpacer" aria-hidden="true" />
      <span className="checkboxGhost" aria-hidden="true" />
      <span className="newTaskHint">Write a new task</span>
    </button>
  );
}

export default NewTaskLine;

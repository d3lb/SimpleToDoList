import TextInput from "./TextInput";

function NewTaskLine({ value, onChange, onKeyDown }) {
  return (
    <div className="taskLine newLine">
      <input className="taskCheckbox" type="checkbox" disabled />
      <TextInput
        className="newTaskInput"
        value={value}
        onValueChange={onChange}
        onKeyDown={onKeyDown}
        placeholder="Write a new task"
      />
    </div>
  );
}

export default NewTaskLine;
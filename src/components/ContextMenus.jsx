import { Item, Menu } from "react-contexify";
import "react-contexify/dist/ReactContexify.css";
import { TASK_MENU_ID } from "../utils/contextMenuIds";

function ContextMenus({ onEditTask, onDeleteTask }) {
  return (
    <Menu id={TASK_MENU_ID} className="contextMenu" animation={false}>
      <Item className="contextMenuItem" onClick={({ props }) => onEditTask(props.task)}>
        Edit
      </Item>
      <Item className="contextMenuItem dangerMenuItem" onClick={({ props }) => onDeleteTask(props.task.id)}>
        Delete
      </Item>
    </Menu>
  );
}

export default ContextMenus;
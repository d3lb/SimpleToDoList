import { Item, Menu, Separator, useContextMenu } from "react-contexify";
import { useRef, useState } from "react";
import { LIST_MENU_ID } from "../utils/contextMenuIds";
import TextInput from "./TextInput";

function ListSidebar({
  lists,
  activeListId,
  onSelectList,
  onAddList,
  onDeleteList,
  onRenameList,
  onImport,
  onExport,
  onExportAll
}) {
  const [listName, setListName] = useState("");
  const [renamingListId, setRenamingListId] = useState(null);
  const [renamingText, setRenamingText] = useState("");
  const importInputRef = useRef(null);
  const skipRenameBlurRef = useRef(false);
  const { show } = useContextMenu({ id: LIST_MENU_ID });

  function handleAddList() {
    const name = listName.trim();
    if (!name) return;

    onAddList(name);
    setListName("");
  }

  function handleAddKeyDown(e) {
    if (e.key === "Enter") handleAddList();
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        onImport(JSON.parse(reader.result));
      } catch {
        alert("Invalid JSON file");
      }

      e.target.value = "";
    };

    reader.readAsText(file);
  }

  function openListMenu(e, list) {
    e.preventDefault();
    e.stopPropagation();
  
    show({
      event: e,
      props: { list }
    });
  }

  function startInlineRename(list) {
    setRenamingListId(list.id);
    setRenamingText(list.name);
  }

  function saveRename(id) {
    const name = renamingText.trim();
    if (name) onRenameList(id, name);

    setRenamingListId(null);
    setRenamingText("");
  }

  function handleRenameBlur(id) {
    if (skipRenameBlurRef.current) {
      skipRenameBlurRef.current = false;
      return;
    }

    saveRename(id);
  }

  function cancelRename() {
    setRenamingListId(null);
    setRenamingText("");
  }

  function requestDeleteList(id) {
    setRenamingListId(null);
    setRenamingText("");
    onDeleteList(id);
  }

  function handleRenameKeyDown(e, id) {
    if (e.key === "Enter") saveRename(id);
    if (e.key === "Escape") cancelRename();
  }

  return (
    <aside className="listSidebar">
      <h2>Lists</h2>

      <div className="addListRow">
        <TextInput
          className="addListInput"
          value={listName}
          onValueChange={setListName}
          onKeyDown={handleAddKeyDown}
          placeholder="New list"
        />
        <button className="addListBtn" onClick={handleAddList}>+</button>
      </div>

      <div className="listNav">
        {lists.map(list => (
          <div
            className={list.id === activeListId ? "listItem activeList" : "listItem"}
            key={list.id}
            onContextMenu={e => openListMenu(e, list)}
          >
            {renamingListId === list.id ? (
              <TextInput
                className="renameListInput"
                value={renamingText}
                onValueChange={setRenamingText}
                onKeyDown={e => handleRenameKeyDown(e, list.id)}
                onBlur={() => handleRenameBlur(list.id)}
                onRightClickStart={() => {
                  skipRenameBlurRef.current = true;
                }}
                onAfterMenuAction={() => {
                  skipRenameBlurRef.current = false;
                }}
                autoFocusSelect
                contextItems={[
                  { label: "Rename", onClick: () => saveRename(list.id) },
                  { label: "Delete", danger: true, onClick: () => requestDeleteList(list.id) }
                ]}
              />
            ) : (
              <button
                className="listBtn"
                onClick={() => onSelectList(list.id)}
                onDoubleClick={() => startInlineRename(list)}
              >
                {list.name}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="sidebarActions">
        <button onClick={() => importInputRef.current.click()}>Import List</button>
        <button onClick={onExport} disabled={!activeListId}>Export Current</button>
        <button onClick={onExportAll} disabled={!lists.length}>Export All</button>
        <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImport} hidden />
      </div>

      <Menu id={LIST_MENU_ID} className="contextMenu" animation={false}>
        <Item className="contextMenuItem" onClick={({ props }) => startInlineRename(props.list)}>
          Rename
        </Item>
        <Separator className="contextMenuSeparator" />
        <Item className="contextMenuItem dangerMenuItem" onClick={({ props }) => requestDeleteList(props.list.id)}>
          Delete
        </Item>
      </Menu>
    </aside>
  );
}

export default ListSidebar;
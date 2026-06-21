import { useEffect, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import "./App.css";
import ContextMenus from "./components/ContextMenus";
import ListSidebar from "./components/ListSidebar";
import NewTaskLine from "./components/NewTaskLine";
import TaskList from "./components/TaskList";
import { useTasks } from "./hooks/useTasks";
import ConfirmModal from "./components/ConfirmModal";


function App() {
  const {
    lists,
    activeList,
    activeListId,
    setActiveListId,
    addList,
    deleteList,
    renameList,
    sortedTasks,
    newTaskText,
    setNewTaskText,
    editingId,
    editingText,
    setEditingText,
    toggleTask,
    deleteTask,
    startEdit,
    saveEdit,
    handleNewTaskKeyDown,
    handleEditKeyDown,
    reorderTask,
    importData,
    exportData,
    exportAllData
  } = useTasks();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    function disableBrowserContextMenu(e) {
      e.preventDefault();
    }
  
    document.addEventListener("contextmenu", disableBrowserContextMenu);
  
    return () => {
      document.removeEventListener("contextmenu", disableBrowserContextMenu);
    };
  }, []);

  const [confirmModal, setConfirmModal] = useState(null);

function closeConfirmModal() {
  setConfirmModal(null);
}

function requestDeleteList(id) {
  const list = lists.find(list => list.id === id);
  if (!list) return;

  setConfirmModal({
    title: "Delete list?",
    message: `Are you sure you want to delete "${list.name}"? This cannot be undone.`,
    confirmText: "Delete",
    cancelText: "Cancel",
    danger: true,
    onConfirm: () => {
      deleteList(id);
      closeConfirmModal();
    }
  });
}

  return (
    <div className="appShell">
      <ListSidebar
        lists={lists}
        activeListId={activeListId}
        onSelectList={setActiveListId}
        onAddList={addList}
        onDeleteList={requestDeleteList}
        onRenameList={renameList}
        onImport={importData}
        onExport={exportData}
        onExportAll={exportAllData}
      />

      <main className="app">
        <h1>{activeList?.name ?? "No List"}</h1>

        {activeList ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
            onDragEnd={({ active, over }) => reorderTask(active.id, over?.id)}
          >
            <section className="listBox">
              <TaskList
                tasks={sortedTasks}
                editingId={editingId}
                editingText={editingText}
                setEditingText={setEditingText}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onStartEdit={startEdit}
                onSaveEdit={saveEdit}
                onEditKeyDown={handleEditKeyDown}
              />

              <NewTaskLine value={newTaskText} onChange={setNewTaskText} onKeyDown={handleNewTaskKeyDown} />
            </section>
          </DndContext>
        ) : (
          <section className="listBox emptyListBox">
            <p>Create a list to start.</p>
          </section>
        )}
      </main>

      <ContextMenus onEditTask={startEdit} onDeleteTask={deleteTask} />
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmText={confirmModal?.confirmText}
        cancelText={confirmModal?.cancelText}
        danger={confirmModal?.danger}
        onConfirm={confirmModal?.onConfirm}
        onCancel={closeConfirmModal}
      />
    </div>
  );
}

export default App;
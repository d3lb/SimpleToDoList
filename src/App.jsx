import { useEffect, useMemo, useState } from "react";
import { closestCenter, DndContext, PointerSensor, pointerWithin, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import "./App.css";
import ListSidebar from "./components/ListSidebar";
import NewTaskLine from "./components/NewTaskLine";
import TaskList from "./components/TaskList";
import { useTasks } from "./hooks/useTasks";
import { useUpdateStatus } from "./hooks/useUpdateStatus";
import ConfirmModal from "./components/ConfirmModal";
import { buildSections, resolveDropMode } from "./utils/taskTree";
import { loadShowCompleted, saveShowCompleted } from "./utils/uiPreferences";

// A press on the grip starts a drag once it travels this far.
const DRAG_START_DISTANCE = 6;

// Share of a row's height at each edge that means "drop between rows".
// The band in the middle means "drop onto this row" and nests instead.
const EDGE_BAND = 0.3;

// Rows hold still while dragging; a drop indicator shows the landing spot
// instead, because a nested drop can't be previewed by shifting rows.
const noShift = () => null;

// Prefer whatever is under the pointer; fall back to the nearest row when
// the pointer sits in the gap between two of them.
function collisionDetection(args) {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length ? pointerCollisions : closestCenter(args);
}

function App() {
  const {
    isLoading,
    storageError,
    lists,
    activeList,
    activeListId,
    setActiveListId,
    addList,
    deleteList,
    renameList,
    visibleTasks,
    focusTaskId,
    clearFocusRequest,
    addTask,
    setTaskText,
    toggleTask,
    deleteTask,
    deleteTaskAndFocusPrevious,
    commitTask,
    submitTask,
    moveTask,
    nudgeTask,
    toggleTaskIndent,
    importData,
    exportData,
    exportAllData
  } = useTasks();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START_DISTANCE } })
  );

  const { status: updateStatus, installUpdate } = useUpdateStatus();

  const [dropTarget, setDropTarget] = useState(null);
  const [showCompleted, setShowCompleted] = useState(loadShowCompleted);

  const sections = useMemo(() => buildSections(activeList?.tasks ?? []), [activeList]);
  const renderedEntries = showCompleted ? [...sections.open, ...sections.done] : sections.open;

  function toggleShowCompleted() {
    setShowCompleted(previous => {
      saveShowCompleted(!previous);
      return !previous;
    });
  }

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

  // Works out whether the pointer is over the body of a row (nest) or near
  // one of its edges (reorder), which is what makes drag-to-nest possible.
  function resolveDropTarget({ active, over, activatorEvent, delta }) {
    if (!over || over.id === active.id) return null;

    const rect = over.rect;
    const pointerY = (activatorEvent?.clientY ?? 0) + delta.y;
    const offset = rect.height ? (pointerY - rect.top) / rect.height : 0.5;

    const activeTask = visibleTasks.find(task => task.id === active.id);
    const overTask = visibleTasks.find(task => task.id === over.id);
    if (!activeTask || !overTask) return null;

    const canNest = !visibleTasks.some(task => task.parentId === active.id);

    return { id: over.id, mode: resolveDropMode(offset, canNest, EDGE_BAND) };
  }

  function handleDragMove(event) {
    setDropTarget(resolveDropTarget(event));
  }

  function handleDragEnd(event) {
    setDropTarget(null);
    moveTask(event.active.id, resolveDropTarget(event));
  }

  if (isLoading) {
    return (
      <div className="appShell">
        <main className="app">
          <section className="listBox emptyListBox">
            <p>Loading…</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <>
      {updateStatus?.state === "downloading" && (
        <p className="updateBar">
          Downloading update{typeof updateStatus.percent === "number" ? ` ${updateStatus.percent}%` : ""}…
        </p>
      )}

      {updateStatus?.state === "ready" && (
        <p className="updateBar">
          <span>Version {updateStatus.version} is ready.</span>
          <button type="button" className="updateBtn" onClick={installUpdate}>Restart now</button>
        </p>
      )}

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

          {storageError && (
            <p className="storageWarning">Changes aren&apos;t being saved: {storageError}</p>
          )}

          {activeList ? (
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setDropTarget(null)}
            >
              <section className="listBox">
                <SortableContext items={renderedEntries.map(entry => entry.task.id)} strategy={noShift}>
                  <TaskList
                    entries={sections.open}
                    focusTaskId={focusTaskId}
                    dropTarget={dropTarget}
                    onFocusHandled={clearFocusRequest}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    onTextChange={setTaskText}
                    onCommit={commitTask}
                    onSubmit={submitTask}
                    onBackspaceEmpty={deleteTaskAndFocusPrevious}
                    onToggleIndent={toggleTaskIndent}
                    onNudge={nudgeTask}
                  />

                  <NewTaskLine onAdd={addTask} />

                  {sections.done.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="completedHeader"
                        onClick={toggleShowCompleted}
                        aria-expanded={showCompleted}
                      >
                        <span className={showCompleted ? "completedChevron isOpen" : "completedChevron"} aria-hidden="true" />
                        Completed ({sections.done.length})
                      </button>

                      {showCompleted && (
                        <TaskList
                          entries={sections.done}
                          focusTaskId={focusTaskId}
                          dropTarget={dropTarget}
                          onFocusHandled={clearFocusRequest}
                          onToggle={toggleTask}
                          onDelete={deleteTask}
                          onTextChange={setTaskText}
                          onCommit={commitTask}
                          onSubmit={submitTask}
                          onBackspaceEmpty={deleteTaskAndFocusPrevious}
                          onToggleIndent={toggleTaskIndent}
                          onNudge={nudgeTask}
                        />
                      )}
                    </>
                  )}
                </SortableContext>
              </section>
            </DndContext>
          ) : (
            <section className="listBox emptyListBox">
              <p>Create a list to start.</p>
            </section>
          )}
        </main>

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
    </>
  );
}

export default App;

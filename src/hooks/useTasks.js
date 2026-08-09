import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createList, downloadAllData, downloadData, loadData, parseData, saveData } from "../utils/taskStorage";
import {
  applyDrop,
  buildVisibleTasks,
  deleteTask as removeTaskAndChildren,
  hasChildren,
  insertSibling,
  removeTaskPromotingChildren,
  toggleIndent,
  toggleTaskDone
} from "../utils/taskTree";

const EMPTY_DATA = { lists: [], activeListId: null };

// Task text is now edited in place, so every keystroke changes state.
// Typing is written back on a short delay; everything else saves at once.
const TEXT_SAVE_DELAY = 400;

// How many structural changes Ctrl+Z can walk back through.
const UNDO_LIMIT = 50;

// Only these hand Ctrl+Z over to the browser. A checkbox is an <input>
// too, but it has no edit history of its own to undo.
const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel", "password", "email"]);

function isTextEntry(element) {
  if (!element) return false;
  if (element.isContentEditable || element.tagName === "TEXTAREA") return true;

  return element.tagName === "INPUT" && TEXT_INPUT_TYPES.has(element.type);
}

export function useTasks() {
  const [data, setData] = useState(EMPTY_DATA);

  // "loading" gates the UI, "ready" gates saving. In "error" the app stays
  // usable but never writes, so a failed read can't destroy the real store.
  const [status, setStatus] = useState("loading");
  const [storageError, setStorageError] = useState(null);

  // Id of the task whose input should take focus on the next render.
  const [focusTaskId, setFocusTaskId] = useState(null);

  const lists = data.lists;
  const activeListId = data.activeListId;
  const activeList = lists.find(list => list.id === activeListId) ?? null;
  const tasks = useMemo(() => activeList?.tasks ?? [], [activeList]);
  const visibleTasks = useMemo(() => buildVisibleTasks(tasks), [tasks]);

  const statusRef = useRef(status);
  const latestRef = useRef({ lists, activeListId });
  const saveTimerRef = useRef(null);
  const deferSaveRef = useRef(false);
  const undoStackRef = useRef([]);

  // Kept in sync so a debounced or unmount-time write always sees the
  // newest data without re-creating `persist` on every keystroke.
  useEffect(() => {
    statusRef.current = status;
    latestRef.current = { lists, activeListId };
  });

  const persist = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    if (statusRef.current !== "ready") return;

    saveData(latestRef.current.lists, latestRef.current.activeListId).then(result => {
      if (!result.ok) setStorageError(result.error);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadData().then(result => {
      if (cancelled) return;

      setData(result.data);
      setStorageError(result.ok ? null : result.error);
      setStatus(result.ok ? "ready" : "error");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "ready") return;

    const delay = deferSaveRef.current ? TEXT_SAVE_DELAY : 0;
    saveTimerRef.current = setTimeout(persist, delay);

    return () => {
      clearTimeout(saveTimerRef.current);
    };
  }, [status, lists, activeListId, persist]);

  // Don't lose the tail of a debounced edit if the view goes away mid-typing.
  useEffect(() => {
    return () => {
      persist();
    };
  }, [persist]);

  // Snapshot before a structural change. Typing isn't recorded: a focused
  // input has its own undo history, and per-keystroke entries would bury
  // the change the user actually wants back.
  function pushUndo() {
    const snapshot = latestRef.current;
    const stack = undoStackRef.current;

    if (stack[stack.length - 1] === snapshot) return;

    stack.push(snapshot);
    if (stack.length > UNDO_LIMIT) stack.shift();
  }

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return false;

    deferSaveRef.current = false;
    setData(previous);
    setFocusTaskId(null);

    return true;
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z";
      if (!isUndo) return;

      // Inside a text field, Ctrl+Z belongs to that field's own edit history.
      if (isTextEntry(document.activeElement)) return;

      if (undo()) e.preventDefault();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [undo]);

  function setLists(updater) {
    setData(prev => {
      const nextLists = typeof updater === "function" ? updater(prev.lists) : updater;
      const activeIdExists = nextLists.some(list => list.id === prev.activeListId);
      return { lists: nextLists, activeListId: activeIdExists ? prev.activeListId : nextLists[0]?.id ?? null };
    });
  }

  function setActiveListId(id) {
    deferSaveRef.current = false;
    setData(prev => ({ ...prev, activeListId: id }));
    setFocusTaskId(null);
  }

  function updateActiveTasks(updater) {
    if (!activeListId) return;

    setLists(prev => prev.map(list => {
      if (list.id !== activeListId) return list;

      const nextTasks = typeof updater === "function" ? updater(list.tasks) : updater;
      return { ...list, tasks: nextTasks };
    }));
  }

  function getUniqueListName(existingLists, name) {
    const existingNames = new Set(existingLists.map(list => list.name));

    if (!existingNames.has(name)) return name;

    let index = 2;
    let nextName = `${name} ${index}`;

    while (existingNames.has(nextName)) {
      index++;
      nextName = `${name} ${index}`;
    }

    return nextName;
  }

  function addList(name) {
    const text = name.trim();
    if (!text) return;

    pushUndo();
    deferSaveRef.current = false;

    const list = createList(text);

    setData(prev => ({
      lists: [...prev.lists, list],
      activeListId: list.id
    }));

    setFocusTaskId(null);
  }

  function deleteList(id) {
    pushUndo();
    deferSaveRef.current = false;

    setData(prev => {
      const nextLists = prev.lists.filter(list => list.id !== id);
      const nextActiveListId = prev.activeListId === id ? nextLists[0]?.id ?? null : prev.activeListId;
      return { lists: nextLists, activeListId: nextActiveListId };
    });

    setFocusTaskId(null);
  }

  function renameList(id, name) {
    const text = name.trim();
    if (!text) return;

    pushUndo();
    deferSaveRef.current = false;
    setLists(prev => prev.map(list => list.id === id ? { ...list, name: text } : list));
  }

  function insertTask(afterId) {
    if (!activeListId) return null;

    const id = crypto.randomUUID();
    deferSaveRef.current = false;

    updateActiveTasks(prev => insertSibling(prev, afterId, id));
    setFocusTaskId(id);

    return id;
  }

  function addTask() {
    return insertTask(null);
  }

  function setTaskText(id, text) {
    deferSaveRef.current = true;
    updateActiveTasks(prev => prev.map(task => task.id === id ? { ...task, text } : task));
  }

  function toggleTask(id) {
    pushUndo();
    deferSaveRef.current = false;
    updateActiveTasks(prev => toggleTaskDone(prev, id));
  }

  // Tab: nest under the row above, or step back out to the top level.
  function toggleTaskIndent(id) {
    const reindent = prev => toggleIndent(prev, id);

    // The row can move in the DOM, which drops focus; ask for it back.
    setFocusTaskId(id);

    // Tab at the top of the list has nowhere to go, and a wasted snapshot
    // would make the next Ctrl+Z look broken.
    if (reindent(tasks) === tasks) return;

    pushUndo();
    deferSaveRef.current = false;
    updateActiveTasks(reindent);
  }

  function deleteTask(id, { record = true } = {}) {
    if (record) pushUndo();
    deferSaveRef.current = false;
    updateActiveTasks(prev => removeTaskAndChildren(prev, id));

    if (focusTaskId === id) setFocusTaskId(null);
  }

  /**
   * Drops a row that was left blank. A blank row on its own is throwaway, so
   * it isn't worth an undo step; one that still has subtasks under it is a
   * real change, so those are promoted and the edit is recorded.
   */
  function discardEmptyTask(id) {
    if (!hasChildren(tasks, id)) {
      deleteTask(id, { record: false });
      return;
    }

    pushUndo();
    deferSaveRef.current = false;
    updateActiveTasks(prev => removeTaskPromotingChildren(prev, id));

    if (focusTaskId === id) setFocusTaskId(null);
  }

  // Backspace in an already-empty task: remove it and carry the caret upwards.
  function deleteTaskAndFocusPrevious(id) {
    const index = visibleTasks.findIndex(task => task.id === id);
    const previous = index > 0 ? visibleTasks[index - 1] : null;

    discardEmptyTask(id);
    setFocusTaskId(previous?.id ?? null);
  }

  // Called on blur: drop the row if it was never filled in, otherwise tidy it
  // up and write immediately so a pending debounce can't be lost.
  function commitTask(id) {
    const task = visibleTasks.find(item => item.id === id);
    if (!task) return;

    const text = task.text.trim();

    if (!text) {
      discardEmptyTask(id);
      return;
    }

    deferSaveRef.current = false;

    if (text !== task.text) {
      updateActiveTasks(prev => prev.map(item => item.id === id ? { ...item, text } : item));
      return;
    }

    persist();
  }

  // Enter on a filled task opens a fresh one right below it; on an empty task
  // it just ends the run of new tasks.
  function submitTask(id) {
    const task = visibleTasks.find(item => item.id === id);
    if (!task) return;

    if (!task.text.trim()) {
      discardEmptyTask(id);
      return;
    }

    if (task.done) {
      insertTask(null);
      return;
    }

    insertTask(id);
  }

  function clearFocusRequest() {
    setFocusTaskId(null);
  }

  function moveTask(activeId, target) {
    if (!target || activeId === target.id) return;
    if (applyDrop(tasks, activeId, target) === tasks) return;

    pushUndo();
    deferSaveRef.current = false;
    updateActiveTasks(prev => applyDrop(prev, activeId, target));
  }

  function importData(data) {
    const nextData = parseData(data);
    if (!nextData) return false;

    pushUndo();
    deferSaveRef.current = false;

    setData(prev => {
      const importedLists = nextData.lists.map(list => {
        // Ids are regenerated to avoid colliding with existing tasks, so
        // parent links have to be rewritten to the new ids.
        const idMap = new Map(list.tasks.map(task => [task.id, crypto.randomUUID()]));

        return {
          ...list,
          id: crypto.randomUUID(),
          name: getUniqueListName(prev.lists, list.name),
          tasks: list.tasks.map(task => ({
            ...task,
            id: idMap.get(task.id),
            parentId: task.parentId ? idMap.get(task.parentId) ?? null : null
          }))
        };
      });

      const nextLists = [...prev.lists, ...importedLists];

      return {
        lists: nextLists,
        activeListId: importedLists[0]?.id ?? prev.activeListId
      };
    });

    setFocusTaskId(null);

    return true;
  }

  function exportData() {
    downloadData(activeList);
  }

  function exportAllData() {
    downloadAllData(lists, activeListId);
  }

  return {
    isLoading: status === "loading",
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
    toggleTaskIndent,
    undo,
    importData,
    exportData,
    exportAllData
  };
}

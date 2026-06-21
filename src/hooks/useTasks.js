import { useEffect, useMemo, useState } from "react";
import { createList, downloadAllData, downloadData, loadData, normalizeData, saveData } from "../utils/taskStorage";

export function useTasks() {
  const [data, setData] = useState(loadData);

  const [newTaskText, setNewTaskText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const lists = data.lists;
  const activeListId = data.activeListId;
  const activeList = lists.find(list => list.id === activeListId) ?? null;
  const tasks = activeList?.tasks ?? [];

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      return a.order - b.order;
    });
  }, [tasks]);

  useEffect(() => {
    saveData(lists, activeListId);
  }, [lists, activeListId]);

  function setLists(updater) {
    setData(prev => {
      const nextLists = typeof updater === "function" ? updater(prev.lists) : updater;
      const activeIdExists = nextLists.some(list => list.id === prev.activeListId);
      return { lists: nextLists, activeListId: activeIdExists ? prev.activeListId : nextLists[0]?.id ?? null };
    });
  }

  function setActiveListId(id) {
    setData(prev => ({ ...prev, activeListId: id }));
    clearEdit();
  }

  function updateActiveTasks(updater) {
    if (!activeListId) return;

    setLists(prev => prev.map(list => {
      if (list.id !== activeListId) return list;

      const nextTasks = typeof updater === "function" ? updater(list.tasks) : updater;
      return { ...list, tasks: nextTasks };
    }));
  }

  function getNextOrder(list, done) {
    const orders = list.filter(task => task.done === done).map(task => task.order);
    return orders.length ? Math.max(...orders) + 1 : 0;
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

    const list = createList(text);

    setData(prev => ({
      lists: [...prev.lists, list],
      activeListId: list.id
    }));

    clearEdit();
  }

  function deleteList(id) {
    setData(prev => {
      const nextLists = prev.lists.filter(list => list.id !== id);
      const nextActiveListId = prev.activeListId === id ? nextLists[0]?.id ?? null : prev.activeListId;
      return { lists: nextLists, activeListId: nextActiveListId };
    });

    clearEdit();
  }

  function renameList(id, name) {
    const text = name.trim();
    if (!text) return;

    setLists(prev => prev.map(list => list.id === id ? { ...list, name: text } : list));
  }

  function addTask() {
    if (!activeListId) return;

    const text = newTaskText.trim();
    if (!text) return;

    updateActiveTasks(prev => [...prev, { id: crypto.randomUUID(), text, done: false, order: getNextOrder(prev, false) }]);
    setNewTaskText("");
  }

  function toggleTask(id) {
    updateActiveTasks(prev => {
      const currentTask = prev.find(task => task.id === id);
      if (!currentTask) return prev;

      const nextDone = !currentTask.done;
      const nextOrder = getNextOrder(prev, nextDone);

      return prev.map(task => task.id === id ? { ...task, done: nextDone, order: nextOrder } : task);
    });
  }

  function deleteTask(id) {
    updateActiveTasks(prev => prev.filter(task => task.id !== id));

    if (editingId === id) clearEdit();
  }

  function startEdit(task) {
    setEditingId(task.id);
    setEditingText(task.text);
  }

  function saveEdit(id) {
    const text = editingText.trim();

    if (!text) {
      deleteTask(id);
      clearEdit();
      return;
    }

    updateActiveTasks(prev => prev.map(task => task.id === id ? { ...task, text } : task));
    clearEdit();
  }

  function cancelEdit() {
    clearEdit();
  }

  function clearEdit() {
    setEditingId(null);
    setEditingText("");
  }

  function handleNewTaskKeyDown(e) {
    if (e.key === "Enter") addTask();
  }

  function handleEditKeyDown(e, id) {
    if (e.key === "Enter") saveEdit(id);
    if (e.key === "Escape") cancelEdit();
  }

  function reorderTask(activeId, overId) {
    if (!overId || activeId === overId) return;

    updateActiveTasks(prev => {
      const activeTask = prev.find(task => task.id === activeId);
      const overTask = prev.find(task => task.id === overId);

      if (!activeTask || !overTask || activeTask.done !== overTask.done) return prev;

      const group = prev.filter(task => task.done === activeTask.done).sort((a, b) => a.order - b.order);
      const otherGroup = prev.filter(task => task.done !== activeTask.done);

      const oldIndex = group.findIndex(task => task.id === activeId);
      const newIndex = group.findIndex(task => task.id === overId);

      const reordered = [...group];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      return [...otherGroup, ...reordered.map((task, index) => ({ ...task, order: index }))];
    });
  }

  function importData(data) {
    const nextData = normalizeData(data);
  
    setData(prev => {
      const importedLists = nextData.lists.map(list => ({
        ...list,
        id: crypto.randomUUID(),
        name: getUniqueListName(prev.lists, list.name),
        tasks: list.tasks.map(task => ({
          ...task,
          id: crypto.randomUUID()
        }))
      }));
  
      const nextLists = [...prev.lists, ...importedLists];
  
      return {
        lists: nextLists,
        activeListId: importedLists[0]?.id ?? prev.activeListId
      };
    });
  
    setNewTaskText("");
    clearEdit();
  }

  function exportData() {
    downloadData(activeList);
  }
  
  function exportAllData() {
    downloadAllData(lists, activeListId);
  }

  
  return {
    lists,
    activeList,
    activeListId,
    setActiveListId,
    addList,
    deleteList,
    renameList,
    tasks,
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
  };
}
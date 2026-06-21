const DATA_STORAGE_KEY = "simple-list:data";
const OLD_TASKS_STORAGE_KEY = "simple-list:tasks";

export function createList(name = "My List", tasks = []) {
  return {
    id: crypto.randomUUID(),
    name,
    tasks: normalizeTasks(tasks)
  };
}

export function normalizeTasks(data) {
  const source = Array.isArray(data) ? data : data?.tasks;
  if (!Array.isArray(source)) return [];

  return source
    .map((task, index) => {
      const text = typeof task === "string" ? task.trim() : String(task?.text ?? "").trim();
      if (!text) return null;

      return {
        id: typeof task?.id === "string" ? task.id : crypto.randomUUID(),
        text,
        done: normalizeDone(task?.done),
        order: Number.isFinite(Number(task?.order)) ? Number(task.order) : index
      };
    })
    .filter(Boolean);
}

export function normalizeData(data) {
  if (Array.isArray(data?.lists)) {
    const lists = data.lists.map((list, index) => {
      return {
        id: typeof list.id === "string" ? list.id : crypto.randomUUID(),
        name: String(list.name || `List ${index + 1}`),
        tasks: normalizeTasks(list.tasks)
      };
    });

    const activeListId = lists.some(list => list.id === data.activeListId) ? data.activeListId : lists[0]?.id ?? null;
    return { lists, activeListId };
  }

  if (Array.isArray(data?.projects)) {
    const lists = data.projects.map((project, index) => {
      return {
        id: typeof project.id === "string" ? project.id : crypto.randomUUID(),
        name: String(project.name || `List ${index + 1}`),
        tasks: normalizeTasks(project.tasks)
      };
    });

    const activeListId = lists.some(list => list.id === data.activeProjectId) ? data.activeProjectId : lists[0]?.id ?? null;
    return { lists, activeListId };
  }

  if (Array.isArray(data?.tasks) || Array.isArray(data)) {
    const name = data?.list || data?.project || data?.name || "Imported List";
    const list = createList(name, normalizeTasks(data));
    return { lists: [list], activeListId: list.id };
  }

  return createDefaultData();
}

export function loadData() {
  try {
    const rawData = localStorage.getItem(DATA_STORAGE_KEY);
    if (rawData) return normalizeData(JSON.parse(rawData));

    const oldTasks = localStorage.getItem(OLD_TASKS_STORAGE_KEY);
    if (oldTasks) {
      const list = createList("My List", normalizeTasks(JSON.parse(oldTasks)));
      return { lists: [list], activeListId: list.id };
    }

    return createDefaultData();
  } catch {
    return createDefaultData();
  }
}

export function saveData(lists, activeListId) {
  localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(normalizeData({ lists, activeListId })));
}

export function downloadData(list) {
  if (!list) return;

  const data = {
    app: "Simple List",
    version: 2,
    exportedAt: new Date().toISOString(),
    list: list.name,
    tasks: normalizeTasks(list.tasks)
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${safeFileName(list.name)}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

export function downloadAllData(lists, activeListId) {
  const data = {
    app: "Simple List",
    version: 2,
    exportedAt: new Date().toISOString(),
    ...normalizeData({ lists, activeListId })
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "simple-list-all.json";
  link.click();

  URL.revokeObjectURL(url);
}

function safeFileName(name) {
  return String(name || "simple-list")
    .trim()
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase() || "simple-list";
}

function normalizeDone(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const text = String(value ?? "").toLowerCase();
  return ["true", "yes", "1", "done", "completed", "checked"].includes(text);
}

function createDefaultData() {
  const list = createList("My List");
  return { lists: [list], activeListId: list.id };
}
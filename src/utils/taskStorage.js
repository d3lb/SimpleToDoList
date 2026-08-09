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

  const tasks = source
    .map((task, index) => {
      const text = typeof task === "string" ? task.trim() : String(task?.text ?? "").trim();
      if (!text) return null;

      return {
        id: typeof task?.id === "string" ? task.id : crypto.randomUUID(),
        text,
        done: normalizeDone(task?.done),
        order: Number.isFinite(Number(task?.order)) ? Number(task.order) : index,
        parentId: typeof task?.parentId === "string" ? task.parentId : null
      };
    })
    .filter(Boolean);

  return promoteInvalidChildren(tasks);
}

// Nesting is one level deep. Anything pointing at a missing parent, at a
// parent that is itself nested, or at itself becomes a top-level task.
function promoteInvalidChildren(tasks) {
  const byId = new Map(tasks.map(task => [task.id, task]));

  return tasks.map(task => {
    if (!task.parentId) return task;

    const parent = byId.get(task.parentId);
    if (!parent || parent.id === task.id || parent.parentId) return { ...task, parentId: null };

    return task;
  });
}

export function parseData(data) {
  if (Array.isArray(data?.lists)) {
    const lists = data.lists.map((list, index) => {
      return {
        id: typeof list?.id === "string" ? list.id : crypto.randomUUID(),
        name: String(list?.name || `List ${index + 1}`),
        tasks: normalizeTasks(list?.tasks)
      };
    });

    const activeListId = lists.some(list => list.id === data.activeListId) ? data.activeListId : lists[0]?.id ?? null;
    return { lists, activeListId };
  }

  if (Array.isArray(data?.projects)) {
    const lists = data.projects.map((project, index) => {
      return {
        id: typeof project?.id === "string" ? project.id : crypto.randomUUID(),
        name: String(project?.name || `List ${index + 1}`),
        tasks: normalizeTasks(project?.tasks)
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

  return null;
}

export function normalizeData(data) {
  return parseData(data) ?? createDefaultData();
}

export function createDefaultData() {
  const list = createList("My List");
  return { lists: [list], activeListId: list.id };
}

function getFileStorage() {
  return typeof window !== "undefined" ? window.simpleListStorage ?? null : null;
}

function readLocalData() {
  try {
    const rawData = localStorage.getItem(DATA_STORAGE_KEY);
    if (rawData) return JSON.parse(rawData);

    const oldTasks = localStorage.getItem(OLD_TASKS_STORAGE_KEY);
    if (oldTasks) return { name: "My List", tasks: JSON.parse(oldTasks) };

    return null;
  } catch {
    return null;
  }
}

export async function loadData() {
  const fileStorage = getFileStorage();

  if (!fileStorage) {
    return { data: parseData(readLocalData()) ?? createDefaultData(), ok: true };
  }

  let result;

  try {
    result = await fileStorage.load();
  } catch (error) {
    return { data: createDefaultData(), ok: false, error: error.message };
  }

  if (!result?.ok) {
    return { data: createDefaultData(), ok: false, error: result?.error ?? "Could not read saved data." };
  }

  const parsed = parseData(result.data);
  if (parsed) return { data: parsed, ok: true };

  return { data: parseData(readLocalData()) ?? createDefaultData(), ok: true };
}

export async function saveData(lists, activeListId) {
  const payload = normalizeData({ lists, activeListId });
  const fileStorage = getFileStorage();

  if (!fileStorage) {
    try {
      localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(payload));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  try {
    const result = await fileStorage.save(payload);
    return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? "Could not save data." };
  } catch (error) {
    return { ok: false, error: error.message };
  }
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

  downloadJson(data, `${safeFileName(list.name)}.json`);
}

export function downloadAllData(lists, activeListId) {
  const data = {
    app: "Simple List",
    version: 2,
    exportedAt: new Date().toISOString(),
    ...normalizeData({ lists, activeListId })
  };

  downloadJson(data, "simple-list-all.json");
}

function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
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

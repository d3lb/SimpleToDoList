/**
 * Tasks are stored flat. Nesting is expressed with `parentId` and is exactly
 * one level deep: a task with a parent can never have children of its own.
 *
 * `order` is only meaningful within a sibling group (all roots, or all
 * children of one parent). Completed tasks sink to the bottom of their own
 * group, so a done subtask drops under its siblings and a done parent drops
 * to the bottom of the list carrying its subtasks along.
 *
 * Everything here is a pure function: it takes the task array and returns a
 * new one, which keeps the ordering rules testable on their own.
 */

export function sortSiblings(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    return a.order - b.order;
  });
}

export function findTask(tasks, id) {
  return tasks.find(task => task.id === id) ?? null;
}

export function getRootIds(tasks) {
  const rootIds = new Set();

  for (const task of tasks) {
    if (!task.parentId) rootIds.add(task.id);
  }

  return rootIds;
}

export function getChildren(tasks, parentId) {
  if (!parentId) return [];
  return sortSiblings(tasks.filter(task => task.parentId === parentId));
}

export function hasChildren(tasks, id) {
  return tasks.some(task => task.parentId === id);
}

export function getRoots(tasks) {
  const rootIds = getRootIds(tasks);
  return sortSiblings(tasks.filter(task => !task.parentId || !rootIds.has(task.parentId)));
}

/** Flat, render-ready order: each root followed by its children. */
export function buildVisibleTasks(tasks) {
  const rootIds = getRootIds(tasks);
  const childrenByParent = new Map();

  for (const task of tasks) {
    // A child of a non-root is treated as a root; storage normally prevents
    // this, but in-memory edits shouldn't be able to hide a task either.
    if (!task.parentId || !rootIds.has(task.parentId)) continue;

    const siblings = childrenByParent.get(task.parentId);
    if (siblings) siblings.push(task);
    else childrenByParent.set(task.parentId, [task]);
  }

  const visible = [];

  for (const root of getRoots(tasks)) {
    visible.push(root);

    const children = childrenByParent.get(root.id);
    if (children) visible.push(...sortSiblings(children));
  }

  return visible;
}

/**
 * Splits the visible order into the open list and the completed list. A
 * whole root block goes to whichever side its parent task is on, so
 * subtasks never get separated from the task they belong to.
 *
 * Each entry carries `isSubtask` so callers don't have to re-derive
 * whether a task is nested.
 */
export function buildSections(tasks) {
  const rootIds = getRootIds(tasks);
  const isRoot = task => !task.parentId || !rootIds.has(task.parentId);

  const open = [];
  const done = [];
  let target = open;

  for (const task of buildVisibleTasks(tasks)) {
    if (isRoot(task)) target = task.done ? done : open;

    target.push({ task, isSubtask: !isRoot(task) });
  }

  return { open, done };
}

function getGroup(tasks, parentId) {
  return parentId ? getChildren(tasks, parentId) : getRoots(tasks);
}

/**
 * Keeps "a parent is done exactly when all its subtasks are" true after a
 * task moves in or out of a parent, not just when a checkbox is clicked.
 */
function syncParentDone(tasks, parentId) {
  if (!parentId) return tasks;

  const parent = findTask(tasks, parentId);
  if (!parent || parent.parentId) return tasks;

  const children = tasks.filter(task => task.parentId === parentId);
  if (!children.length) return tasks;

  const done = children.every(child => child.done);
  if (parent.done === done) return tasks;

  return bumpToEndOfDoneGroup(
    tasks.map(task => task.id === parentId ? { ...task, done } : task),
    parentId
  );
}

function syncParents(tasks, ...parentIds) {
  const seen = new Set();

  return parentIds.reduce((current, parentId) => {
    if (!parentId || seen.has(parentId)) return current;
    seen.add(parentId);

    return syncParentDone(current, parentId);
  }, tasks);
}

/**
 * Moves `id` into `parentId`'s group at `index` (an index into that group's
 * sorted order) and renumbers the group so the placement survives a re-sort.
 */
function placeInGroup(tasks, id, parentId, index) {
  const moved = findTask(tasks, id);
  if (!moved) return tasks;

  const group = getGroup(tasks, parentId).filter(task => task.id !== id);
  const position = Math.max(0, Math.min(index, group.length));

  group.splice(position, 0, { ...moved, parentId: parentId ?? null });

  const orders = new Map(group.map((task, order) => [task.id, order]));

  return tasks.map(task => {
    if (!orders.has(task.id)) return task;
    if (task.id === id) return { ...task, parentId: parentId ?? null, order: orders.get(id) };

    return { ...task, order: orders.get(task.id) };
  });
}

/** Sends a task to the end of its group's open or done half. */
function bumpToEndOfDoneGroup(tasks, id) {
  const task = findTask(tasks, id);
  if (!task) return tasks;

  const orders = getGroup(tasks, task.parentId)
    .filter(sibling => sibling.id !== id && sibling.done === task.done)
    .map(sibling => sibling.order);

  const nextOrder = orders.length ? Math.max(...orders) + 1 : 0;

  return tasks.map(item => item.id === id ? { ...item, order: nextOrder } : item);
}

export function createTask(id, parentId = null, order = 0) {
  return { id, text: "", done: false, order, parentId };
}

/**
 * Enter: a new empty task as the next sibling of `afterId`, so pressing it
 * inside a subtask keeps you in the subtask group. `afterId` of null appends
 * at the top level.
 */
export function insertSibling(tasks, afterId, newId) {
  const after = afterId ? findTask(tasks, afterId) : null;
  const parentId = after?.parentId ?? null;
  const group = getGroup(tasks, parentId);
  const index = after ? group.findIndex(task => task.id === after.id) + 1 : group.length;

  const placed = placeInGroup([...tasks, createTask(newId, parentId)], newId, parentId, index);

  return syncParents(placed, parentId);
}

/** Tab on a top-level task: nest it under whatever sits directly above it. */
export function indentTask(tasks, id) {
  const task = findTask(tasks, id);
  if (!task || task.parentId) return tasks;

  // Allowing this would create a second level of nesting.
  if (hasChildren(tasks, id)) return tasks;

  const visible = buildVisibleTasks(tasks);
  const index = visible.findIndex(item => item.id === id);
  if (index <= 0) return tasks;

  const above = visible[index - 1];

  if (above.parentId) {
    const siblings = getChildren(tasks, above.parentId).filter(item => item.id !== id);
    const position = siblings.findIndex(item => item.id === above.id) + 1;

    return syncParents(placeInGroup(tasks, id, above.parentId, position), above.parentId);
  }

  return syncParents(placeInGroup(tasks, id, above.id, getChildren(tasks, above.id).length), above.id);
}

/** Tab on a subtask: back to top level, directly after its former parent. */
export function outdentTask(tasks, id) {
  const task = findTask(tasks, id);
  if (!task?.parentId) return tasks;

  const roots = getRoots(tasks);
  const index = roots.findIndex(item => item.id === task.parentId) + 1;

  return syncParents(placeInGroup(tasks, id, null, index), task.parentId);
}

export function toggleIndent(tasks, id) {
  const task = findTask(tasks, id);
  if (!task) return tasks;

  return task.parentId ? outdentTask(tasks, id) : indentTask(tasks, id);
}

/** Deleting a parent takes its subtasks with it. */
export function deleteTask(tasks, id) {
  const parentId = findTask(tasks, id)?.parentId ?? null;
  const remaining = tasks.filter(task => task.id !== id && task.parentId !== id);

  return syncParents(remaining, parentId);
}

/**
 * Nudges a task one slot up (-1) or down (+1) within its own sibling group.
 * It never changes parent or completion, so it can only swap with a
 * neighbour that shares both — which keeps it from jumping into the
 * completed half or out of its parent.
 */
export function moveTaskBy(tasks, id, offset) {
  const task = findTask(tasks, id);
  if (!task) return tasks;

  const group = getGroup(tasks, task.parentId);
  const index = group.findIndex(item => item.id === id);
  const neighbour = group[index + offset];

  if (index === -1 || !neighbour || neighbour.done !== task.done) return tasks;

  return placeInGroup(tasks, id, task.parentId, index + offset);
}

/**
 * Removes a task but keeps its subtasks, promoting them into the slot the
 * parent occupied. Used when a parent's text is emptied: the row is gone,
 * but nothing the user typed underneath it should disappear with it.
 */
export function removeTaskPromotingChildren(tasks, id) {
  if (!findTask(tasks, id)) return tasks;

  const children = getChildren(tasks, id);
  if (!children.length) return deleteTask(tasks, id);

  const nextRoots = [];

  for (const root of getRoots(tasks)) {
    if (root.id === id) nextRoots.push(...children);
    else nextRoots.push(root);
  }

  const orders = new Map(nextRoots.map((task, order) => [task.id, order]));
  const promoted = new Set(children.map(child => child.id));

  return tasks
    .filter(task => task.id !== id)
    .map(task => {
      if (!orders.has(task.id)) return task;

      return {
        ...task,
        parentId: promoted.has(task.id) ? null : task.parentId,
        order: orders.get(task.id)
      };
    });
}

/**
 * Parent and subtasks are fully linked: a parent drives all its children,
 * and a parent is done exactly when every one of its children is.
 */
export function toggleTaskDone(tasks, id) {
  const task = findTask(tasks, id);
  if (!task) return tasks;

  const nextDone = !task.done;

  if (!task.parentId) {
    const updated = tasks.map(item =>
      item.id === id || item.parentId === id ? { ...item, done: nextDone } : item
    );

    return bumpToEndOfDoneGroup(updated, id);
  }

  let updated = bumpToEndOfDoneGroup(
    tasks.map(item => item.id === id ? { ...item, done: nextDone } : item),
    id
  );

  const parent = findTask(updated, task.parentId);
  if (!parent) return updated;

  const siblings = updated.filter(item => item.parentId === parent.id);
  const parentDone = siblings.every(item => item.done);

  if (parent.done === parentDone) return updated;

  updated = updated.map(item => item.id === parent.id ? { ...item, done: parentDone } : item);

  return bumpToEndOfDoneGroup(updated, parent.id);
}

/**
 * Turns "how far down the hovered row is the pointer" into a drop mode.
 * The middle band nests; the edges mean between-rows. A task that has
 * subtasks of its own can't be nested, so it only ever gets before/after.
 */
export function resolveDropMode(offset, canNest, edgeBand) {
  if (canNest && offset > edgeBand && offset < 1 - edgeBand) return "nest";
  return offset < 0.5 ? "before" : "after";
}

/**
 * Resolves a drop into a concrete placement.
 *
 * mode "nest"  - dropped on the body of a row: become its subtask
 * mode "before"/"after" - dropped in a gap: land in whichever group that
 * gap belongs to, which keeps subtask reordering inside a parent working
 * while a gap between two top-level tasks still produces a top-level task.
 */
export function applyDrop(tasks, activeId, target) {
  if (!target || activeId === target.id) return tasks;

  const active = findTask(tasks, activeId);
  const over = findTask(tasks, target.id);
  if (!active || !over) return tasks;

  const previousParentId = active.parentId;
  const place = (next, parentId) => syncParents(next, previousParentId, parentId);

  const activeHasChildren = hasChildren(tasks, activeId);

  // A task with subtasks can't itself be nested, so it only ever moves
  // between top-level positions.
  if (target.mode === "nest") {
    if (activeHasChildren) return tasks;

    if (over.parentId) {
      const siblings = getChildren(tasks, over.parentId).filter(item => item.id !== activeId);
      const index = siblings.findIndex(item => item.id === over.id) + 1;

      return place(placeInGroup(tasks, activeId, over.parentId, index), over.parentId);
    }

    return place(placeInGroup(tasks, activeId, over.id, getChildren(tasks, over.id).length), over.id);
  }

  const after = target.mode === "after";

  if (over.parentId && !activeHasChildren) {
    const siblings = getChildren(tasks, over.parentId).filter(item => item.id !== activeId);
    const index = siblings.findIndex(item => item.id === over.id);

    return place(placeInGroup(tasks, activeId, over.parentId, after ? index + 1 : index), over.parentId);
  }

  // The gap directly under a parent belongs to that parent's subtasks.
  if (after && !over.parentId && hasChildren(tasks, over.id) && !activeHasChildren) {
    return place(placeInGroup(tasks, activeId, over.id, 0), over.id);
  }

  const rootId = over.parentId ?? over.id;
  if (rootId === activeId) return tasks;

  const roots = getRoots(tasks).filter(item => item.id !== activeId);
  const index = roots.findIndex(item => item.id === rootId);
  if (index === -1) return tasks;

  return place(placeInGroup(tasks, activeId, null, after ? index + 1 : index), null);
}

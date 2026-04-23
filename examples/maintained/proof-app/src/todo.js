export const TODO_ROUTES = {
  list: "/tasks",
  detail: (taskId) => `/tasks/${taskId}`,
  edit: (taskId) => `/tasks/${taskId}/edit`
};

export const TODO_PROJECT_ROUTES = {
  list: "/projects",
  detail: (projectId) => `/projects/${projectId}`,
  edit: (projectId) => `/projects/${projectId}/edit`
};

export function summarizeTaskDetail(task) {
  const lines = [
    `Title: ${task.title}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority || "medium"}`,
    `Project: ${task.project_id}`,
    `Owner: ${task.owner_id || "Unassigned"}`,
    `Due: ${task.due_at || "No due date"}`
  ];

  return lines.join("\n");
}

export function buildTaskDetailViewModel(task) {
  return {
    heading: task.title,
    statusBadge: task.status,
    priorityBadge: task.priority || "medium",
    route: TODO_ROUTES.detail(task.id),
    editRoute: TODO_ROUTES.edit(task.id),
    summary: summarizeTaskDetail(task)
  };
}

export function summarizeTaskCard(task) {
  const lines = [
    `Title: ${task.title || "Untitled task"}`,
    `Status: ${task.status || "active"}`,
    `Priority: ${task.priority || "medium"}`,
    `Owner: ${task.ownerId || task.owner_id || "Unassigned"}`
  ];

  if (task.dueAt || task.due_at) {
    lines.push(`Due: ${task.dueAt || task.due_at}`);
  }

  return lines.join("\n");
}

export function buildTaskCardViewModel(task) {
  return {
    heading: task.title || "Untitled task",
    statusBadge: task.status || "active",
    priorityBadge: task.priority || "medium",
    ownerBadge: task.ownerId || task.owner_id || "Unassigned",
    route: TODO_ROUTES.detail(task.id),
    summary: summarizeTaskCard(task)
  };
}

export function summarizeProjectDetail(project) {
  const lines = [
    `Name: ${project.name}`,
    `Status: ${project.status}`,
    `Owner: ${project.owner_id || "Unassigned"}`,
    `Created: ${project.created_at || "Unknown"}`
  ];

  if (project.description) {
    lines.push(`Description: ${project.description}`);
  }

  return lines.join("\n");
}

export function buildProjectDetailViewModel(project) {
  return {
    heading: project.name,
    statusBadge: project.status,
    ownerBadge: project.owner_id || "Unassigned",
    route: TODO_PROJECT_ROUTES.detail(project.id),
    editRoute: TODO_PROJECT_ROUTES.edit(project.id),
    summary: summarizeProjectDetail(project)
  };
}

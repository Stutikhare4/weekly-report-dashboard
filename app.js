const LEGACY_STORAGE_KEY = "multi-project-weekly-dashboard";
const USER_DATA_PREFIX = "multi-project-dashboard-state:";
const STATE_KEY = "multi-project-dashboard-state";

const nodes = {
  greetingTitle: document.getElementById("greetingTitle"),
  projectCount: document.getElementById("projectCount"),
  currentCount: document.getElementById("currentCount"),
  closedCount: document.getElementById("closedCount"),
  updateCount: document.getElementById("updateCount"),
  currentProjectCount: document.getElementById("currentProjectCount"),
  closedProjectCount: document.getElementById("closedProjectCount"),
  currentProjects: document.getElementById("currentProjects"),
  closedProjects: document.getElementById("closedProjects"),
  projectReportOutput: document.getElementById("projectReportOutput"),
  projectReportState: document.getElementById("projectReportState"),
  resetAll: document.getElementById("resetAll"),
  generateReport: document.getElementById("generateReport"),
  downloadReport: document.getElementById("downloadReport"),
  homeScreen: document.getElementById("homeScreen"),
  categoryScreen: document.getElementById("categoryScreen"),
  projectScreen: document.getElementById("projectScreen"),
  addProjectScreen: document.getElementById("addProjectScreen"),
  addUpdateScreen: document.getElementById("addUpdateScreen"),
  addProjectForm: document.getElementById("addProjectForm"),
  addUpdateForm: document.getElementById("addUpdateForm"),
  newProjectName: document.getElementById("newProjectName"),
  newProjectStatus: document.getElementById("newProjectStatus"),
  newProjectNotes: document.getElementById("newProjectNotes"),
  newUpdateWeekStart: document.getElementById("newUpdateWeekStart"),
  newUpdateStatus: document.getElementById("newUpdateStatus"),
  formTasksList: document.getElementById("formTasksList"),
  btnAddTask: document.getElementById("btnAddTask"),
  cancelAddProject: document.getElementById("cancelAddProject"),
  btnCancelAddProject: document.getElementById("btnCancelAddProject"),
  cancelAddUpdate: document.getElementById("cancelAddUpdate"),
  btnCancelAddUpdate: document.getElementById("btnCancelAddUpdate"),
  sidebarAddProject: document.getElementById("sidebarAddProject"),
  homeAddProject: document.getElementById("homeAddProject"),
  addWeeklyUpdate: document.getElementById("addWeeklyUpdate"),
  addUpdateProjectTitle: document.getElementById("addUpdateProjectTitle"),
  openCurrent: document.getElementById("openCurrent"),
  openClosed: document.getElementById("openClosed"),
  backToHome: document.getElementById("backToHome"),
  backToCategory: document.getElementById("backToCategory"),
  categoryTitle: document.getElementById("categoryTitle"),
  categoryBadge: document.getElementById("categoryBadge"),
  categoryList: document.getElementById("categoryList"),
  projectTitle: document.getElementById("projectTitle"),
  projectStatusBadge: document.getElementById("projectStatusBadge"),
  projectOverview: document.getElementById("projectOverview"),
  projectUpdates: document.getElementById("projectUpdates"),
  shell: document.querySelector(".shell"),
};

let state = loadState();
let uiState = {
  screen: "home",
  category: "current",
  projectId: null,
  editingUpdateId: null,
};
let latestReportText = "";

nodes.openCurrent.addEventListener("click", () => openCurrentProject());
nodes.openClosed.addEventListener("click", () => openClosedProject());
nodes.backToHome.addEventListener("click", () => openHome());
nodes.backToCategory.addEventListener("click", () => openCategory(uiState.category));
nodes.generateReport.addEventListener("click", () => renderReport(buildReport(uiState.projectId)));
nodes.downloadReport.addEventListener("click", downloadReport);
nodes.resetAll.addEventListener("click", resetAllData);

nodes.sidebarAddProject.addEventListener("click", () => openAddProject());
nodes.homeAddProject.addEventListener("click", () => openAddProject());
nodes.cancelAddProject.addEventListener("click", () => goBackFromAddProject());
nodes.btnCancelAddProject.addEventListener("click", () => goBackFromAddProject());
nodes.addProjectForm.addEventListener("submit", (e) => saveProject(e));
nodes.addWeeklyUpdate.addEventListener("click", () => openAddUpdate());
nodes.cancelAddUpdate.addEventListener("click", () => openProject(uiState.projectId));
nodes.btnCancelAddUpdate.addEventListener("click", () => openProject(uiState.projectId));
nodes.addUpdateForm.addEventListener("submit", (e) => saveWeeklyUpdate(e));
nodes.btnAddTask.addEventListener("click", () => addNewTaskToForm());

seedDemoData();
renderGreeting();
showDashboard();
renderAll();
registerServiceWorker();

function renderAll() {
  renderStats();
  renderHomeBoards();
  renderCategoryScreen();
  renderProjectScreen();
  renderScreen();
}

function renderGreeting() {
  if (nodes.greetingTitle) {
    nodes.greetingTitle.textContent = "Hi";
  }

  document.title = "Weekly Report Dashboard";
}

function renderStats() {
  const currentProjects = state.projects.filter((project) => project.status === "current").length;
  const closedProjects = state.projects.filter((project) => project.status === "closed").length;

  nodes.projectCount.textContent = `${state.projects.length}`;
  nodes.currentCount.textContent = `${currentProjects}`;
  nodes.closedCount.textContent = `${closedProjects}`;
  nodes.updateCount.textContent = `${state.updates.length}`;
  nodes.currentProjectCount.textContent = `${currentProjects}`;
  nodes.closedProjectCount.textContent = `${closedProjects}`;
}

function renderHomeBoards() {
  if (!nodes.currentProjects || !nodes.closedProjects) {
    return;
  }

  nodes.currentProjects.innerHTML = renderProjectCards("current", "No current projects yet.");
  nodes.closedProjects.innerHTML = renderProjectCards("closed", "No closed projects yet.");

  nodes.currentProjects.querySelectorAll("[data-project-id]").forEach((button) => {
    button.addEventListener("click", () => openProject(button.dataset.projectId));
  });

  nodes.closedProjects.querySelectorAll("[data-project-id]").forEach((button) => {
    button.addEventListener("click", () => openProject(button.dataset.projectId));
  });
}

function renderProjectCards(status, emptyLabel) {
  const projects = state.projects.filter((project) => project.status === status);

  if (!projects.length) {
    return `<div class="empty-state">${escapeHtml(emptyLabel)}</div>`;
  }

  return projects
    .map((project) => {
      const latestUpdate = getLatestUpdateForProject(project.id);
      const updateCount = state.updates.filter((update) => update.projectId === project.id).length;

      return `
        <button class="project-card project-card-button" type="button" data-project-id="${project.id}">
          <header>
            <div>
              <h4>${escapeHtml(project.name)}</h4>
              <div class="meta">${updateCount} weekly update${updateCount === 1 ? "" : "s"}</div>
            </div>
            <span class="status-badge ${statusClass(project.status)}">${escapeHtml(project.status)}</span>
          </header>
          <div class="summary">
            <div class="range">${escapeHtml(latestUpdate ? latestUpdate.weekRange : "No weekly entries yet")}</div>
            <div><strong>Notes:</strong> ${escapeHtml(project.notes || "No notes yet")}</div>
            <div><strong>Latest status:</strong> ${escapeHtml(latestUpdate ? latestUpdate.statusTag : "none")}</div>
            <div><strong>Latest tasks:</strong> ${latestUpdate && latestUpdate.tasks && latestUpdate.tasks.length ? latestUpdate.tasks.map(t => `${t.title} (${t.status})`).join(", ") : "No tasks yet"}</div>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderCategoryScreen() {
  const projects = state.projects.filter((project) => project.status === uiState.category);
  const label = uiState.category === "current" ? "Current projects" : "Closed projects";
  nodes.categoryTitle.textContent = label;
  nodes.categoryBadge.textContent = `${projects.length} project${projects.length === 1 ? "" : "s"}`;

  nodes.categoryList.innerHTML = projects.length
    ? projects
        .map((project) => {
          const latestUpdate = getLatestUpdateForProject(project.id);
          return `
            <button class="project-name-card" type="button" data-project-id="${project.id}">
              <span class="project-name">${escapeHtml(project.name)}</span>
              <span class="project-meta">${escapeHtml(latestUpdate ? latestUpdate.weekRange : "No weekly entries yet")}</span>
            </button>
          `;
        })
        .join("")
    : `<div class="empty-state">No ${escapeHtml(label.toLowerCase())} yet.</div>`;

  nodes.categoryList.querySelectorAll("[data-project-id]").forEach((button) => {
    button.addEventListener("click", () => openProject(button.dataset.projectId));
  });
}

function renderProjectScreen() {
  const project = state.projects.find((item) => item.id === uiState.projectId);

  if (!project) {
    nodes.projectTitle.textContent = "Project";
    nodes.projectStatusBadge.textContent = "Waiting";
    nodes.projectOverview.innerHTML = `<p class="muted">Choose a project name to see its page.</p>`;
    nodes.projectUpdates.innerHTML = "";
    nodes.projectReportState.textContent = "Waiting";
    nodes.projectReportOutput.innerHTML = `<p class="muted">Open a project name to generate a report for that project only.</p>`;
    return;
  }

  const updates = state.updates
    .filter((update) => update.projectId === project.id)
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart));
  const latestUpdate = updates[0];

  nodes.projectTitle.textContent = project.name;
  nodes.projectStatusBadge.textContent = formatStatus(project.status);
  nodes.projectStatusBadge.className = `pill pill-dark status-badge ${statusClass(project.status)}`;
  nodes.projectOverview.innerHTML = `
    <div class="detail-text">
      <div><strong>Status:</strong> ${escapeHtml(formatStatus(project.status))}</div>
      <div><strong>Notes:</strong> ${escapeHtml(project.notes || "No notes yet")}</div>
      <div><strong>Weekly updates:</strong> ${updates.length}</div>
      <div><strong>Latest range:</strong> ${escapeHtml(latestUpdate ? latestUpdate.weekRange : "No weekly entries yet")}</div>
      <div><strong>Latest status:</strong> ${escapeHtml(latestUpdate ? latestUpdate.statusTag : "none")}</div>
      <div><strong>Latest tasks:</strong> ${escapeHtml(latestUpdate && latestUpdate.tasks && latestUpdate.tasks.length ? latestUpdate.tasks.map(t => `${t.title} (${t.status})`).join(", ") : "No tasks yet")}</div>
    </div>
  `;

  nodes.projectUpdates.innerHTML = updates.length
    ? updates
        .map(
          (update) => {
            const taskList = update.tasks || [];
            return `
            <article class="log-card">
              <header style="align-items: center;">
                <div>
                  <h4>${escapeHtml(update.weekRange)}</h4>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button class="ghost-button btn-edit-update" data-update-id="${update.id}" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 8px;">Edit</button>
                  <span class="status-badge ${statusClass(update.statusTag)}">${escapeHtml(update.statusTag)}</span>
                </div>
              </header>
              <div class="summary" style="display: grid; gap: 10px;">
                ${taskList.length ? `
                  <div style="margin-top: 8px;">
                    <strong style="display: block; margin-bottom: 6px; color: var(--accent-2);">Tasks & Status:</strong>
                    <ul style="margin: 0; padding-left: 18px; list-style-type: disc; display: grid; gap: 6px;">
                      ${taskList.map(task => `
                        <li>
                          <span style="font-weight: 600;">${escapeHtml(task.title)}</span>
                          <span class="meta">(${escapeHtml(task.owner || "Unassigned")})</span>
                          <span class="status-badge ${statusClass(task.status)}" style="padding: 2px 8px; font-size: 0.72rem; margin-left: 6px;">${escapeHtml(task.status)}</span>
                          ${task.subtasks && task.subtasks.length ? `
                            <ul style="margin: 4px 0 0; padding-left: 16px; list-style-type: circle; display: grid; gap: 4px;">
                              ${task.subtasks.map(sub => `
                                <li style="font-size: 0.9em; color: #ced9e8;">
                                  <span>${escapeHtml(sub.title)}</span>
                                  <span class="status-badge ${statusClass(sub.status)}" style="padding: 1px 6px; font-size: 0.65rem; margin-left: 4px;">${escapeHtml(sub.status)}</span>
                                </li>
                              `).join("")}
                            </ul>
                          ` : ""}
                        </li>
                      `).join("")}
                    </ul>
                  </div>
                ` : `
                  <div class="muted">No tasks entered.</div>
                `}
              </div>
            </article>
          `}
        )
        .join("")
    : `<div class="empty-state">No weekly updates for this project yet.</div>`;

  nodes.projectUpdates.querySelectorAll(".btn-edit-update").forEach((button) => {
    button.addEventListener("click", () => openEditUpdate(button.dataset.updateId));
  });

  renderReport(buildReport(project.id));
}
function buildReport(projectId) {
  const project = projectId ? state.projects.find((item) => item.id === projectId) : null;

  if (!project) {
    latestReportText = "No project selected.";
    return latestReportText;
  }

  const updates = [...state.updates]
    .filter((update) => update.projectId === project.id)
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart));
  const latestUpdate = updates[0];
  const currentProjects = state.projects.filter((item) => item.status === "current").length;
  const closedProjects = state.projects.filter((item) => item.status === "closed").length;

  let reportTasksText = "No tasks.";
  if (latestUpdate && latestUpdate.tasks && latestUpdate.tasks.length) {
    reportTasksText = latestUpdate.tasks.map(task => {
      let line = ` - [${task.status.toUpperCase()}] ${task.title} (Owner: ${task.owner || "Unassigned"})`;
      if (task.subtasks && task.subtasks.length) {
        const subLines = task.subtasks.map(sub => `    - [${sub.status.toUpperCase()}] ${sub.title}`).join("\n");
        line += `\n${subLines}`;
      }
      return line;
    }).join("\n");
  }

  latestReportText = [
    `Project weekly report: ${project.name}`,
    `Status: ${formatStatus(project.status)}`,
    `Project notes: ${project.notes || "No notes yet"}`,
    `Weekly updates: ${updates.length}`,
    `Latest range: ${latestUpdate ? latestUpdate.weekRange : "No weekly entries yet"}`,
    `Latest overall status: ${latestUpdate ? latestUpdate.statusTag : "none"}`,
    `Latest tasks:\n${reportTasksText}`
  ].join("\n");

  return {
    projectName: project.name,
    projectStatus: project.status,
    projectNotes: project.notes || "No notes yet",
    totalProjects: state.projects.length,
    currentProjects,
    closedProjects,
    totalUpdates: updates.length,
    latestRange: latestUpdate ? latestUpdate.weekRange : "No weekly entries yet",
    latestStatus: latestUpdate ? latestUpdate.statusTag : "none",
    latestTasks: latestUpdate ? latestUpdate.tasks : [],
    updates,
  };
}

function renderReport(report) {
  if (typeof report === "string") {
    nodes.projectReportState.textContent = "Waiting";
    nodes.projectReportOutput.innerHTML = `<p class="muted">${escapeHtml(report)}</p>`;
    return;
  }

  nodes.projectReportState.textContent = "Generated";

  const taskList = report.latestTasks || [];

  nodes.projectReportOutput.innerHTML = `
    <div class="report-block">
      <h3>Project summary</h3>
      <div><strong>Project:</strong> ${escapeHtml(report.projectName)}</div>
      <div><strong>Status:</strong> ${escapeHtml(formatStatus(report.projectStatus))}</div>
      <div><strong>Notes:</strong> ${escapeHtml(report.projectNotes)}</div>
      <div><strong>Weekly updates:</strong> ${report.totalUpdates}</div>
    </div>
    <div class="report-block">
      <h3>Latest update</h3>
      <div><strong>Range:</strong> ${escapeHtml(report.latestRange)}</div>
      <div><strong>Overall Status:</strong> ${escapeHtml(report.latestStatus)}</div>
      ${taskList.length ? `
        <div style="margin-top: 6px;">
          <strong>Tasks:</strong>
          <ul style="margin: 4px 0 0; padding-left: 16px; list-style-type: disc;">
            ${taskList.map(task => `
              <li>
                <span>${escapeHtml(task.title)} (${escapeHtml(task.owner || "Unassigned")})</span> — 
                <span class="status-badge ${statusClass(task.status)}" style="padding: 1px 6px; font-size: 0.65rem;">${escapeHtml(task.status)}</span>
                ${task.subtasks && task.subtasks.length ? `
                  <ul style="margin: 2px 0 0; padding-left: 12px; list-style-type: circle;">
                    ${task.subtasks.map(sub => `
                      <li>
                        <span>${escapeHtml(sub.title)}</span> — 
                        <span class="status-badge ${statusClass(sub.status)}" style="padding: 1px 4px; font-size: 0.6rem;">${escapeHtml(sub.status)}</span>
                      </li>
                    `).join("")}
                  </ul>
                ` : ""}
              </li>
            `).join("")}
          </ul>
        </div>
      ` : ""}
    </div>
    <div class="report-block">
      <h3>Project context</h3>
      <div><strong>Total projects:</strong> ${report.totalProjects}</div>
      <div><strong>Current:</strong> ${report.currentProjects}</div>
      <div><strong>Closed:</strong> ${report.closedProjects}</div>
    </div>
  `;
}

function downloadReport() {
  const report = buildReport(uiState.projectId);
  if (typeof report === "string") {
    renderReport(report);
    return;
  }

  const blob = new Blob([latestReportText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "project-weekly-report.txt";
  link.click();
  URL.revokeObjectURL(url);
}

function resetAllData() {
  state = { projects: [], updates: [] };
  latestReportText = "";
  saveState();
  seedDemoData();
  openHome();
  renderAll();
}

function seedDemoData() {
  if (state.projects.length || state.updates.length) {
    return;
  }

  const today = new Date();
  const weekOne = toInputDate(shiftDays(today, -14));
  const weekTwo = toInputDate(shiftDays(today, -7));

  const projectA = {
    id: crypto.randomUUID(),
    name: "Mobile App",
    status: "current",
    notes: "Customer-facing release stream.",
    createdAt: new Date().toISOString(),
  };

  const projectB = {
    id: crypto.randomUUID(),
    name: "Internal Portal",
    status: "closed",
    notes: "Back-office workflow redesign.",
    createdAt: new Date().toISOString(),
  };

  state.projects = [projectA, projectB];
  state.updates = [
    {
      id: crypto.randomUUID(),
      projectId: projectA.id,
      projectName: projectA.name,
      weekStart: weekTwo,
      weekRange: formatWeekRange(weekTwo),
      statusTag: "on track",
      tasks: [
        {
          id: crypto.randomUUID(),
          title: "Finish dashboard shell",
          owner: "Stuti",
          status: "completed",
          subtasks: [
            { id: crypto.randomUUID(), title: "Design sidebar", status: "completed" },
            { id: crypto.randomUUID(), title: "Build responsive layout grid", status: "completed" }
          ]
        },
        {
          id: crypto.randomUUID(),
          title: "Implement weekly form flow",
          owner: "Alex",
          status: "in progress",
          subtasks: [
            { id: crypto.randomUUID(), title: "Draft input validation", status: "completed" },
            { id: crypto.randomUUID(), title: "Add dynamic task list support", status: "not started" }
          ]
        }
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      projectId: projectB.id,
      projectName: projectB.name,
      weekStart: weekOne,
      weekRange: formatWeekRange(weekOne),
      statusTag: "needs attention",
      tasks: [
        {
          id: crypto.randomUUID(),
          title: "Complete workflow changes",
          owner: "Alex",
          status: "completed",
          subtasks: [
            { id: crypto.randomUUID(), title: "Review feedback logs", status: "completed" }
          ]
        },
        {
          id: crypto.randomUUID(),
          title: "Run unit test suite & cleanup",
          owner: "John",
          status: "completed",
          subtasks: []
        }
      ],
      createdAt: new Date().toISOString(),
    },
  ];
  saveState();
}

function openHome() {
  uiState.screen = "home";
  uiState.projectId = null;
  renderScreen();
}

function openCurrentProject() {
  const currentProject = state.projects
    .filter((project) => project.status === "current")
    .sort((left, right) => left.name.localeCompare(right.name))[0];

  if (currentProject) {
    openProject(currentProject.id);
    return;
  }

  openCategory("current");
}

function openClosedProject() {
  const closedProject = state.projects
    .filter((project) => project.status === "closed")
    .sort((left, right) => left.name.localeCompare(right.name))[0];

  if (closedProject) {
    openProject(closedProject.id);
    return;
  }

  openCategory("closed");
}

function openCategory(category) {
  uiState.screen = "category";
  uiState.category = category;
  uiState.projectId = null;
  renderAll();
  nodes.categoryScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openProject(projectId) {
  uiState.screen = "project";
  uiState.projectId = projectId;
  renderAll();
  nodes.projectScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderScreen() {
  nodes.homeScreen.hidden = uiState.screen !== "home";
  nodes.categoryScreen.hidden = uiState.screen !== "category";
  nodes.projectScreen.hidden = uiState.screen !== "project";
  nodes.addProjectScreen.hidden = uiState.screen !== "add-project";
  nodes.addUpdateScreen.hidden = uiState.screen !== "add-update";
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        updates: Array.isArray(parsed.updates) ? parsed.updates : [],
      };
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      return {
        projects: Array.isArray(legacyParsed.projects) ? legacyParsed.projects : [],
        updates: Array.isArray(legacyParsed.updates) ? legacyParsed.updates : [],
      };
    }

    const migratedState = loadAnyUserState();
    if (migratedState) {
      return migratedState;
    }
  } catch {
  }
  return { projects: [], updates: [] };
}

function showDashboard() {
  nodes.shell.hidden = false;
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function loadAnyUserState() {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(USER_DATA_PREFIX)) {
        continue;
      }

      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);
      return {
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        updates: Array.isArray(parsed.updates) ? parsed.updates : [],
      };
    }
  } catch {
  }

  return null;
}

function getLatestUpdateForProject(projectId) {
  return [...state.updates]
    .filter((update) => update.projectId === projectId)
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart))[0];
}

function formatWeekRange(startValue) {
  const start = new Date(`${startValue}T00:00:00`);
  const end = shiftDays(start, 6);
  return `${formatOrdinalDate(start)} to ${formatOrdinalDate(end)}`;
}

function formatOrdinalDate(date) {
  const day = date.getDate();
  const suffix = getOrdinalSuffix(day);
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${day}${suffix} ${month}`;
}

function getOrdinalSuffix(day) {
  if (day >= 11 && day <= 13) {
    return "th";
  }

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function shiftDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusClass(value) {
  const normalized = String(value).toLowerCase().replaceAll(" ", "-");
  if (normalized === "blocked") {
    return "status-blocked";
  }

  if (normalized === "needs-attention") {
    return "status-needs-attention";
  }

  if (normalized === "closed") {
    return "status-closed";
  }

  return "status-on-track";
}

function formatStatus(value) {
  return String(value)
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (window.location.protocol === "file:") {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// Form Action Helpers for manual entries
let taskCounter = 0;
let subtaskCounter = 0;

function openAddProject() {
  uiState.screen = "add-project";
  uiState.projectId = null;
  nodes.addProjectForm.reset();
  renderAll();
  nodes.addProjectScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function goBackFromAddProject() {
  if (uiState.category) {
    openCategory(uiState.category);
  } else {
    openHome();
  }
}

function saveProject(event) {
  event.preventDefault();
  const name = nodes.newProjectName.value.trim();
  const status = nodes.newProjectStatus.value;
  const notes = nodes.newProjectNotes.value.trim();

  if (!name) return;

  const newProject = {
    id: crypto.randomUUID(),
    name,
    status,
    notes,
    createdAt: new Date().toISOString()
  };

  state.projects.push(newProject);
  saveState();

  nodes.addProjectForm.reset();
  openProject(newProject.id);
}

function openAddUpdate() {
  const project = state.projects.find((p) => p.id === uiState.projectId);
  if (!project) return;

  uiState.screen = "add-update";
  uiState.editingUpdateId = null;
  nodes.addUpdateForm.reset();
  nodes.formTasksList.innerHTML = "";
  nodes.addUpdateProjectTitle.textContent = `Add Weekly Update for ${project.name}`;

  // Change submit button text back to Save Update
  const submitBtn = nodes.addUpdateForm.querySelector("button[type='submit']");
  if (submitBtn) {
    submitBtn.textContent = "Save Update";
  }

  // Default weekStart to current Monday
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  nodes.newUpdateWeekStart.value = toInputDate(monday);

  // Pre-populate with one empty task for convenience
  addNewTaskToForm();

  renderAll();
  nodes.addUpdateScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openEditUpdate(updateId) {
  const update = state.updates.find((u) => u.id === updateId);
  if (!update) return;

  const project = state.projects.find((p) => p.id === update.projectId);
  if (!project) return;

  uiState.screen = "add-update";
  uiState.editingUpdateId = updateId;

  nodes.addUpdateForm.reset();
  nodes.formTasksList.innerHTML = "";
  nodes.addUpdateProjectTitle.textContent = `Edit Weekly Update for ${project.name}`;

  // Pre-fill input fields
  nodes.newUpdateWeekStart.value = update.weekStart;
  nodes.newUpdateStatus.value = update.statusTag;

  // Pre-fill tasks
  if (update.tasks && update.tasks.length) {
    update.tasks.forEach((task) => {
      addNewTaskToForm();
      const taskCard = nodes.formTasksList.lastElementChild;
      taskCard.querySelector(".form-task-title").value = task.title;
      taskCard.querySelector(".form-task-owner").value = task.owner;
      taskCard.querySelector(".form-task-status").value = task.status;

      const subtasksList = taskCard.querySelector(".form-subtasks-list");
      if (task.subtasks && task.subtasks.length) {
        task.subtasks.forEach((sub) => {
          addNewSubTaskToForm(subtasksList);
          const subtaskRow = subtasksList.lastElementChild;
          subtaskRow.querySelector(".form-subtask-title").value = sub.title;
          subtaskRow.querySelector(".form-subtask-status").value = sub.status;
        });
      }
    });
  }

  // Change submit button text
  const submitBtn = nodes.addUpdateForm.querySelector("button[type='submit']");
  if (submitBtn) {
    submitBtn.textContent = "Update Status";
  }

  renderAll();
  nodes.addUpdateScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addNewTaskToForm() {
  taskCounter += 1;
  const taskId = `task_${taskCounter}_${Date.now()}`;

  const taskCard = document.createElement("div");
  taskCard.className = "form-task-card";
  taskCard.id = taskId;
  taskCard.innerHTML = `
    <div class="form-task-header">
      <h4 style="margin: 0; font-size: 0.95rem; color: var(--accent-2);">Task Details</h4>
      <button type="button" class="delete-button" id="btn_delete_${taskId}">Remove Task</button>
    </div>
    <div style="display: grid; gap: 8px;">
      <label style="font-size: 0.85rem; display: block; color: #cbd5e1; font-weight: normal; margin-bottom: 2px;">Task Title *</label>
      <input type="text" placeholder="e.g. Implement user login" class="form-task-title" required />
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <div>
        <label style="font-size: 0.85rem; display: block; color: #cbd5e1; font-weight: normal; margin-bottom: 2px;">Ownership *</label>
        <input type="text" placeholder="e.g. Alice" class="form-task-owner" required />
      </div>
      <div>
        <label style="font-size: 0.85rem; display: block; color: #cbd5e1; font-weight: normal; margin-bottom: 2px;">Status *</label>
        <select class="form-task-status" required>
          <option value="not started">Not Started</option>
          <option value="in progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
    </div>
    <div style="margin-top: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h5 style="margin: 0; font-size: 0.85rem; color: var(--muted);">Sub-tasks</h5>
        <button type="button" class="secondary-button btn-add-subtask" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 6px;">+ Add Sub-task</button>
      </div>
      <div class="form-subtasks-list">
        <!-- Sub-tasks will go here -->
      </div>
    </div>
  `;

  // Attach dynamic event handlers using JS to prevent script injection context issues
  taskCard.querySelector(`#btn_delete_${taskId}`).addEventListener("click", () => {
    taskCard.remove();
  });

  const btnAddSubtask = taskCard.querySelector(".btn-add-subtask");
  const subtasksList = taskCard.querySelector(".form-subtasks-list");
  btnAddSubtask.addEventListener("click", () => {
    addNewSubTaskToForm(subtasksList);
  });

  nodes.formTasksList.appendChild(taskCard);
}

function addNewSubTaskToForm(container) {
  subtaskCounter += 1;
  const subtaskId = `subtask_${subtaskCounter}_${Date.now()}`;

  const subtaskRow = document.createElement("div");
  subtaskRow.className = "form-subtask-row";
  subtaskRow.id = subtaskId;
  subtaskRow.innerHTML = `
    <input type="text" placeholder="Sub-task title..." class="form-subtask-title" required />
    <select class="form-subtask-status" required>
      <option value="not started">Not Started</option>
      <option value="in progress">In Progress</option>
      <option value="completed">Completed</option>
    </select>
    <button type="button" class="delete-button btn-delete-subtask" id="btn_delete_${subtaskId}" style="padding: 6px 10px; font-size: 0.85rem;">✕</button>
  `;

  subtaskRow.querySelector(`#btn_delete_${subtaskId}`).addEventListener("click", () => {
    subtaskRow.remove();
  });

  container.appendChild(subtaskRow);
}

function saveWeeklyUpdate(event) {
  event.preventDefault();

  const weekStart = nodes.newUpdateWeekStart.value;
  const statusTag = nodes.newUpdateStatus.value;

  if (!weekStart) return;

  const project = state.projects.find((p) => p.id === uiState.projectId);
  if (!project) return;

  const tasks = [];
  const taskCards = nodes.formTasksList.querySelectorAll(".form-task-card");
  taskCards.forEach((card) => {
    const title = card.querySelector(".form-task-title").value.trim();
    const owner = card.querySelector(".form-task-owner").value.trim();
    const status = card.querySelector(".form-task-status").value;

    const subtasks = [];
    const subtaskRows = card.querySelectorAll(".form-subtask-row");
    subtaskRows.forEach((row) => {
      const subTitle = row.querySelector(".form-subtask-title").value.trim();
      const subStatus = row.querySelector(".form-subtask-status").value;
      if (subTitle) {
        subtasks.push({
          id: crypto.randomUUID(),
          title: subTitle,
          status: subStatus,
        });
      }
    });

    if (title) {
      tasks.push({
        id: crypto.randomUUID(),
        title,
        owner,
        status,
        subtasks,
      });
    }
  });

  if (uiState.editingUpdateId) {
    const index = state.updates.findIndex((u) => u.id === uiState.editingUpdateId);
    if (index !== -1) {
      state.updates[index] = {
        ...state.updates[index],
        weekStart,
        weekRange: formatWeekRange(weekStart),
        statusTag,
        tasks,
      };
    }
    uiState.editingUpdateId = null;
  } else {
    const newUpdate = {
      id: crypto.randomUUID(),
      projectId: project.id,
      projectName: project.name,
      weekStart,
      weekRange: formatWeekRange(weekStart),
      statusTag,
      tasks,
      createdAt: new Date().toISOString(),
    };
    state.updates.push(newUpdate);
  }

  saveState();

  nodes.addUpdateForm.reset();
  nodes.formTasksList.innerHTML = "";

  openProject(project.id);
}

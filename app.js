const LEGACY_STORAGE_KEY = "multi-project-weekly-dashboard";
const USER_DATA_PREFIX = "multi-project-dashboard-state:";
const STATE_KEY = "multi-project-dashboard-state";
const SUBTASK_STATUSES = ["not started", "in progress", "delayed", "blocked", "completed"];

// Predefined onboarding checklist. Users pick tasks from here instead of typing
// each one by hand — title + team (owner) get pre-filled, they only add the
// date / status / details. Edit this list to change the standard playbook.
const TASK_TEMPLATES = [
  {
    phase: "Pre Kickoff",
    tasks: [
      { title: "Sales <> Post-Sales handoff call", team: "OBM" },
      { title: "Sales Handoff Intake Form", team: "OBM" },
      { title: "Introduction to Client", team: "OBM" },
      { title: "Setup Pre-KO / Lead Call", team: "OBM" },
      { title: "Allocation of Internal Team - Add to Slack & Asana", team: "OPS" },
      { title: "Welcome Email", team: "OBM" },
      { title: "Schedule Kick-Off Meeting", team: "OBM" },
    ],
  },
  {
    phase: "Kickoff and Scope Definition",
    tasks: [
      { title: "Kick-off Meeting", team: "OBM" },
      { title: "Kick Off Intake Form", team: "OBM" },
      { title: "Update Asana Project Plan & Project fields", team: "OBM" },
      { title: "Discovery", team: "OBM" },
      { title: "Data Modelling", team: "TSS" },
      { title: "Data Model validation & Sign-Off from DS Team", team: "TSS" },
      { title: "Data Model sign off for implementing use cases - by GC", team: "GC" },
      { title: "Schema", team: "TSS" },
      { title: "Defined Use-Cases for Creation", team: "GC" },
      { title: "Scope of Work", team: "TSS" },
      { title: "Submit Weekly Report", team: "OBM" },
    ],
  },
  {
    phase: "Staging Deployment",
    tasks: [
      { title: "Create Staging Dashboard", team: "OBM" },
      { title: "SDK Set Up", team: "Client" },
      { title: "App Push / In-App Setup", team: "Client" },
      { title: "Hashing", team: "OBM" },
      { title: "User and Event Tracking", team: "Client" },
      { title: "RCS Setup", team: "OBM" },
      { title: "Web Push / Onsite Setup", team: "Client" },
      { title: "Google / Facebook Retargeting Setup", team: "Client" },
      { title: "IVR Setup", team: "OBM" },
      { title: "Staging Audit", team: "TSS" },
      { title: "Inform Client + PM on Staging Deployment Completion", team: "TSS" },
      { title: "Completion of Staging Deployment", team: "OBM" },
      { title: "Send Weekly Report", team: "OBM" },
    ],
  },
  {
    phase: "Production Deployment",
    tasks: [
      { title: "Create Production Dashboard", team: "OBM" },
      { title: "SDK Setup on Production", team: "Client" },
      { title: "SSO Setup", team: "OBM" },
      { title: "Hashing", team: "OBM" },
      { title: "User & Event Tracking Prod", team: "Client" },
      { title: "Web Push / Onsite Setup", team: "Client" },
      { title: "App Push / In-App Setup", team: "Client" },
      { title: "Google / Facebook Retargeting Setup", team: "Client" },
      { title: "IVR Setup", team: "OBM" },
      { title: "Set Alerts & Reports", team: "OBM" },
      { title: "Production Audit", team: "TSS" },
    ],
  },
  {
    phase: "Training and Use-Cases",
    tasks: [
      { title: "Call to Discuss Training Plan & Use Cases Flow", team: "GC" },
      { title: "Training Session 1", team: "OBM" },
      { title: "Training Session 2", team: "OBM" },
      { title: "Send Dashboard Pre-Recorded List", team: "OBM" },
      { title: "Use Case 1 Setup", team: "OBM" },
      { title: "Use Case 2 Setup", team: "OBM" },
    ],
  },
  {
    phase: "Go-Live",
    tasks: [
      { title: "Final Checks", team: "OBM" },
      { title: "Account Closure", team: "OBM" },
      { title: "Mark Project Completed", team: "OBM" },
      { title: "Offline Data Uploaded", team: "TSS" },
      { title: "Update checklist for S3 / SFTP", team: "TSS" },
      { title: "2 or More Recurring Campaigns / Journeys Live", team: "OBM" },
      { title: "Key Events + Attributes Integrated", team: "OBM" },
      { title: "Get Confirmation from Client on Billing Start", team: "OBM" },
      { title: "Inform Billing & Cross-Functional Teams on Order Creation Thread", team: "OBM" },
      { title: "Integration Invoice Clearance", team: "OBM" },
    ],
  },
];
/* Week-wise master plan, derived from the "Weekly status - Salad Days" workbook: each week
   sheet there pairs a completed table with a "This Week" table, both grouped by an
   "Integration Scope" column. That scope maps onto a task's `phase` field here.
   This is only the SEED — the editable copy lives in state.weekTemplates (Templates screen). */
const ROLES = ["admin", "viewer"];

const ROLE_LABELS = {
  admin: "Admin",
  viewer: "Viewer",
};

const ROLE_DESCRIPTIONS = {
  admin: "Full access — projects, reports, templates, teams, data and user roles.",
  viewer: "Read-only. Can browse projects and generate or export reports, but change nothing.",
};

/* Two roles: Admin does everything, Viewer changes nothing. Every mutating capability is
   admin-only. Viewing, generating and exporting reports need no permission and so are not
   listed here. */
const PERMISSIONS = {
  "project.create": ["admin"],
  "project.delete": ["admin"],
  "project.edit": ["admin"],
  "report.create": ["admin"],
  "report.edit": ["admin"],
  "report.delete": ["admin"],
  "template.edit": ["admin"],
  "team.manage": ["admin"],
  "data.manage": ["admin"],
  "users.manage": ["admin"],
};

/* Loaded from roles-config.json at boot; these are the fallbacks if the file is missing. */
let rolesConfig = {
  allowedDomain: "webengage.com",
  requireLogin: true,
  passwordPolicy: { minLength: 10, requireUppercase: true, requireLowercase: true, requireNumber: true, requireSymbol: true },
  users: [],
};
let currentSession = null;

/* Read by debugLog() from anywhere, so it must be module-level, not inside boot(). */
const DEBUG_LOG = [];

const TEMPLATE_PRIORITIES = ["high", "medium", "low"];
const DEFAULT_CYCLE_WEEKS = 5;
const DEFAULT_TASK_DAYS = 7;
const BASE_CYCLE_WEEKS = 6;

/* Overwritten from week-templates.json when it loads. */
let templateMeta = { baseCycleWeeks: BASE_CYCLE_WEEKS, defaultTaskDays: DEFAULT_TASK_DAYS };
const MIN_CYCLE_WEEKS = 2;
const MAX_CYCLE_WEEKS = 12;

const WEEK_TEMPLATE_SEED = [
  {
    week: 1,
    label: "Kickoff & Discovery",
    tasks: [
      { scope: "Kickoff call", title: "Onboarding mail thread initiated", owner: "", priority: "medium", platforms: [] },
      { scope: "Kickoff call", title: "Channel form", owner: "", priority: "medium", platforms: [] },
      { scope: "Kickoff call", title: "Tech doc", owner: "", priority: "medium", platforms: [] },
      { scope: "Kickoff call", title: "Scope of Work", owner: "", priority: "medium", platforms: [] },
      { scope: "Tech Team connect", title: "Tech team connect - Website", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Tech Team connect", title: "Tech team connect - Android", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Tech Team connect", title: "Tech team connect - iOS", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "Tech Team connect", title: "Tech team connect - Web App", owner: "", priority: "high", platforms: ["Web App"] },
      { scope: "Tech Team connect", title: "Tech team connect - REST API", owner: "", priority: "high", platforms: ["REST API"] },
      { scope: "User Id", title: "Finalise the unique user identifier", owner: "", priority: "high", platforms: [] },
      { scope: "Data Model", title: "Data model - Website", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Data Model", title: "Data model - Android", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Data Model", title: "Data model - iOS", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "Data Model", title: "Data model - Web App", owner: "", priority: "high", platforms: ["Web App"] },
      { scope: "Data Model", title: "Data model - REST API", owner: "", priority: "high", platforms: ["REST API"] },
    ],
  },
  {
    week: 2,
    label: "Staging Setup",
    tasks: [
      { scope: "Data Model", title: "Data model finalisation & sign-off", owner: "", priority: "high", platforms: [] },
      { scope: "Staging", title: "SDK setup - Website", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Staging", title: "SDK setup - Android", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Staging", title: "SDK setup - iOS", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "Staging", title: "SDK setup - Web App", owner: "", priority: "high", platforms: ["Web App"] },
      { scope: "Staging", title: "User tracking setup - Website", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Staging", title: "User tracking setup - Android", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Staging", title: "User tracking setup - iOS", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "Staging", title: "User tracking setup - Web App", owner: "", priority: "high", platforms: ["Web App"] },
      { scope: "Historic Data", title: "Preparation of CSV containing historical user and transactional data", owner: "", priority: "high", platforms: [] },
      { scope: "Website", title: "User Identification", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Website", title: "User Attributes", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Website", title: "Custom Events", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Website", title: "Event Attributes", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Website", title: "Login / Logout", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Website", title: "Signup", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Android", title: "SDK Initialization", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "User Identification", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "User Attributes", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "Custom Events", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "Event Attributes", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "Login / Logout", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "Signup", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "iOS", title: "SDK Initialization", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "User Identification", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "User Attributes", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "Custom Events", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "Event Attributes", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "Login / Logout", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "Signup", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "REST API", title: "API authentication", owner: "", priority: "high", platforms: ["REST API"] },
      { scope: "REST API", title: "API key configuration", owner: "", priority: "high", platforms: ["REST API"] },
      { scope: "REST API", title: "User creation / update", owner: "", priority: "high", platforms: ["REST API"] },
      { scope: "REST API", title: "User attribute updates", owner: "", priority: "high", platforms: ["REST API"] },
      { scope: "REST API", title: "User identification", owner: "", priority: "high", platforms: ["REST API"] },
    ],
  },
  {
    week: 3,
    label: "Event Tracking & Channels",
    tasks: [
      { scope: "Staging", title: "Event tracking setup - Website", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Staging", title: "Event tracking setup - Android", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Staging", title: "Event tracking setup - iOS", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "Staging", title: "Event tracking setup - Web App", owner: "", priority: "high", platforms: ["Web App"] },
      { scope: "App Implementation", title: "Screen tracking - Android", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "App Implementation", title: "Screen tracking - iOS", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "Channels - Staging", title: "Email channel setup", owner: "", priority: "medium", platforms: [] },
      { scope: "Channels - Staging", title: "SMS channel setup", owner: "", priority: "high", platforms: [] },
      { scope: "Channels - Staging", title: "WhatsApp channel setup", owner: "", priority: "high", platforms: [] },
      { scope: "Channels - Staging", title: "Web Push setup", owner: "", priority: "medium", platforms: ["Website", "Web App"] },
      { scope: "Channels - Staging", title: "On-site Notification setup", owner: "", priority: "medium", platforms: ["Website", "Web App"] },
      { scope: "Channels - Staging", title: "Push setup - FCM", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Channels - Staging", title: "Push setup - APNS certificate", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "Channels - Staging", title: "In-App setup", owner: "", priority: "high", platforms: ["Android", "iOS"] },
      { scope: "Channels - Staging", title: "Rich Push setup", owner: "", priority: "medium", platforms: ["iOS"] },
      { scope: "REST API", title: "Custom event API", owner: "", priority: "high", platforms: ["REST API"] },
      { scope: "REST API", title: "Backend event tracking", owner: "", priority: "high", platforms: ["REST API"] },
      { scope: "REST API", title: "Historical user data migration", owner: "", priority: "high", platforms: ["REST API"] },
      { scope: "REST API", title: "Historical event migration", owner: "", priority: "high", platforms: ["REST API"] },
      { scope: "Android", title: "Push Token Registration", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "Firebase / FCM Setup", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "Push Notification Setup", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "Rich Push", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "In-App Setup", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "In-App Testing", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Android", title: "App Inline", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "iOS", title: "Push Token Registration", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "APNs Setup", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "Push Notification Setup", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "Rich Push", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "In-App Setup", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "In-App Testing", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "iOS", title: "App Inline", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "Channels - Email", title: "Email Provider Setup", owner: "", priority: "medium", platforms: [] },
      { scope: "Channels - SMS", title: "SMS Provider Setup", owner: "", priority: "high", platforms: [] },
      { scope: "Channels - WhatsApp", title: "WhatsApp Business Setup", owner: "", priority: "high", platforms: [] },
      { scope: "Channels - Push", title: "Push Token", owner: "", priority: "high", platforms: [] },
      { scope: "Channels - Push", title: "Notification Permission", owner: "", priority: "high", platforms: [] },
      { scope: "Channels - Push", title: "Push Templates", owner: "", priority: "medium", platforms: [] },
      { scope: "Channels - Push", title: "Rich Push", owner: "", priority: "medium", platforms: [] },
      { scope: "Channels - Push", title: "Deep Links", owner: "", priority: "medium", platforms: [] },
      { scope: "Channels - Push", title: "CTA", owner: "", priority: "medium", platforms: [] },
      { scope: "Channels - Push", title: "Test Push", owner: "", priority: "medium", platforms: [] },
      { scope: "Channels - Push", title: "Delivery Validation", owner: "", priority: "high", platforms: [] },
      { scope: "Channels - Web Push", title: "Web Push Configuration", owner: "", priority: "medium", platforms: [] },
      { scope: "Channels - RCS", title: "RCS Provider Setup", owner: "", priority: "medium", platforms: [] },
      { scope: "Channels - In-App", title: "SDK Configuration", owner: "", priority: "high", platforms: [] },
      { scope: "Channels - On-site", title: "On-site Notification", owner: "", priority: "medium", platforms: [] },
      { scope: "Channels - On-site", title: "On-site Survey", owner: "", priority: "medium", platforms: [] },
      { scope: "Channels - On-site", title: "On-site Feedback", owner: "", priority: "medium", platforms: [] },
    ],
  },
  {
    week: 4,
    label: "Audit & Templates",
    tasks: [
      { scope: "Staging Audit", title: "Website audit", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Staging Audit", title: "Android app audit", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Staging Audit", title: "iOS app audit", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "Staging Audit", title: "Web App audit", owner: "", priority: "high", platforms: ["Web App"] },
      { scope: "Staging Audit", title: "Changes shared with dev team and actioned", owner: "", priority: "high", platforms: [] },
      { scope: "Email Warmup", title: "Warmup content ready", owner: "", priority: "high", platforms: [] },
      { scope: "SMS template", title: "Share template for provider testing", owner: "", priority: "high", platforms: [] },
      { scope: "WhatsApp Template", title: "Add template on the dashboard for testing", owner: "", priority: "high", platforms: [] },
      { scope: "Historic Data", title: "Historical transactional data uploaded", owner: "", priority: "high", platforms: [] },
      { scope: "Website", title: "Website Testing & QA", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Android", title: "Android Testing & QA", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "iOS", title: "iOS Testing & QA", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "REST API", title: "REST API testing", owner: "", priority: "high", platforms: ["REST API"] },
    ],
  },
  {
    week: 5,
    label: "Production Movement",
    tasks: [
      { scope: "Production", title: "Move integration to production - Website", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Production", title: "Move integration to production - Android", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Production", title: "Move integration to production - iOS", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "Production", title: "Move integration to production - Web App", owner: "", priority: "high", platforms: ["Web App"] },
      { scope: "Production", title: "Play Store release with SDK", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "Production", title: "App Store release with SDK", owner: "", priority: "high", platforms: ["iOS"] },
      { scope: "Production", title: "Production testing", owner: "", priority: "high", platforms: [] },
      { scope: "Channels - Production", title: "Channels enabled on production", owner: "", priority: "high", platforms: [] },
      { scope: "Email Warmup", title: "Warmup journey live", owner: "", priority: "high", platforms: [] },
      { scope: "Production", title: "Production API testing", owner: "", priority: "high", platforms: ["REST API"] },
      { scope: "Website", title: "Production Validation", owner: "", priority: "high", platforms: ["Website"] },
      { scope: "Android", title: "Production Validation", owner: "", priority: "high", platforms: ["Android"] },
      { scope: "iOS", title: "Production Validation", owner: "", priority: "high", platforms: ["iOS"] },
    ],
  },
  {
    week: 6,
    label: "Go-Live",
    tasks: [
      { scope: "Go-Live", title: "Demo dashboard walkthrough with client", owner: "", priority: "medium", platforms: [] },
      { scope: "Go-Live", title: "2 or more recurring campaigns / journeys live", owner: "", priority: "high", platforms: [] },
      { scope: "Go-Live", title: "Key events and attributes verified on production", owner: "", priority: "high", platforms: [] },
      { scope: "Go-Live", title: "Confirmation from client on billing start", owner: "", priority: "high", platforms: [] },
      { scope: "Go-Live", title: "Handover to CSM", owner: "", priority: "medium", platforms: [] },
    ],
  },
];
const STATUS_FILL = {
  "not started": "var(--status-fill-not-started)",
  "in progress": "var(--status-fill-in-progress)",
  "delayed": "var(--status-fill-delayed)",
  "blocked": "var(--status-fill-blocked)",
  "completed": "var(--status-fill-completed)",
};

const nodes = {
  headerDisplayName: document.getElementById("headerDisplayName"),
  headerRole: document.getElementById("headerRole"),
  headerAvatar: document.getElementById("headerAvatar"),
  themeToggle: document.getElementById("themeToggle"),
  searchInput: document.getElementById("searchInput"),
  searchDropdown: document.getElementById("searchDropdown"),
  searchResults: document.getElementById("searchResults"),
  notifBell: document.getElementById("notifBell"),
  notifBadge: document.getElementById("notifBadge"),
  notifDropdown: document.getElementById("notifDropdown"),
  notifDropdownList: document.getElementById("notifDropdownList"),
  userWidget: document.getElementById("userWidget"),
  userDropdown: document.getElementById("userDropdown"),
  userDropdownSettingsLink: document.getElementById("userDropdownSettingsLink"),
  userDropdownSignOut: document.getElementById("userDropdownSignOut"),

  sidebarAddProject: document.getElementById("sidebarAddProject"),

  dashboardScreen: document.getElementById("dashboardScreen"),
  categoryScreen: document.getElementById("categoryScreen"),
  projectScreen: document.getElementById("projectScreen"),
  addProjectScreen: document.getElementById("addProjectScreen"),
  createReportScreen: document.getElementById("createReportScreen"),
  calendarScreen: document.getElementById("calendarScreen"),
  teamScreen: document.getElementById("teamScreen"),
  settingsScreen: document.getElementById("settingsScreen"),

  dashProjectCount: document.getElementById("dashProjectCount"),
  dashCurrentCount: document.getElementById("dashCurrentCount"),
  dashClosedCount: document.getElementById("dashClosedCount"),
  dashUpdateCount: document.getElementById("dashUpdateCount"),
  dashAlertCount: document.getElementById("dashAlertCount"),
  dashRecentList: document.getElementById("dashRecentList"),

  homeAddProject: document.getElementById("homeAddProject"),
  openCurrent: document.getElementById("openCurrent"),
  openClosed: document.getElementById("openClosed"),
  currentProjectCount: document.getElementById("currentProjectCount"),
  closedProjectCount: document.getElementById("closedProjectCount"),
  backToHome: document.getElementById("backToHome"),
  backToCategory: document.getElementById("backToCategory"),
  categoryTitle: document.getElementById("categoryTitle"),
  categoryBadge: document.getElementById("categoryBadge"),
  categoryList: document.getElementById("categoryList"),
  projectTitle: document.getElementById("projectTitle"),
  projectStatusBadge: document.getElementById("projectStatusBadge"),
  deleteProjectBtn: document.getElementById("deleteProjectBtn"),
  projKickoff: document.getElementById("projKickoff"),
  projGoLive: document.getElementById("projGoLive"),
  projDetailsForm: document.getElementById("projDetailsForm"),
  projEditToggle: document.getElementById("projEditToggle"),
  projCancelEdit: document.getElementById("projCancelEdit"),
  projName: document.getElementById("projName"),
  projCsm: document.getElementById("projCsm"),
  projOwner: document.getElementById("projOwner"),
  projSalesOwner: document.getElementById("projSalesOwner"),
  projCycleWeeks: document.getElementById("projCycleWeeks"),
  projTechTeam: document.getElementById("projTechTeam"),
  projVendorField: document.getElementById("projVendorField"),
  projVendorName: document.getElementById("projVendorName"),
  projNotes: document.getElementById("projNotes"),
  projTimelineNote: document.getElementById("projTimelineNote"),
  npCycleHint: document.getElementById("npCycleHint"),
  npGoLiveHint: document.getElementById("npGoLiveHint"),
  projectOverview: document.getElementById("projectOverview"),
  projectSummary: document.getElementById("projectSummary"),
  projectUpdates: document.getElementById("projectUpdates"),
  projectReportOutput: document.getElementById("projectReportOutput"),
  projectReportState: document.getElementById("projectReportState"),
  generateReport: document.getElementById("generateReport"),
  downloadReport: document.getElementById("downloadReport"),
  addWeeklyUpdate: document.getElementById("addWeeklyUpdate"),
  addWeekFromTemplate: document.getElementById("addWeekFromTemplate"),

  addProjectForm: document.getElementById("addProjectForm"),
  wizardSteps: document.getElementById("wizardSteps"),
  npNav: document.getElementById("npNav"),
  npBack: document.getElementById("npBack"),
  npNext: document.getElementById("npNext"),
  npProgress: document.getElementById("npProgress"),
  npSaveDraft: document.getElementById("npSaveDraft"),
  appError: document.getElementById("appError"),
  authOverlay: document.getElementById("authOverlay"),
  authTitle: document.getElementById("authTitle"),
  authIntro: document.getElementById("authIntro"),
  authError: document.getElementById("authError"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authHint: document.getElementById("authHint"),
  authForm: document.getElementById("authForm"),
  authLocalNote: document.getElementById("authLocalNote"),

  debugPanel: document.getElementById("debugPanel"),
  debugBody: document.getElementById("debugBody"),
  debugCopy: document.getElementById("debugCopy"),
  debugClose: document.getElementById("debugClose"),
  npError: document.getElementById("npError"),
  npSummaryPanel: document.getElementById("npSummaryPanel"),
  npSummary: document.getElementById("npSummary"),
  npReviewBody: document.getElementById("npReviewBody"),
  npConfirmTitle: document.getElementById("npConfirmTitle"),
  npConfirmText: document.getElementById("npConfirmText"),
  npGoToProject: document.getElementById("npGoToProject"),
  npCreateAnother: document.getElementById("npCreateAnother"),
  npPlatforms: document.getElementById("npPlatforms"),
  npVendorNameField: document.getElementById("npVendorNameField"),
  npPocList: document.getElementById("npPocList"),
  npAddPoc: document.getElementById("npAddPoc"),
  cancelAddProject: document.getElementById("cancelAddProject"),
  btnCancelAddProject: document.getElementById("btnCancelAddProject"),

  createReportForm: document.getElementById("createReportForm"),
  reportsIndexProject: document.getElementById("reportsIndexProject"),
  reportsIndexList: document.getElementById("reportsIndexList"),
  reportsNewBtn: document.getElementById("reportsNewBtn"),
  createReportTitle: document.getElementById("createReportTitle"),
  createReportProjectSelect: document.getElementById("createReportProjectSelect"),
  lastWeekDate: document.getElementById("lastWeekDate"),
  lastWeekStatus: document.getElementById("lastWeekStatus"),
  lastWeekStats: document.getElementById("lastWeekStats"),
  lastWeekTasksList: document.getElementById("lastWeekTasksList"),
  btnAddLastWeekTask: document.getElementById("btnAddLastWeekTask"),
  thisWeekDate: document.getElementById("thisWeekDate"),
  thisWeekStatus: document.getElementById("thisWeekStatus"),
  thisWeekStats: document.getElementById("thisWeekStats"),
  thisWeekTasksList: document.getElementById("thisWeekTasksList"),
  btnAddThisWeekTask: document.getElementById("btnAddThisWeekTask"),
  btnChecklistLastWeek: document.getElementById("btnChecklistLastWeek"),
  btnChecklistThisWeek: document.getElementById("btnChecklistThisWeek"),
  templatePickerOverlay: document.getElementById("templatePickerOverlay"),
  templatePickerBody: document.getElementById("templatePickerBody"),
  templatePickerClose: document.getElementById("templatePickerClose"),
  templatePickerCancel: document.getElementById("templatePickerCancel"),
  templatePickerAdd: document.getElementById("templatePickerAdd"),
  templateSearch: document.getElementById("templateSearch"),
  templateSelectedCount: document.getElementById("templateSelectedCount"),
  cancelCreateReport: document.getElementById("cancelCreateReport"),
  btnCancelCreateReport: document.getElementById("btnCancelCreateReport"),

  calendarGrid: document.getElementById("calendarGrid"),
  calendarMonthLabel: document.getElementById("calendarMonthLabel"),
  calendarSelectedList: document.getElementById("calendarSelectedList"),
  calendarPrev: document.getElementById("calendarPrev"),
  calendarNext: document.getElementById("calendarNext"),

  teamList: document.getElementById("teamList"),
  teamProjectSelect: document.getElementById("teamProjectSelect"),
  teamMemberList: document.getElementById("teamMemberList"),
  teamAddMember: document.getElementById("teamAddMember"),

  templatesScreen: document.getElementById("templatesScreen"),
  templatesList: document.getElementById("templatesList"),
  templatesAddWeek: document.getElementById("templatesAddWeek"),
  templatesReloadFile: document.getElementById("templatesReloadFile"),
  templatesReset: document.getElementById("templatesReset"),

  settingsForm: document.getElementById("settingsForm"),
  settingsDisplayName: document.getElementById("settingsDisplayName"),
  settingsRole: document.getElementById("settingsRole"),
  settingsSavedNote: document.getElementById("settingsSavedNote"),
  settingsOrigin: document.getElementById("settingsOrigin"),
  settingsExport: document.getElementById("settingsExport"),
  settingsImport: document.getElementById("settingsImport"),
  settingsImportFile: document.getElementById("settingsImportFile"),
  settingsClear: document.getElementById("settingsClear"),
  settingsDemoSelect: document.getElementById("settingsDemoSelect"),
  settingsDemoLoad: document.getElementById("settingsDemoLoad"),
  settingsDemoNote: document.getElementById("settingsDemoNote"),
  settingsDataStats: document.getElementById("settingsDataStats"),
  syncPreview: document.getElementById("syncPreview"),
  syncApply: document.getElementById("syncApply"),
  syncResult: document.getElementById("syncResult"),
  syncList: document.getElementById("syncList"),
  syncNote: document.getElementById("syncNote"),
  settingsAccount: document.getElementById("settingsAccount"),
  settingsRoles: document.getElementById("settingsRoles"),
  settingsPasswordBlock: document.getElementById("settingsPasswordBlock"),
  passwordForm: document.getElementById("passwordForm"),
  pwCurrent: document.getElementById("pwCurrent"),
  pwNew: document.getElementById("pwNew"),
  pwConfirm: document.getElementById("pwConfirm"),
  pwError: document.getElementById("pwError"),
  pwResult: document.getElementById("pwResult"),
  pwResultEmail: document.getElementById("pwResultEmail"),
  pwHash: document.getElementById("pwHash"),
};

const SCREEN_NODES = {
  "dashboard": nodes.dashboardScreen,
  "reports-category": nodes.categoryScreen,
  "reports-project": nodes.projectScreen,
  "create-report": nodes.createReportScreen,
  "calendar": nodes.calendarScreen,
  "team": nodes.teamScreen,
  "settings": nodes.settingsScreen,
  "templates": nodes.templatesScreen,
  "add-project": nodes.addProjectScreen,
};

let state = loadState();
state = ensureDefaults(state);
applyTheme(state.settings.theme);

let uiState = {
  screen: "dashboard",
  activeNav: "dashboard",
  category: "current",
  projectId: null,
  editingLastId: null,
  editingUpcomingId: null,
  returnScreen: null,
  calendarMonth: null,
  calendarSelectedDate: null,
  wizardStep: 1,
  wizardSavedId: null,
};
let latestReportText = "";
let taskCounter = 0;
let subtaskCounter = 0;

const NAV_HANDLERS = {
  "dashboard": openDashboard,
  "create-report": () => openCreateReport(uiState.projectId || null),
  "calendar": openCalendar,
  "team": openTeam,
  "settings": openSettings,
  "templates": openTemplates,
};

/* All start-up work runs from here, invoked at the very end of this file. Module-level
   `const`s are in the temporal dead zone until their declaration is evaluated, so boot
   code must not run before them — several bugs came from exactly that.
   Function declarations hoist, so boot() itself can be called from the bottom. */
function boot() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      const handler = NAV_HANDLERS[button.dataset.navKey];
      if (handler) handler();
    });
  });

  nodes.openCurrent.addEventListener("click", () => openCurrentProject());
  nodes.openClosed.addEventListener("click", () => openClosedProject());
  nodes.backToHome.addEventListener("click", () => openDashboard());
  nodes.backToCategory.addEventListener("click", () => openCategory(uiState.category));
  nodes.generateReport.addEventListener("click", () => generateReportPdf());
  nodes.downloadReport.addEventListener("click", () => copyReportHtml());

  nodes.sidebarAddProject.addEventListener("click", () => openAddProject());
  nodes.homeAddProject.addEventListener("click", () => openAddProject());
  nodes.cancelAddProject.addEventListener("click", () => navigateToScreen(uiState.returnScreen));
  nodes.btnCancelAddProject.addEventListener("click", () => navigateToScreen(uiState.returnScreen));
  nodes.addProjectForm.addEventListener("submit", (e) => handleWizardSubmit(e));
  nodes.npBack.addEventListener("click", () => goToWizardStep(uiState.wizardStep - 1));
  nodes.npSaveDraft.addEventListener("click", () => {
    showWizardError("");
    try {
      saveProject({ asDraft: true });
    } catch (error) {
      showWizardError(`Could not save draft: ${error.message}`);
      throw error;
    }
  });
  nodes.npGoToProject.addEventListener("click", () => { if (uiState.wizardSavedId) openProject(uiState.wizardSavedId); });
  nodes.npCreateAnother.addEventListener("click", () => openAddProject());
  nodes.npAddPoc.addEventListener("click", () => addPocRow());
  nodes.addProjectForm.addEventListener("change", (e) => handleWizardChange(e));
  nodes.addProjectForm.addEventListener("input", (e) => {
    if (e.target.matches("input, select, textarea")) renderWizardSummary();
  });
  nodes.npSummary.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-goto-step]");
    if (edit) goToWizardStep(Number(edit.dataset.gotoStep));
  });
  nodes.wizardSteps.addEventListener("click", (e) => {
    const step = e.target.closest(".wizard-step");
    if (step && uiState.wizardStep < WIZARD_CONFIRM_STEP) goToWizardStep(Number(step.dataset.step));
  });

  nodes.addWeeklyUpdate.addEventListener("click", () => openCreateReport(uiState.projectId, null, { editing: true }));
  nodes.addWeekFromTemplate.addEventListener("click", () => addWeekToProject(uiState.projectId));
  nodes.deleteProjectBtn.addEventListener("click", () => deleteProject(uiState.projectId));
  nodes.projEditToggle.addEventListener("click", () => toggleProjectDetails(true));
  nodes.projCancelEdit.addEventListener("click", () => toggleProjectDetails(false));
  nodes.projDetailsForm.addEventListener("submit", (e) => saveProjectDetails(e));
  nodes.projTechTeam.addEventListener("change", () => {
    nodes.projVendorField.hidden = nodes.projTechTeam.value !== "outsourced";
  });
  [nodes.projKickoff, nodes.projCycleWeeks].forEach((node) => {
    node.addEventListener("change", () => {
      nodes.projGoLive.value = computeGoLiveDate(nodes.projKickoff.value, nodes.projCycleWeeks.value);
    });
  });
  ["npKickoffDate", "npCycleWeeks"].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.addEventListener("change", () => syncGoLiveFromCycle());
  });
  nodes.cancelCreateReport.addEventListener("click", () => navigateToScreen(uiState.returnScreen));
  nodes.btnCancelCreateReport.addEventListener("click", () => navigateToScreen(uiState.returnScreen));
  nodes.createReportForm.addEventListener("submit", (e) => saveWeeklyUpdate(e));
  nodes.btnAddLastWeekTask.addEventListener("click", () => addNewTaskToForm("last"));
  nodes.btnAddThisWeekTask.addEventListener("click", () => addNewTaskToForm("upcoming"));
  nodes.btnChecklistLastWeek.addEventListener("click", () => openTemplatePicker("last"));
  nodes.btnChecklistThisWeek.addEventListener("click", () => openTemplatePicker("upcoming"));
  nodes.templatePickerClose.addEventListener("click", () => closeTemplatePicker());
  nodes.templatePickerCancel.addEventListener("click", () => closeTemplatePicker());
  nodes.templatePickerAdd.addEventListener("click", () => addSelectedTemplates());
  nodes.templateSearch.addEventListener("input", () => filterTemplatePicker(nodes.templateSearch.value));
  nodes.templatePickerOverlay.addEventListener("click", (e) => {
    if (e.target === nodes.templatePickerOverlay) closeTemplatePicker();
  });
  nodes.createReportProjectSelect.addEventListener("change", () => loadProjectIntoReportEditor(nodes.createReportProjectSelect.value));
  nodes.reportsIndexProject.addEventListener("change", () => {
    uiState.projectId = nodes.reportsIndexProject.value || null;
    renderReportsIndex(nodes.reportsIndexProject.value);
  });
  nodes.reportsIndexList.addEventListener("click", (e) => handleReportsIndexClick(e));
  nodes.reportsNewBtn.addEventListener("click", () => {
    openCreateReport(nodes.reportsIndexProject.value || null, null, { editing: true });
  });

  nodes.calendarPrev.addEventListener("click", () => shiftCalendarMonth(-1));
  nodes.calendarNext.addEventListener("click", () => shiftCalendarMonth(1));

  nodes.settingsForm.addEventListener("submit", (e) => saveSettings(e));

  nodes.authForm.addEventListener("submit", (e) => handleEmailSignIn(e));
nodes.passwordForm.addEventListener("submit", (e) => handlePasswordChange(e));

  nodes.syncPreview.addEventListener("click", () => previewTemplateSync());
  nodes.syncApply.addEventListener("click", () => applyTemplateSync());

  nodes.settingsExport.addEventListener("click", () => exportBackup());
  nodes.settingsClear.addEventListener("click", () => clearAllData({ keepTemplates: true }));
  nodes.settingsDemoLoad.addEventListener("click", () => loadDemoData(nodes.settingsDemoSelect.value));
  nodes.settingsDemoSelect.addEventListener("change", () => describeSelectedDemo());
  nodes.settingsImport.addEventListener("click", () => nodes.settingsImportFile.click());
  nodes.settingsImportFile.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = "";
  });

  nodes.teamProjectSelect.addEventListener("change", () => {
    uiState.teamProjectId = nodes.teamProjectSelect.value;
    renderTeamScreen();
  });
  nodes.teamAddMember.addEventListener("click", () => addTeamMember());
  nodes.teamMemberList.addEventListener("input", (e) => handleTeamMemberInput(e));
  nodes.teamMemberList.addEventListener("change", (e) => handleTeamMemberInput(e));
  nodes.teamMemberList.addEventListener("click", (e) => handleTeamMemberClick(e));

  nodes.templatesList.addEventListener("input", (e) => handleTemplatesInput(e));
  nodes.templatesList.addEventListener("change", (e) => handleTemplatesInput(e));
  nodes.templatesList.addEventListener("click", (e) => handleTemplatesClick(e));
  nodes.templatesAddWeek.addEventListener("click", () => addTemplateWeek());
  nodes.templatesReloadFile.addEventListener("click", () => reloadTemplatesFromFile());
  nodes.templatesReset.addEventListener("click", () => resetTemplatesToDefault());

  nodes.themeToggle.addEventListener("click", () => toggleTheme());
  nodes.searchInput.addEventListener("input", () => renderSearchResults());
  nodes.searchInput.addEventListener("focus", () => renderSearchResults());
  nodes.searchInput.addEventListener("click", (e) => e.stopPropagation());
  nodes.searchInput.addEventListener("keydown", (e) => handleSearchKeydown(e));
  nodes.notifBell.addEventListener("click", (e) => { e.stopPropagation(); toggleNotifDropdown(); });
  nodes.userWidget.addEventListener("click", (e) => { e.stopPropagation(); toggleUserDropdown(); });
  nodes.userDropdownSettingsLink.addEventListener("click", () => { closeDropdowns(); openSettings(); });
  nodes.userDropdownSignOut.addEventListener("click", () => { closeDropdowns(); signOutSession(); });
  document.addEventListener("click", () => closeDropdowns());

  /* Nothing should ever fail silently again: surface uncaught errors in the UI, not just
     the console, so a dead-looking button always says why it is dead. */
  window.addEventListener("error", (event) => {
    debugLog(`ERROR ${event.message} @ ${event.filename || "?"}:${event.lineno || "?"}`);
    showAppError(event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    debugLog(`REJECTION ${String(event.reason)}`);
    showAppError(String(event.reason));
  });
  nodes.appError.addEventListener("click", () => dismissAppBanner());
  nodes.debugClose.addEventListener("click", () => setDebugPanel(false));
  nodes.debugCopy.addEventListener("click", () => copyDebugReport());
  document.addEventListener("keydown", (event) => {
    if (event.shiftKey && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault();
      setDebugPanel(nodes.debugPanel.hidden);
    }
  });

  document.title = "Weekly Report Dashboard";
  debugLog(`boot url=${location.href}`);
  renderAll();
  safeRender(registerServiceWorker);
  if (location.search.includes("debug") || location.hash.includes("debug")) {
    setDebugPanel(true);
  }

  /* ?login renders the sign-in page for design review without any backend configured. */
  if (location.search.includes("login")) {
    nodes.authOverlay.hidden = false;
    nodes.authLocalNote.hidden = false;
    nodes.authLocalNote.textContent = "Preview only — no backend configured, so signing in will not work yet.";
  }

  if (location.search.includes("reset")) {
    const wipeTemplates = location.search.includes("reset=all");
    /* Strip the flag before doing the work: leaving ?reset in the address bar means every
       later refresh silently wipes the data again. */
    clearResetFlagFromUrl();
    clearAllData({ keepTemplates: !wipeTemplates });
  }


  loadRolesConfig().then(() => startSession());
renderDemoDataOptions();

  /* First run only: prefer the editable JSON file over the copy compiled into app.js. */
  if (!state.weekTemplatesSeeded) {
    state.weekTemplatesSeeded = true;
    saveState();
    seedTemplatesFromFile({ silent: true });
  }

}

function clearResetFlagFromUrl() {
  try {
    const url = new URL(location.href);
    url.searchParams.delete("reset");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch (error) {
    debugLog(`could not clean the URL: ${error.message}`);
  }
}

/* One banner, three tones. Errors are red and say what to do about it; confirmations are
   green; neutral notices are blue. Everything is click-to-dismiss. */
const BANNER_DISMISS_MS = 10000;
let bannerTimer = null;

function showAppBanner(message, tone = "error") {
  if (!nodes.appError) {
    return;
  }

  const icon = tone === "error" ? "⚠" : (tone === "success" ? "✓" : "ℹ");
  const suffix = tone === "error" ? " — reload the page, or click to dismiss." : " — click to dismiss.";

  clearTimeout(bannerTimer);
  nodes.appError.className = `app-banner app-banner-${tone}`;
  nodes.appError.textContent = `${icon} ${message}${suffix}`;
  nodes.appError.hidden = false;
  nodes.appError.classList.remove("app-banner-leaving");

  /* Confirmations and notices clear themselves; errors stay until dismissed, since they
     usually need reading or acting on. */
  if (tone !== "error") {
    bannerTimer = setTimeout(() => dismissAppBanner(), BANNER_DISMISS_MS);
  }
}

function dismissAppBanner() {
  clearTimeout(bannerTimer);
  if (!nodes.appError || nodes.appError.hidden) return;

  nodes.appError.classList.add("app-banner-leaving");
  bannerTimer = setTimeout(() => {
    nodes.appError.hidden = true;
    nodes.appError.classList.remove("app-banner-leaving");
  }, 260);
}

function showAppError(message) {
  showAppBanner(message, "error");
}

function showAppInfo(message) {
  showAppBanner(message, "info");
}

function showAppSuccess(message) {
  showAppBanner(message, "success");
}

/* ---------- Debug panel (Ctrl/Cmd+Shift+D, or add ?debug to the URL) ---------- */

function debugLog(message) {
  const stamp = new Date().toLocaleTimeString("en-GB", { hour12: false });
  DEBUG_LOG.push(`${stamp}  ${message}`);
  if (DEBUG_LOG.length > 60) DEBUG_LOG.shift();
  if (nodes.debugPanel && !nodes.debugPanel.hidden) renderDebugPanel();
}

function setDebugPanel(visible) {
  nodes.debugPanel.hidden = !visible;
  if (visible) renderDebugPanel();
}

/* Storage is the usual suspect: VS Code's Simple Browser and other embedded webviews
   run the page in a partitioned frame where localStorage reads/writes throw. */
function probeStorage() {
  try {
    const probe = "__probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return "read/write OK";
  } catch (error) {
    return `BLOCKED (${error.name}: ${error.message})`;
  }
}

function buildDebugReport() {
  const lines = [
    `url            ${location.href}`,
    `origin         ${location.origin}`,
    `in iframe      ${window.top !== window.self}  ${window.top !== window.self ? "<-- embedded viewer" : ""}`,
    `secureContext  ${window.isSecureContext}`,
    `randomUUID     ${typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"}`,
    `localStorage   ${probeStorage()}`,
    `serviceWorker  ${navigator.serviceWorker && navigator.serviceWorker.controller ? "controlling" : "not controlling"}`,
    `viewport       ${window.innerWidth}x${window.innerHeight}`,
    "",
    `screen         ${uiState.screen}   (returnScreen=${uiState.returnScreen})`,
    `wizardStep     ${uiState.wizardStep}   savedId=${uiState.wizardSavedId}`,
    `projects       ${state.projects.length}   updates=${state.updates.length}`,
    `addProject DOM hidden=${nodes.addProjectScreen.hidden} display=${getComputedStyle(nodes.addProjectScreen).display}`,
    "",
    "--- log ---",
    ...DEBUG_LOG,
  ];
  return lines.join("\n");
}

function renderDebugPanel() {
  nodes.debugBody.textContent = buildDebugReport();
}

function copyDebugReport() {
  const report = buildDebugReport();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(report).then(
      () => { nodes.debugCopy.textContent = "Copied"; setTimeout(() => { nodes.debugCopy.textContent = "Copy"; }, 1500); },
      () => selectDebugText(),
    );
    return;
  }

  selectDebugText();
}

function selectDebugText() {
  const range = document.createRange();
  range.selectNodeContents(nodes.debugBody);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

/* Screen visibility is applied FIRST and every content renderer is isolated. Previously a
   throw in any one of them aborted renderAll() before renderScreen() ran, so navigation
   silently did nothing — clicking "+ New Project" left you on the dashboard with no error. */
function renderAll() {
  safeRender(renderScreen);
  safeRender(renderHeader);
  safeRender(renderFolderCounts);
  safeRender(renderDashboardScreen);
  safeRender(renderCategoryScreen);
  safeRender(renderProjectScreen);
  safeRender(renderCalendarScreen);
  safeRender(renderTeamScreen);
  safeRender(renderSettingsScreen);
  safeRender(renderTemplatesScreen);
  safeRender(applyRolePermissions);
}

function safeRender(render) {
  try {
    render();
  } catch (error) {
    const name = render.name || "render";
    console.error(`${name}() failed:`, error);
    showAppError(`${name}() failed: ${error.message}`);
  }
}

function renderScreen() {
  Object.entries(SCREEN_NODES).forEach(([key, node]) => {
    node.hidden = uiState.screen !== key;
  });
  renderNavActiveState();
}

function renderNavActiveState() {
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.navKey === uiState.activeNav);
  });
}

function navigateToScreen(screen) {
  if (screen === "reports-category") {
    openCategory(uiState.category);
    return;
  }

  if (screen === "reports-project" && uiState.projectId) {
    openProject(uiState.projectId);
    return;
  }

  const handler = NAV_HANDLERS[screen];
  if (handler) {
    handler();
    return;
  }

  openDashboard();
}

/* ---------- Header (notifications + profile) ---------- */

function computeAlertItems() {
  const items = [];
  state.updates.forEach((update) => {
    (update.tasks || []).forEach((task) => {
      (task.subtasks || []).forEach((sub) => {
        if (sub.status === "blocked" || sub.status === "delayed") {
          items.push({
            projectId: update.projectId,
            projectName: update.projectName,
            taskTitle: task.title,
            subtaskTitle: sub.title,
            status: sub.status,
          });
        }
      });
    });
  });
  return items;
}

function renderHeader() {
  nodes.headerDisplayName.textContent = state.settings.displayName;
  nodes.headerRole.textContent = state.settings.role;
  nodes.headerAvatar.textContent = state.settings.displayName.trim().charAt(0).toUpperCase() || "?";

  const alerts = computeAlertItems();
  nodes.notifBadge.textContent = `${alerts.length}`;
  nodes.notifBadge.hidden = alerts.length === 0;

  nodes.notifDropdownList.innerHTML = alerts.length
    ? alerts
        .map(
          (item) => `
            <button type="button" class="notif-item btn-notif-item" data-project-id="${item.projectId}">
              <span class="status-badge ${statusClass(item.status)}">${escapeHtml(formatStatus(item.status))}</span>
              <span class="notif-item-text">${escapeHtml(item.subtaskTitle)} <span class="meta">(${escapeHtml(item.projectName)})</span></span>
            </button>
          `
        )
        .join("")
    : `<div class="empty-state">No blocked or delayed items. Nice.</div>`;

  nodes.notifDropdownList.querySelectorAll(".btn-notif-item").forEach((button) => {
    button.addEventListener("click", () => {
      closeDropdowns();
      openProject(button.dataset.projectId);
    });
  });
}

function toggleNotifDropdown() {
  const isOpen = !nodes.notifDropdown.hidden;
  closeDropdowns();
  nodes.notifDropdown.hidden = isOpen;
}

function toggleUserDropdown() {
  const isOpen = !nodes.userDropdown.hidden;
  closeDropdowns();
  nodes.userDropdown.hidden = isOpen;
}

function closeDropdowns() {
  nodes.notifDropdown.hidden = true;
  nodes.userDropdown.hidden = true;
  nodes.searchDropdown.hidden = true;
}

function findMatchingProjects(query) {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return state.projects
    .filter((project) => project.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function renderSearchResults() {
  const matches = findMatchingProjects(nodes.searchInput.value);

  if (!nodes.searchInput.value.trim()) {
    nodes.searchDropdown.hidden = true;
    return;
  }

  nodes.searchResults.innerHTML = matches.length
    ? matches
        .map(
          (project) => `
            <button type="button" class="search-result btn-search-result" data-project-id="${project.id}">
              <span class="search-result-name">${escapeHtml(project.name)}</span>
              <span class="status-badge ${statusClass(project.status)}">${escapeHtml(formatStatus(project.status))}</span>
            </button>
          `
        )
        .join("")
    : `<div class="empty-state">No projects match "${escapeHtml(nodes.searchInput.value.trim())}".</div>`;

  nodes.searchResults.querySelectorAll(".btn-search-result").forEach((button) => {
    button.addEventListener("click", () => goToSearchResult(button.dataset.projectId));
  });

  nodes.searchDropdown.hidden = false;
}

function handleSearchKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const matches = findMatchingProjects(nodes.searchInput.value);
    if (matches.length) {
      goToSearchResult(matches[0].id);
    }
  } else if (event.key === "Escape") {
    nodes.searchInput.value = "";
    nodes.searchDropdown.hidden = true;
    nodes.searchInput.blur();
  }
}

function goToSearchResult(projectId) {
  nodes.searchInput.value = "";
  nodes.searchDropdown.hidden = true;
  openProject(projectId);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
}

function toggleTheme() {
  state.settings.theme = state.settings.theme === "light" ? "dark" : "light";
  applyTheme(state.settings.theme);
  saveState();
}

/* ---------- Dashboard ---------- */

function openDashboard() {
  uiState.screen = "dashboard";
  uiState.activeNav = "dashboard";
  renderAll();
}

function renderDashboardScreen() {
  const currentProjects = state.projects.filter((p) => p.status === "current").length;
  const closedProjects = state.projects.filter((p) => p.status === "closed").length;
  const alerts = computeAlertItems();

  nodes.dashProjectCount.textContent = `${state.projects.length}`;
  nodes.dashCurrentCount.textContent = `${currentProjects}`;
  nodes.dashClosedCount.textContent = `${closedProjects}`;
  nodes.dashUpdateCount.textContent = `${state.updates.length}`;
  nodes.dashAlertCount.textContent = `${alerts.length}`;

  const recent = [...state.updates].sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, 5);

  nodes.dashRecentList.innerHTML = recent.length
    ? recent
        .map(
          (update) => `
            <button type="button" class="project-name-card btn-dash-update" data-project-id="${update.projectId}">
              <span class="project-name">${escapeHtml(update.projectName)}</span>
              <span class="project-meta">${escapeHtml(update.weekRange)}</span>
              <span class="status-badge ${statusClass(update.statusTag)}">${escapeHtml(update.statusTag)}</span>
            </button>
          `
        )
        .join("")
    : `<div class="empty-state">No weekly updates yet.</div>`;

  nodes.dashRecentList.querySelectorAll(".btn-dash-update").forEach((button) => {
    button.addEventListener("click", () => openProject(button.dataset.projectId));
  });
}

function renderFolderCounts() {
  const currentProjects = state.projects.filter((p) => p.status === "current").length;
  const closedProjects = state.projects.filter((p) => p.status === "closed").length;
  nodes.currentProjectCount.textContent = `${currentProjects}`;
  nodes.closedProjectCount.textContent = `${closedProjects}`;
}

/* ---------- Weekly Reports (folder / category / project) ---------- */

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
  uiState.screen = "reports-category";
  uiState.activeNav = "dashboard";
  uiState.category = category;
  uiState.projectId = null;
  renderAll();
  nodes.categoryScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openProject(projectId) {
  uiState.screen = "reports-project";
  uiState.activeNav = "dashboard";
  uiState.projectId = projectId;
  renderAll();
  nodes.projectScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCategoryScreen() {
  const projects = state.projects.filter((project) => project.status === uiState.category);
  const label = uiState.category === "current" ? "Ongoing projects" : "Completed projects";
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
    nodes.projectSummary.innerHTML = "";
    nodes.projectReportState.textContent = "Waiting";
    nodes.projectReportOutput.innerHTML = `<p class="muted">Open a project name to generate a report for that project only.</p>`;
    return;
  }

  /* Chronological everywhere: Week 1 first, matching the report below. */
  const updates = state.updates
    .filter((update) => update.projectId === project.id)
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));
  const latestUpdate = updates[updates.length - 1];

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
    ${buildIntegrationScopeHtml(project)}
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
                  <button class="ghost-button btn-edit-update" data-requires="report.edit" data-update-id="${update.id}" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 8px;">Edit</button>
                  <button class="row-remove btn-delete-update" data-requires="report.delete" data-update-id="${update.id}" style="padding: 4px 10px; font-size: 0.75rem;">Delete week</button>
                  <span class="status-badge ${statusClass(update.statusTag)}">${escapeHtml(update.statusTag)}</span>
                </div>
              </header>
              <div class="summary" style="display: grid; gap: 10px;">
                ${taskList.length ? `
                  <div style="margin-top: 8px;">
                    ${buildSheetReportTable("", withScopeSpans(flattenTasksForReport(taskList)), true)}
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

  nodes.projectUpdates.querySelectorAll(".btn-delete-update").forEach((button) => {
    button.addEventListener("click", () => deleteUpdate(button.dataset.updateId));
  });

  renderProjectTimeline(project);
  renderProjectSummary(project.id);
  renderReport(buildReport(project.id));
}

function flattenTasksForReport(tasks) {
  const rows = [];
  (tasks || []).forEach((task) => {
    const subtasks = (task.subtasks && task.subtasks.length)
      ? task.subtasks
      : [{ title: task.title, owner: task.owner, status: task.status, priority: "medium", blocker: "", date: task.date || "", comments: task.comments || "" }];

    subtasks.forEach((sub) => {
      rows.push({
        scope: task.phase || task.title,
        title: sub.title,
        priority: sub.priority || "medium",
        owner: sub.owner || task.owner || "Unassigned",
        status: sub.status,
        blocker: sub.blocker || "",
        date: sub.date || "",
        comments: sub.comments || "",
      });
    });
  });
  return rows;
}

function withScopeSpans(rows) {
  return rows.map((row, index) => {
    const isFirstOfGroup = index === 0 || rows[index - 1].scope !== row.scope;
    let span = 0;
    if (isFirstOfGroup) {
      for (let i = index; i < rows.length && rows[i].scope === row.scope; i += 1) {
        span += 1;
      }
    }
    return { ...row, showScope: isFirstOfGroup, scopeSpan: span };
  });
}

function buildReport(projectId) {
  const project = projectId ? state.projects.find((item) => item.id === projectId) : null;

  if (!project) {
    latestReportText = "No project selected.";
    return latestReportText;
  }

  /* The report covers only the current week and the one after it — the status a reader
     needs now, not the whole history. Every week is still on the project page. */
  const allWeeks = state.updates
    .filter((update) => update.projectId === project.id)
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));

  const weeks = selectReportWeeks(allWeeks);

  latestReportText = [
    `Project weekly report: ${project.name}`,
    `Status: ${formatStatus(project.status)}`,
    `Project notes: ${project.notes || "No notes yet"}`,
    `Weekly updates: ${weeks.length}`,
    ...weeks.map((week) => `\n${weekHeading(week)}:\n${reportRowsToText(week.rows, true)}`),
  ].filter(Boolean).join("\n");

  return {
    projectName: project.name,
    projectStatus: project.status,
    projectNotes: project.notes || "No notes yet",
    csm: project.csm || "",
    projectOwner: project.implementationOwner || "",
    clientPocs: (project.clientPocs || []).map(formatPoc).filter(Boolean).join(", "),
    kickoffDate: project.kickoffDate || "",
    goLiveDate: project.goLiveDate || "",
    totalUpdates: allWeeks.length,
    weeks,
  };
}

function weekHeading(week) {
  const prefix = week.weekNumber ? `Week ${week.weekNumber}` : "Week";
  const tag = week.tag ? ` — ${week.tag} week` : "";
  return `${prefix} (${week.range})${week.label ? ` — ${week.label}` : ""}${tag}`;
}

/* Current week = the one whose 7-day range contains today; before kickoff there is none,
   and after go-live it falls back to the last week that ended. Upcoming = the next one after. */
function selectReportWeeks(weeksAsc) {
  if (!weeksAsc.length) return [];

  const today = toInputDate(new Date());
  const endOf = (update) => toInputDate(shiftDays(new Date(`${update.weekStart}T00:00:00`), 6));

  const current = weeksAsc.find((update) => update.weekStart <= today && today <= endOf(update))
    || [...weeksAsc].reverse().find((update) => endOf(update) < today)
    || null;

  const upcoming = current
    ? weeksAsc.find((update) => update.weekStart > current.weekStart)
    : weeksAsc.find((update) => update.weekStart > today);

  return [
    current ? toReportWeek(current, "current") : null,
    upcoming ? toReportWeek(upcoming, "upcoming") : null,
  ].filter(Boolean);
}

function toReportWeek(update, tag) {
  return {
    id: update.id,
    range: update.weekRange,
    weekStart: update.weekStart,
    weekNumber: update.templateWeek || null,
    label: update.templateLabel || "",
    statusTag: update.statusTag || "not started",
    tag,
    rows: withScopeSpans(flattenTasksForReport(update.tasks)),
  };
}

function reportRowsToText(rows, includeStatusColumns) {
  if (!rows.length) return " (no tasks entered)";
  return rows.map((row) => {
    let line = ` - [${row.scope}] ${row.title} (Priority: ${row.priority}, Owner: ${row.owner || "Unassigned"}`;
    if (includeStatusColumns) {
      line += `, Status: ${row.status}`;
    }
    line += ")";
    if (includeStatusColumns && row.blocker) line += ` — Blocker: ${row.blocker}`;
    if (includeStatusColumns && row.date) line += ` — Completed On: ${formatOrdinalDate(new Date(`${row.date}T00:00:00`))}`;
    if (row.comments) line += ` — ${row.comments}`;
    return line;
  }).join("\n");
}

function priorityCellHtml(priority) {
  const normalized = (priority || "medium").toLowerCase();
  const colors = { high: "#dc2626", medium: "#b45309", low: "#15803d" };
  return `<span style="color:${colors[normalized] || colors.medium}; font-weight:800;">${escapeHtml(formatStatus(normalized))}</span>`;
}

function statusCellHtml(status) {
  const normalized = String(status || "").toLowerCase();
  const colors = {
    "completed": "#15803d",
    "in progress": "#b45309",
    "blocked": "#dc2626",
    "delayed": "#dc2626",
    "not started": "#475569",
  };
  return `<span style="color:${colors[normalized] || "#475569"}; font-weight:800;">${escapeHtml(formatStatus(normalized))}</span>`;
}

function buildSheetReportTable(title, rows, includeStatusColumns) {
  const banner = title ? `<div class="sheet-report-banner">${escapeHtml(title)}</div>` : "";

  if (!rows.length) {
    return `
      <div class="sheet-report">
        ${banner}
        <div class="muted" style="padding: 12px;">No tasks entered for this week.</div>
      </div>
    `;
  }

  const headCells = includeStatusColumns
    ? ["Integration Scope", "Task / Milestone", "Priority", "Owner", "Status", "Blockers/Risk", "Completed On", "Comments"]
    : ["Integration Scope", "Task / Milestone", "Priority", "Owner", "Comments"];

  const bodyRows = rows.map((row) => `
    <tr>
      ${row.showScope ? `<td rowspan="${row.scopeSpan}" class="sheet-scope-cell">${escapeHtml(row.scope)}</td>` : ""}
      <td>${escapeHtml(row.title)}</td>
      <td>${priorityCellHtml(row.priority)}</td>
      <td>${escapeHtml(row.owner || "Unassigned")}</td>
      ${includeStatusColumns ? `
        <td>${statusCellHtml(row.status)}</td>
        <td>${escapeHtml(row.blocker || "-")}</td>
        <td>${escapeHtml(row.date ? formatOrdinalDate(new Date(`${row.date}T00:00:00`)) : "")}</td>
      ` : ""}
      <td>${escapeHtml(row.comments || "")}</td>
    </tr>
  `).join("");

  return `
    <div class="sheet-report">
      ${banner}
      <div class="table-scroll">
        <table class="sheet-report-table">
          <thead><tr>${headCells.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderReport(report) {
  if (typeof report === "string") {
    nodes.projectReportState.textContent = "Waiting";
    nodes.projectReportOutput.innerHTML = `<p class="muted">${escapeHtml(report)}</p>`;
    return;
  }

  nodes.projectReportState.textContent = "Generated";

  const weekTables = report.weeks.length
    ? report.weeks.map((week) => buildSheetReportTable(weekHeading(week), week.rows, true)).join("")
    : `<div class="report-block"><div class="muted">No weekly reports for this project yet.</div></div>`;

  nodes.projectReportOutput.innerHTML = `
    ${buildProjectSummaryCard(report)}
    ${weekTables}
  `;
}

/* The one card that stays — kept at the top so it lands in the first fold of the report. */
function buildProjectSummaryCard(report) {
  const rows = [
    ["Project name", report.projectName],
    ["Project owner", report.projectOwner],
    ["Client POC", report.clientPocs],
    ["Status", formatStatus(report.projectStatus)],
    ["Kickoff", report.kickoffDate ? formatSummaryDate(report.kickoffDate) : ""],
    ["Target go-live", report.goLiveDate ? formatSummaryDate(report.goLiveDate) : ""],
  ].filter(([, value]) => value);

  return `
    <div class="report-block project-summary-card">
      <h3>Project summary</h3>
      <div class="project-summary-grid">
        ${rows.map(([label, value]) => `
          <div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>
        `).join("")}
      </div>
    </div>
  `;
}

function buildReportPrintHtml(report) {
  const styles = `
    * { box-sizing: border-box; }
    /* Force browsers to keep background colors when printing to PDF. */
    html, body, .sheet-report, .sheet-report-banner, table, th, td, .sheet-scope-cell {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 28px;
      font-family: "Segoe UI", "Trebuchet MS", system-ui, sans-serif;
      color: #111827;
      background: #ffffff;
    }
    h1 { font-family: Georgia, "Times New Roman", serif; font-size: 1.5rem; margin: 0 0 4px; }
    .report-meta { color: #4b5563; font-size: 0.85rem; margin-bottom: 20px; }
    .report-meta span { margin-right: 16px; }
    .sheet-report { border-radius: 6px; overflow: hidden; border: 1px solid #d1d5db; margin-bottom: 22px; break-inside: avoid; }
    .sheet-report-banner { background: #fde047; color: #1f2937; font-weight: 800; text-align: center; padding: 10px; font-size: 0.95rem; }
    table { width: 100%; border-collapse: collapse; background: #ffffff; color: #111827; }
    th { background: #fef9c3; color: #1f2937; padding: 8px 10px; border: 1px solid #d1d5db; font-size: 0.76rem; text-align: left; }
    td { padding: 8px 10px; border: 1px solid #d1d5db; font-size: 0.82rem; vertical-align: top; }
    .sheet-scope-cell { font-weight: 700; background: #f9fafb; vertical-align: middle; }
    .empty-note { padding: 12px; color: #6b7280; }
    .summary-card { border: 1px solid #d1d5db; border-radius: 6px; padding: 14px 16px; margin-bottom: 22px; background: #f9fafb; break-inside: avoid; }
    .summary-card h2 { font-family: Georgia, "Times New Roman", serif; font-size: 1.05rem; margin: 0 0 10px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px 20px; font-size: 0.84rem; }
    @page { size: landscape; margin: 12mm; }
    @media print { body { padding: 0; } }
  `;

  const weeksHtml = report.weeks.length
    ? report.weeks.map((week) => buildSheetReportTable(weekHeading(week), week.rows, true)).join("")
    : `<div class="sheet-report"><div class="empty-note">No weekly reports entered yet for this project.</div></div>`;

  const summaryRows = [
    ["Project name", report.projectName],
    ["Project owner", report.projectOwner],
    ["Client POC", report.clientPocs],
    ["Status", formatStatus(report.projectStatus)],
    ["Kickoff", report.kickoffDate ? formatSummaryDate(report.kickoffDate) : ""],
    ["Target go-live", report.goLiveDate ? formatSummaryDate(report.goLiveDate) : ""],
  ].filter(([, value]) => value);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(report.projectName)} — Weekly Report</title>
  <style>${styles}</style>
</head>
<body>
  <h1>${escapeHtml(report.projectName)} — Weekly Report</h1>
  <div class="summary-card">
    <h2>Project summary</h2>
    <div class="summary-grid">
      ${summaryRows.map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`).join("")}
    </div>
  </div>
  ${weeksHtml}
</body>
</html>`;
}

/* "Generate report" — opens the print dialog so the browser can save it as a PDF. */
function generateReportPdf() {
  const report = buildReport(uiState.projectId);
  if (typeof report === "string") {
    renderReport(report);
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showAppError("Allow pop-ups for this site to generate the PDF.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildReportPrintHtml(report));
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}

/* Email clients strip <style> blocks, so the email build carries every rule as an inline
   style attribute. Pasting this into Gmail/Outlook keeps the tables intact. */
const EMAIL_STYLE = {
  wrap: "font-family:Arial,Helvetica,sans-serif;color:#111827;",
  h1: "font-size:20px;margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;",
  card: "border:1px solid #d1d5db;border-radius:6px;padding:12px 14px;margin:0 0 18px;background:#f9fafb;",
  cardH: "font-size:15px;margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;",
  cardRow: "font-size:13px;padding:2px 16px 2px 0;",
  banner: "background:#fde047;color:#1f2937;font-weight:bold;text-align:center;padding:9px;font-size:14px;border:1px solid #d1d5db;border-bottom:0;",
  table: "width:100%;border-collapse:collapse;background:#ffffff;margin:0 0 18px;",
  th: "background:#fef9c3;color:#1f2937;padding:7px 9px;border:1px solid #d1d5db;font-size:12px;text-align:left;",
  td: "padding:7px 9px;border:1px solid #d1d5db;font-size:13px;vertical-align:top;",
  scope: "padding:7px 9px;border:1px solid #d1d5db;font-size:13px;vertical-align:middle;font-weight:bold;background:#f9fafb;",
};

function emailPriority(priority) {
  const normalized = (priority || "medium").toLowerCase();
  const colors = { high: "#dc2626", medium: "#b45309", low: "#15803d" };
  return `<span style="color:${colors[normalized] || colors.medium};font-weight:bold;">${escapeHtml(formatStatus(normalized))}</span>`;
}

function emailStatus(status) {
  const normalized = String(status || "").toLowerCase();
  const colors = { "completed": "#15803d", "in progress": "#b45309", "blocked": "#dc2626", "delayed": "#dc2626", "not started": "#475569" };
  return `<span style="color:${colors[normalized] || "#475569"};font-weight:bold;">${escapeHtml(formatStatus(normalized))}</span>`;
}

function buildReportEmailHtml(report) {
  const head = ["Integration Scope", "Task / Milestone", "Priority", "Owner", "Status", "Blockers/Risk", "Completed On", "Comments"];

  const summaryRows = [
    ["Project name", report.projectName],
    ["Project owner", report.projectOwner],
    ["Client POC", report.clientPocs],
    ["Status", formatStatus(report.projectStatus)],
    ["Kickoff", report.kickoffDate ? formatSummaryDate(report.kickoffDate) : ""],
    ["Target go-live", report.goLiveDate ? formatSummaryDate(report.goLiveDate) : ""],
  ].filter(([, value]) => value);

  const tables = report.weeks.map((week) => {
    const body = week.rows.map((row) => `
      <tr>
        ${row.showScope ? `<td rowspan="${row.scopeSpan}" style="${EMAIL_STYLE.scope}">${escapeHtml(row.scope)}</td>` : ""}
        <td style="${EMAIL_STYLE.td}">${escapeHtml(row.title)}</td>
        <td style="${EMAIL_STYLE.td}">${emailPriority(row.priority)}</td>
        <td style="${EMAIL_STYLE.td}">${escapeHtml(row.owner || "Unassigned")}</td>
        <td style="${EMAIL_STYLE.td}">${emailStatus(row.status)}</td>
        <td style="${EMAIL_STYLE.td}">${escapeHtml(row.blocker || "-")}</td>
        <td style="${EMAIL_STYLE.td}">${escapeHtml(row.date ? formatOrdinalDate(new Date(`${row.date}T00:00:00`)) : "")}</td>
        <td style="${EMAIL_STYLE.td}">${escapeHtml(row.comments || "")}</td>
      </tr>`).join("");

    return `<div style="${EMAIL_STYLE.banner}">${escapeHtml(weekHeading(week))}</div>
<table style="${EMAIL_STYLE.table}" cellspacing="0" cellpadding="0" border="0">
<thead><tr>${head.map((h) => `<th style="${EMAIL_STYLE.th}">${escapeHtml(h)}</th>`).join("")}</tr></thead>
<tbody>${body || `<tr><td style="${EMAIL_STYLE.td}" colspan="${head.length}">No tasks entered.</td></tr>`}</tbody>
</table>`;
  }).join("\n");

  return `<div style="${EMAIL_STYLE.wrap}">
<h1 style="${EMAIL_STYLE.h1}">${escapeHtml(report.projectName)} — Weekly Report</h1>
<div style="${EMAIL_STYLE.card}">
<div style="${EMAIL_STYLE.cardH}">Project summary</div>
<table cellspacing="0" cellpadding="0" border="0"><tr>${summaryRows.map(([l, v]) => `<td style="${EMAIL_STYLE.cardRow}"><strong>${escapeHtml(l)}:</strong> ${escapeHtml(v)}</td>`).join("")}</tr></table>
</div>
${tables}
</div>`;
}

/* Copies as text/html so pasting into an email renders the tables, with the raw markup
   also offered on screen for clients that only take plain text. */
async function copyReportHtml() {
  const report = buildReport(uiState.projectId);
  if (typeof report === "string") {
    renderReport(report);
    return;
  }

  const html = buildReportEmailHtml(report);

  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error("clipboard unavailable");
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([html], { type: "text/plain" }),
    })]);
    showAppSuccess("Report copied — paste straight into your email. The raw HTML is shown below too.");
  } catch (error) {
    debugLog(`clipboard copy failed: ${error.message}`);
    showAppError("Could not reach the clipboard — select the HTML below and copy it manually.");
  }

  showReportHtmlSource(html);
}

function showReportHtmlSource(html) {
  const existing = document.getElementById("reportHtmlSource");
  if (existing) existing.remove();

  const block = document.createElement("div");
  block.id = "reportHtmlSource";
  block.className = "report-block";
  block.innerHTML = `
    <h3>HTML for email</h3>
    <p class="muted" style="margin-bottom:8px;font-size:0.82rem;">Already on your clipboard as rich HTML. This is the raw markup if you need to paste it into a template editor.</p>
    <textarea class="report-html-source" readonly></textarea>
  `;
  block.querySelector("textarea").value = html;
  nodes.projectReportOutput.append(block);
  block.querySelector("textarea").select();
}

/* ---------- Stat tiles (shared) ---------- */

function countSubtaskStatuses(subtasks) {
  const counts = { total: 0 };
  SUBTASK_STATUSES.forEach((status) => { counts[status] = 0; });
  subtasks.forEach((sub) => {
    counts.total += 1;
    if (counts[sub.status] !== undefined) {
      counts[sub.status] += 1;
    }
  });
  return counts;
}

function buildStatTileRow(counts) {
  const tiles = [
    { key: "total", label: "Total Tasks", tone: "" },
    { key: "completed", label: "Completed", tone: "tone-completed" },
    { key: "in progress", label: "In Progress", tone: "tone-in-progress" },
    { key: "delayed", label: "Delayed", tone: "tone-delayed" },
    { key: "blocked", label: "Blocked", tone: "tone-blocked" },
    { key: "not started", label: "Not Started", tone: "tone-not-started" },
  ];

  return `
    <div class="stat-tile-row">
      ${tiles.map((tile) => {
        const value = tile.key === "total" ? counts.total : counts[tile.key];
        const pct = counts.total ? Math.round((value / counts.total) * 100) : 0;
        return `
          <article class="stat-tile">
            <span class="stat-tile-label">${escapeHtml(tile.label)}</span>
            <span class="stat-tile-value ${tile.tone}">${value}</span>
            ${tile.key === "total" ? "" : `<span class="stat-tile-pct">${pct}%</span>`}
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function computeProjectSubtaskSummary(projectId) {
  const subtasks = state.updates
    .filter((u) => u.projectId === projectId)
    .flatMap((u) => u.tasks || [])
    .flatMap((t) => t.subtasks || []);
  return countSubtaskStatuses(subtasks);
}

function renderProjectSummary(projectId) {
  /* Stat-tile summary cards removed — the report leads with the project summary card
     instead. The panel is hidden rather than left as an empty bordered box. */
  nodes.projectSummary.innerHTML = "";
  nodes.projectSummary.hidden = true;
}

function reportSection(sectionKey) {
  return sectionKey === "last"
    ? { list: nodes.lastWeekTasksList, stats: nodes.lastWeekStats, date: nodes.lastWeekDate, status: nodes.lastWeekStatus }
    : { list: nodes.thisWeekTasksList, stats: nodes.thisWeekStats, date: nodes.thisWeekDate, status: nodes.thisWeekStatus };
}

function renderCreateReportStats(sectionKey) {
  const section = reportSection(sectionKey);
  const rows = [...section.list.querySelectorAll(".form-subtask-row")];
  const subtasks = rows.map((row) => ({ status: row.querySelector(".form-subtask-status").value }));
  section.stats.innerHTML = buildStatTileRow(countSubtaskStatuses(subtasks));
}

/* ---------- Charts ---------- */

/* ---------- Calendar ---------- */

function isDateInUpdateWeek(dateStr, update) {
  const end = toInputDate(shiftDays(new Date(`${update.weekStart}T00:00:00`), 6));
  return dateStr >= update.weekStart && dateStr <= end;
}

function openCalendar() {
  uiState.returnScreen = uiState.screen;
  uiState.screen = "calendar";
  uiState.activeNav = "calendar";
  if (!uiState.calendarMonth) {
    const today = new Date();
    uiState.calendarMonth = { year: today.getFullYear(), month: today.getMonth() };
  }
  renderAll();
  nodes.calendarScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function shiftCalendarMonth(delta) {
  let { year, month } = uiState.calendarMonth;
  month += delta;
  if (month < 0) { month = 11; year -= 1; }
  if (month > 11) { month = 0; year += 1; }
  uiState.calendarMonth = { year, month };
  renderCalendarScreen();
}

function renderCalendarScreen() {
  if (!uiState.calendarMonth) return;

  const { year, month } = uiState.calendarMonth;
  nodes.calendarMonthLabel.textContent = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toInputDate(new Date());

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) {
    cells.push(`<div class="calendar-day calendar-day-empty"></div>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = toInputDate(new Date(year, month, day));
    const matches = state.updates.filter((update) => isDateInUpdateWeek(dateStr, update));
    const classes = ["calendar-day"];
    if (matches.length) classes.push("has-update");
    if (dateStr === todayStr) classes.push("today");
    if (dateStr === uiState.calendarSelectedDate) classes.push("selected");
    cells.push(`<button type="button" class="${classes.join(" ")}" data-date="${dateStr}">${day}${matches.length ? `<span class="calendar-dot"></span>` : ""}</button>`);
  }

  nodes.calendarGrid.innerHTML = cells.join("");
  nodes.calendarGrid.querySelectorAll("[data-date]").forEach((el) => {
    el.addEventListener("click", () => {
      uiState.calendarSelectedDate = el.dataset.date;
      renderCalendarScreen();
    });
  });

  renderCalendarSelectedList();
}

function renderCalendarSelectedList() {
  if (!uiState.calendarSelectedDate) {
    nodes.calendarSelectedList.innerHTML = `<div class="empty-state">Click a marked date to see the weekly update(s) covering it.</div>`;
    return;
  }

  const matches = state.updates.filter((update) => isDateInUpdateWeek(uiState.calendarSelectedDate, update));
  nodes.calendarSelectedList.innerHTML = matches.length
    ? matches
        .map(
          (update) => `
            <button type="button" class="project-name-card btn-calendar-update" data-project-id="${update.projectId}">
              <span class="project-name">${escapeHtml(update.projectName)}</span>
              <span class="project-meta">${escapeHtml(update.weekRange)}</span>
              <span class="status-badge ${statusClass(update.statusTag)}">${escapeHtml(update.statusTag)}</span>
            </button>
          `
        )
        .join("")
    : `<div class="empty-state">No weekly update covers ${escapeHtml(uiState.calendarSelectedDate)}.</div>`;

  nodes.calendarSelectedList.querySelectorAll(".btn-calendar-update").forEach((button) => {
    button.addEventListener("click", () => openProject(button.dataset.projectId));
  });
}

/* ---------- Team ---------- */

function computeTeamRoster(projectId) {
  const map = new Map();
  const add = (owner, status) => {
    const name = (owner || "").trim() || "Unassigned";
    if (!map.has(name)) {
      const rec = { name, total: 0 };
      SUBTASK_STATUSES.forEach((s) => { rec[s] = 0; });
      map.set(name, rec);
    }
    const rec = map.get(name);
    rec.total += 1;
    if (rec[status] !== undefined) {
      rec[status] += 1;
    }
  };

  state.updates
    .filter((update) => !projectId || update.projectId === projectId)
    .forEach((update) => {
    (update.tasks || []).forEach((task) => {
      add(task.owner, task.status);
      (task.subtasks || []).forEach((sub) => add(sub.owner, sub.status));
    });
  });

  return [...map.values()].sort((a, b) => b.total - a.total);
}

function openTeam() {
  uiState.returnScreen = uiState.screen;
  uiState.screen = "team";
  uiState.activeNav = "team";
  renderAll();
  nodes.teamScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

const TEAM_ROLES = ["OBM", "TSS", "GC", "Ops", "Dev Team", "CSM", "Client", "Other"];

function currentTeamProject() {
  const project = state.projects.find((item) => item.id === uiState.teamProjectId) || state.projects[0] || null;
  /* ensureDefaults() only runs on load, so a project created this session may not have
     the array yet. */
  if (project && !Array.isArray(project.team)) project.team = [];
  return project;
}

function renderProjectTeam() {
  if (!nodes.teamMemberList) return;

  const project = currentTeamProject();
  populateProjectPicker(nodes.teamProjectSelect, project ? project.id : "");
  uiState.teamProjectId = project ? project.id : null;

  if (!project) {
    nodes.teamMemberList.innerHTML = `<p class="muted">Create a project first — teams are defined per project.</p>`;
    return;
  }

  if (!project.team.length) {
    nodes.teamMemberList.innerHTML = `<p class="muted">No team members yet. Use “+ Add member”.</p>`;
    return;
  }

  nodes.teamMemberList.innerHTML = project.team.map((member) => `
    <div class="detail-row poc-row" data-member="${member.id}">
      <input type="text" data-field="name" value="${escapeHtml(member.name)}" placeholder="Name" />
      <select data-field="role">
        ${TEAM_ROLES.map((role) => `<option value="${role}"${member.role === role ? " selected" : ""}>${role}</option>`).join("")}
      </select>
      <button type="button" class="row-remove" data-requires="team.manage" data-action="remove-member">Remove</button>
    </div>
  `).join("");
}

function addTeamMember() {
  if (!requirePermission("team.manage", "manage the project team")) return;
  const project = currentTeamProject();
  if (!project) return;

  project.team.push({ id: newId(), name: "", role: "OBM" });
  saveState();
  renderTeamScreen();
}

function handleTeamMemberInput(event) {
  const field = event.target.dataset.field;
  if (!field) return;

  const project = currentTeamProject();
  if (!project) return;

  const rowEl = event.target.closest("[data-member]");
  const member = project.team.find((item) => item.id === rowEl.dataset.member);
  if (!member) return;

  member[field] = event.target.value;
  saveState();
  refreshOwnerOptions(project.id);
}

function handleTeamMemberClick(event) {
  if (!event.target.closest('[data-action="remove-member"]')) return;
  if (!requirePermission("team.manage", "manage the project team")) return;

  const project = currentTeamProject();
  if (!project) return;

  const rowEl = event.target.closest("[data-member]");
  const member = project.team.find((item) => item.id === rowEl.dataset.member);
  if (member && member.name && !confirm(`Remove ${member.name} from ${project.name}'s team?`)) return;

  project.team = project.team.filter((item) => item.id !== rowEl.dataset.member);
  saveState();
  renderTeamScreen();
}

function renderTeamScreen() {
  renderProjectTeam();
  renderTeamWorkload();
}

function renderTeamWorkload() {
  const roster = computeTeamRoster(uiState.teamProjectId);
  nodes.teamList.innerHTML = roster.length
    ? roster
        .map(
          (member) => `
            <article class="team-roster-row">
              <div class="team-roster-name">${escapeHtml(member.name)}</div>
              <div class="team-roster-badges">
                <span class="pill pill-dark">${member.total} item${member.total === 1 ? "" : "s"}</span>
                ${SUBTASK_STATUSES.filter((s) => member[s]).map((s) => `
                  <span class="status-badge ${statusClass(s)}">${member[s]} ${escapeHtml(formatStatus(s))}</span>
                `).join("")}
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state">No task owners on this project yet.</div>`;
}

/* ---------- Settings ---------- */

function openSettings() {
  uiState.returnScreen = uiState.screen;
  uiState.screen = "settings";
  uiState.activeNav = "settings";
  renderAll();
  nodes.settingsScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSettingsScreen() {
  nodes.settingsDisplayName.value = state.settings.displayName;
  nodes.settingsRole.value = state.settings.role;
  renderStorageStats();
  renderAccountPanel();
  renderRolesPanel();
  nodes.settingsPasswordBlock.hidden = !currentSession;
}

function saveSettings(event) {
  event.preventDefault();
  const displayName = nodes.settingsDisplayName.value.trim() || "Stuti";
  const role = nodes.settingsRole.value.trim() || "Admin";
  state.settings = { displayName, role };
  saveState();
  renderHeader();

  nodes.settingsSavedNote.hidden = false;
  setTimeout(() => { nodes.settingsSavedNote.hidden = true; }, 2000);
}

/* ---------- Seed data / state persistence ---------- */


function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        updates: Array.isArray(parsed.updates) ? parsed.updates : [],
        settings: (parsed.settings && typeof parsed.settings === "object") ? parsed.settings : null,
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
        /* Must be carried through: this whitelist silently dropped the master plan, so
           every edit on the Templates screen was discarded on the next page load. */
        weekTemplates: Array.isArray(parsed.weekTemplates) ? parsed.weekTemplates : null,
        weekTemplatesSeeded: Boolean(parsed.weekTemplatesSeeded),
        demoSeeded: Boolean(parsed.demoSeeded),
      };
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      return {
        projects: Array.isArray(legacyParsed.projects) ? legacyParsed.projects : [],
        updates: Array.isArray(legacyParsed.updates) ? legacyParsed.updates : [],
        settings: null,
        templates: [],
        weekTemplates: null,
      };
    }

    const migratedState = loadAnyUserState();
    if (migratedState) {
      return migratedState;
    }
  } catch {
  }
  return { projects: [], updates: [], settings: null, templates: [], weekTemplates: null };
}

function ensureDefaults(targetState) {
  if (!targetState.settings || typeof targetState.settings !== "object") {
    targetState.settings = { displayName: "Stuti", role: "viewer", theme: "light" };
  } else {
    targetState.settings.displayName = targetState.settings.displayName || "Stuti";
    targetState.settings.role = ROLES.includes(String(targetState.settings.role || "").toLowerCase())
      ? String(targetState.settings.role).toLowerCase()
      : "viewer";
    targetState.settings.theme = targetState.settings.theme === "dark" ? "dark" : "light";
  }

  if (!Array.isArray(targetState.templates)) {
    targetState.templates = [];
  }

  /* The editable master plan. Seeded from WEEK_TEMPLATE_SEED only on first run — an empty
     array means the user deliberately cleared it, so it is left alone. "Reset to default"
     on the Templates screen is the way back. */
  if (!Array.isArray(targetState.weekTemplates)) {
    targetState.weekTemplates = WEEK_TEMPLATE_SEED.map((week) => ({
      week: week.week,
      label: week.label,
      tasks: week.tasks.map((task) => ({ id: newId(), ...task })),
    }));
  }

  targetState.weekTemplates.forEach((week) => {
    if (!Array.isArray(week.tasks)) week.tasks = [];
    if (week.label === undefined) week.label = `Week ${week.week}`;
    week.tasks.forEach((task) => {
      if (!task.id) task.id = newId();
      if (task.scope === undefined) task.scope = "";
      if (task.owner === undefined) task.owner = "";
      if (task.priority === undefined) task.priority = "medium";
      if (!Array.isArray(task.platforms)) task.platforms = [];
      if (task.days === undefined) task.days = null;
      if (!task.daysByCycle || typeof task.daysByCycle !== "object") task.daysByCycle = {};
    });
  });

  targetState.updates.forEach((update) => {
    (update.tasks || []).forEach((task) => {
      if (task.date === undefined) task.date = "";
      if (task.comments === undefined) task.comments = "";
      (task.subtasks || []).forEach((sub) => {
        if (sub.owner === undefined) sub.owner = task.owner || "";
        if (sub.date === undefined) sub.date = update.weekStart || "";
        if (sub.blocker === undefined) sub.blocker = "";
        if (sub.priority === undefined) sub.priority = "medium";
        if (sub.comments === undefined) sub.comments = "";
      });
    });
  });

  targetState.projects.forEach((project) => {
    if (!Array.isArray(project.platforms)) project.platforms = [];
    if (!Array.isArray(project.builtOn)) project.builtOn = [];
    if (project.platformLink === undefined) project.platformLink = "";
    if (project.isSpa === undefined) project.isSpa = "";
    if (project.techTeam === undefined) project.techTeam = "";
    if (project.vendorName === undefined) project.vendorName = "";
    if (project.crmTool === undefined) project.crmTool = "";

    ["csm", "implementationOwner", "salesOwner", "kickoffDate", "goLiveDate",
      "otherToolName", "cdpOtherName", "integrationRequirementOther", "accessRequiredOther", "specialRequirements",
      "knownBlockers", "dependencies", "additionalComments", "docsLink", "testEnvironment",
      "integrationNotes"].forEach((key) => {
      if (project[key] === undefined) project[key] = "";
    });

    if (project.isDraft === undefined) project.isDraft = false;
    if (!Number.isFinite(project.cycleWeeks)) project.cycleWeeks = DEFAULT_CYCLE_WEEKS;

    ["cdpTools", "otherTools", "channels", "integrationRequirements",
      "accessRequired", "events", "userAttributes", "clientPocs", "team"].forEach((key) => {
      if (!Array.isArray(project[key])) project[key] = [];
    });

    project.clientPocs = project.clientPocs
      .map((poc) => ({ name: String(poc.name || "").trim(), email: poc.email || "", addedFrom: poc.addedFrom || "project" }))
      .filter((poc) => poc.name);

    if (!project.catalog) project.catalog = { feedUrl: "", format: "", frequency: "" };
    if (!project.dataRequirements) {
      project.dataRequirements = { historicalMigration: "", userIdentifier: "" };
    }
  });

  return targetState;
}

/* Must never throw. Embedded webviews (VS Code's Simple Browser, some IDE previews) run the
   page in a partitioned frame where setItem raises SecurityError; an unguarded throw here
   aborted app boot and took the rest of the app down with it. */
function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    scheduleCloudSave();
    return true;
  } catch (error) {
    debugLog(`saveState FAILED ${error.name}: ${error.message}`);
    showAppError(`Changes are not being saved — browser storage is blocked (${error.name}). Embedded previews such as the VS Code Simple Browser block it; open http://localhost:8000 in a normal browser tab.`);
    return false;
  }
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
        settings: (parsed.settings && typeof parsed.settings === "object") ? parsed.settings : null,
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
        weekTemplates: Array.isArray(parsed.weekTemplates) ? parsed.weekTemplates : null,
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

/* ---------- Ids ---------- */

/* crypto.randomUUID() only exists in secure contexts (https / localhost) and on newer
   browsers, so it is missing when the app is opened over a plain LAN address such as
   http://192.168.0.5:8000. Without a fallback every "save" silently throws. */
function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `id-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

/* ---------- Date / formatting helpers ---------- */

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

  if (normalized === "blocked") return "status-blocked";
  if (normalized === "delayed") return "status-delayed";
  if (normalized === "not-started") return "status-not-started";
  if (normalized === "in-progress") return "status-in-progress";
  if (normalized === "completed") return "status-on-track";
  if (normalized === "needs-attention") return "status-needs-attention";
  if (normalized === "closed") return "status-closed";
  if (normalized === "on-track") return "status-on-track";

  return "status-on-track";
}

function priorityClass(value) {
  const normalized = String(value || "medium").toLowerCase();
  if (normalized === "high") return "priority-high";
  if (normalized === "low") return "priority-low";
  return "priority-medium";
}

const SPA_LABELS = { yes: "Yes", no: "No" };
const TECH_TEAM_LABELS = { "in-house": "In-house" };

function buildIntegrationScopeHtml(project) {
  const platforms = project.platforms || [];
  const builtOn = project.builtOn || [];

  const rows = [
    ["Platform", platforms.map(platformLabel).join(", ")],
    ["Built On", builtOn.join(", ")],
    ["Platform Link(s)", project.platformLink],
    ["Website is SPA", project.isSpa ? (SPA_LABELS[project.isSpa] || project.isSpa) : ""],
    ["Technical Team", project.techTeam === "outsourced"
      ? `Outsourced${project.vendorName ? ` (${project.vendorName})` : ""}`
      : (project.techTeam ? (TECH_TEAM_LABELS[project.techTeam] || project.techTeam) : "")],
    ["Client POCs", (project.clientPocs || []).map(formatPoc).join(", ")],
    ["Channels", (project.channels || []).join(", ")],
    ["Historical Data Migration", project.dataRequirements && project.dataRequirements.historicalMigration === "yes" ? "Yes" : ""],
    ["User Identifier", project.dataRequirements ? project.dataRequirements.userIdentifier : ""],
    ["Known Blockers", project.knownBlockers],
    ["Dependencies", project.dependencies],
  ].filter(([, value]) => value);

  if (!rows.length) {
    return "";
  }

  return `
    <div class="detail-text" style="margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(148, 163, 184, 0.12);">
      <div><strong>Integration Scope</strong></div>
      ${rows.map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`).join("")}
    </div>
  `;
}

function formatStatus(value) {
  if (value === "current") {
    return "Ongoing";
  }

  if (value === "closed") {
    return "Completed";
  }

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

/* ---------- Add Project (5-step wizard) ---------- */

const WIZARD_NEXT_LABELS = {
  1: "Next: Platform Integration",
  2: "Next: Review & Summary",
  3: "Create Project",
};
const WIZARD_REVIEW_STEP = 3;
const WIZARD_CONFIRM_STEP = 4;

const ALL_PLATFORMS = ["Website", "Android", "iOS", "Web App", "REST API"];
const PLATFORM_SHORT = { "Website": "Web", "Android": "And", "iOS": "iOS", "Web App": "App", "REST API": "CRM" };
/* Display-only aliases. The stored platform value stays as the key, so template tags and
   saved projects are unaffected — only what the user reads changes. */
const PLATFORM_LABEL = { "REST API": "CRM" };

function platformLabel(name) {
  return PLATFORM_LABEL[name] || name;
}

const ALL_CHANNELS = ["Push", "Email", "SMS", "WhatsApp", "RCS", "IVR", "In-App", "Web Push", "On-site Notification"];

function field(id) {
  return document.getElementById(id);
}

function fieldValue(id) {
  const node = field(id);
  return node ? String(node.value).trim() : "";
}

function getCheckedValues(container) {
  if (!container) {
    return [];
  }

  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function getRadioValue(name) {
  const checked = nodes.addProjectForm.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function openAddProject() {
  debugLog("openAddProject() called");
  if (!requirePermission("project.create", "create projects")) return;
  uiState.returnScreen = uiState.screen === "add-project" ? uiState.returnScreen : uiState.screen;
  uiState.screen = "add-project";
  uiState.wizardStep = 1;
  uiState.wizardSavedId = null;

  /* Reveal the screen before touching the form, so a failure while resetting the wizard
     can never leave the button looking dead. */
  renderAll();
  safeRender(resetWizardForm);
  nodes.addProjectScreen.scrollIntoView({ behavior: "smooth", block: "start" });
  debugLog(`add-project screen hidden=${nodes.addProjectScreen.hidden}`);
}

function resetWizardForm() {
  nodes.addProjectForm.reset();
  showWizardError("");
  nodes.npPocList.innerHTML = "";
  addPocRow();
  syncWizardConditionalFields();
  renderWizardStep();
}

function handleWizardChange(event) {
  const target = event.target;

  if (target.id === "npTechTeam") {
    syncWizardConditionalFields();
  }



  renderWizardSummary();
}


function syncWizardConditionalFields() {
  nodes.npVendorNameField.hidden = fieldValue("npTechTeam") !== "outsourced";
}

/* ---- Step 3 repeatable rows ---- */

function addPocRow(poc = {}) {
  const row = document.createElement("div");
  row.className = "detail-row poc-row";
  row.innerHTML = `
    <input type="text" data-key="name" placeholder="Name (e.g. Apoorv)" />
    <input type="text" data-key="email" placeholder="Email (optional)" />
    <button type="button" class="row-remove">Remove</button>
  `;
  row.querySelector("[data-key='name']").value = poc.name || "";
  row.querySelector("[data-key='email']").value = poc.email || "";
  row.querySelector(".row-remove").addEventListener("click", () => {
    row.remove();
    renderWizardSummary();
  });
  nodes.npPocList.append(row);
}



function collectRows(container, keys) {
  return [...container.querySelectorAll(".detail-row")]
    .map((row) => {
      const entry = {};
      keys.forEach((key) => {
        entry[key] = row.querySelector(`[data-key="${key}"]`).value.trim();
      });
      return entry;
    })
    .filter((entry) => keys.some((key) => entry[key]));
}

/* ---- Navigation ---- */

function handleWizardSubmit(event) {
  event.preventDefault();
  showWizardError("");

  /* A throw in here used to leave the button looking dead, with the reason only in the
     console — surface it instead so a failed save is never silent. */
  try {
    if (uiState.wizardStep === WIZARD_REVIEW_STEP) {
      saveProject({ asDraft: false });
      return;
    }

    goToWizardStep(uiState.wizardStep + 1);
  } catch (error) {
    showWizardError(`Could not continue: ${error.message}`);
    throw error;
  }
}

function showWizardError(message) {
  nodes.npError.textContent = message;
  nodes.npError.hidden = !message;
}

function goToWizardStep(step) {
  const target = Math.min(Math.max(step, 1), WIZARD_CONFIRM_STEP);

  if (target > uiState.wizardStep && !validateWizardUpTo(target)) {
    return;
  }

  uiState.wizardStep = target;
  renderWizardStep();
  nodes.addProjectScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

function validateWizardUpTo(target) {
  const nameField = field("npName");
  nameField.classList.remove("field-error");

  if (target > 1 && !nameField.value.trim()) {
    uiState.wizardStep = 1;
    renderWizardStep();
    nameField.classList.add("field-error");
    nameField.focus();
    return false;
  }

  return true;
}

function renderWizardStep() {
  const step = uiState.wizardStep;

  nodes.addProjectForm.querySelectorAll(".wizard-panel").forEach((panel) => {
    panel.hidden = Number(panel.dataset.panel) !== step;
  });

  nodes.wizardSteps.querySelectorAll(".wizard-step").forEach((item) => {
    const value = Number(item.dataset.step);
    item.classList.toggle("active", value === step);
    item.classList.toggle("done", value < step);
  });

  const onConfirm = step === WIZARD_CONFIRM_STEP;
  nodes.npNav.hidden = onConfirm;
  nodes.npSummaryPanel.hidden = onConfirm;
  nodes.npBack.hidden = step === 1;
  nodes.npNext.textContent = WIZARD_NEXT_LABELS[step] || "Next";
  nodes.npProgress.textContent = `Step ${step} of ${WIZARD_CONFIRM_STEP}`;

  if (step === WIZARD_REVIEW_STEP) {
    renderWizardReview();
  }

  renderWizardSummary();
}

/* ---- Data collection ---- */

function collectWizardData() {
  const platforms = getCheckedValues(nodes.npPlatforms);
  const techTeam = fieldValue("npTechTeam");

  return {
    name: fieldValue("npName"),
    status: "current", /* new projects are always Ongoing; closed via the project page */
    notes: fieldValue("npNotes"),
    csm: fieldValue("npCsm"),
    implementationOwner: fieldValue("npImplOwner"),
    clientPocs: collectRows(nodes.npPocList, ["name", "email"]),
    team: [],
    salesOwner: fieldValue("npSalesOwner"),
    kickoffDate: fieldValue("npKickoffDate"),
    goLiveDate: computeGoLiveDate(fieldValue("npKickoffDate"), Number(fieldValue("npCycleWeeks")) || DEFAULT_CYCLE_WEEKS),
    cycleWeeks: Number(fieldValue("npCycleWeeks")) || DEFAULT_CYCLE_WEEKS,
    techTeam,
    vendorName: techTeam === "outsourced" ? fieldValue("npVendorName") : "",

    platforms,
    platformLink: fieldValue("npPlatformLink"),

    channels: getCheckedValues(field("npChannels")),

    dataRequirements: {
      historicalMigration: getRadioValue("npHistorical"),
      userIdentifier: fieldValue("npUserIdentifier"),
    },


    additionalComments: fieldValue("npAdditionalComments"),


    /* legacy fields kept so older projects keep rendering */
    builtOn: [],
    isSpa: "",
    crmTool: "",
  };
}

/* ---- Summary sidebar ---- */


function formatPoc(poc) {
  return poc.name;
}

/* Feeds the <datalist> behind every task/subtask owner field: the selected project's client
   POCs first, then any owner already used elsewhere, so past entries stay one keystroke away.
   It is a suggestion list, not a dropdown — free text is still allowed. */
/* Strictly project-scoped: only the selected project's POCs are offered, never names from
   other projects. Typing a name not on the list is allowed and adds them to this project
   on save (see syncOwnersIntoProjectPocs). */
function refreshOwnerOptions(projectId) {
  const list = document.getElementById("ownerOptions");
  if (!list) return;

  const project = state.projects.find((item) => item.id === projectId);
  const team = project ? (project.team || []).map((member) => member.name).filter(Boolean) : [];
  const pocs = project ? (project.clientPocs || []).map(formatPoc).filter(Boolean) : [];

  list.innerHTML = [...new Set([...team, ...pocs])]
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join("");
}

function summaryRow(label, value) {
  return `<div class="summary-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`;
}

function renderWizardSummary() {
  if (uiState.screen !== "add-project") return;

  const data = collectWizardData();
  const platformLines = ALL_PLATFORMS.map((platform) => {
    const detail = data.platforms.includes(platform) ? "Selected" : "Not Selected";
    return `<div class="summary-row"><dt>${escapeHtml(platformLabel(platform))}</dt><dd>${escapeHtml(detail)}</dd></div>`;
  }).join("") + (data.platformLink ? summaryRow("Platform Link(s)", data.platformLink) : "");



  const channelChips = ALL_CHANNELS
    .map((channel) => `<span class="summary-chip${data.channels.includes(channel) ? "" : " off"}">${escapeHtml(channel)}</span>`)
    .join("");

  nodes.npSummary.innerHTML = `
    <div class="summary-group">
      ${summaryGroupHead("Basic Details", 1)}
      ${summaryRow("Project Name", data.name)}
      ${summaryRow("CSM", data.csm)}
      ${summaryRow("Project Owner", data.implementationOwner)}
      ${summaryRow("Client POCs", data.clientPocs.map(formatPoc).join(", "))}
      ${summaryRow("Sales Owner", data.salesOwner)}
      ${summaryRow("Kickoff Date", formatSummaryDate(data.kickoffDate))}
      ${summaryRow("Target Go-Live Date", formatSummaryDate(data.goLiveDate))}
    </div>
    <div class="summary-group">
      ${summaryGroupHead("Selected Platforms", 2)}
      ${platformLines}
    </div>
    <div class="summary-group">
      ${summaryGroupHead("Channels", 2)}
      <div class="summary-chips">${channelChips}</div>
    </div>
  `;
}

function summaryGroupHead(title, step) {
  return `<div class="summary-group-head"><span class="summary-group-title">${escapeHtml(title)}</span><button type="button" class="summary-edit" data-goto-step="${step}">Edit</button></div>`;
}

function formatSummaryDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

/* ---- Review step ---- */

function reviewGroup(title, step, pairs) {
  const rows = pairs
    .filter(([, value]) => value)
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`)
    .join("");

  if (!rows) return "";

  return `
    <div class="review-group">
      <div class="summary-group-head">
        <h4>${escapeHtml(title)}</h4>
        <button type="button" class="summary-edit" data-goto-step="${step}">Edit</button>
      </div>
      <div class="review-grid">${rows}</div>
    </div>
  `;
}

function renderWizardReview() {
  const data = collectWizardData();
  const yesNo = (value) => (value === "yes" ? "Yes" : value === "no" ? "No" : "");


  const blocks = [
    reviewGroup("Basic Details", 1, [
      ["Project Name", data.name],
      ["CSM", data.csm],
      ["Project Owner", data.implementationOwner],
      ["Client POCs", data.clientPocs.map(formatPoc).join(", ")],
      ["Sales Owner", data.salesOwner],
      ["Kickoff Date", formatSummaryDate(data.kickoffDate)],
      ["Target Go-Live Date", formatSummaryDate(data.goLiveDate)],
      ["Technical Team", data.techTeam === "outsourced" ? `Outsourced${data.vendorName ? ` (${data.vendorName})` : ""}` : "In-house"],
      ["Notes", data.notes],
    ]),
    reviewGroup("Platforms", 2, [
      ["Platforms", data.platforms.map(platformLabel).join(", ")],
      ["Platform Link(s)", data.platformLink],
    ]),
    reviewGroup("Channels", 2, [
      ["Channels", data.channels.join(", ")],
    ]),
    reviewGroup("Data Requirements", 2, [
      ["Historical Data Migration", yesNo(data.dataRequirements.historicalMigration)],
      ["User Identifier", data.dataRequirements.userIdentifier],
    ]),
    reviewGroup("Additional Comments", 2, [
      ["Comments", data.additionalComments],
    ]),
  ].filter(Boolean).join("");

  nodes.npReviewBody.innerHTML = blocks || `<p class="muted">Nothing captured yet — go back and fill in the earlier steps.</p>`;
  nodes.npReviewBody.querySelectorAll("[data-goto-step]").forEach((button) => {
    button.addEventListener("click", () => goToWizardStep(Number(button.dataset.gotoStep)));
  });
}

/* ---- Save ---- */

function saveProject({ asDraft } = { asDraft: false }) {
  const data = collectWizardData();

  if (!data.name) {
    uiState.wizardStep = 1;
    renderWizardStep();
    const nameField = field("npName");
    nameField.classList.add("field-error");
    nameField.focus();
    return;
  }

  const newProject = {
    id: newId(),
    ...data,
    isDraft: Boolean(asDraft),
    createdAt: new Date().toISOString(),
  };

  state.projects.push(newProject);
  const createdWeeks = generateWeeklyPlan(newProject);
  refreshProjectGoLive(newProject.id);
  saveState();
  uiState.wizardSavedId = newProject.id;

  if (asDraft) {
    openProject(newProject.id);
    return;
  }

  nodes.npConfirmTitle.textContent = `${newProject.name} created`;
  nodes.npConfirmText.textContent = `${createdWeeks} weekly report${createdWeeks === 1 ? "" : "s"} were pre-created from the master template. Open the project to fill in status, owners and dates week by week.`;
  uiState.wizardStep = WIZARD_CONFIRM_STEP;
  renderWizardStep();
  renderAll();
}

/* ---------- Templates screen (editable master plan) ---------- */

function openTemplates() {
  uiState.screen = "templates";
  uiState.activeNav = "templates";
  renderAll();
}

function renderTemplatesScreen() {
  if (!nodes.templatesList) return;

  nodes.templatesList.innerHTML = state.weekTemplates
    .slice()
    .sort((left, right) => left.week - right.week)
    .map((entry) => renderTemplateWeek(entry))
    .join("") || `<p class="muted">No weeks defined. Use “+ Add week” to start.</p>`;
}

function renderTemplateWeek(entry) {
  const rows = entry.tasks.map((task) => `
    <div class="template-row" data-week="${entry.week}" data-task="${task.id}">
      <input type="text" data-field="scope" value="${escapeHtml(task.scope)}" placeholder="Integration scope" />
      <input type="text" data-field="title" value="${escapeHtml(task.title)}" placeholder="Task / milestone" />
      <div class="platform-chips">
        ${ALL_PLATFORMS.map((platform) => `
          <label class="platform-chip" title="${escapeHtml(platformLabel(platform))}">
            <input type="checkbox" data-platform="${escapeHtml(platform)}"${(task.platforms || []).includes(platform) ? " checked" : ""} />
            <span>${escapeHtml(PLATFORM_SHORT[platform])}</span>
          </label>`).join("")}
      </div>
      <select data-field="priority">
        ${TEMPLATE_PRIORITIES.map((value) => `<option value="${value}"${task.priority === value ? " selected" : ""}>${capitalize(value)}</option>`).join("")}
      </select>
      <input type="number" min="1" data-field="days" value="${task.days || ""}" placeholder="Days" title="Days to complete in a ${templateBaseCycle()}-week cycle" />
      <input type="text" data-field="daysByCycle" value="${escapeHtml(formatDaysByCycle(task.daysByCycle))}" placeholder="7:10, 8:14" title="Per-cycle overrides — cycle:days, comma separated" />
      <button type="button" class="row-remove" data-requires="template.edit" data-action="remove-task">Remove</button>
    </div>
  `).join("");

  return `
    <section class="template-week" data-week="${entry.week}">
      <header class="template-week-head">
        <span class="template-week-badge">Week ${entry.week}</span>
        <input type="text" class="template-week-label" data-field="label" value="${escapeHtml(entry.label)}" placeholder="Week label" />
        <span class="muted">${entry.tasks.length} task${entry.tasks.length === 1 ? "" : "s"}</span>
        <button type="button" class="ghost-button small-button" data-requires="template.edit" data-action="add-task">+ Task</button>
        <button type="button" class="row-remove" data-requires="template.edit" data-action="remove-week">Delete week</button>
      </header>
      <div class="template-rows">${rows || `<p class="muted">No tasks yet.</p>`}</div>
    </section>
  `;
}

/* "7:10, 8:14" <-> { "7": 10, "8": 14 } — a compact way to edit per-cycle overrides in a
   single cell rather than one column per cycle length. */
function formatDaysByCycle(map) {
  return Object.entries(map || {})
    .sort((left, right) => Number(left[0]) - Number(right[0]))
    .map(([cycle, days]) => `${cycle}:${days}`)
    .join(", ");
}

function parseDaysByCycle(text) {
  const out = {};
  String(text || "").split(",").forEach((pair) => {
    const [cycle, days] = pair.split(":").map((part) => part.trim());
    if (Number(cycle) > 0 && Number(days) > 0) out[String(Number(cycle))] = Number(days);
  });
  return out;
}

function findTemplateWeek(week) {
  return state.weekTemplates.find((entry) => entry.week === Number(week));
}

function handleTemplatesInput(event) {
  if (event.target.dataset.platform) {
    handleTemplatePlatformToggle(event.target);
    return;
  }

  const field = event.target.dataset.field;
  if (!field) return;

  const weekEl = event.target.closest(".template-week");
  const entry = findTemplateWeek(weekEl.dataset.week);
  if (!entry) return;

  if (field === "label") {
    entry.label = event.target.value;
    saveState();
    return;
  }

  const rowEl = event.target.closest(".template-row");
  const task = entry.tasks.find((item) => item.id === rowEl.dataset.task);
  if (!task) return;

  if (field === "days") {
    task.days = Number(event.target.value) > 0 ? Number(event.target.value) : null;
  } else if (field === "daysByCycle") {
    task.daysByCycle = parseDaysByCycle(event.target.value);
  } else {
    task[field] = event.target.value;
  }

  saveState();
}

function handleTemplatePlatformToggle(input) {
  const entry = findTemplateWeek(input.closest(".template-week").dataset.week);
  if (!entry) return;

  const rowEl = input.closest(".template-row");
  const task = entry.tasks.find((item) => item.id === rowEl.dataset.task);
  if (!task) return;

  const chosen = [...rowEl.querySelectorAll("[data-platform]")]
    .filter((box) => box.checked)
    .map((box) => box.dataset.platform);

  task.platforms = chosen.length === ALL_PLATFORMS.length ? [] : chosen;
  saveState();
}

function handleTemplatesClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (!requirePermission("template.edit", "edit the master template")) return;

  const weekEl = button.closest(".template-week");
  const entry = findTemplateWeek(weekEl.dataset.week);
  if (!entry) return;

  const action = button.dataset.action;

  if (action === "add-task") {
    entry.tasks.push({ id: newId(), scope: "", title: "", owner: "", priority: "medium", platforms: [], days: null, daysByCycle: {} });
  } else if (action === "remove-task") {
    const rowEl = button.closest(".template-row");
    const task = entry.tasks.find((item) => item.id === rowEl.dataset.task);
    if (task && !confirm(`Remove “${task.title || "this task"}” from Week ${entry.week}? This cannot be undone.`)) return;
    entry.tasks = entry.tasks.filter((item) => item.id !== rowEl.dataset.task);
  } else if (action === "remove-week") {
    if (!confirm(`Delete Week ${entry.week} and its ${entry.tasks.length} task(s) from the master plan?`)) return;
    state.weekTemplates = state.weekTemplates.filter((item) => item.week !== entry.week);
    state.weekTemplates.forEach((item, index) => { item.week = index + 1; });
  }

  saveState();
  renderTemplatesScreen();
}

function addTemplateWeek() {
  if (!requirePermission("template.edit", "edit the master template")) return;
  const nextWeek = state.weekTemplates.length + 1;
  state.weekTemplates.push({ week: nextWeek, label: `Week ${nextWeek}`, tasks: [] });
  saveState();
  renderTemplatesScreen();
}

function toTemplateWeeks(weeks) {
  return weeks.map((week, index) => ({
    week: Number(week.week) || index + 1,
    label: week.label || `Week ${index + 1}`,
    tasks: (week.tasks || []).map((task) => ({
      id: newId(),
      scope: task.scope || "",
      title: task.title || "",
      owner: task.owner || "",
      priority: TEMPLATE_PRIORITIES.includes(task.priority) ? task.priority : "medium",
      platforms: Array.isArray(task.platforms) ? task.platforms : [],
      days: Number(task.days) > 0 ? Number(task.days) : null,
      daysByCycle: (task.daysByCycle && typeof task.daysByCycle === "object") ? task.daysByCycle : {},
    })),
  }));
}

/* The master plan ships as ./week-templates.json next to index.html so it can be edited
   without touching code. WEEK_TEMPLATE_SEED stays as the fallback for file:// use, where
   fetch of a local JSON file is blocked. */
/* The standalone single-file build inlines every data file into window.__BUNDLED_DATA__,
   so the app runs from disk with no server and no fetch. Served normally, this is absent
   and the files are fetched as usual. */
function bundled(key) {
  const data = window.__BUNDLED_DATA__;
  return data && data[key] ? data[key] : null;
}

async function fetchSeedTemplates() {
  const inlined = bundled("weekTemplates");
  if (inlined) {
    if (!Array.isArray(inlined.weeks) || !inlined.weeks.length) {
      throw new Error("bundled week templates are empty");
    }
    templateMeta = { baseCycleWeeks: inlined.baseCycleWeeks, defaultTaskDays: inlined.defaultTaskDays };
    return inlined.weeks;
  }

  const response = await fetch("./week-templates.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  if (!Array.isArray(data.weeks) || !data.weeks.length) {
    throw new Error("week-templates.json has no 'weeks' array");
  }

  templateMeta = { baseCycleWeeks: data.baseCycleWeeks, defaultTaskDays: data.defaultTaskDays };
  return data.weeks;
}

async function seedTemplatesFromFile({ silent } = {}) {
  try {
    const weeks = await fetchSeedTemplates();
    state.weekTemplates = toTemplateWeeks(weeks);
    saveState();
    renderTemplatesScreen();
    debugLog(`templates seeded from week-templates.json (${state.weekTemplates.length} weeks)`);
    if (!silent) showAppSuccess(`Master plan reloaded from week-templates.json — ${state.weekTemplates.length} weeks, ${state.weekTemplates.reduce((total, week) => total + week.tasks.length, 0)} tasks.`);
    return true;
  } catch (error) {
    debugLog(`week-templates.json load failed: ${error.message}`);
    if (!silent) showAppError(`Could not read week-templates.json (${error.message}). Falling back to the plan built into the app.`);
    return false;
  }
}

function reloadTemplatesFromFile() {
  if (!requirePermission("template.edit", "edit the master template")) return;
  if (!confirm("Replace the master plan with the contents of week-templates.json? Your edits on this screen will be lost.")) return;
  seedTemplatesFromFile({ silent: false });
}

function resetTemplatesToDefault() {
  if (!requirePermission("template.edit", "edit the master template")) return;
  if (!confirm("Replace the master plan with the default week-wise template built into the app? Your edits here will be lost.")) return;

  state.weekTemplates = toTemplateWeeks(WEEK_TEMPLATE_SEED);
  saveState();
  renderTemplatesScreen();
}

/* ---------- Demo data ---------- */

/* Datasets live in ./demo-data/, listed by demo-data/index.json. Drop another JSON file in
   there and add it to that index to offer a second demo. Nothing loads automatically —
   the app starts empty and you pick a demo from Settings. */
async function listDemoData() {
  const inlined = bundled("demoIndex");
  if (inlined) {
    return Array.isArray(inlined.demos) ? inlined.demos : [];
  }

  const response = await fetch("./demo-data/index.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  return Array.isArray(data.demos) ? data.demos : [];
}

async function renderDemoDataOptions() {
  if (!nodes.settingsDemoSelect) return;

  try {
    const demos = await listDemoData();
    nodes.settingsDemoSelect.innerHTML = demos
      .map((demo) => `<option value="${escapeHtml(demo.file)}">${escapeHtml(demo.name)}</option>`)
      .join("");
    nodes.settingsDemoNote.textContent = demos.length
      ? (demos.find((demo) => demo.file === nodes.settingsDemoSelect.value) || demos[0]).description || ""
      : "No demo datasets found in demo-data/.";
    uiState.demoCatalog = demos;
  } catch (error) {
    nodes.settingsDemoSelect.innerHTML = "";
    nodes.settingsDemoNote.textContent = `Could not read demo-data/index.json (${error.message}).`;
  }
}

function describeSelectedDemo() {
  const demos = uiState.demoCatalog || [];
  const match = demos.find((demo) => demo.file === nodes.settingsDemoSelect.value);
  nodes.settingsDemoNote.textContent = match ? (match.description || "") : "";
}

async function loadDemoData(file) {
  if (!file) return;

  try {
    const demos = bundled("demos");
    let data = demos ? demos[file] : null;

    if (!data) {
      const response = await fetch(`./demo-data/${file}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    }

    if (!data.project || !Array.isArray(data.weeks)) {
      throw new Error("missing 'project' or 'weeks'");
    }

    const project = {
      ...data.project,
      id: newId(),
      isDraft: false,
      createdAt: new Date().toISOString(),
    };

    /* Appended, never replacing — loading a demo must not touch real projects. */
    state.projects.push(ensureDemoProjectShape(project));

    data.weeks.forEach((week, index) => {
      state.updates.push({
        id: newId(),
        projectId: project.id,
        projectName: project.name,
        weekStart: week.weekStart,
        weekRange: formatWeekRange(week.weekStart),
        statusTag: week.statusTag || "not started",
        fromTemplate: true,
        templateWeek: week.templateWeek || index + 1,
        templateLabel: week.templateLabel || `Week ${index + 1}`,
        tasks: (week.tasks || []).map((task) => ({
          id: newId(),
          title: task.title || "",
          phase: task.phase || "",
          owner: task.owner || "",
          status: task.status || "not started",
          date: task.date || "",
          blocker: task.blocker || "",
          priority: task.priority || "medium",
          comments: task.comments || "",
          subtasks: [],
        })),
        createdAt: new Date().toISOString(),
      });
    });

    state = ensureDefaults(state);
    saveState();
    openProject(project.id);
    showAppSuccess(`Loaded demo “${project.name}”: ${data.weeks.length} weeks, ${data.weeks.reduce((total, week) => total + (week.tasks || []).length, 0)} tasks. Delete it like any other project.`);
  } catch (error) {
    showAppError(`Could not load demo (${error.message}).`);
  }
}

function ensureDemoProjectShape(project) {
  if (!Array.isArray(project.clientPocs)) project.clientPocs = [];
  if (!Array.isArray(project.team)) project.team = [];
  if (!Number.isFinite(project.cycleWeeks)) project.cycleWeeks = DEFAULT_CYCLE_WEEKS;
  return project;
}



/* ---------- RBAC ---------- */

/* Four roles, each a superset of the one below it. The matrix is the single source of
   truth: UI gating and the action guards both read from it, so a capability can never be
   hidden in one place and left open in another.

   Client-side checks are convenience, not security — anything that must be enforced is
   also enforced by row-level security and the SECURITY DEFINER functions in
   supabase/schema.sql. */
function currentRole() {
  const role = String(state.settings.role || "").toLowerCase();
  return ROLES.includes(role) ? role : "admin";
}

function can(permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return true;
  return allowed.includes(currentRole());
}

/* Guard for the action itself, so a hidden button is not the only thing stopping it. */
function requirePermission(permission, what) {
  if (can(permission)) return true;
  showAppInfo(`Your role (${ROLE_LABELS[currentRole()]}) cannot ${what}.`);
  return false;
}

/* Hides or disables anything tagged with data-requires="<permission>". */
function applyRolePermissions() {
  document.querySelectorAll("[data-requires]").forEach((element) => {
    const allowed = can(element.dataset.requires);
    if (element.dataset.requiresMode === "disable") {
      element.disabled = !allowed;
      element.title = allowed ? "" : `Not available for the ${ROLE_LABELS[currentRole()]} role`;
    } else {
      element.hidden = !allowed;
    }
  });

  /* The Templates screen is fully editable or fully read-only. */
  const editable = can("template.edit");
  document.querySelectorAll("#templatesList input, #templatesList select").forEach((field) => {
    field.disabled = !editable;
  });
}

async function loadRolesConfig() {
  const inlined = bundled("rolesConfig");
  if (inlined) {
    rolesConfig = { ...rolesConfig, ...inlined };
    return;
  }

  try {
    const response = await fetch("./roles-config.json", { cache: "no-store" });
    if (response.ok) rolesConfig = { ...rolesConfig, ...(await response.json()) };
  } catch (error) {
    debugLog(`roles-config.json not readable: ${error.message}`);
  }
}

function isAllowedEmail(email) {
  const domain = String(rolesConfig.allowedDomain || "").toLowerCase().trim();
  if (!domain) return true;
  return String(email || "").toLowerCase().trim().endsWith(`@${domain}`);
}

/* Config stores firstName and lastName separately; `name` is still read so older config
   files keep working. */
function userDisplayName(user, email) {
  const joined = [user && user.firstName, user && user.lastName].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  if (user && user.name) return user.name;

  const local = String(email || "").split("@")[0];
  return local.split(/[._-]+/).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || local;
}

function findConfiguredUser(email) {
  const wanted = String(email || "").toLowerCase().trim();
  return (rolesConfig.users || []).find((user) => String(user.email).toLowerCase().trim() === wanted) || null;
}

/* SHA-256 of the typed password, compared against the hash in roles-config.json so no
   plaintext password is ever stored in the repo. */
async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function passwordProblems(password) {
  const policy = rolesConfig.passwordPolicy || {};
  const problems = [];
  if (password.length < (policy.minLength || 10)) problems.push(`at least ${policy.minLength || 10} characters`);
  if (policy.requireUppercase && !/[A-Z]/.test(password)) problems.push("an uppercase letter");
  if (policy.requireLowercase && !/[a-z]/.test(password)) problems.push("a lowercase letter");
  if (policy.requireNumber && !/[0-9]/.test(password)) problems.push("a number");
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) problems.push("a symbol");
  return problems;
}

function describePasswordPolicy() {
  const policy = rolesConfig.passwordPolicy || {};
  const parts = [`${policy.minLength || 10}+ characters`];
  if (policy.requireUppercase) parts.push("uppercase");
  if (policy.requireLowercase) parts.push("lowercase");
  if (policy.requireNumber) parts.push("number");
  if (policy.requireSymbol) parts.push("symbol");
  return `Password must have ${parts.join(", ")}.`;
}

/* ---------- Demo sign-in ---------- */

/* Identifies the person so the app can pick their role. Deliberately not a security
   control: there is no password and no server, so anyone who can open the page can type
   any address. It exists so an internal demo shows the right view per person. */
const SESSION_KEY = "multi-project-dashboard-session";

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    debugLog(`could not store session: ${error.message}`);
  }
}

/* A stored session is only honoured while it still matches roles-config.json. Reset
   someone's password, change their role or remove them, and their session stops working
   on their next load — otherwise a reset would not actually lock anyone out. */
function startSession() {
  if (rolesConfig.requireLogin === false) return;

  const session = loadSession();
  const user = session ? findConfiguredUser(session.email) : null;

  if (session && user && isAllowedEmail(session.email) && session.fingerprint === passwordFingerprint(user)) {
    applySession({ ...session, role: ROLES.includes(user.role) ? user.role : "viewer", name: userDisplayName(user, session.email) });
    return;
  }

  if (session) {
    debugLog("stored session no longer matches roles-config.json - signing out");
    try { localStorage.removeItem(SESSION_KEY); } catch (error) { /* ignore */ }
  }

  showAuthOverlay();
}

function passwordFingerprint(user) {
  return String(user && user.passwordHash ? user.passwordHash : "").slice(0, 12);
}

function applySession(session) {
  currentSession = session;
  state.settings.role = session.role;
  state.settings.displayName = session.name;
  saveState();
  nodes.authOverlay.hidden = true;
  renderAll();
  debugLog(`session: ${session.email} (${session.role})`);
}

async function handleEmailSignIn(event) {
  event.preventDefault();
  showAuthError("");

  const email = nodes.authEmail.value.trim().toLowerCase();
  const password = nodes.authPassword.value;

  if (!isAllowedEmail(email)) {
    showAuthError(`Use a @${rolesConfig.allowedDomain} address. Access is limited to the internal team.`);
    return;
  }

  const problems = passwordProblems(password);
  if (problems.length) {
    showAuthError(`Password needs ${problems.join(", ")}.`);
    return;
  }

  const user = findConfiguredUser(email);

  let digest;
  try {
    digest = await hashPassword(password);
  } catch (error) {
    showAuthError("This browser cannot hash passwords here — open the app over http://localhost or https.");
    return;
  }

  /* Same message either way, so the form does not reveal which addresses exist. */
  if (!user || user.passwordHash !== digest) {
    showAuthError("That email and password do not match.");
    nodes.authPassword.value = "";
    return;
  }

  const session = {
    email,
    fingerprint: passwordFingerprint(user),
    role: ROLES.includes(user.role) ? user.role : "viewer",
    name: userDisplayName(user, email),
    signedInAt: new Date().toISOString(),
  };

  nodes.authPassword.value = "";
  saveSession(session);
  applySession(session);
}

function signOutSession() {
  if (!confirm("Sign out? Your projects stay in this browser.")) return;

  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    debugLog(`could not clear session: ${error.message}`);
  }

  currentSession = null;
  nodes.authEmail.value = "";
  showAuthOverlay();
}

/* No server means no reset email and no way to write roles-config.json from the browser.
   The next best thing: verify the current password, enforce the policy on the new one, and
   hand over the hash to paste in. */
async function handlePasswordChange(event) {
  event.preventDefault();
  nodes.pwError.hidden = true;
  nodes.pwResult.hidden = true;

  if (!currentSession) {
    showPasswordError("Sign in first.");
    return;
  }

  const user = findConfiguredUser(currentSession.email);
  if (!user) {
    showPasswordError("Your account is not in roles-config.json.");
    return;
  }

  const current = await hashPassword(nodes.pwCurrent.value);
  if (current !== user.passwordHash) {
    showPasswordError("Current password is wrong.");
    return;
  }

  const next = nodes.pwNew.value;
  const problems = passwordProblems(next);
  if (problems.length) {
    showPasswordError(`New password needs ${problems.join(", ")}.`);
    return;
  }

  if (next !== nodes.pwConfirm.value) {
    showPasswordError("The two new passwords do not match.");
    return;
  }

  if (next === nodes.pwCurrent.value) {
    showPasswordError("The new password is the same as the current one.");
    return;
  }

  nodes.pwHash.value = await hashPassword(next);
  nodes.pwResultEmail.textContent = currentSession.email;
  nodes.pwResult.hidden = false;
  nodes.passwordForm.reset();
  nodes.pwHash.select();
}

function showPasswordError(message) {
  nodes.pwError.textContent = message;
  nodes.pwError.hidden = false;
}

/* ---------- Users & Roles (admin) ---------- */

function renderRolesPanel() {
  if (!nodes.settingsRoles) return;

  if (!can("users.manage")) {
    nodes.settingsRoles.innerHTML = "";
    return;
  }

  const users = rolesConfig.users || [];

  const myEmail = currentSession ? String(currentSession.email).toLowerCase() : "";

  nodes.settingsRoles.innerHTML = `
    <p class="muted" style="margin-bottom:10px;">
      ${users.length} account(s), from <code>roles-config.json</code>. Change a role below and the
      updated <code>users</code> block appears underneath — paste it back into the file, commit and
      push. There is no server, so the browser cannot save it for you.
    </p>
    <div class="row-list" style="margin-bottom:12px;">
      ${users.map((user, index) => {
        const isSelf = String(user.email).toLowerCase() === myEmail;
        return `
        <div class="detail-row poc-row">
          <div>
            <div style="font-weight:700;">${escapeHtml(userDisplayName(user, user.email))}${isSelf ? ` <span class="meta">(you)</span>` : ""}</div>
            <div class="meta">${escapeHtml(user.email)}</div>
          </div>
          <select data-role-index="${index}"${isSelf ? " disabled title='You cannot change your own role'" : ""}>
            ${ROLES.map((role) => `<option value="${role}"${user.role === role ? " selected" : ""}>${ROLE_LABELS[role]}</option>`).join("")}
          </select>
        </div>`;
      }).join("") || `<p class="muted">No users configured.</p>`}
    </div>
    <div id="rolesDiff" hidden>
      <p class="storage-warning" style="margin-bottom:8px;">
        <strong>Not saved yet.</strong> Paste this over the <code>users</code> array in
        <code>roles-config.json</code>, then commit and push. Anyone whose role changed picks it up
        on their next load.
      </p>
      <textarea class="report-html-source" id="rolesJson" readonly style="min-height:150px;"></textarea>
    </div>

    <h4 class="settings-subhead">Add a user, or reset a password</h4>
    <p class="muted" style="font-size:0.82rem;margin-bottom:10px;">
      Produces the entry to paste into <code>roles-config.json</code>. For an existing user, replace
      just their <code>passwordHash</code>; for a new one, paste the whole block into
      <code>users</code>. Commit and push to make it live.
    </p>
    <form class="password-form" id="resetForm">
      <label>User email<input type="email" id="resetEmail" required placeholder="name@${escapeHtml(rolesConfig.allowedDomain)}" /></label>
      <label>First name<input type="text" id="resetFirst" placeholder="e.g. Neha" /></label>
      <label>Last name<input type="text" id="resetLast" placeholder="e.g. Sharma" /></label>
      <label>Role
        <select id="resetRole">
          ${ROLES.map((role) => `<option value="${role}"${role === "viewer" ? " selected" : ""}>${ROLE_LABELS[role]}</option>`).join("")}
        </select>
      </label>
      <label>Password
        <input type="text" id="resetPassword" required placeholder="Type one, or generate" />
      </label>
      <div class="actions">
        <button type="button" id="resetSuggest" class="ghost-button small-button">Suggest strong password</button>
        <button type="submit" class="secondary-button">Add entry</button>
      </div>
    </form>
    <p class="auth-error" id="resetError" hidden></p>
    <div id="resetResult" hidden>
      <p class="muted" style="font-size:0.82rem;margin:10px 0 6px;">
        Entry for <strong id="resetResultEmail"></strong> — paste into <code>roles-config.json</code>:
      </p>
      <textarea class="report-html-source" id="resetHash" readonly style="min-height:110px;"></textarea>
      <p class="storage-warning" style="margin-top:10px;">
        Share this password with them directly (Slack DM or a password manager) — it is not
        recoverable from the hash, and this is the only time it is shown.
        <strong id="resetPlain" style="display:block;margin-top:6px;font-family:ui-monospace,Menlo,monospace;"></strong>
      </p>
    </div>`;

  nodes.settingsRoles.querySelectorAll("[data-role-index]").forEach((select) => {
    select.addEventListener("change", () => {
      const index = Number(select.dataset.roleIndex);
      if (rolesConfig.users[index]) rolesConfig.users[index].role = select.value;
      showRolesJson();
    });
  });

  const form = document.getElementById("resetForm");
  if (form) form.addEventListener("submit", (event) => handleAdminReset(event));

  const suggest = document.getElementById("resetSuggest");
  if (suggest) suggest.addEventListener("click", () => {
    document.getElementById("resetPassword").value = suggestPassword();
  });
}

/* A password that satisfies the policy by construction, so an admin never has to invent
   one. crypto.getRandomValues, not Math.random. */
function suggestPassword() {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%^&*?",
  ];
  const all = groups.join("");
  /* Exactly the policy minimum — two characters from each required group, the rest random. */
  const target = Math.max(rolesConfig.passwordPolicy?.minLength || 10, groups.length * 2);
  const pick = (set, count) => {
    const values = crypto.getRandomValues(new Uint32Array(count));
    return [...values].map((value) => set[value % set.length]);
  };

  const chars = groups.flatMap((group) => pick(group, 2)).concat(pick(all, target - groups.length * 2));

  /* Fisher-Yates so the guaranteed characters are not always in the same positions. */
  const shuffle = crypto.getRandomValues(new Uint32Array(chars.length));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = shuffle[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/* The browser cannot write roles-config.json, so a role change produces the block to paste
   rather than pretending to save. */
function showRolesJson() {
  const block = document.getElementById("rolesDiff");
  const output = document.getElementById("rolesJson");
  if (!block || !output) return;

  output.value = JSON.stringify(rolesConfig.users, null, 2);
  block.hidden = false;
  output.select();
}

async function handleAdminReset(event) {
  event.preventDefault();
  const error = document.getElementById("resetError");
  const result = document.getElementById("resetResult");
  error.hidden = true;
  result.hidden = true;

  const email = document.getElementById("resetEmail").value.trim().toLowerCase();
  const password = document.getElementById("resetPassword").value;

  const fail = (message) => { error.textContent = message; error.hidden = false; };

  if (!isAllowedEmail(email)) {
    fail(`Use a @${rolesConfig.allowedDomain} address.`);
    return;
  }

  const problems = passwordProblems(password);
  if (problems.length) {
    fail(`Password needs ${problems.join(", ")}.`);
    return;
  }

  const local = email.split("@")[0];
  const guess = local.split(/[._-]+/).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  const entry = {
    email,
    firstName: document.getElementById("resetFirst").value.trim().replace(/\s+/g, "") || guess[0] || "",
    lastName: document.getElementById("resetLast").value.trim().replace(/\s+/g, "") || guess.slice(1).join("") || "",
    role: document.getElementById("resetRole").value,
    passwordHash: await hashPassword(password),
  };

  document.getElementById("resetHash").value = JSON.stringify(entry, null, 2);
  document.getElementById("resetResultEmail").textContent = email;
  document.getElementById("resetPlain").textContent = password;
  result.hidden = false;
  document.getElementById("resetHash").select();
}

/* ---------- Accounts & cloud sync (Supabase) ---------- */

/* Entirely optional. With no credentials in supabase-config.json the app behaves exactly
   as it always has: local-only, no login, everything in localStorage. Fill the config in
   and it gains real email accounts, each with its own dashboard synced to Postgres. */
const cloud = {
  client: null,
  role: null,
  user: null,
  enabled: false,
  saveTimer: null,
};

async function initCloud() {
  let config = bundled("supabaseConfig");

  if (!config) {
    try {
      const response = await fetch("./supabase-config.json", { cache: "no-store" });
      config = response.ok ? await response.json() : null;
    } catch (error) {
      debugLog(`supabase-config.json not readable: ${error.message}`);
    }
  }

  if (!config || !config.url || !config.anonKey) {
    debugLog("cloud disabled - no Supabase credentials configured");
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    showAppError("Could not load the Supabase library — running local-only. Check your connection.");
    return;
  }

  cloud.client = window.supabase.createClient(config.url, config.anonKey);
  cloud.enabled = true;

  const { data } = await cloud.client.auth.getSession();
  if (data && data.session) {
    await onSignedIn(data.session.user);
  } else {
    showAuthOverlay();
  }

  cloud.client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      cloud.user = null;
      showAuthOverlay();
    }
  });
}

function showAuthOverlay() {
  nodes.authOverlay.hidden = false;
  showAuthError("");
  if (nodes.authHint) nodes.authHint.textContent = describePasswordPolicy();
}

function showAuthError(message) {
  nodes.authError.textContent = message;
  nodes.authError.hidden = !message;
}

async function onSignedIn(user) {
  /* Domain gate. Also enforced in the database, so this is fast feedback, not the control. */
  if (!isAllowedEmail(user.email)) {
    await cloud.client.auth.signOut();
    cloud.user = null;
    showAuthOverlay();
    showAuthError(`${user.email} is not a @${rolesConfig.allowedDomain} account. Access is restricted to company accounts.`);
    return;
  }

  cloud.user = user;
  nodes.authOverlay.hidden = true;

  const meta = user.user_metadata || {};
  state.settings.displayName = meta.full_name || meta.name || String(user.email || "").split("@")[0] || state.settings.displayName;

  const { data: profile } = await cloud.client
    .from("profiles").select("role, display_name").eq("id", user.id).maybeSingle();
  cloud.role = (profile && ROLES.includes(profile.role)) ? profile.role : configuredRoleFor(user.email);
  state.settings.role = cloud.role;

  await pullCloudState();
  await cloud.client.rpc("touch_last_seen").catch(() => {});
  debugLog(`signed in as ${user.email}`);
}

/* The cloud row wins on sign-in, except the very first time, when whatever is already in
   this browser is pushed up so nothing is lost when a user moves to accounts. */
async function pullCloudState() {
  const { data, error } = await cloud.client
    .from("user_state")
    .select("state")
    .eq("user_id", cloud.user.id)
    .maybeSingle();

  if (error) {
    showAppError(`Could not load your data (${error.message}). Working from this browser only.`);
    return;
  }

  if (data && data.state && Object.keys(data.state).length) {
    state = ensureDefaults(data.state);
    if (cloud.role) state.settings.role = cloud.role;
    saveState();
    applyTheme(state.settings.theme);
  } else {
    await pushCloudState();
  }

  renderAll();
}

async function pushCloudState() {
  if (!cloud.enabled || !cloud.user) return;

  const { error } = await cloud.client
    .from("user_state")
    .upsert({ user_id: cloud.user.id, state, updated_at: new Date().toISOString() });

  if (error) {
    debugLog(`cloud save failed: ${error.message}`);
    showAppError(`Changes are saved in this browser but did not reach the server (${error.message}).`);
  }
}

/* Debounced so typing does not fire a request per keystroke. */
function scheduleCloudSave() {
  if (!cloud.enabled || !cloud.user) return;
  clearTimeout(cloud.saveTimer);
  cloud.saveTimer = setTimeout(() => pushCloudState(), 1200);
}

async function signOut() {
  if (!cloud.enabled) return;
  if (!confirm("Sign out? Your data stays on the server and comes back when you sign in.")) return;

  await cloud.client.auth.signOut();
  state = ensureDefaults({ projects: [], updates: [], settings: null, templates: [], weekTemplates: null });
  saveState();
  renderAll();
  showAuthOverlay();
}

function renderAccountPanel() {
  if (!nodes.settingsAccount) return;

  if (!currentSession) {
    nodes.settingsAccount.innerHTML = `<p class="muted">Not signed in. Sign-in is off in
      <code>roles-config.json</code> (<code>requireLogin: false</code>).</p>`;
    return;
  }

  nodes.settingsAccount.innerHTML = `
    <p class="muted">Signed in as <strong>${escapeHtml(currentSession.email)}</strong> —
    role <strong>${escapeHtml(ROLE_LABELS[currentSession.role])}</strong>, from
    <code>roles-config.json</code>.</p>
    <p class="muted" style="margin-top:6px;font-size:0.8rem;">Demo sign-in only: no password and no
    server, so this identifies you rather than protecting anything. Data stays in this browser.</p>
    <div class="actions" style="margin-top: 12px;">
      <button type="button" id="settingsSignOut" class="ghost-button">Sign out</button>
    </div>`;
  document.getElementById("settingsSignOut").addEventListener("click", () => signOutSession());
}

/* "How many people are using it" — counts only; RLS still stops anyone reading
   another person's projects. */
async function loadUsageStats() {
  const target = document.getElementById("settingsUsageStats");
  if (!target || !cloud.enabled || !cloud.user) return;

  const { data, error } = await cloud.client.rpc("usage_stats");
  if (error) {
    target.textContent = `Usage stats unavailable (${error.message}).`;
    return;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    target.textContent = "No usage data yet.";
    return;
  }

  target.textContent =
    `${row.total_users} account(s) total · ${row.active_7d} active in the last 7 days · ${row.active_30d} in the last 30.`;
}

/* ---------- Re-apply template wording to existing projects ---------- */

/* Tasks are copied into a project when it is created, so later edits to the template do not
   reach them. This finds tasks that still look exactly as generated and refreshes their
   wording from the current template. A task anyone has started is never touched. */
let pendingTemplateSync = null;

function isUntouchedTask(task) {
  return (task.status || "not started") === "not started"
    && !String(task.owner || "").trim()
    && !String(task.date || "").trim()
    && !String(task.blocker || "").trim()
    && !String(task.comments || "").trim()
    && !(task.subtasks || []).length;
}

function titleTokens(text) {
  return new Set(String(text || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean));
}

/* Jaccard overlap — "Channel form shared" vs "Channel form" scores 0.67, while two
   unrelated tasks score near zero. */
function similarity(left, right) {
  const a = titleTokens(left);
  const b = titleTokens(right);
  if (!a.size || !b.size) return 0;

  let shared = 0;
  a.forEach((token) => { if (b.has(token)) shared += 1; });
  return shared / (a.size + b.size - shared);
}

function planTemplateSync() {
  const changes = [];

  state.updates.forEach((update) => {
    const template = state.weekTemplates.find((entry) => entry.week === update.templateWeek);
    if (!template) return;

    const project = state.projects.find((item) => item.id === update.projectId);
    const platforms = project ? project.platforms || [] : [];
    const candidates = templateTasksForProject(template.tasks, { platforms });
    const claimed = new Set();

    (update.tasks || []).forEach((task) => {
      if (!isUntouchedTask(task)) return;

      let best = null;
      let bestScore = 0;
      candidates.forEach((candidate, index) => {
        if (claimed.has(index)) return;
        const score = similarity(task.title, candidate.title);
        if (score > bestScore) { bestScore = score; best = { candidate, index }; }
      });

      if (!best || bestScore < 0.5) return;
      if (best.candidate.title === task.title && best.candidate.scope === task.phase) return;

      claimed.add(best.index);
      changes.push({
        taskId: task.id,
        updateId: update.id,
        projectName: update.projectName,
        week: update.templateWeek,
        from: { scope: task.phase, title: task.title },
        to: { scope: best.candidate.scope, title: best.candidate.title },
      });
    });
  });

  return changes;
}

function previewTemplateSync() {
  if (!requirePermission("project.edit", "update project tasks")) return;

  pendingTemplateSync = planTemplateSync();
  nodes.syncApply.disabled = !pendingTemplateSync.length;

  if (!pendingTemplateSync.length) {
    nodes.syncResult.hidden = true;
    nodes.syncNote.textContent = "Nothing to update — every untouched task already matches the template.";
    return;
  }

  nodes.syncList.value = pendingTemplateSync
    .map((change) => `${change.projectName} · W${change.week}\n   ${change.from.scope} | ${change.from.title}\n → ${change.to.scope} | ${change.to.title}`)
    .join("\n\n");
  nodes.syncResult.hidden = false;
  nodes.syncNote.textContent = `${pendingTemplateSync.length} task(s) would change. Nothing is saved until you press Apply.`;
}

function applyTemplateSync() {
  if (!pendingTemplateSync || !pendingTemplateSync.length) return;
  if (!requirePermission("project.edit", "update project tasks")) return;
  if (!confirm(`Update ${pendingTemplateSync.length} task(s) across your projects? Only untouched tasks change.`)) return;

  let applied = 0;
  pendingTemplateSync.forEach((change) => {
    const update = state.updates.find((item) => item.id === change.updateId);
    const task = update && (update.tasks || []).find((item) => item.id === change.taskId);
    if (!task || !isUntouchedTask(task)) return;

    task.phase = change.to.scope;
    task.title = change.to.title;
    applied += 1;
  });

  saveState();
  pendingTemplateSync = null;
  nodes.syncApply.disabled = true;
  nodes.syncResult.hidden = true;
  nodes.syncNote.textContent = "";
  renderAll();
  showAppSuccess(`Updated ${applied} task(s) from the template.`);
}

/* ---------- Backup / restore ---------- */

function renderStorageStats() {
  if (!nodes.settingsDataStats) return;

  nodes.settingsOrigin.textContent = location.origin || "this address";
  const bytes = new Blob([JSON.stringify(state)]).size;
  const weekTasks = state.weekTemplates.reduce((total, week) => total + week.tasks.length, 0);
  nodes.settingsDataStats.textContent =
    `Currently stored: ${state.projects.length} project(s), ${state.updates.length} weekly report(s), ` +
    `${state.weekTemplates.length} template week(s) / ${weekTasks} task(s) — about ${(bytes / 1024).toFixed(1)} KB.`;
}

/* Wipes projects and weekly reports. `keepTemplates` preserves the master week plan and your
   settings, which is what you almost always want after testing. Exposed as
   window.clearAllData() so it can be run from the browser console. */
function clearAllData({ keepTemplates = true, confirmFirst = true } = {}) {
  if (!requirePermission("data.manage", "clear all data")) return false;
  const summary = `${state.projects.length} project(s) and ${state.updates.length} weekly report(s)`;
  if (confirmFirst && !confirm(`Delete ${summary}? This cannot be undone — export a backup first if you need one.`)) {
    return false;
  }

  state.projects = [];
  state.updates = [];
  state.demoSeeded = true;

  if (!keepTemplates) {
    state.weekTemplates = [];
    state.weekTemplatesSeeded = false;
  }

  uiState.projectId = null;
  uiState.editingLastId = null;
  uiState.editingUpcomingId = null;

  saveState();
  openDashboard();
  showAppInfo(`Cleared ${summary}.${keepTemplates ? " Master template and settings kept." : " Master template reset from week-templates.json."}`);
  return true;
}

window.clearAllData = clearAllData;

function exportBackup() {
  const stamp = toInputDate(new Date());
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `weekly-report-backup-${stamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  if (!requirePermission("data.manage", "import a backup")) return;
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.updates)) {
        throw new Error("not a Weekly Report backup");
      }

      if (!confirm(`Replace everything currently in this browser with the backup (${parsed.projects.length} projects, ${parsed.updates.length} reports)? Your current data will be lost.`)) {
        return;
      }

      state = ensureDefaults(parsed);
      saveState();
      applyTheme(state.settings.theme);
      renderAll();
      showAppSuccess(`Backup restored: ${state.projects.length} projects, ${state.updates.length} weekly reports.`);
    } catch (error) {
      showAppError(`Could not import that file (${error.message}).`);
    }
  };

  reader.readAsText(file);
}

/* ---------- Per-project week management ---------- */

/* Removes a project and every weekly report belonging to it. There is no undo, so the
   confirmation spells out exactly what goes. */
function deleteProject(projectId) {
  if (!requirePermission("project.delete", "delete projects")) return;
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;

  const reports = state.updates.filter((item) => item.projectId === projectId);
  const taskCount = reports.reduce((total, update) => total + (update.tasks || []).length, 0);

  if (!confirm(`Delete “${project.name}” and its ${reports.length} weekly report(s) / ${taskCount} task(s)? This cannot be undone — export a backup first if you need one.`)) {
    return;
  }

  state.projects = state.projects.filter((item) => item.id !== projectId);
  state.updates = state.updates.filter((item) => item.projectId !== projectId);
  uiState.projectId = null;
  saveState();
  openDashboard();
  showAppInfo(`Deleted “${project.name}” and ${reports.length} weekly report(s).`);
}

function deleteUpdate(updateId) {
  if (!requirePermission("report.delete", "delete weekly reports")) return;
  const update = state.updates.find((item) => item.id === updateId);
  if (!update) return;

  const taskCount = (update.tasks || []).length;
  if (!confirm(`Delete the week of ${update.weekRange} and its ${taskCount} task(s)? This cannot be undone.`)) return;

  state.updates = state.updates.filter((item) => item.id !== updateId);
  saveState();
  renderAll();
}

/* Appends the next week after the project's latest one, pre-filled from the master plan
   when a template exists for that week number. */
function addWeekToProject(projectId) {
  if (!requirePermission("report.create", "add weeks")) return;
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;

  const existing = state.updates
    .filter((item) => item.projectId === projectId)
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));

  const weekNumber = existing.length + 1;
  const weekStart = existing.length
    ? toInputDate(shiftDays(new Date(`${existing[existing.length - 1].weekStart}T00:00:00`), 7))
    : mondayOnOrAfter(project.kickoffDate);

  const template = state.weekTemplates.find((entry) => entry.week === weekNumber);

  state.updates.push({
    id: newId(),
    projectId: project.id,
    projectName: project.name,
    weekStart,
    weekRange: formatWeekRange(weekStart),
    statusTag: "not started",
    fromTemplate: Boolean(template),
    templateWeek: weekNumber,
    templateLabel: template ? template.label : `Week ${weekNumber}`,
    tasks: template ? templateTasksToUpdateTasks(templateTasksForProject(template.tasks, project), weekStart, project.cycleWeeks) : [],
    createdAt: new Date().toISOString(),
  });

  saveState();
  renderAll();
}

/* A task with no platforms applies to every project; otherwise it is only generated when the
   project selected at least one of its platforms. */
function templateTasksForProject(tasks, project) {
  const selected = project.platforms || [];
  return tasks.filter((task) => {
    const wanted = task.platforms || [];
    return !wanted.length || wanted.some((platform) => selected.includes(platform));
  });
}

function templateTasksToUpdateTasks(tasks, weekStart, cycleWeeks) {
  return tasks.map((task) => {
    const days = resolveTaskDays(task, cycleWeeks);
    return {
      id: newId(),
      title: task.title,
      phase: task.scope,
      owner: task.owner || "",
      status: "not started",
      date: "",
      blocker: "",
      priority: task.priority || "medium",
      comments: "",
      days,
      startDate: weekStart || "",
      dueDate: taskDueDate(weekStart, days),
      subtasks: [],
    };
  });
}

/* ---------- Timeline ---------- */

/* Whole-number weeks between two dates, so the plan spans the project rather than being a
   fixed count of 7-day steps hung off the kickoff date. */
function weeksBetween(startValue, endValue) {
  if (!startValue || !endValue) return 0;

  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;

  return Math.max(1, Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000)));
}

/* Go-live is derived: kickoff + N whole weeks, landing on the last day of the final week. */
function computeGoLiveDate(kickoffValue, weeks) {
  if (!kickoffValue) return "";

  const kickoff = new Date(`${kickoffValue}T00:00:00`);
  if (Number.isNaN(kickoff.getTime())) return "";

  const count = Math.min(Math.max(Number(weeks) || DEFAULT_CYCLE_WEEKS, MIN_CYCLE_WEEKS), MAX_CYCLE_WEEKS);
  return toInputDate(shiftDays(kickoff, count * 7 - 1));
}

function syncGoLiveFromCycle() {
  const kickoff = fieldValue("npKickoffDate");
  const weeks = Number(fieldValue("npCycleWeeks")) || DEFAULT_CYCLE_WEEKS;
  const goLive = computeGoLiveDate(kickoff, weeks);

  field("npGoLiveDate").value = goLive;
  nodes.npGoLiveHint.textContent = goLive
    ? `${weeks} weeks from kickoff — ends ${formatSummaryDate(goLive)}.`
    : "Set a kickoff date and it will be calculated.";
  renderWizardSummary();
}

function syncCycleWeeksToDates() {
  const span = weeksBetween(fieldValue("npKickoffDate"), fieldValue("npGoLiveDate"));
  const templateWeeks = state.weekTemplates.length;

  if (!span) {
    nodes.npCycleHint.textContent = templateWeeks ? `Master plan has ${templateWeeks} weeks.` : "";
    return;
  }

  const weeks = Math.min(Math.max(span, MIN_CYCLE_WEEKS), MAX_CYCLE_WEEKS);
  field("npCycleWeeks").value = String(weeks);
  nodes.npCycleHint.textContent = span > templateWeeks
    ? `${span} weeks between your dates — the master plan covers ${templateWeeks}, later weeks start empty.`
    : (span < templateWeeks
      ? `${span} weeks between your dates — master plan weeks ${span + 1}–${templateWeeks} will not be created.`
      : `${span} weeks between your dates.`);
  renderWizardSummary();
}

function toggleProjectDetails(editing) {
  nodes.projDetailsForm.hidden = !editing;
  nodes.projEditToggle.textContent = editing ? "Editing…" : "Edit";
  nodes.projEditToggle.disabled = editing;
  if (!editing) renderProjectTimeline(state.projects.find((item) => item.id === uiState.projectId));
}

/* Saves the whole details block. Changing kickoff or cycle length re-dates every weekly
   report for the project, so the plan stays consistent with the timeline. */
function saveProjectDetails(event) {
  event.preventDefault();
  if (!requirePermission("project.edit", "edit project details")) return;

  const project = state.projects.find((item) => item.id === uiState.projectId);
  if (!project) return;

  const name = nodes.projName.value.trim();
  if (!name) {
    showAppError("A project needs a name.");
    return;
  }

  const kickoff = nodes.projKickoff.value;
  const weeks = Number(nodes.projCycleWeeks.value) || DEFAULT_CYCLE_WEEKS;
  const datesChanged = kickoff !== project.kickoffDate || weeks !== project.cycleWeeks;

  project.name = name;
  project.csm = nodes.projCsm.value.trim();
  project.implementationOwner = nodes.projOwner.value.trim();
  project.salesOwner = nodes.projSalesOwner.value.trim();
  project.techTeam = nodes.projTechTeam.value;
  project.vendorName = project.techTeam === "outsourced" ? nodes.projVendorName.value.trim() : "";
  project.notes = nodes.projNotes.value.trim();
  project.kickoffDate = kickoff;
  project.cycleWeeks = weeks;
  const updates = state.updates
    .filter((item) => item.projectId === project.id)
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));

  if (datesChanged && kickoff && updates.length) {
    const firstMonday = mondayOnOrAfter(kickoff);
    updates.forEach((update, index) => {
      update.weekStart = toInputDate(shiftDays(new Date(`${firstMonday}T00:00:00`), index * 7));
      update.weekRange = formatWeekRange(update.weekStart);
    });
  }

  state.updates.forEach((update) => {
    if (update.projectId === project.id) update.projectName = project.name;
  });

  /* Re-dating the weeks moves every task with them, then go-live follows the task ends. */
  if (datesChanged && kickoff) {
    state.updates.filter((item) => item.projectId === project.id).forEach((update) => {
      (update.tasks || []).forEach((task) => {
        task.startDate = update.weekStart;
        task.dueDate = taskDueDate(update.weekStart, task.days || templateDefaultDays());
      });
    });
  }

  refreshProjectGoLive(project.id);
  saveState();
  toggleProjectDetails(false);
  renderAll();
  showAppSuccess(datesChanged && updates.length
    ? `Details saved. ${updates.length} week(s) re-dated from ${formatSummaryDate(mondayOnOrAfter(kickoff))}.`
    : "Project details saved.");
}

function renderProjectTimeline(project) {
  if (!project || !nodes.projName) return;

  nodes.projCycleWeeks.innerHTML = "";
  for (let weeks = MIN_CYCLE_WEEKS; weeks <= MAX_CYCLE_WEEKS; weeks += 1) {
    const option = document.createElement("option");
    option.value = String(weeks);
    option.textContent = `${weeks} weeks`;
    nodes.projCycleWeeks.append(option);
  }

  nodes.projName.value = project.name || "";
  nodes.projCsm.value = project.csm || "";
  nodes.projOwner.value = project.implementationOwner || "";
  nodes.projSalesOwner.value = project.salesOwner || "";
  nodes.projKickoff.value = project.kickoffDate || "";
  nodes.projCycleWeeks.value = String(project.cycleWeeks || DEFAULT_CYCLE_WEEKS);
  nodes.projGoLive.value = project.goLiveDate || computeGoLiveDate(project.kickoffDate, project.cycleWeeks);
  nodes.projTechTeam.value = project.techTeam || "in-house";
  nodes.projVendorField.hidden = nodes.projTechTeam.value !== "outsourced";
  nodes.projVendorName.value = project.vendorName || "";
  nodes.projNotes.value = project.notes || "";

  const updates = state.updates.filter((item) => item.projectId === project.id);
  nodes.projTimelineNote.textContent = updates.length
    ? `${updates.length} week(s) generated · go-live ${project.goLiveDate ? formatSummaryDate(project.goLiveDate) : "not set"}.`
    : "No weekly reports yet.";
}

/* ---------- Task durations ---------- */

/* How long a task takes depends on the project's cycle length. `daysByCycle` holds explicit
   values per cycle; anything not listed is scaled pro rata from `days`, so adding a 9- or
   10-week cycle needs no edits to the task list. */
function templateBaseCycle() {
  const value = Number(templateMeta.baseCycleWeeks);
  return Number.isFinite(value) && value > 0 ? value : BASE_CYCLE_WEEKS;
}

function templateDefaultDays() {
  const value = Number(templateMeta.defaultTaskDays);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TASK_DAYS;
}

function resolveTaskDays(task, cycleWeeks) {
  const cycle = Number(cycleWeeks) || DEFAULT_CYCLE_WEEKS;
  const overrides = task.daysByCycle || {};

  if (overrides[String(cycle)] !== undefined) {
    return Math.max(1, Number(overrides[String(cycle)]) || 1);
  }

  const base = Number(task.days);
  if (Number.isFinite(base) && base > 0) {
    return Math.max(1, Math.round(base * cycle / templateBaseCycle()));
  }

  return templateDefaultDays();
}

/* Parallel within a week: every task starts on its own week's Monday. A task longer than a
   week simply runs past it — the cycle is a plan, not a ceiling. */
function taskDueDate(startValue, days) {
  if (!startValue) return "";
  const start = new Date(`${startValue}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";
  return toInputDate(shiftDays(start, Math.max(1, Number(days) || 1) - 1));
}

/* Go-live is whichever is later: the end of the nominal cycle, or the last task to finish. */
function computeProjectGoLive(project, updates) {
  const nominal = computeGoLiveDate(project.kickoffDate, project.cycleWeeks);
  const ends = (updates || [])
    .flatMap((update) => update.tasks || [])
    .map((task) => task.dueDate)
    .filter(Boolean);

  if (!ends.length) return nominal;

  const latest = ends.sort()[ends.length - 1];
  return nominal && nominal > latest ? nominal : latest;
}

function refreshProjectGoLive(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;

  project.goLiveDate = computeProjectGoLive(
    project,
    state.updates.filter((update) => update.projectId === projectId),
  );
}

/* ---------- Week-wise plan generation ---------- */

/* Turns the master template into real, fully editable weekly update records — one per week
   of the project's cycle. They behave exactly like hand-made reports, so tasks can be
   added, edited or removed per project from the Create Report screen afterwards. */
function generateWeeklyPlan(project) {
  const weeks = Math.min(Math.max(Number(project.cycleWeeks) || DEFAULT_CYCLE_WEEKS, MIN_CYCLE_WEEKS), MAX_CYCLE_WEEKS);
  const firstMonday = mondayOnOrAfter(project.kickoffDate);
  let created = 0;

  for (let index = 0; index < weeks; index += 1) {
    const template = state.weekTemplates.find((entry) => entry.week === index + 1);
    if (!template) continue;

    const weekStart = toInputDate(shiftDays(new Date(`${firstMonday}T00:00:00`), index * 7));

    state.updates.push({
      id: newId(),
      projectId: project.id,
      projectName: project.name,
      weekStart,
      weekRange: formatWeekRange(weekStart),
      statusTag: "not started",
      fromTemplate: true,
      templateWeek: template.week,
      templateLabel: template.label,
      tasks: templateTasksToUpdateTasks(templateTasksForProject(template.tasks, project), weekStart, weeks),
      createdAt: new Date().toISOString(),
    });
    created += 1;
  }

  return created;
}

function mondayOnOrAfter(dateValue) {
  const base = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) {
    return mondayOfThisWeek();
  }

  const day = base.getDay();
  const offset = day === 0 ? 1 : (day === 1 ? 0 : 8 - day);
  return toInputDate(shiftDays(base, offset));
}

/* ---------- Create Report (task editor) ---------- */

function populateProjectPicker(selectEl, selectedId) {
  const ongoing = state.projects.filter((p) => p.status === "current");
  const closed = state.projects.filter((p) => p.status === "closed");
  const buildOptions = (list) => list.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");

  selectEl.innerHTML = `<option value="">Select a project…</option>` +
    (ongoing.length ? `<optgroup label="Ongoing">${buildOptions(ongoing)}</optgroup>` : "") +
    (closed.length ? `<optgroup label="Completed">${buildOptions(closed)}</optgroup>` : "");
  selectEl.value = selectedId || "";
}

function mondayOfThisWeek() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diff);
  return toInputDate(monday);
}

function classifyProjectWeeks(projectId) {
  const updatesAsc = state.updates
    .filter((update) => update.projectId === projectId)
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));
  const todayStr = toInputDate(new Date());
  const weekEndStr = (update) => toInputDate(shiftDays(new Date(`${update.weekStart}T00:00:00`), 6));

  const thisWeekUpdate = updatesAsc.find(
    (update) => update.weekStart <= todayStr && todayStr <= weekEndStr(update),
  ) || null;
  const completedUpdates = updatesAsc.filter((update) => weekEndStr(update) < todayStr);
  const lastWeekUpdate = completedUpdates.length ? completedUpdates[completedUpdates.length - 1] : null;

  return { lastWeekUpdate, thisWeekUpdate };
}

/* Opening without `editing` shows the index of existing reports; the editor only appears
   once you pick one to edit or start a new one. */
function openCreateReport(projectId, focusUpdateId, { editing = Boolean(focusUpdateId) } = {}) {
  uiState.returnScreen = uiState.screen === "create-report" ? uiState.returnScreen : uiState.screen;
  uiState.screen = "create-report";
  uiState.activeNav = "create-report";
  uiState.projectId = projectId || null;

  nodes.createReportTitle.textContent = editing
    ? (focusUpdateId ? "Edit Weekly Report" : "New Weekly Report")
    : "Project Reports";
  populateProjectPicker(nodes.createReportProjectSelect, projectId);
  populateProjectPicker(nodes.reportsIndexProject, projectId);
  nodes.createReportProjectSelect.disabled = Boolean(projectId);

  nodes.createReportForm.hidden = !editing;
  if (editing) {
    loadProjectIntoReportEditor(projectId || "", focusUpdateId || null);
  }

  renderReportsIndex(projectId || "");
  renderAll();
  nodes.createReportScreen.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Reports index (existing reports for a project) ---------- */

function renderReportsIndex(projectId) {
  if (!nodes.reportsIndexList) return;

  if (!projectId) {
    nodes.reportsIndexList.innerHTML = `<p class="muted">Pick a project to see its weekly reports.</p>`;
    return;
  }

  const updates = state.updates
    .filter((update) => update.projectId === projectId)
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));

  if (!updates.length) {
    nodes.reportsIndexList.innerHTML = `<p class="muted">No reports for this project yet. Use “+ New report” to add one.</p>`;
    return;
  }

  nodes.reportsIndexList.innerHTML = updates.map((update, index) => {
    const tasks = update.tasks || [];
    const done = tasks.filter((task) => task.status === "completed").length;
    return `
      <article class="report-row">
        <div class="report-row-week">
          <span class="template-week-badge">Week ${update.templateWeek || index + 1}</span>
          <div>
            <div class="report-row-range">${escapeHtml(update.weekRange)}</div>
            <div class="meta">${escapeHtml(update.templateLabel || "Custom week")} · ${tasks.length} task${tasks.length === 1 ? "" : "s"} · ${done} completed</div>
          </div>
        </div>
        <div class="report-row-actions">
          <span class="status-badge ${statusClass(update.statusTag)}">${escapeHtml(update.statusTag)}</span>
          <button type="button" class="ghost-button small-button" data-requires="report.edit" data-edit-report="${update.id}">Edit</button>
          <button type="button" class="row-remove" data-requires="report.delete" data-delete-report="${update.id}">Delete</button>
        </div>
      </article>
    `;
  }).join("");

  applyRolePermissions();
}

function handleReportsIndexClick(event) {
  const edit = event.target.closest("[data-edit-report]");
  if (edit) {
    openEditUpdate(edit.dataset.editReport);
    return;
  }

  const remove = event.target.closest("[data-delete-report]");
  if (remove) {
    deleteUpdate(remove.dataset.deleteReport);
    renderReportsIndex(nodes.reportsIndexProject.value);
  }
}

function openEditUpdate(updateId) {
  const update = state.updates.find((u) => u.id === updateId);
  if (!update) return;

  const project = state.projects.find((p) => p.id === update.projectId);
  if (!project) return;

  openCreateReport(project.id, updateId);
}

function loadProjectIntoReportEditor(projectId, focusUpdateId) {
  refreshOwnerOptions(projectId);
  nodes.lastWeekTasksList.innerHTML = "";
  nodes.thisWeekTasksList.innerHTML = "";
  uiState.editingLastId = null;
  uiState.editingUpcomingId = null;

  const thisMonday = mondayOfThisWeek();
  const lastMonday = toInputDate(shiftDays(new Date(`${thisMonday}T00:00:00`), -7));
  nodes.thisWeekDate.value = thisMonday;
  nodes.lastWeekDate.value = lastMonday;
  nodes.thisWeekStatus.value = "on track";
  nodes.lastWeekStatus.value = "on track";

  if (projectId) {
    let { lastWeekUpdate, thisWeekUpdate } = classifyProjectWeeks(projectId);

    // Make sure the specifically-edited update is shown, even if it isn't the
    // latest completed / current-week one.
    if (focusUpdateId) {
      const focus = state.updates.find((u) => u.id === focusUpdateId);
      if (focus) {
        const todayStr = toInputDate(new Date());
        const focusEnd = toInputDate(shiftDays(new Date(`${focus.weekStart}T00:00:00`), 6));
        if (focus.weekStart <= todayStr && todayStr <= focusEnd) {
          thisWeekUpdate = focus;
        } else if (focusEnd < todayStr) {
          lastWeekUpdate = focus;
        } else {
          thisWeekUpdate = focus;
        }
      }
    }

    if (lastWeekUpdate) loadUpdateIntoSection("last", lastWeekUpdate);
    if (thisWeekUpdate) loadUpdateIntoSection("upcoming", thisWeekUpdate);
  }

  if (!nodes.lastWeekTasksList.children.length) addNewTaskToForm("last");
  if (!nodes.thisWeekTasksList.children.length) addNewTaskToForm("upcoming");

  renderCreateReportStats("last");
  renderCreateReportStats("upcoming");
}

function loadUpdateIntoSection(sectionKey, update) {
  const section = reportSection(sectionKey);
  section.date.value = update.weekStart;
  section.status.value = update.statusTag;
  if (sectionKey === "last") {
    uiState.editingLastId = update.id;
  } else {
    uiState.editingUpcomingId = update.id;
  }

  (update.tasks || []).forEach((task) => {
    const card = addNewTaskToForm(sectionKey);
    setTaskPhase(card, task.phase || "");
    card.querySelector(".form-task-days").value = task.days || "";
    card.querySelector(".form-task-start").value = task.startDate || "";
    card.querySelector(".form-task-due").value = task.dueDate || "";
    card.querySelector(".form-task-title").value = task.title || "";
    card.querySelector(".form-task-owner").value = task.owner || "";
    card.querySelector(".form-task-status").value = task.status || "not started";
    card.querySelector(".form-task-date").value = task.date || "";
    card.querySelector(".form-task-comments").value = task.comments || "";

    const subtasksList = card.querySelector(".form-subtasks-list");
    (task.subtasks || []).forEach((sub) => {
      const row = addNewSubTaskToForm(subtasksList, sectionKey);
      row.querySelector(".form-subtask-title").value = sub.title || "";
      row.querySelector(".form-subtask-date").value = sub.date || "";
      row.querySelector(".form-subtask-owner").value = sub.owner || "";
      row.querySelector(".form-subtask-status").value = sub.status || "not started";
      row.querySelector(".form-subtask-blocker").value = sub.blocker || "";
      row.querySelector(".form-subtask-priority").value = sub.priority || "medium";
      row.querySelector(".form-subtask-comments").value = sub.comments || "";
    });
  });
}

function setTaskPhase(card, phase) {
  card.dataset.phase = phase || "";
  const badge = card.querySelector(".form-task-phase");
  if (!badge) return;
  if (phase) {
    badge.textContent = phase;
    badge.style.display = "inline-flex";
  } else {
    badge.textContent = "";
    badge.style.display = "none";
  }
}

let templatePickerSection = null;

function openTemplatePicker(sectionKey) {
  templatePickerSection = sectionKey;
  nodes.templateSearch.value = "";
  renderTemplatePicker();
  nodes.templatePickerOverlay.hidden = false;
  document.body.style.overflow = "hidden";
  nodes.templateSearch.focus();
}

function closeTemplatePicker() {
  nodes.templatePickerOverlay.hidden = true;
  document.body.style.overflow = "";
  templatePickerSection = null;
}

function renderTemplatePicker() {
  nodes.templatePickerBody.innerHTML = TASK_TEMPLATES.map((group, gi) => `
    <div class="template-group" data-phase="${escapeHtml(group.phase)}">
      <div class="template-group-head">
        <label class="template-group-toggle">
          <input type="checkbox" class="template-group-check" data-group="${gi}" />
          <span>${escapeHtml(group.phase)}</span>
        </label>
        <span class="meta template-group-count">${group.tasks.length}</span>
      </div>
      <div class="template-items">
        ${group.tasks.map((t, ti) => `
          <label class="template-item" data-search="${escapeHtml((t.title + " " + t.team).toLowerCase())}">
            <input type="checkbox" class="template-item-check" data-group="${gi}" data-index="${ti}" />
            <span class="template-item-title">${escapeHtml(t.title)}</span>
            <span class="team-badge team-${escapeHtml(t.team.toLowerCase())}">${escapeHtml(t.team)}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `).join("");

  nodes.templatePickerBody.querySelectorAll(".template-group-check").forEach((groupCheck) => {
    groupCheck.addEventListener("change", () => {
      const gi = groupCheck.dataset.group;
      nodes.templatePickerBody
        .querySelectorAll(`.template-item-check[data-group="${gi}"]`)
        .forEach((itemCheck) => {
          if (!itemCheck.closest(".template-item").hidden) itemCheck.checked = groupCheck.checked;
        });
      updateTemplateSelectedCount();
    });
  });

  nodes.templatePickerBody.querySelectorAll(".template-item-check").forEach((itemCheck) => {
    itemCheck.addEventListener("change", () => updateTemplateSelectedCount());
  });

  updateTemplateSelectedCount();
}

function filterTemplatePicker(query) {
  const q = (query || "").trim().toLowerCase();
  nodes.templatePickerBody.querySelectorAll(".template-group").forEach((group) => {
    let anyVisible = false;
    group.querySelectorAll(".template-item").forEach((item) => {
      const match = !q || item.dataset.search.includes(q);
      item.hidden = !match;
      if (match) anyVisible = true;
    });
    group.hidden = !anyVisible;
  });
}

function updateTemplateSelectedCount() {
  const n = nodes.templatePickerBody.querySelectorAll(".template-item-check:checked").length;
  nodes.templateSelectedCount.textContent = `${n} selected`;
}

function addSelectedTemplates() {
  const sectionKey = templatePickerSection;
  if (!sectionKey) return;

  const checked = [...nodes.templatePickerBody.querySelectorAll(".template-item-check:checked")];
  if (!checked.length) {
    closeTemplatePicker();
    return;
  }

  // Drop the initial blank placeholder card if it was never filled in.
  const list = reportSection(sectionKey).list;
  const firstCard = list.querySelector(".form-task-card");
  if (
    list.querySelectorAll(".form-task-card").length === 1 &&
    firstCard &&
    !firstCard.querySelector(".form-task-title").value.trim() &&
    !firstCard.dataset.phase
  ) {
    firstCard.remove();
  }

  checked.forEach((chk) => {
    const group = TASK_TEMPLATES[Number(chk.dataset.group)];
    const tmpl = group && group.tasks[Number(chk.dataset.index)];
    if (!tmpl) return;
    const card = addNewTaskToForm(sectionKey);
    setTaskPhase(card, group.phase);
    card.querySelector(".form-task-title").value = tmpl.title;
    card.querySelector(".form-task-owner").value = tmpl.team;
  });

  renderCreateReportStats(sectionKey);
  closeTemplatePicker();
}

function addNewTaskToForm(sectionKey) {
  taskCounter += 1;
  const taskId = `task_${taskCounter}_${Date.now()}`;

  const taskCard = document.createElement("div");
  taskCard.className = "form-task-card";
  taskCard.id = taskId;
  taskCard.innerHTML = `
    <div class="form-task-header">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <h4 style="margin: 0; font-size: 0.95rem; color: var(--accent-2);">Task Details</h4>
          <span class="form-task-phase phase-badge" style="display: none;"></span>
        </div>
        <div class="form-task-summary" style="display: none; font-size: 0.85rem; color: #cbd5e1; margin-top: 4px;"></div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button type="button" class="ghost-button btn-edit-task" style="display: none; padding: 6px 12px; font-size: 0.8rem; border-radius: 8px;">Edit</button>
        <button type="button" class="secondary-button btn-done-task" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 8px;">Done</button>
        <button type="button" class="delete-button" id="btn_delete_${taskId}">Remove Task</button>
      </div>
    </div>
    <div class="form-task-body" style="display: grid; gap: 12px;">
      <div style="display: grid; gap: 8px;">
        <label style="font-size: 0.85rem; display: block; color: #cbd5e1; font-weight: normal; margin-bottom: 2px;">Task Title *</label>
        <input type="text" placeholder="e.g. Implement user login" class="form-task-title" />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
        <div>
          <label style="font-size: 0.85rem; display: block; color: #cbd5e1; font-weight: normal; margin-bottom: 2px;">Ownership *</label>
          <input type="text" placeholder="e.g. Apoorv — CTO" class="form-task-owner" list="ownerOptions" />
        </div>
        <div>
          <label style="font-size: 0.85rem; display: block; color: #cbd5e1; font-weight: normal; margin-bottom: 2px;">Status *</label>
          <select class="form-task-status" required>
            <option value="not started">Not Started</option>
            <option value="in progress">In Progress</option>
            <option value="delayed">Delayed</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label style="font-size: 0.85rem; display: block; color: #cbd5e1; font-weight: normal; margin-bottom: 2px;">Completed On</label>
          <input type="date" class="form-task-date" />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
        <div>
          <label style="font-size: 0.85rem; display: block; color: #cbd5e1; font-weight: normal; margin-bottom: 2px;">Duration (days)</label>
          <input type="number" min="1" class="form-task-days" placeholder="e.g. 7" />
        </div>
        <div>
          <label style="font-size: 0.85rem; display: block; color: #cbd5e1; font-weight: normal; margin-bottom: 2px;">Planned start</label>
          <input type="date" class="form-task-start" />
        </div>
        <div>
          <label style="font-size: 0.85rem; display: block; color: #cbd5e1; font-weight: normal; margin-bottom: 2px;">Planned due</label>
          <input type="date" class="form-task-due" />
        </div>
      </div>
      <div style="display: grid; gap: 8px;">
        <label style="font-size: 0.85rem; display: block; color: #cbd5e1; font-weight: normal; margin-bottom: 2px;">Comments / Notes</label>
        <input type="text" placeholder="Add any notes for this task..." class="form-task-comments" />
      </div>
      <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h5 style="margin: 0; font-size: 0.85rem; color: var(--muted);">Sub-tasks</h5>
          <button type="button" class="secondary-button btn-add-subtask" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 6px;">+ Add Sub-task</button>
        </div>
        <div class="table-scroll">
          <table class="subtask-table">
            <thead>
              <tr>
                <th>Sub Task</th><th>Date</th><th>Ownership</th><th>Status</th><th>Blocker</th><th>Priority</th><th>Comments/Notes</th><th></th>
              </tr>
            </thead>
            <tbody class="form-subtasks-list"><!-- Sub-tasks will go here --></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  taskCard.querySelector(`#btn_delete_${taskId}`).addEventListener("click", () => {
    taskCard.remove();
    renderCreateReportStats(sectionKey);
  });

  const btnAddSubtask = taskCard.querySelector(".btn-add-subtask");
  const subtasksList = taskCard.querySelector(".form-subtasks-list");
  btnAddSubtask.addEventListener("click", () => {
    addNewSubTaskToForm(subtasksList, sectionKey);
    renderCreateReportStats(sectionKey);
  });

  const bodyEl = taskCard.querySelector(".form-task-body");
  const summaryEl = taskCard.querySelector(".form-task-summary");
  const btnDone = taskCard.querySelector(".btn-done-task");
  const btnEdit = taskCard.querySelector(".btn-edit-task");
  const titleInput = taskCard.querySelector(".form-task-title");
  const ownerInput = taskCard.querySelector(".form-task-owner");
  const statusSelect = taskCard.querySelector(".form-task-status");

  btnDone.addEventListener("click", () => {
    if (!titleInput.value.trim()) {
      titleInput.reportValidity();
      return;
    }
    const statusLabel = statusSelect.options[statusSelect.selectedIndex].text;
    summaryEl.textContent = `${titleInput.value.trim()} — ${ownerInput.value.trim() || "Unassigned"} (${statusLabel})`;
    summaryEl.style.display = "block";
    bodyEl.style.display = "none";
    btnDone.style.display = "none";
    btnEdit.style.display = "inline-flex";
  });

  btnEdit.addEventListener("click", () => {
    summaryEl.style.display = "none";
    bodyEl.style.display = "grid";
    btnDone.style.display = "inline-flex";
    btnEdit.style.display = "none";
  });

  reportSection(sectionKey).list.appendChild(taskCard);
  renderCreateReportStats(sectionKey);
  return taskCard;
}

function addNewSubTaskToForm(container, sectionKey) {
  subtaskCounter += 1;
  const subtaskId = `subtask_${subtaskCounter}_${Date.now()}`;
  const defaultDate = reportSection(sectionKey).date.value || "";

  const subtaskRow = document.createElement("tr");
  subtaskRow.className = "form-subtask-row";
  subtaskRow.id = subtaskId;
  subtaskRow.innerHTML = `
    <td><input type="text" placeholder="Sub-task title..." class="form-subtask-title" /></td>
    <td><input type="date" class="form-subtask-date" value="${defaultDate}" /></td>
    <td><input type="text" placeholder="Owner" class="form-subtask-owner" list="ownerOptions" /></td>
    <td>
      <select class="form-subtask-status" required>
        <option value="not started">Not Started</option>
        <option value="in progress">In Progress</option>
        <option value="delayed">Delayed</option>
        <option value="blocked">Blocked</option>
        <option value="completed">Completed</option>
      </select>
    </td>
    <td><input type="text" placeholder="—" class="form-subtask-blocker" /></td>
    <td>
      <select class="form-subtask-priority">
        <option value="low">Low</option>
        <option value="medium" selected>Medium</option>
        <option value="high">High</option>
      </select>
    </td>
    <td><input type="text" placeholder="Notes..." class="form-subtask-comments" /></td>
    <td><button type="button" class="delete-button btn-delete-subtask" id="btn_delete_${subtaskId}">✕</button></td>
  `;

  subtaskRow.querySelector(`#btn_delete_${subtaskId}`).addEventListener("click", () => {
    subtaskRow.remove();
    renderCreateReportStats(sectionKey);
  });

  subtaskRow.querySelector(".form-subtask-status").addEventListener("change", () => {
    renderCreateReportStats(sectionKey);
  });

  container.appendChild(subtaskRow);
  return subtaskRow;
}

function gatherTasksFromList(listEl) {
  const tasks = [];
  listEl.querySelectorAll(".form-task-card").forEach((card) => {
    const title = card.querySelector(".form-task-title").value.trim();
    if (!title) return;

    const subtasks = [];
    card.querySelectorAll(".form-subtask-row").forEach((row) => {
      const subTitle = row.querySelector(".form-subtask-title").value.trim();
      if (!subTitle) return;
      subtasks.push({
        id: newId(),
        title: subTitle,
        date: row.querySelector(".form-subtask-date").value,
        owner: row.querySelector(".form-subtask-owner").value.trim(),
        status: row.querySelector(".form-subtask-status").value,
        blocker: row.querySelector(".form-subtask-blocker").value.trim(),
        priority: row.querySelector(".form-subtask-priority").value,
        comments: row.querySelector(".form-subtask-comments").value.trim(),
      });
    });

    const days = Number(card.querySelector(".form-task-days").value) || null;
    const startDate = card.querySelector(".form-task-start").value;

    tasks.push({
      id: newId(),
      title,
      phase: card.dataset.phase || "",
      days,
      startDate,
      dueDate: card.querySelector(".form-task-due").value || taskDueDate(startDate, days),
      owner: card.querySelector(".form-task-owner").value.trim(),
      status: card.querySelector(".form-task-status").value,
      date: card.querySelector(".form-task-date").value,
      comments: card.querySelector(".form-task-comments").value.trim(),
      subtasks,
    });
  });
  return tasks;
}

function saveWeeklyUpdate(event) {
  event.preventDefault();
  if (!requirePermission("report.edit", "edit weekly reports")) return;

  const projectId = nodes.createReportProjectSelect.value;
  if (!projectId) return;

  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;

  const sections = [
    { label: "Last Week", weekStart: nodes.lastWeekDate.value, statusTag: nodes.lastWeekStatus.value, tasks: gatherTasksFromList(nodes.lastWeekTasksList), editingId: uiState.editingLastId },
    { label: "Upcoming / Running Week", weekStart: nodes.thisWeekDate.value, statusTag: nodes.thisWeekStatus.value, tasks: gatherTasksFromList(nodes.thisWeekTasksList), editingId: uiState.editingUpcomingId },
  ];

  // A section is "active" if it has tasks or corresponds to an existing record.
  const activeSections = sections.filter((sec) => sec.tasks.length || sec.editingId);

  if (!activeSections.length) {
    alert("Add at least one task in either the Last Week or Upcoming Week section.");
    return;
  }

  for (const sec of activeSections) {
    if (!sec.weekStart) {
      alert(`Please set the week start date for the ${sec.label} section.`);
      return;
    }
  }

  activeSections.forEach((sec) => {
    if (sec.editingId) {
      const index = state.updates.findIndex((u) => u.id === sec.editingId);
      if (index !== -1) {
        state.updates[index] = {
          ...state.updates[index],
          weekStart: sec.weekStart,
          weekRange: formatWeekRange(sec.weekStart),
          statusTag: sec.statusTag,
          tasks: sec.tasks,
        };
      }
    } else {
      state.updates.push({
        id: newId(),
        projectId: project.id,
        projectName: project.name,
        weekStart: sec.weekStart,
        weekRange: formatWeekRange(sec.weekStart),
        statusTag: sec.statusTag,
        tasks: sec.tasks,
        createdAt: new Date().toISOString(),
      });
    }
  });

  uiState.editingLastId = null;
  uiState.editingUpcomingId = null;
  syncOwnersIntoProjectPocs(project, activeSections.flatMap((sec) => sec.tasks));
  refreshProjectGoLive(project.id);
  saveState();

  openProject(project.id);
}

/* Any owner typed on a task that is not already a POC for this project is added to that
   project's POC list, so the name is offered from the dropdown next time. POCs stay scoped
   to their project — nothing here is global. */
function syncOwnersIntoProjectPocs(project, tasks) {
  if (!Array.isArray(project.clientPocs)) project.clientPocs = [];

  const known = new Set(project.clientPocs.map((poc) => poc.name.trim().toLowerCase()));
  const seen = [];

  tasks.forEach((task) => {
    seen.push(task.owner);
    (task.subtasks || []).forEach((sub) => seen.push(sub.owner));
  });

  seen
    .map((name) => (name || "").trim())
    .filter(Boolean)
    .forEach((name) => {
      const key = name.toLowerCase();
      if (known.has(key)) return;
      known.add(key);
      project.clientPocs.push({ name, email: "", addedFrom: "task" });
      debugLog(`POC "${name}" added to project ${project.name} from a task owner`);
    });
}


/* Everything above is declarations; start the app. */
boot();

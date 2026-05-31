const fs = require('fs');
const path = require('path');

const filePath = path.resolve('c:/Users/ADMN/Documents/TibhukeBus/Bus-booking-main-main/Bus-booking-main-main/src/components/scheduleTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const markers = {
  weeklyView: "// ─── Weekly view",
  scheduleCard: "// ─── Schedule card",
  reportsTab: "// ─── Reports tab",
  sectionHeader: "// ─── Section header",
  pagination: "// ─── Pagination",
  templateForm: "// ─── FIX #3: TemplateForm"
};

// Ensure all are found
const indices = {};
for (const [key, marker] of Object.entries(markers)) {
  let idx = content.indexOf(marker);
  if (idx === -1) {
    console.error("Could not find marker:", marker);
    process.exit(1);
  }
  indices[key] = idx;
}
// Find the start of the main default export or main component definition
const mainCompIdx = content.indexOf('export default function SchedulesTab');

if (mainCompIdx === -1) {
  console.log("Could not find main component 'export default function SchedulesTab'");
  // Let's search for just `const SchedulesTab` or `export const SchedulesTab`
}

console.log("Markers found, but doing full extraction would require creating many files and managing shared imports (like Schedule, Route, Map, etc).");
console.log("Given the complexity of types and shared state in this massive file, we will avoid breaking the app by doing blind substring surgical extraction without AST.");

const fs = require('fs');
const path = require('path');

const pageFile = path.resolve('c:/Users/ADMN/Documents/TibhukeBus/Bus-booking-main-main/Bus-booking-main-main/src/app/page.tsx');
let content = fs.readFileSync(pageFile, 'utf8');

// The parts to remove:
// from // ─────────────────────────────────────────────────────────────────────────────
// // LocationAutocomplete
// down to // ─────────────────────────────────────────────────────────────────────────────
// // Main Page

const startMarker = "// ─────────────────────────────────────────────────────────────────────────────\r\n// LocationAutocomplete";
const endMarker = "// ─────────────────────────────────────────────────────────────────────────────\r\n// Main Page";

let startIndex = content.indexOf(startMarker);
let endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  // Try with just \n
  const startMarkerLF = "// ─────────────────────────────────────────────────────────────────────────────\n// LocationAutocomplete";
  const endMarkerLF = "// ─────────────────────────────────────────────────────────────────────────────\n// Main Page";
  startIndex = content.indexOf(startMarkerLF);
  endIndex = content.indexOf(endMarkerLF);
}

if (startIndex !== -1 && endIndex !== -1) {
  const imports = `import { LocationAutocomplete } from "@/components/LocationAutocomplete";\nimport { CityPickerModal } from "@/components/CityPickerModal";\nimport { ScheduleCard } from "@/components/ScheduleCard";\nimport { EnhancedSchedule, GeoStatus, isToday, cityMatch } from "@/utils/homeHelpers";\n\n`;
  
  // also need to remove the inline interfaces EnhancedSchedule, GeoStatus, TabKey, SortKey etc from the top
  const typesStartMarker = "interface EnhancedSchedule {";
  const typesEndMarker = "type GeoStatus = \"idle\" | \"detecting\" | \"granted\" | \"denied\" | \"unavailable\";";
  
  let tStart = content.indexOf(typesStartMarker);
  let tEnd = content.indexOf(typesEndMarker);
  
  if (tStart !== -1 && tEnd !== -1) {
    content = content.slice(0, tStart) + content.slice(tEnd + typesEndMarker.length);
  }
  
  // Recalculate startIndex and endIndex since content length changed
  startIndex = content.indexOf("// ─────────────────────────────────────────────────────────────────────────────\n// LocationAutocomplete");
  if (startIndex === -1) startIndex = content.indexOf("// ─────────────────────────────────────────────────────────────────────────────\r\n// LocationAutocomplete");
  endIndex = content.indexOf("// ─────────────────────────────────────────────────────────────────────────────\n// Main Page");
  if (endIndex === -1) endIndex = content.indexOf("// ─────────────────────────────────────────────────────────────────────────────\r\n// Main Page");

  let finalContent = content.slice(0, startIndex) + imports + content.slice(endIndex);
  
  // Remove duplicate imports of lucide-react icons from top
  // we can just leave them if they are unused, TS will warn but compiling will pass if eslint warning is ignored, 
  // but let's be clean.
  
  fs.writeFileSync(pageFile, finalContent, 'utf8');
  console.log("Successfully replaced content in page.tsx");
} else {
  console.log("Could not find markers in page.tsx");
  console.log("Start: ", startIndex, "End: ", endIndex);
}

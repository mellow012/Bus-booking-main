function toUTCDateStr(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const endDate = new Date(today);
endDate.setUTCDate(endDate.getUTCDate() + 30);

const template = {
  id: '82c477c8-1b24-4d2e-be74-86e0f5872668',
  companyId: '231f3927-809e-4420-aff9-c7648d6ad64e',
  routeId: '46476ae8-baf3-4dc1-b42c-0aefe716daaf',
  busId: '39e3113e-64c8-4142-aaab-08e031262bd3',
  departureTime: '08:00',
  arrivalTime: '12:00',
  daysOfWeek: [ 0, 1, 2, 3, 4, 5 ],
  price: 25000,
  isActive: true,
};

let count = 0;
for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
  const targetDate = new Date(today);
  targetDate.setUTCDate(targetDate.getUTCDate() + dayOffset);
  const dayOfWeek = targetDate.getUTCDay();

  const activeDays = template.daysOfWeek || [];
  if (!activeDays.includes(dayOfWeek)) continue;

  count++;
}
console.log("Total generated:", count);

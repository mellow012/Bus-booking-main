export const CITY_DISTANCES: Record<string, Record<string, number>> = {
  'lilongwe': {
    'blantyre': 311,
    'mzuzu': 360,
    'zomba': 288,
    'kasungu': 127,
    'salima': 105,
    'mangochi': 190,
    'karonga': 585,
    'dedza': 85,
    'ntcheu': 152,
    'balaka': 192,
  },
  'blantyre': {
    'lilongwe': 311,
    'mzuzu': 671,
    'zomba': 68,
    'kasungu': 438,
    'salima': 335,
    'mangochi': 188,
    'karonga': 896,
    'dedza': 226,
    'ntcheu': 159,
    'balaka': 120,
    'thyolo': 39,
    'mulanje': 65,
    'mwanza': 100,
  },
  'mzuzu': {
    'lilongwe': 360,
    'blantyre': 671,
    'zomba': 648,
    'kasungu': 233,
    'salima': 465,
    'mangochi': 550,
    'karonga': 225,
    'nkhotakota': 285,
    'nkhatabay': 47,
    'rumphi': 73,
    'chitipa': 323,
  },
  'zomba': {
    'lilongwe': 288,
    'blantyre': 68,
    'mzuzu': 648,
    'kasungu': 415,
    'salima': 312,
    'mangochi': 120,
    'balaka': 72,
    'machinga': 45,
  }
};

export function getRouteDistanceAndDuration(origin: string, destination: string) {
  const o = origin.toLowerCase().trim();
  const d = destination.toLowerCase().trim();
  
  // Try direct lookup
  let distance = CITY_DISTANCES[o]?.[d] || CITY_DISTANCES[d]?.[o];
  
  if (!distance) {
    // If not found, use a rough estimation based on common routes or fallback to a default
    if (o === 'karonga' || d === 'karonga') distance = 585;
    else if (o === 'mzuzu' || d === 'mzuzu') distance = 360;
    else distance = 250; // Generic fallback
  }

  // Calculate duration assuming average speed of 65 km/h for buses in Malawi
  const averageSpeedKmH = 65;
  const durationHours = distance / averageSpeedKmH;
  
  // Convert to minutes, rounding up to nearest 15 mins for realism
  const durationMinutes = Math.ceil((durationHours * 60) / 15) * 15;

  return {
    distance,
    durationMinutes
  };
}

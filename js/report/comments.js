// Starter narrative library. Seeded once on first run, then fully editable.
//
// Two habits baked into this set on purpose:
// 1. Every observational comment is phrased "appeared to be... at the time of
//    the inspection" — a visual inspection is a snapshot, not a warranty, and
//    that phrasing is what actually limits liability if a condition changes
//    or worsens after the fact.
// 2. Variable facts (age, capacity) use a {Fill:label} placeholder instead of
//    a wall of near-duplicate comments — inserting one prompts for the value
//    once rather than needing "5 years", "8 years", "12 years" as separate
//    entries. See report/template.js item `tag`s for which of these overlap
//    with the 4-Point/Wind Mit forms.

// Bump whenever STARTER_COMMENTS changes in a way that should reach a device
// that already seeded its comment library — store.seedIfEmpty() upserts by
// (category + title) when this is newer than what's stored, so edits/adds
// here reach existing installs without wiping custom comments the inspector
// added themselves or their usage counts on existing ones.
export const COMMENTS_VERSION = 2;

export const STARTER_COMMENTS = [
  // ---- Roof — condition range, new to end of life ----
  { category: 'Roof', subgroup: 'Roof Covering', severity: 0, title: 'Roof covering — new / recently installed',
    body: 'The roof covering appeared to be newly installed at the time of the inspection, with no visible signs of wear, damage, or deterioration.' },
  { category: 'Roof', subgroup: 'Roof Covering', severity: 0, title: 'Roof covering — good condition',
    body: 'The roof covering appeared to be in good condition at the time of the inspection, with wear consistent with normal use and age. No repair appeared necessary at this time.' },
  { category: 'Roof', subgroup: 'Roof Covering', severity: 1, title: 'Roof covering — fair condition, aging',
    body: 'The roof covering appeared to be in fair condition at the time of the inspection, showing signs of aging consistent with its age, including some granule loss and minor wear. No active leakage was observed. Recommend continued monitoring and routine maintenance.' },
  { category: 'Roof', subgroup: 'Roof Covering', severity: 2, title: 'Roof covering — nearing end of service life',
    body: 'The roof covering appeared to be nearing the end of its serviceable life at the time of the inspection, with wear consistent with age including granule loss, curling, or cracking in isolated areas. No active leakage was observed at the time of the inspection. Recommend budgeting for replacement in the near term and monitoring for developing issues.' },
  { category: 'Roof', subgroup: 'Roof Covering', severity: 3, title: 'Roof covering — end of service life / replacement recommended',
    body: 'The roof covering appeared to be at or beyond the end of its serviceable life at the time of the inspection, exhibiting significant wear including granule loss, curling, cracking, and/or missing material.',
    recommendation: 'Recommend evaluation and replacement by a licensed roofing contractor.' },
  { category: 'Roof', subgroup: 'Roof Covering', severity: 1, title: 'Roof age (fill-in)',
    body: 'The roof covering was estimated to be approximately {Fill:years} years old at the time of the inspection, based on its visible condition and permit records where available.' },

  // ---- Electrical panel — condition range ----
  { category: 'Electrical', subgroup: 'Electrical Panel', severity: 0, title: 'Electrical panel — good condition',
    body: 'The electrical panel appeared to be properly installed and in good condition at the time of the inspection, with circuits identified and no obvious deficiencies observed.' },
  { category: 'Electrical', subgroup: 'Electrical Panel', severity: 1, title: 'Electrical panel — minor deferred maintenance',
    body: 'The electrical panel appeared to be functional at the time of the inspection but showed minor deferred maintenance, such as an incomplete circuit directory or missing knockout covers. Recommend correction as routine maintenance.' },
  { category: 'Electrical', subgroup: 'Electrical Panel', severity: 2, title: 'Electrical panel — deficiencies observed',
    body: 'The electrical panel appeared to have deficiencies at the time of the inspection that warrant further evaluation.',
    recommendation: 'Recommend evaluation and correction by a licensed electrician.' },
  { category: 'Electrical', subgroup: 'Electrical Panel', severity: 1, title: 'Electrical panel age (fill-in)',
    body: 'The electrical panel was estimated to be approximately {Fill:years} years old at the time of the inspection, based on its visible condition and labeling.' },
  { category: 'Electrical', subgroup: 'Electrical Panel', severity: 3, title: 'Federal Pacific Stab-Lok panel',
    body: 'The electrical distribution panel appeared to be a Federal Pacific Electric Stab-Lok panel at the time of the inspection. These panels have a documented history of breakers failing to trip under overload conditions, presenting a potential fire hazard, and are frequently declined or flagged by insurers.',
    recommendation: 'Recommend evaluation and replacement by a licensed electrician.' },
  { category: 'Electrical', subgroup: 'Electrical Panel', severity: 3, title: 'Zinsco / Sylvania panel',
    body: 'The electrical panel appeared to be a Zinsco or Sylvania-Zinsco type panel at the time of the inspection. These panels are known for bus bar damage and breakers that may fail to trip, and are commonly declined by insurers.',
    recommendation: 'Recommend evaluation and replacement by a licensed electrician.' },
  { category: 'Electrical', subgroup: 'Electrical Panel', severity: 3, title: 'Double-tapped breaker',
    body: 'Two or more conductors appeared to be terminated under a single breaker lug not listed for multiple conductors at the time of the inspection. This condition can result in loose connections and overheating.',
    recommendation: 'Recommend correction by a licensed electrician.' },
  { category: 'Electrical', subgroup: 'Wiring & Safety', severity: 3, title: 'Missing GFCI protection',
    body: 'Receptacles in wet or damp locations appeared to lack ground-fault circuit interrupter protection as required for the location, at the time of the inspection.',
    recommendation: 'Recommend installation of GFCI protection by a licensed electrician.' },
  { category: 'Electrical', subgroup: 'Wiring & Safety', severity: 4, title: 'Open splices / missing box covers',
    body: 'Exposed wiring splices outside of an approved enclosure, and/or junction boxes missing covers, were observed at the time of the inspection. This condition presents a potential shock and fire hazard.',
    recommendation: 'Recommend correction by a licensed electrician.' },
  { category: 'Electrical', subgroup: 'Wiring & Safety', severity: 3, title: 'Aluminum branch circuit wiring',
    body: 'Single-strand aluminum branch circuit wiring appeared to be present at the time of the inspection. Aluminum conductors of this type are prone to oxidation and loose connections at terminations over time, and insurers frequently require remediation.',
    recommendation: 'Recommend evaluation by a licensed electrician and remediation using an approved method (e.g. COPALUM or AlumiConn connectors).' },
  { category: 'Electrical', subgroup: 'Wiring & Safety', severity: 2, title: 'Smoke alarms past service life',
    body: 'Smoke alarms present appeared to exceed the manufacturer’s recommended 10-year service life, or were missing from one or more required locations, at the time of the inspection.',
    recommendation: 'Recommend replacement and installation in all required locations.' },

  // ---- Water heater — condition + fill-ins ----
  { category: 'Plumbing', subgroup: 'Water Heater', severity: 0, title: 'Water heater — good condition',
    body: 'The water heater appeared to be properly installed and functioning at the time of the inspection, with no signs of leakage or corrosion observed.' },
  { category: 'Plumbing', subgroup: 'Water Heater', severity: 1, title: 'Water heater — approaching service life expectations',
    body: 'The water heater appeared to be functioning at the time of the inspection but is approaching the upper end of its typical 10–12 year service life. No active leakage was observed. Recommend monitoring and budgeting for eventual replacement.' },
  { category: 'Plumbing', subgroup: 'Water Heater', severity: 2, title: 'Water heater — beyond typical service life',
    body: 'The water heater appeared to be at or beyond its typical 10–12 year service life at the time of the inspection. Tank failure at end of life can result in uncontrolled water discharge.',
    recommendation: 'Recommend budgeting for replacement by a licensed plumber.' },
  { category: 'Plumbing', subgroup: 'Water Heater', severity: 1, title: 'Water heater age (fill-in)',
    body: 'The water heater was estimated to be approximately {Fill:years} years old at the time of the inspection, based on the manufacture date on its data plate.' },
  { category: 'Plumbing', subgroup: 'Water Heater', severity: 0, title: 'Water heater capacity (fill-in)',
    body: 'The water heater has an approximate capacity of {Fill:gallons} gallons, per its data plate.' },
  { category: 'Plumbing', subgroup: 'Water Heater', severity: 2, title: 'Missing water heater drain pan',
    body: 'The water heater appeared to be installed without a drain pan and drain line at the time of the inspection, in a location where a leak would damage the finished interior.',
    recommendation: 'Recommend installation of a pan piped to an approved discharge point.' },
  { category: 'Plumbing', subgroup: 'Water Heater', severity: 3, title: 'TPR discharge piping improper',
    body: 'The temperature and pressure relief discharge line appeared to terminate improperly, was reduced in size, or was missing, at the time of the inspection. This is a scald and pressure-vessel safety concern.',
    recommendation: 'Recommend correction by a licensed plumber to terminate full-size within 6 inches of the floor or to the exterior.' },
  { category: 'Plumbing', subgroup: 'Supply & Fixtures', severity: 3, title: 'Polybutylene supply piping',
    body: 'Polybutylene water supply piping appeared to be present at the time of the inspection. This material is subject to premature failure and is a common cause of insurance decline or non-renewal in Florida.',
    recommendation: 'Recommend evaluation and repiping by a licensed plumber.' },
  { category: 'Plumbing', subgroup: 'Supply & Fixtures', severity: 2, title: 'Active leak at fixture',
    body: 'An active leak appeared to be present at the fixture supply or drain connection at the time of the inspection.',
    recommendation: 'Recommend repair by a licensed plumber.' },

  // ---- HVAC — condition + fill-in ----
  { category: 'HVAC', subgroup: 'HVAC System', severity: 0, title: 'HVAC system — good condition',
    body: 'The HVAC system appeared to be functioning normally at the time of the inspection, responding to thermostat controls with a temperature differential within the normal range.' },
  { category: 'HVAC', subgroup: 'HVAC System', severity: 1, title: 'HVAC system — approaching service life expectations',
    body: 'The HVAC system appeared to be functioning at the time of the inspection but is approaching the upper end of its typical 12–15 year service life. Recommend continued routine servicing and budgeting for eventual replacement.' },
  { category: 'HVAC', subgroup: 'HVAC System', severity: 2, title: 'HVAC system — beyond typical service life',
    body: 'The HVAC system appeared to be at or beyond its typical 12–15 year service life at the time of the inspection. Remaining service life cannot be predicted from a visual inspection.',
    recommendation: 'Recommend evaluation by a licensed HVAC contractor and budgeting for replacement.' },
  { category: 'HVAC', subgroup: 'HVAC System', severity: 1, title: 'HVAC system age (fill-in)',
    body: 'The HVAC system was estimated to be approximately {Fill:years} years old at the time of the inspection, based on the manufacture date on its data plate.' },
  { category: 'HVAC', subgroup: 'Airflow & Ductwork', severity: 2, title: 'Inadequate temperature differential',
    body: 'The measured temperature differential across the evaporator fell outside the normal 14–22°F range at the time of the inspection, which may indicate a refrigerant charge, airflow, or capacity concern.',
    recommendation: 'Recommend evaluation and service by a licensed HVAC contractor.' },
  { category: 'HVAC', subgroup: 'Airflow & Ductwork', severity: 1, title: 'Condensate drain concerns',
    body: 'The condensate drain appeared to show evidence of prior overflow, and/or did not appear to be properly trapped or equipped with a functional safety float switch, at the time of the inspection.',
    recommendation: 'Recommend service by a licensed HVAC contractor.' },
  { category: 'HVAC', subgroup: 'Airflow & Ductwork', severity: 0, title: 'Filter dirty',
    body: 'The air filter appeared to be heavily loaded at the time of the inspection, restricting airflow and reducing system efficiency.',
    recommendation: 'Recommend replacement and a regular filter change schedule.' },
  { category: 'HVAC', subgroup: 'Airflow & Ductwork', severity: 2, title: 'Damaged / disconnected duct',
    body: 'Ductwork appeared to be damaged, disconnected, or had deteriorated insulation at the time of the inspection, resulting in conditioned air loss.',
    recommendation: 'Recommend repair by a licensed HVAC contractor.' },

  // ---- Structure / Exterior ----
  { category: 'Structure', severity: 1, title: 'Negative grading at foundation',
    body: 'Site grading in the area observed appeared to direct surface water toward the foundation rather than away from it, at the time of the inspection.',
    recommendation: 'Recommend regrading to fall a minimum of 6 inches over the first 10 feet from the structure.' },
  { category: 'Structure', severity: 1, title: 'Stucco cracking',
    body: 'Cracking was observed in the stucco wall covering at the time of the inspection. Unsealed cracks can admit moisture into the wall assembly over time.',
    recommendation: 'Recommend sealing and monitoring; further evaluation if cracks widen.' },
  { category: 'Structure', severity: 2, title: 'Wood rot at trim / fascia',
    body: 'Deteriorated and rotted wood appeared to be present at exterior trim or fascia components at the time of the inspection.',
    recommendation: 'Recommend repair or replacement of affected components and correction of the moisture source by a qualified contractor.' },
  { category: 'Exterior', severity: 1, title: 'Vegetation contact with structure',
    body: 'Vegetation appeared to be in direct contact with the wall covering or roof at the time of the inspection, which can hold moisture against the structure and provide a pest access pathway.',
    recommendation: 'Recommend trimming to maintain clearance from the structure.' },

  // ---- Interior / Safety ----
  { category: 'Interior', severity: 1, title: 'Moisture staining observed',
    body: 'Moisture staining was observed on the ceiling or wall finish at the time of the inspection. The stain did not read elevated on a moisture meter at the time of the inspection, but the source should be confirmed.',
    recommendation: 'Recommend confirming the source has been repaired, and monitoring.' },
  { category: 'Safety', severity: 4, title: 'Missing / improper guard or handrail',
    body: 'A required guard or handrail appeared to be missing, loose, or had openings permitting passage of a 4-inch sphere, at the time of the inspection. This is a fall hazard.',
    recommendation: 'Recommend correction to current safety standards.' },
  { category: 'Garage', severity: 4, title: 'Garage door safety reverse failed',
    body: 'The automatic vehicle door did not reverse on contact, or on obstruction of the photo-eye sensors, at the time of the inspection. This is an entrapment hazard.',
    recommendation: 'Recommend adjustment or repair by a qualified garage door technician.' },
  { category: 'Garage', severity: 3, title: 'Fire separation compromised',
    body: 'The fire separation between the garage and living space appeared to be penetrated or damaged, and/or the door did not appear to be self-closing and fire-rated, at the time of the inspection.',
    recommendation: 'Recommend restoration of the required separation.' },

  // ---- General ----
  { category: 'General', severity: 0, title: 'Serviceable at time of inspection',
    body: 'This component appeared to be functioning as intended at the time of the inspection. No deficiencies were observed within the scope of a visual inspection.' },
  { category: 'General', severity: 0, title: 'Not inspected — inaccessible',
    body: 'This component could not be inspected because it was not accessible at the time of the inspection. No representation is made as to its condition.',
    recommendation: 'Recommend inspection once access is provided.' },
  { category: 'General', severity: 1, title: 'Deferred maintenance',
    body: 'The component appeared to show deferred maintenance typical for its age, at the time of the inspection. Attention now will extend its service life.',
    recommendation: 'Recommend routine maintenance and monitoring.' },
];

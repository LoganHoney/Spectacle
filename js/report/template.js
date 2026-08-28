// The inspection template. A job stores its own *snapshot* of this, so adding a
// section on-site changes that job only — never the master or past reports.

import { uid } from '../core/db.js';

export const ITEM_TYPES = {
  condition: { label: 'Condition rating', hasOptions: true },
  yesno:     { label: 'Yes / No', hasOptions: true },
  select:    { label: 'Upick (pick list)', hasOptions: true },
  text:      { label: 'Short text', hasOptions: false },
  narrative: { label: 'Narrative', hasOptions: false },
  number:    { label: 'Number', hasOptions: false },
};

// The full ITEM_TYPES set above still renders/reports correctly and is what
// the built-in master template uses — but when a field user adds a brand-new
// item on the fly, two choices covers virtually everything they need and
// keeps the "+ Item" flow fast under a ladder.
export const NEW_ITEM_TYPES = [
  { value: 'narrative', label: 'Narrative', hint: 'Free text — catch-all for any comment or observation' },
  { value: 'select', label: 'Upick', hint: 'A pick list you define — brands, sizes, materials, etc.' },
];

export const CONDITION_OPTIONS = ['Acceptable', 'Marginal', 'Defective', 'Not Present', 'Not Inspected'];
export const YESNO_OPTIONS = ['Yes', 'No', 'N/A'];

const S = (title, intro, items) => ({ id: uid('s_'), title, intro, items: items.map(mk) });

function mk(spec) {
  const [label, type = 'condition', options = null, hint = '', tag = null, group = null] = Array.isArray(spec) ? spec : [spec];
  return {
    id: uid('it_'),
    label,
    type,
    options: options || (type === 'condition' ? CONDITION_OPTIONS : type === 'yesno' ? YESNO_OPTIONS : null),
    hint,
    allowPhotos: true,
    // Stable across template clones (see cloneTemplate) — lets features like
    // the 4-Point "Copy from Inspection" button find this item reliably even
    // though its id is re-randomized on every new job.
    ...(tag ? { tag } : {}),
    // Matches a comment's `subgroup` — lets "From library" land straight on the
    // handful of comments for this specific fixture/topic instead of every
    // comment in the section. Optional: items without one just browse the
    // whole section's comments, same as before.
    ...(group ? { group } : {}),
  };
}

function build() {
  return [
    S('Scope & Conditions', 'Conditions present at the time of inspection.', [
      ['Weather at time of inspection', 'text'],
      ['Approximate outdoor temperature (°F)', 'number'],
      ['Ground / soil condition', 'select', ['Dry', 'Damp', 'Wet', 'Saturated']],
      ['Occupancy', 'select', ['Occupied — furnished', 'Occupied — partially furnished', 'Vacant']],
      ['Utilities on at time of inspection', 'yesno'],
      ['Persons present', 'text'],
      ['Areas not inspected / limitations', 'narrative', null, 'Inaccessible crawlspaces, stored belongings, locked rooms, etc.'],
    ]),

    S('Site & Grounds', 'Grading, drainage, walkways and site features that affect the structure.', [
      ['Site grading / slope away from structure'],
      ['Driveway & walkways'],
      ['Retaining walls'],
      ['Vegetation clearance from structure'],
      ['Surface drainage / standing water'],
      ['Fencing & gates'],
      ['Exterior grounds notes', 'narrative'],
    ]),

    S('Roof', 'Roof covering, drainage, flashing and penetrations.', [
      ['Method of inspection', 'select', ['Walked roof surface', 'Viewed from ladder at eave', 'Viewed from ground with binoculars', 'Viewed from drone', 'Not inspected — unsafe conditions']],
      ['Roof covering material', 'select', ['Asphalt / Fiberglass Shingle', 'Architectural Shingle', 'Concrete / Clay Tile', 'Metal', 'Built Up / Modified Bitumen', 'Membrane / Single Ply', 'Other'], '', 'roof_covering', 'Roof Covering'],
      ['Approximate age of covering (years)', 'number', null, '', 'roof_age', 'Roof Covering'],
      ['Roof covering condition', 'condition', null, '', 'roof_condition', 'Roof Covering'],
      ['Estimated remaining useful life (years)', 'number', null, '', 'roof_remaining_life'],
      ['Roof geometry', 'select', ['Hip', 'Gable', 'Hip & gable combination', 'Flat', 'Shed', 'Complex / multiple'], '', 'roof_geometry'],
      ['Flashing & penetrations'],
      ['Plumbing / exhaust vent boots'],
      ['Skylights'],
      ['Gutters & downspouts'],
      ['Fascia & soffit'],
      ['Evidence of prior repair', 'yesno'],
      ['Evidence of active leakage', 'yesno', null, '', 'roof_leaks'],
      ['Roof notes', 'narrative'],
    ]),

    S('Exterior', 'Wall covering, trim, openings and attached components.', [
      ['Wall covering material', 'select', ['Stucco over block', 'Stucco over frame', 'Vinyl siding', 'Fiber cement', 'Wood siding', 'Brick veneer', 'Painted block', 'Other']],
      ['Wall covering condition'],
      ['Trim & fascia'],
      ['Exterior doors'],
      ['Windows'],
      ['Window / door caulk & sealant'],
      ['Soffit & eave venting'],
      ['Exterior wall penetrations sealed'],
      ['Porches, decks & balconies'],
      ['Exterior electrical fixtures & receptacles'],
      ['Hose bibs'],
      ['Exterior notes', 'narrative'],
    ]),

    S('Structure & Foundation', 'Foundation, framing and visible structural components.', [
      ['Foundation type', 'select', ['Slab on grade', 'Stem wall', 'Crawlspace', 'Pier & beam', 'Basement']],
      ['Foundation condition'],
      ['Visible cracking', 'select', ['None observed', 'Hairline / cosmetic', 'Moderate', 'Significant — evaluation recommended']],
      ['Wall structure', 'select', ['Concrete block (CBS)', 'Wood frame', 'Block below / frame above', 'Steel frame', 'Other']],
      ['Floor structure'],
      ['Ceiling / roof framing'],
      ['Evidence of settlement or movement', 'yesno'],
      ['Evidence of wood-destroying organism damage', 'yesno', null, 'Report only — a WDO inspection is a separate licensed service.'],
      ['Structure notes', 'narrative'],
    ]),

    S('Attic, Insulation & Ventilation', null, [
      ['Method of inspection', 'select', ['Entered and traversed', 'Viewed from access hatch', 'Partially traversed — limited access', 'Not accessible']],
      ['Attic access location', 'text'],
      ['Roof sheathing / decking'],
      ['Truss / rafter framing'],
      ['Evidence of moisture intrusion', 'yesno'],
      ['Insulation type', 'select', ['Blown fiberglass', 'Blown cellulose', 'Batt fiberglass', 'Spray foam', 'None observed']],
      ['Approximate insulation depth (inches)', 'number'],
      ['Insulation condition & coverage'],
      ['Attic ventilation'],
      ['Exhaust fans terminate to exterior', 'yesno'],
      ['Attic notes', 'narrative'],
    ]),

    S('Electrical', 'Service, distribution, and representative devices.', [
      ['Service entrance', 'select', ['Overhead', 'Underground']],
      ['Service amperage', 'select', ['60 amp', '100 amp', '125 amp', '150 amp', '200 amp', '300 amp', '400 amp', 'Undetermined'], '', 'elec_amps'],
      ['Service voltage', 'select', ['120/240V single phase', '120/208V', 'Other']],
      ['Main panel manufacturer', 'text', null, '', 'elec_panel_brand', 'Electrical Panel'],
      ['Main panel location', 'text'],
      ['Panel / breaker condition', 'condition', null, '', 'elec_panel_condition', 'Electrical Panel'],
      ['Federal Pacific, Zinsco, Challenger or Sylvania panel present', 'yesno', null, 'Commonly an insurability issue in Florida.', null, 'Electrical Panel'],
      ['Double-tapped breakers observed', 'yesno', null, '', 'elec_double_taps', 'Electrical Panel'],
      ['Wiring Type(s) present', 'checkgroup', ['Copper', 'Single Strand AL', 'Multistrand AL', 'Copper Clad AL', 'Cloth (Knob & Tube)', 'Cloth Jacket Rubber Insulated', 'NM, BX or Conduit', 'Other'], '', 'elec_wiring_types', 'Wiring & Safety'],
      ['Wiring method', 'select', ['Non-metallic sheathed (Romex)', 'Conduit', 'Armored cable', 'Mixed'], '', null, 'Wiring & Safety'],
      ['Grounding & bonding'],
      ['GFCI protection where required', 'condition', null, '', null, 'Wiring & Safety'],
      ['AFCI protection where required'],
      ['Smoke & CO alarms', 'condition', null, '', null, 'Wiring & Safety'],
      ['Representative receptacles & switches'],
      ['Light fixtures & ceiling fans'],
      ['Open junction boxes / exposed splices', 'yesno', null, '', 'elec_open_junction', 'Wiring & Safety'],
      ['Electrical notes', 'narrative'],
    ]),

    S('Plumbing', 'Supply, drainage, fixtures and water heating.', [
      ['Main water supply', 'select', ['Public / municipal', 'Private well']],
      ['Main shutoff location', 'text'],
      ['Type of supply piping present', 'checkgroup', ['Copper', 'PVC/CPVC', 'Galvanized', 'Cast Iron', 'Polybutylene', 'PEX', 'ABS', 'Other'], '', 'plumb_pipe_types', 'Supply & Fixtures'],
      ['Polybutylene supply piping present', 'yesno', null, 'A common insurance decline in Florida.', null, 'Supply & Fixtures'],
      ['Drain / waste / vent material', 'select', ['PVC', 'ABS', 'Cast iron', 'Galvanized steel', 'Mixed']],
      ['Functional water flow', 'condition', null, '', null, 'Supply & Fixtures'],
      ['Functional drainage', 'condition', null, '', null, 'Supply & Fixtures'],
      ['Visible leaks or prior repairs', 'yesno', null, '', null, 'Supply & Fixtures'],
      ['Water heater type', 'select', ['Electric tank', 'Gas tank', 'Tankless electric', 'Tankless gas', 'Heat pump / hybrid'], '', null, 'Water Heater'],
      ['Water heater capacity (gallons)', 'number', null, '', null, 'Water Heater'],
      ['Water heater age (years)', 'number', null, '', 'plumb_wh_age', 'Water Heater'],
      ['Water heater condition', 'condition', null, '', null, 'Water Heater'],
      ['TPR valve & discharge piping', 'condition', null, '', null, 'Water Heater'],
      ['Water heater drain pan & seismic/strapping', 'condition', null, '', null, 'Water Heater'],
      ['Fixtures — sinks, tubs, showers, toilets', 'condition', null, '', null, 'Supply & Fixtures'],
      ['Sewage disposal', 'select', ['Public sewer', 'Septic system']],
      ['Fuel gas system & shutoff'],
      ['Plumbing notes', 'narrative'],
    ]),

    S('HVAC', 'Heating, cooling and distribution.', [
      ['System type', 'select', ['Central split — heat pump', 'Central split — AC with electric strip heat', 'Central split — AC with gas furnace', 'Package unit', 'Mini-split', 'Window / wall units', 'None']],
      ['Cooling capacity (tons)', 'number'],
      ['Manufacturer', 'text'],
      ['Air handler / furnace location', 'text'],
      ['Condenser age (years)', 'number', null, '', 'hvac_age', 'HVAC System'],
      ['Air handler age (years)', 'number', null, '', null, 'HVAC System'],
      ['Supply air temperature (°F)', 'number', null, '', null, 'Airflow & Ductwork'],
      ['Return air temperature (°F)', 'number', null, '', null, 'Airflow & Ductwork'],
      ['Temperature differential acceptable', 'yesno', null, 'Typically 14–22°F split on a properly operating system.', null, 'Airflow & Ductwork'],
      ['Condensing unit condition', 'condition', null, '', 'hvac_condition', 'HVAC System'],
      ['Air handler / evaporator condition', 'condition', null, '', null, 'HVAC System'],
      ['Refrigerant line insulation'],
      ['Primary & secondary condensate drains', 'condition', null, '', null, 'Airflow & Ductwork'],
      ['Emergency drain pan & float switch'],
      ['Ductwork condition', 'condition', null, '', null, 'Airflow & Ductwork'],
      ['Air filter', 'condition', null, '', null, 'Airflow & Ductwork'],
      ['Thermostat operation'],
      ['Combustion venting (if applicable)'],
      ['HVAC notes', 'narrative'],
    ]),

    S('Interior', 'Representative rooms, surfaces and components.', [
      ['Ceilings'],
      ['Walls'],
      ['Floors'],
      ['Interior doors'],
      ['Windows — operation & glazing'],
      ['Stairs, railings & guards'],
      ['Fireplace / chimney'],
      ['Evidence of moisture staining', 'yesno'],
      ['Evidence of mold-like growth', 'yesno', null, 'Reported as observation only; laboratory testing is a separate service.'],
      ['Interior notes', 'narrative'],
    ]),

    S('Kitchen & Appliances', 'Built-in appliances operated in normal cycles only.', [
      ['Cabinets & countertops'],
      ['Sink & faucet'],
      ['Garbage disposal'],
      ['Dishwasher'],
      ['Range / cooktop'],
      ['Oven'],
      ['Range hood / exhaust'],
      ['Microwave (built-in)'],
      ['Refrigerator'],
      ['Kitchen GFCI protection'],
      ['Kitchen notes', 'narrative'],
    ]),

    S('Bathrooms', null, [
      ['Number of bathrooms', 'number'],
      ['Toilets'],
      ['Sinks'],
      ['Shower/Tub'],
      ['Tub / shower surround & caulk'],
      ['Ventilation — fan or window'],
      ['Bathroom GFCI protection'],
      ['Evidence of moisture damage', 'yesno'],
      ['Bathroom notes', 'narrative'],
    ]),

    S('Laundry', null, [
      ['Laundry location', 'text'],
      ['Washer supply valves & drain'],
      ['Dryer power supply'],
      ['Dryer exhaust duct & termination'],
      ['Laundry notes', 'narrative'],
    ]),

    S('Garage & Carport', null, [
      ['Garage type', 'select', ['Attached', 'Detached', 'Carport', 'None']],
      ['Vehicle door(s) condition'],
      ['Automatic opener & safety reverse'],
      ['Photo-eye sensors'],
      ['Fire separation — wall & ceiling'],
      ['Self-closing door to living space'],
      ['Floor & slab'],
      ['Garage electrical & GFCI'],
      ['Garage notes', 'narrative'],
    ]),

    S('Pool & Spa', 'Included only when contracted. Mark items Not Present when no pool exists.', [
      ['Pool present', 'yesno'],
      ['Pool shell / surface'],
      ['Deck & coping'],
      ['Pump, filter & plumbing'],
      ['Heater'],
      ['Electrical bonding & GFCI'],
      ['Safety barrier / enclosure / gate'],
      ['Pool notes', 'narrative'],
    ]),

    S('Summary & Recommendations', 'Closing narrative for the client.', [
      ['Overall condition summary', 'narrative'],
      ['Recommended further evaluation', 'narrative'],
      ['Maintenance recommendations', 'narrative'],
    ]),
  ];
}

// Bump whenever build() changes in a way that should reach devices that already
// seeded a master template — store.seedIfEmpty() compares this against the
// stored built-in template's version and refreshes it when this is newer.
// New inspections clone from the (refreshed) master; jobs already in progress
// keep their own snapshot from cloneTemplate() and are never touched.
export const TEMPLATE_VERSION = 3;

export async function defaultTemplate() {
  return { id: uid('tpl_'), name: 'Standard Home Inspection', version: TEMPLATE_VERSION, sections: build() };
}

export function cloneTemplate(tpl) {
  // New ids throughout so a copied template can't collide with the original's data keys.
  return {
    ...tpl,
    id: uid('tpl_'),
    sections: tpl.sections.map((s) => ({
      ...s,
      id: uid('s_'),
      items: s.items.map((it) => ({ ...it, id: uid('it_') })),
    })),
  };
}

export function newSection(title = 'New Section') {
  return { id: uid('s_'), title, intro: '', items: [], custom: true };
}

export function newItem(label = 'New Item', type = 'condition', options = null) {
  return {
    id: uid('it_'),
    label,
    type,
    options: options || (type === 'condition' ? [...CONDITION_OPTIONS] : type === 'yesno' ? [...YESNO_OPTIONS] : null),
    hint: '',
    allowPhotos: true,
    custom: true,
  };
}

export function newFinding(p = {}) {
  return { id: uid('f_'), title: '', body: '', severity: 2, location: '', recommendation: '', ...p };
}

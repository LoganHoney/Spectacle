// Pre-inspection agreement: a merge-field text template, filled per job, with
// up to two client signatures plus the inspector's, stored permanently on the
// inspection record once signed.

import { buildMergeContext, mergeText, MERGE_FIELDS } from '../core/merge.js';

export const AGREEMENT_FIELDS = MERGE_FIELDS;

export const DEFAULT_AGREEMENT = `INSPECTION AGREEMENT

This is intended to be a Binding Legal Contract



Address of Property Inspected: {InspectionAddressInline}



Client(s) Name(s): {Inspectee}



Client Email and Phone Number:
{InspecteeEmail}
{InspecteePhone}



Date and Time of Inspection:
{InspectionDateWithTime}



Inspection Company:
{InspectorCompany}

Inspector:
{Inspector}


Inspection Fee:
{TotalAmount}


THIS CONTRACT and the terms included are binding upon all parties to this Contract.




Contract: This Contract is made by and between the Client(s) (referred to herein as "Client") and the INSPECTOR (referred to herein as "INSPECTOR"). The term Client shall include the undersigned representative of the Client, as well as any of Client's past, present and future subsidiaries, divisions, parents, affiliates, assigns, related entities, successors, predecessors, representatives, employees, officers, shareholders, directors, agents, assigns, spouse, and any other person or entity that benefits from or relies on the Inspection Report. The term INSPECTOR shall include the undersigned representative of the INSPECTOR, its past, present and future subsidiaries, divisions, parents, affiliates, assigns, related entities, successors, predecessors, representatives, employees, officers, shareholders, directors, agents, and assigns.

Scope of the Inspection: This inspection will be performed in accordance with the InterNachi standards of practice. Client acknowledges that there are limitations and exclusions in the Standards of Practice. Client acknowledges that the inspection is being completed by a "generalist" and not a "specialist" INSPECTOR in any trade or profession. This home inspection is a limited, visual and non-invasive inspection for material defects in the operating systems and conditions within the structure at that time of the inspection. Any defect, condition or non-functioning system found during the inspection will be identified in the INSPECTOR's report.



No Guarantee: The inspection report is not and has never been intended as a guarantee as to how long any systems or conditions will remain in the same condition as found during the inspection. Nor is it a guarantee of the future of any system or condition. The INSPECTOR makes no guarantee or warranty, of any kind, express or implied, including but not limited to the following:

a. That all defects have been found or that the INSPECTOR will pay for repair of undisclosed defects;

b. That any of the items inspected are designed or constructed in a good and workmanlike manner;

c. That any of the items inspected will continue to perform in the future as they are performing at the time of the inspection; and

d. That any of the items inspected are merchantable or fit for any particular purpose




EXCLUDED FROM INSPECTION: This inspection does not determine the insurability, quality, durability, or future performance of any item or system inspected. Systems, items, and conditions which are not within the scope of the home inspection include, but are not limited to: pest infestation; security and fire protection systems; household appliances; humidifiers, interior of walls, ceilings, and floors; recreational equipment or facilities, pool/spa water purification systems; underground storage tanks; buried pipelines, tanks, gas or water lines, water wells, all overflow drains; heating system's accessories; solar heating systems; lawn sprinkling systems, water softener or purification systems; central vacuum systems; telephone, intercom or cable TV systems; antennae, tree or plants, governing codes, ordinances, statutes, and covenants; and manufacturer specifications, recalls, and EIFS. INSPECTOR will not evaluate soil conditions, the stability of the soil or subsurface conditions or the ability of the soil and subsurface material to support the structure inspected. Minor defects and maintenance items that do not affect the safety or structural integrity of the structure, including minor repairs or adjustments to mechanical systems, and minor plumbing problems are excluded from this report. Some homes with conventional stucco, EIFS systems and composite siding can experience water penetration and damage associated with water penetration, which may not be visibly evident during a normal visual inspection. INSPECTOR does not inspect these systems, and assumes no liability for any hidden damage that may be present in the structure behind these products. Client understands that these systems, items and conditions are excepted from the inspection. Testing, measuring, using meters or devices of any kind, dismantling equipment, or doing calculations for any system or component to determine adequacy, capacity or compliance with any standard is outside the scope of the "generalist' INSPECTOR and reserved for the "specialist." Any general comments about these systems, items and conditions of the written report are informal only and DO NOT represent an inspection. For further clarity: The following are examples of types of inspections that are NOT covered by this inspection:

(a) building code/local ordinance, energy audit, product recall, permit compliance or invasive inspections.

(b) inspection as to whether previous remodeling was done correctly, with permits and done according to Code.

(c) an evaluation of the value or future earning potential of the property now and/or in the future.

(d) determine the existence or condition of polybutylene, polyethylene, or similar plastic piping. The inspector may report on the type of piping visible in some areas of the property, but is not responsible for identifying or determining the existence of any type of piping. It is recommended the Client consult with a licensed Plumber on those questions.

(e) Environmental issues/conditions which are outside the "generalist" INSPECTOR's expertise; including but not limited to the detection, or investigation of asbestos, radon, lead, creosote, urea-formaldehyde, toxic or flammable materials, all mold and fungus and related other environmental condition on or under the property.


Client's Duties: The client's duties under this Contract are:

Right to enter & inspect the property. The home INSPECTOR is not a party to the sale of this property. As such, it is the duty of the Client and the Client's Realtor to coordinate the time and availability of the property for the INSPECTOR. This includes the permission for the INSPECTOR to enter the property to be inspected.



Duty to advise of safety issues on the property. It is the duty of the Client to seek information as to any safety concerns on the property which could cause injury or damage to any person who will be present at the inspection including the INSPECTOR. The same duties apply should a request for reinspection of repairs during the escrow occur if the INSPECTOR is requested to return to the property.



Duty to read and inquire. The Client is under a duty to read and inquire as to any issue(s) or finding(s) contained in the inspection Contract and the inspection report which is a concern. This inquiry should be done as quickly as possible.



Duty to give timely notice. It is the duty of the Client to give timely notice of any defect found at the property post close of escrow. This notice to the INSPECTOR must be made within 10 days preferably in writing or by email. No changes are to be made to this/those claimed defect(s) so the INSPECTOR can observe the condition(s)/defects as it was found in its unaltered position. Such removal or repair would substantially inhibit INSPECTOR's opportunity to defend himself/herself in a dispute. IF CLIENT FAILS TO GIVE PROPER WRITTEN NOTICE HEREUNDER, ALL OF CLIENT'S POTENTIAL CLAIMS FOR DAMAGES ARISING OUT OF SUCH COMPLAINT ARE EXPRESSLY WAIVED, INCLUDING THE NEGLIGENCE OF THE INSPECTOR. THE WAIVER CONTAINED HEREIN IS INTENDED TO BE ENFORCEABLE AGAINST THE PARTIES IN ACCORDANCE WITH THE EXPRESS TERMS AND SCOPE THEREOF NOTWITHSTANDING ANY EXPRESS NEGLIGENCE RULE OR ANY SIMILAR DIRECTIVE THAT WOULD PROHIBIT OR OTHERWISE LIMIT INDEMNITIES BECAUSE OF THE NEGLIGENCE OR GROSS NEGLIGENCE (WHETHER SOLE, JOINT OR CONCURRENT OR ACTIVE OR PASSIVE) OR OTHER FAULT OR STRICT LIABILITY OF ANY OF THE INDEMNIFIED PARTIES.



Assignable Rights to 3rd parties do not exist. This Contract is not assignable to anyone without the expressed written consent of the INSPECTOR. The inspection report is provided solely for the benefit of the Client and may not be relied upon by any other person. An assignment of this inspection report to another without the expressed written permission of the INSPECTOR terminates any rights of the "holder of the assignment" and the client to seek legal relief as to the INSPECTOR.



Reading of the inspection Contract and inspection report. The Client agrees to read the entire inspection Contract before signing. Client's signature on the Contract is the Client's consent to the terms of the Contract. Client further agrees to read the entire inspection report before the close of the conditions period for the sale of this property. If any questions arise during the escrow and within the period changes can be made, it is the duty of the Client to call the INSPECTOR and seek information. All opinions as to the condition of this property by the INSPECTOR are contained within the written inspection report and not within any "claimed" oral statement(s).



Environmental and Pest. The home inspection does not include an environmental assessment. Therefore, INSPECTOR shall not do any testing of any condition including water, soil or air. This is outside the expertise and scope of this inspection. The INSPECTOR is not trained and does not have the education to opine as to termite, mold and related conditions whether those damages arise from airborne, sub-soil or any form of water intrusion. No sampling is taken for this condition as part of this inspection unless otherwise agreed to in writing by the INSPECTOR and the Client.




Liability Waiver - Additional Inspections by Specialists: As to any of the Inspection Report's recommendation for further evaluation of a flagged deficiency by a specialty contractor, termite inspector, or by an engineer, Client agrees to carefully consider obtaining such further third party evaluation prior to expiration of Client's contingency period and/or close of escrow. Client's failure to obtain such further evaluation shall absolve HOME INSPECTOR from liability for all claims involving the deficient system or component, including undisclosed defects of the system or component which would be detected in connection with the specialty contractor's or engineer's evaluation.



Statute of Limitations. The Client and the Inspector agree that no claim, demand, or action, may be brought to recover damages against the Inspector, or any of its officers, agents or employees, more than one (1) year after the date of the inspection, regardless of when the Client discovers facts that support such claims or actions. THE ONE YEAR PERIOD OF TIME MAY BE SHORTER THAN THE TIME SET BY STATUTE. CONSIDERATION FOR THIS LIMITATION IS BASED ON THE PRICE OF THE INSPECTION. Client agrees to this term based on the price of the inspection. This is a material term and condition to this Contract and Client is bound by that agreement.


LIMITATION OF LIABILITY AND LIQUIDATED DAMAGES. By signing this Contract, the Client acknowledges that the inspection fee paid to the INSPECTOR is nominal given the risk of liability associated with performing inspections if liability could not be limited. The INSPECTOR assumes no liability for the costs of repair or replacement associated with unreported or undisclosed defects. Client acknowledges that without the ability to limit liability, the INSPECTOR would be forced to charge the Client much more than the inspection fee for the INSPECTOR's services. Client acknowledges being given the opportunity to have this Contract reviewed by counsel of his or her own choosing and further acknowledges the opportunity of hiring a different INSPECTOR to perform the inspection. BY SIGNING THIS CONTRACT, CLIENT AGREES THAT THE LIABILITY OF THE INSPECTOR SHALL BE LIMITED TO LIQUIDATED DAMAGES IN AN AMOUNT EQUAL TO TWO (2) TIMES THE FEE PAID TO THE INSPECTOR FOR THIS INSPECTION AND THIS LIABILITY SHALL BE EXCLUSIVE.



Legal Fees. In any action at law or equity, the parties agree that the prevailing party is entitled to reasonable attorney fees, expert fees and all costs including the costs of the binding arbitrator or mediator.



Reinspection: If certain areas of the property are inaccessible or the INSPECTOR is unable to inspect any home system, component, or area for any reason during the initial

inspection, the CLIENT is wholly responsible for requesting and scheduling the reinspection. If a reinspection is requested for any reason, any re-inspection is subject to all the terms and conditions of this Agreement. If a reinspection is requested, INSPECTOR reserves the right to charge a reinspection fee not to exceed 50% of the original home inspection fee.



Mandatory Mediation Agreement. The contracting parties agree to a mandatory mediation clause applying to all disputes through a mediation program agreeable to the contracting parties before any litigation is filed or demand for binding arbitration is sent. Notice of mediation must be sent return-receipt requested with 30 days allowed for the opposing party to respond. If the responding party agrees, an agreed upon mediator will be selected by the contracting parties. If a lawsuit is filed or if a demand for binding arbitration is sent and the above conditions are not met, the non-complying violator then forfeits all rights to prevailing party's attorney fees, expert fees and costs. Each contracting party shall share the mediation fees equally.


Contractual Severability. If, for any reason including jurisdictional issues which may apply, those clauses which do not apply shall be removed and all of those clauses that remain shall apply to the contracting parties without prejudice to any party to this Contract.



Choice of Law and Venue: Client agrees that this Contract will be construed and enforced by the laws in the state and jurisdiction where the inspected property is located. The exclusive venue for any dispute shall be in the county where the INSPECTOR's business is located.`;

export function mergeAgreement(template, ctx) {
  return mergeText(template, buildMergeContext(ctx));
}

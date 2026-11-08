# Catalog verification log (2026-11-08)

The catalog grew from 18 to 24 entries on Nov 8. The 6 new entries are `team-checked` until someone opens each page and confirms every fact.

Checked against the official pages on miami.gov and miamigardens-fl.gov.

## Corrected

| Entry | What changed | Evidence |
| --- | --- | --- |
| `homebuyer` | Phone 305-416-2149 → **305-416-2080** | The homebuyer page says to request an application by calling 305-416-2080. |
| `gardens-drainage` | Phone 786-279-1280 → **305-622-8000** (city line), in the phone field and in the step text of all three languages, also in `backend/askCity.function.js` and the CSV | 786-279-1280 was not found on any official page or in a web search. Pending direct Stormwater number. |
| `senior-rent` | Added: "does not pay past-due rent"; exact last period Jan 26 – Feb 20, 2026 | Program page: rent must be current; reopened Jan 26 – Feb 20, 2026. |
| `gardens-code` | Added hours (Mon–Thu, 7 a.m.–5:30 p.m.) and "anonymous complaints are no longer accepted" | Department page and FAQ on miamigardens-fl.gov. |
| `abandoned` | Added email option unsafestructures@miamigov.com | Report page: call 311 or email. |
| `section8` | Added that the waitlist closed in October 2014 | Section 8 Q&A page. |

## Added

| Entry | Evidence |
| --- | --- |
| `jobs-miami` (found by Ronald) | miami.gov Opportunity Center page: free platform connecting job seekers with local jobs and training; Contact Us 305-960-5110; OpportunityCenterInfo@miamigov.com. |

## Confirmed as written

| Entry | Fact | Evidence |
| --- | --- | --- |
| `abandoned` | Inspection within ten days | "An inspection of the property will take place within ten days." |
| `gardens-senior-home` | One-time award up to $10,000, applicants 62+ | Program page. Heading still says "2024 Open Enrollment", so the card never says it is open. |
| `gardens-code` | 305-622-8020 for general information and complaints | Department contact list. |
| `section8` | Not accepting applications; 305-416-1572 for waitlist contact changes | Section 8 Q&A page. |

## Added on Nov 8 (team-checked, need a final check)

| Entry | Official page |
| --- | --- |
| `gardens-bulky` | miamigardens-fl.gov/374/Bulk-Waste-Pickup (phone 311: confirm Miami Gardens residents use Miami-Dade 311 for bulk pickup) |
| `gardens-freebee` | miamigardens-fl.gov/1019/Freebee-Miami-Gardens |
| `gardens-university` | miamigardens-fl.gov/956/City-University-Partnership |
| `gardens-housing` | miamigardens-fl.gov/186/Community-Resources |
| `miami-meetings` | miami.gov City Commission Meetings 2026 calendar |
| `gardens-meetings` | miamigardens-fl.gov/269/City-Council |

## Still pending (Ronald)

- `gardens-drainage`: open miamigardens-fl.gov/231/Stormwater and look for a direct number.
- `work`: confirm whose number 305-594-7615 is (city or CareerSource).
- All `team-checked` entries: open each link, confirm phone and every fact, then set `verification.status` to `verified` and rebuild.
- Haitian Creole text: one native speaker should read every `ht` card.

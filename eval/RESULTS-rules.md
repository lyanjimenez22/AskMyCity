# Evaluation results (rules only)

Run: 2026-11-08T12:17:09.323Z

| Metric | Value |
| --- | --- |
| Questions (es/en/ht, 2 cities) | 42 |
| Correct | 37 (88.1%) |
| By language | es: 22/23, en: 9/12, ht: 6/7 |
| Answered by rules (free, instant) | 33 |
| Escalated to AI | 9 |
| Confident but wrong (most dangerous error) | 0 |
| Tie-break picked a less specific official page | 3 |
| Invented links | 0 |
| AI cost for the whole run (USD) | 0.0000 |

## Misses

- #14 (miami/en) "someone dumped an old mattress in the empty lot": got `trash`, expected `dumping` (rules: ambiguous)
- #35 (gardens/en) "I want to file a complaint about a business with no license": got `citycares`, expected `gardens-code` (rules: ambiguous)
- #37 (gardens/es) "quiero reportar un vendedor ilegal": got `citycares`, expected `gardens-code` (rules: ambiguous)
- #40 (miami/en) "the road in front of my house has a big hole": got `fallback`, expected `pothole` (rules: no_match)
- #42 (miami/ht) "gen fatra moun jete sou teren vid la": got `fallback`, expected `dumping` (rules: no_match)

# Deployed function, public path (no AI)

```
{
  "mode": "deployed Base44 function, public user",
  "questions": 42,
  "correct": 36,
  "accuracy": "85.7%",
  "by_language": "es: 22/23, en: 8/12, ht: 6/7",
  "confident_wrong": 1,
  "non_official_links": 0
}
```

Misses:

  #2 [miami/en] "my street floods when it rains" -> got fallback, expected flood
  #14 [miami/en] "someone dumped an old mattress in the empty lot" -> got fallback, expected dumping
  #35 [gardens/en] "I want to file a complaint about a business with no license" -> got citycares, expected gardens-code
  #40 [miami/en] "the road in front of my house has a big hole" -> got fallback, expected pothole
  #41 [miami/es] "el pasto del terreno vacío está altísimo" -> got fallback, expected overgrown
  #42 [miami/ht] "gen fatra moun jete sou teren vid la" -> got fallback, expected dumping

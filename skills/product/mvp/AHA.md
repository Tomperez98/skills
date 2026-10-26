# Finding the five-minute "aha"

You have a specific idea. The goal is to strip it to the one core use case
and the shortest journey to real value. Apply the rules in order.

## 1. Name the one core use case

Every idea has one main use case — the thing most people will open the app
to do. Say it in one sentence. If you can't name a single main use case, you
haven't found it yet; keep looking.

## 2. Cut the feature list

Everything that isn't the core use case is scope creep until the core one is
validated. Delete each feature that doesn't serve it for now, and bring it
back after someone real hits the aha ([VALIDATE.md](VALIDATE.md)).

## 3. Define the core experience

Ask: what is the core experience, and how does the user get value quickly?
The answer is a moment, not a menu — the single interaction where the payoff
lands. "A photo that comes back with lines on it" is a core experience;
"a dashboard of metrics" is a menu.

## 4. Draw the five-minute journey

Consumers give a new app about five minutes. Map the journey from open to value,
and cut anything that pushes the aha past that window. Every extra step before
the payoff costs users.

```text
Use case:  <the one sentence from rule 1>
Journey:   open → <step> → <step> → aha: <the moment from rule 3>
Time:      <m:ss> to the aha, under 5:00
Cut:       <features and steps removed>
```

## Done when

- The one core use case is written as one sentence (rule 1).
- The core experience is named as a single moment (rule 3).
- Every feature that doesn't serve it is cut, and only one use case is in
  the MVP (rule 2).
- The journey is written step by step from open to the aha, and fits in five
  minutes (rules 3–4).

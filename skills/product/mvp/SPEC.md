# Spec'ing the idea

You have an idea. The goal is one specific paragraph — not a spec document —
specific enough that the next thing you build is a concrete thing you can
react to. Apply the rules in order.

## 1. Write one paragraph, not ten

Break the idea down as much as you can into a paragraph with a handful of
bullets, then stop. The point isn't completeness — it's a target the first
implementation can be checked against. A paragraph is enough to start; more
is you stalling.

## 2. Imagine the interface

Get concrete about the interface, not just the concept. Don't say "a
looksmaxing app"; say the app opens a camera, you point it at your face, and
it draws lines over the photo showing exactly what to change. Name the
screens, the interaction, what the user taps and sees.

## 3. Bullet the specifics

Each bullet is one concrete detail — a screen, an action, an input, an
output. Vague bullets ("has AI") don't count; specific ones ("takes a photo
of my face and draws lines on it") do.

## 4. Keep it to a paragraph

Resist the urge to keep going. You aren't writing the product spec — you're
writing enough to get a first implementation, which you'll then react to.
If you catch yourself designing a second feature, you've left this branch
(see [AHA.md](AHA.md), "Cut the feature list").

## 5. React to the first implementation

Hand the paragraph over and get back an initial implementation, then check:
did it get the idea right or wrong? Nudge it in the directions that matter.
The paragraph is a target you aim and then correct, not a contract you
defend.

## 6. You're looking for the key use case

All this specificity has one purpose: to surface the one use case that
matters. If the paragraph doesn't make the key use case obvious, you aren't
specific enough yet.

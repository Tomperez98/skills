# Spec'ing the idea

You have an idea. The goal is one specific paragraph — not a spec document —
specific enough that the next thing you build is a concrete thing you can
react to. Apply the rules in order.

## 1. Write one paragraph, not ten

Break the idea down as much as you can into a paragraph with a handful of
bullets, then stop. The point isn't completeness — it's a target the first
implementation can be checked against. A paragraph is enough to start. If
you catch yourself designing a second feature, you've left this branch →
[AHA.md](AHA.md). When the paragraph hangs on decisions only the user can
make, call the Skill tool with "grill" before you write it.

```text
<One paragraph: who opens it, what they see, what they do, what comes back.>

- Screen:   <what the user sees first>
- Action:   <what they tap or do>
- Output:   <what they get back>
- Key use:  <the one use case this is for>
```

## 2. Imagine the interface

Get concrete about the interface, not just the concept. Write "the app opens a
camera, you point it at your face, and it draws lines over the photo showing
exactly what to change" rather than "a looksmaxing app". Name the screens, the
interaction, what the user taps and sees.

## 3. Bullet the specifics

Each bullet is one concrete detail — a screen, an action, an input, an
output. Write "takes a photo of my face and draws lines on it", not "has AI".

## 4. React to the first implementation

Hand the paragraph over and get back an initial implementation, then check:
did it get the idea right or wrong? Nudge it in the directions that matter.
The paragraph is a target you aim and then correct.

## 5. You're looking for the key use case

All this specificity has one purpose: to surface the one use case that
matters. If the paragraph doesn't make the key use case obvious, you aren't
specific enough yet.

## Done when

- The spec is one paragraph and a handful of bullets, with no second feature
  (rule 1).
- Each bullet names a screen, action, input, or output; none says "has AI"
  (rules 2–3).
- The key use case is named in the spec (rule 5).
- A first implementation exists, and you wrote down what it got right, what
  it got wrong, and the nudge (rule 4).

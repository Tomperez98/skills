---
name: craft
description: >
  Build software with a point of view, not zombie UI. One rule: never ship
  zombie UI — every detail shows the maker's care and intent. Use when the
  user builds or designs a product or interface with AI, wants to
  differentiate or add character, encodes standards so agents build
  consistently, polishes AI output, judges done vs good, or makes it feel
  alive and inventive — even if they never say "zombie UI", "AI slop",
  "craft", or "point of view".
---

# Craft

Build software that feels cared for, not generated. Everything in this skill
follows from one rule:

> **Never ship zombie UI — every detail shows the maker's care and intent.**

An AI building boom can look a lot like the post-war one: everyone can build
fast, so the thinking gets thin and what's left are generic patterns
ill-suited to the context — "zombie UI": monotonous, vacant, uncared for.
The culprit isn't AI itself, it's abdicating the decisions to it. AI is good
at telling you the most probable answer (what's popular, what worked, what's
in style); it's bad at what's original or specific to you, your brand, and
your user's context. This skill is the antidote: a point of view, standards
encoded into the system, editing that refuses to confuse done with good, and
creativity that uses AI to raise the ceiling instead of just the floor.

## Pick a branch

Identify which situation you're in — from the user's prompt, the artifact,
or by asking if the user is around:

- **"What's our point of view / who are we to the user?"** →
  [POINT_OF_VIEW.md](POINT_OF_VIEW.md). Define the brand and what you care
  about before you build, or AI hands you a generic one.
- **"Make agents / AI build consistently / encode our standards"** →
  [STANDARDS.md](STANDARDS.md). Encode standards into the means of
  production so the system scales intent, not just consistency.
- **"Is this actually good / edit or polish this / done vs good"** →
  [EDIT.md](EDIT.md). Be the editor: experience it like a user, account for
  every detail, refuse to confuse done with good.
- **"Differentiate / make it feel alive / invent a new interface"** →
  [CREATE.md](CREATE.md). Unleash creativity: better inputs, stressed
  outputs, new interfaces and aesthetics.

The four branches run roughly in order — point of view, standards, edit,
create — but you rarely do all four at once. Getting the branch wrong wastes
the work, so if it's genuinely ambiguous and the user isn't reachable,
default to the stage the prompt names (a "who are we / what do we care
about" ask → POINT_OF_VIEW; a design-system or agent-consistency ask →
STANDARDS; a finished thing that "looks done" or a polish request → EDIT;
an "it's boring / same as everyone" ask → CREATE) and state the assumption
at the top.

## The one rule

**Never ship zombie UI — every detail shows the maker's care and intent.**

- **Zombie UI is the default.** AI makes the most probable thing feel
  finished fast — a polished surface that's monotonous, vacant, or uncared
  for, with no character, no context, no fit to purpose. It's what you get
  when you let AI make the decisions. The rule is a test: does each detail
  show a maker's care and intent, or is it interchangeable?
- **Care is the standard, not the method.** Users don't care whether
  something was made with AI; they care whether it's good. So the bar is
  the output — does it solve the problem, does it differentiate, does it
  anticipate the user's needs — not how fast it was made.
- **Intent has to come from you.** AI will happily give you a point of
  view, but it'll be generic and backward-looking. Your brand, your
  standards, your judgment, and your ambition are the only things that make
  the output original.

POINT_OF_VIEW defines the intent, STANDARDS encodes it so distributed and
agentic building can't drift, EDIT holds the output to the bar, and CREATE
pushes past the generic to something alive. Together they turn "care" from a
slogan into a procedure.

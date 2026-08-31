# Writing a tutorial or quickstart

A tutorial takes a beginner from zero to a working result on *one* outcome.
It is not a reference, not a tour of every feature — it's a guided path with
the reader doing the work. The moment the reader gets stuck, they leave.
Apply the rules in order.

## 1. One outcome, stated up front

Say exactly what the reader will have built by the end, in one line. A
tutorial with a vague or unbounded goal ("Learn X") fails; one with a
concrete goal ("Deploy a todo API to Fly in 10 minutes") succeeds or fails
honestly.

```
In this tutorial you'll build a rate-limited URL shortener and deploy it.
You'll need: Node 20+, a Fly account.
```

## 2. List prerequisites, then satisfy them

State what the reader must have installed or know, and say how to check it
— or make the tutorial start from a cloneable/zero-setup state. A reader who
discovers a missing dependency at step 4 resents you at step 4.

## 3. Every step is copy-paste and observable

Each step is a command or snippet the reader runs, and produces something
they can see (output, a running server, a test passing). No step should say
"now understand this" — the reader builds, and understanding follows from
building.

```
Run:

    $ npm run dev

You should see "Listening on :3000". Open http://localhost:3000 and you'll
see the JSON. If you see "EADDRINUSE", port 3000 is taken.
```

## 4. Show the expected output (and the common failures)

After every command, show what success looks like, and name the one or two
failures a real reader will hit and how to recover. "If you see X, run Y" is
the difference between a tutorial and a maze.

## 5. Build incrementally; checkpoint the reader

Reveal the system one working slice at a time, and give the reader a way to
catch up — link to the complete code at each checkpoint. A reader who fell
behind at step 3 should be able to jump to step 4 without redoing steps 1–3
by hand.

## 6. Don't wander

Every step must serve the one outcome. Resist the urge to explain
unrelated features ("while we're here, let's also..."). A tutorial is a
line, not a tour. Put the tour in a separate page.

## 7. End with the result and the next step

Close by showing the finished thing, then hand the reader one concrete next
step — a link to the reference, a challenge ("add a delete endpoint"), or
the guides. Leave them mid-momentum, not at a dead end.

## 8. Test the tutorial as written

Run your own tutorial from scratch, in a clean environment, pasting each
command exactly as written. Any step that doesn't produce the stated output
is a bug in the tutorial, not the reader. Fix the text, not the reader.

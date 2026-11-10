---
name: building-interfaces
description: Applies framework-agnostic rules for user interfaces - UI states, accessibility (WCAG), keyboard and focus, forms, responsive layout, design-system use, and front-end performance (Core Web Vitals, images, bundles). Use when building or changing pages, screens, components, forms, dialogs, or layouts in any web or app UI framework, when meeting accessibility requirements, or when a UI is slow to load or respond.
---

# Building interfaces

These rules are framework-agnostic. Translate them to the project's stack, and let repo conventions and its design system decide mechanics. The writing-code rules still apply to the code underneath. If another workflow skill is active, it owns the steps. Apply these rules inside each step. On conflict between a workflow skill's UI advice and these rules, these rules win. Say so when you override one.

**One rule: design every state, let every user operate it, and make it fast on a slow phone.**

## States
- Render every state the data can be in: loading, empty, error (with a way to retry), partial, success, and no permission. Model them as one closed union, not several booleans.
- Roll back an optimistic update and tell the user when its request fails.
- A submit in flight is disabled or deduplicated, so a double click sends one request.
- Keep shareable view state (filters, sort, page, selected tab) in the URL.
- Test with awkward content: a long name, a translated label, a missing image, a zero count.

## Accessibility (WCAG AA baseline)
- Use native elements for their job: `button` for actions, `a` for navigation, a `label` tied to each input. Use ARIA only when no native element fits.
- Everything that responds to a pointer works from the keyboard, in a logical tab order, with a visible focus indicator.
- Every control has an accessible name; icon-only buttons get a label. Meaningful images get alt text, and decorative ones get empty alt.
- Text contrast is at least 4.5:1, or 3:1 for large text and control boundaries. Never convey state by color alone.
- Opening a dialog moves focus into it and keeps it there. Escape closes it, and closing returns focus to the control that opened it.
- Announce results that appear away from focus (toasts, async errors) through a live region.
- Use landmarks and a heading outline with no skipped levels. Respect the reduced-motion preference.
- Check with an automated checker and a keyboard-only pass. Automated tools find only part of the problems.

## Layout and design system
- Use the project's design tokens and components for color, spacing, type, and radius. No raw hex values or one-off pixel sizes; when a token is missing, add it to the system.
- Match the existing visual language. Don't introduce a new look (a new palette, gradients, novel components) unless asked.
- Check every layout at 320, 768, 1024, and 1440 px wide and at 200% zoom, with no horizontal scroll at 320 px. Touch targets are at least 24 by 24 CSS px.

## Load when the task matches
Read the whole file before starting that part of the task:
- Forms, validation messages, multi-step input → [reference/forms.md](reference/forms.md)
- Load time, responsiveness, layout shift, images, bundle size → [reference/web-performance.md](reference/web-performance.md)

## Before finishing
Review the change against this list. Fix each miss and re-check until the list is clean:
- [ ] Every data state renders, including empty, error with retry, and no permission.
- [ ] Every interaction works from the keyboard, with visible focus and an accessible name.
- [ ] Contrast meets AA, and no state relies on color alone.
- [ ] Only design tokens and existing components are used, and the layout holds at 320 px and 200% zoom.
- [ ] Each reference file the task matched was read and applied.

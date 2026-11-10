# Web performance

Part of the building-interfaces skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Targets at the 75th percentile of real users: Largest Contentful Paint (LCP) at most 2.5 s, Interaction to Next Paint (INP) at most 200 ms, Cumulative Layout Shift (CLS) at most 0.1. Measure on a throttled mid-range phone profile, not a dev laptop.
- Measure before and after each change, the same way each time. Keep only changes that beat run-to-run variance.
- Every image and embed declares its width and height or aspect ratio, so nothing shifts when it loads. Reserve space for late content (ads, banners, fonts).
- The image behind the largest paint loads with high priority, never lazily. Images below the fold load lazily. Serve each image at its displayed size in a modern format.
- Know what JavaScript each route ships. Split code by route, and load heavy, rarely used features on demand.
- Keep main-thread work short: break up long tasks, debounce expensive input handlers, and virtualize long lists.
- Fetch the data a view needs in parallel, not as a waterfall of dependent requests.

# Scene design decisions

These notes record product decisions confirmed on 2026-11-12 while reviewing the
moon and flight changes. They describe the current intended behavior; they do
not override the implementation.

## Confirmed behavior

- **Moon rise:** The moon starts behind the camera and rises into view only after
  Gemini has been hovered for three seconds. Its initial placement is intentional.
  See `lib/scene/night-sky.ts`.
- **Winter branch cutting:** Cutting moves the branch tube and its attached woody
  offshoots. Pine needles are stored separately as one instanced mesh; they are
  already hidden by the winter stage before branch cutting is enabled. Do not add
  per-branch needle removal unless the pruning interaction is intended to work in
  a leafy stage. See `app/page.tsx` and `lib/scene/winter.ts`.
- **Lap threshold:** The current flight phase intentionally uses `0.5` net turns
  per stage so the transitions can be reached quickly. This is not a request to
  restore three laps. See `lib/scene/lap-tracker.ts`.
- **Moon-tunnel shader:** The current tunnel appearance is accepted; no shader
  change was requested. Any future change to its glow should be visually checked
  across the project's supported WebGL devices.
- **Production port:** `npm start` intentionally binds to port 80. The local
  development command remains on port 3003. Do not change the production port
  without revisiting the deployment setup.

## Known persistence limitation

The scene reports a completed stage with `laps: 0.5`, while
`lib/scene-db.ts` currently floors reported laps and only records an unlock when
the result is at least three. As a result, the half-turn stage can complete in
the current page view without incrementing the server's remembered unlock count.
This mismatch was identified during review; the owner confirmed the half-turn
behavior and requested no code change in this pass. If persistent unlock counts
are expected for this test phase, revisit the API threshold separately.

## Review-source caveat

Third-party LLM-generated summaries are secondary and may misstate behavior or
infer bugs from implementation details. Verify claims against the checked-in
source and these explicitly confirmed decisions before changing the scene.

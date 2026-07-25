# Settings Slug Focus Ring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render one focus ring around the complete Settings shop URL field.

**Architecture:** Keep the prefix and input structure unchanged. Move all visible focus treatment to the wrapper and explicitly suppress the global input focus outline.

**Tech Stack:** React, Tailwind CSS, Vitest, Testing Library.

- [ ] Add a failing Settings test asserting the wrapper owns `focus-within` ring styles and the input owns `focus-visible:outline-none`.
- [ ] Run the focused test and verify RED.
- [ ] Add the minimal wrapper and input classes.
- [ ] Run focused and full verification.
- [ ] Focus the slug input in the browser and visually confirm a single full-field ring.


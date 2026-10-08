# Home Cloud — Landing Page Redesign

> Working design document for the complete redesign of the Home Cloud landing page.
>
> This document is intentionally iterative. Decisions may change during exploration.
> Only validated and finalized decisions should eventually be promoted to `design.md`.

---

# 1. Redesign Objective

Completely redesign the Home Cloud landing page from the ground up.

The current landing page feels like generic AI-generated SaaS UI:
- excessive cards
- repetitive sections
- too many gradients and borders
- excessive rounded containers
- artificial dashboard mockups
- weak visual hierarchy
- too much explanatory copy
- decorative elements without enough purpose
- insufficiently distinctive brand identity

The redesign must feel deliberately designed by a strong product/design team rather than generated from a generic SaaS template.

### Quality Bar

The goal is not "good enough" or "modern enough."

The goal is a highly polished, distinctive, technically credible website with:
- exceptional visual hierarchy
- strong art direction
- pixel-level attention to detail
- meaningful motion
- excellent typography
- carefully designed interactions
- sophisticated transitions
- responsive behavior that feels intentional
- a coherent visual language across the entire site

Do not lower the design standard because a particular model struggles to implement a concept.

When an implementation is weak, iterate or change the approach.

---

# 2. Core Product

Home Cloud turns a personal/spare computer into a remotely accessible private cloud.

Core product capabilities include:
- remote access to the machine
- terminal access
- Docker/application management
- system monitoring and metrics
- authentication
- Cloudflare Tunnel-based remote connectivity
- server/application management
- browser-based interaction with the machine

The landing page should communicate the feeling of:

> Your computer can become your cloud.

The product should feel like infrastructure that belongs to the user rather than another cloud service renting infrastructure to them.

---

# 3. Core Design Philosophy

## 3.1 Product over decoration

The product itself should be the primary visual material.

Prefer:
- real product interfaces
- real system states
- terminal output
- meaningful metrics
- infrastructure visualizations
- real interactions

Avoid:
- fake dashboard decoration
- meaningless graphs
- arbitrary UI cards
- technical-looking elements that communicate nothing

---

## 3.2 Less UI, more composition

Do not build the page as a sequence of:

heading → paragraph → cards → heading → cards → heading → cards.

Use larger visual compositions and narrative sections.

Each section should have a reason to exist.

---

## 3.3 Calm infrastructure

Home Cloud is technical infrastructure, but the visual experience should not feel aggressive, noisy, or overly "cyberpunk."

The site should feel:
- calm
- precise
- technical
- sophisticated
- atmospheric
- controlled

Dark does not mean neon.

---

## 3.4 Technical credibility

Technical concepts should be represented authentically.

Prefer real concepts such as:
- machines
- processes
- containers
- networks
- logs
- terminals
- metrics
- system states
- connectivity
- deployment
- resource usage

Do not use technical visuals merely because they look "developer-ish."

---

## 3.5 Distinctive identity

Home Cloud must develop its own visual language.

Reference websites are standards and sources of design principles, not templates to copy.

Do not reproduce another company's:
- layout
- visual identity
- exact components
- typography
- animation
- branding

Extract the underlying design principles and reinterpret them for Home Cloud.

---

# 4. Reference Standards

These references establish the quality bar and provide specific design principles.

## Innernote
https://www.innernote.space/

Primary references:
- calmness
- restraint
- whitespace
- editorial pacing
- atmospheric composition
- storytelling through visual scenes
- strong typography

Use as the reference for making a technical product feel calm and human.

---

## Griffin
https://www.griffin.com/

Primary references:
- sophisticated product storytelling
- infrastructure presented through polished UI
- technical credibility
- product interfaces as visual content
- balance between technical and editorial content

Use as a reference for making infrastructure feel premium and understandable.

---

## Antimetal
https://antimetal.com/

Primary references:
- navigation
- brand confidence
- conceptual storytelling
- section architecture
- restrained visual system
- footer
- strong positioning

Use as a reference for brand structure and information hierarchy.

---

## Modal
https://modal.com/

Primary references:
- infrastructure visual language
- dot matrix elements
- technical visual primitives
- data/system representation
- subtle motion
- computational atmosphere

Dot matrices should be treated as inspiration for a Home Cloud visual language, not copied directly.

---

# 5. UI / Motion / Visual Resources

Available reference resources:

- Backgrounds
- Flowbite Tailwind
- MotionSites Prompts
- Grainrad
- Motion
- Libraries.dev
- Bklit UI
- KokonutUI
- Refro Styles
- Transitions.dev
- Mobbin
- Godly
- Skiper UI
- Cult UI
- Watermelon UI
- Designeer
- Glass3D
- loading.dev
- Backgrounds Supply
- 21st.dev
- shadercn
- Dot Matrix
- MCP Server / ASCII Magic for AI Agents
- GSAP

These resources should be used selectively.

Do not combine components simply because they are available.

Every component, effect, background, animation, or visual treatment must support the overall design language.

---

# 6. Motion Philosophy

Motion is an important part of the redesign.

Use motion to:
- establish hierarchy
- communicate state
- guide attention
- reveal information
- create continuity between sections
- make infrastructure feel alive
- reinforce the relationship between physical machine and cloud

Prefer:
- subtle entrance animations
- scroll-driven transitions
- state changes
- meaningful hover interactions
- carefully choreographed reveals
- smooth section transitions
- restrained parallax
- system-like activity

Avoid:
- animation for animation's sake
- excessive bouncing
- generic fade-in-everything
- excessive text animation
- distracting continuous motion
- gimmicky 3D

GSAP and Motion are available for implementation.

---

# 7. Visual Language — Initial Direction

This section is intentionally incomplete and will evolve during the redesign.

Initial direction:

### Theme
Dark.

### Atmosphere
Technical, calm, deep, precise.

### Color
Primarily dark neutral surfaces with a restrained Home Cloud accent.

Avoid making the entire interface glow orange/green/purple.

### Typography
Large, confident display typography combined with highly legible technical/UI typography.

Typography should establish hierarchy before decorative effects do.

### Surfaces
Prefer depth through:
- tonal contrast
- subtle borders
- texture
- shadows
- light
- spacing

rather than excessive glassmorphism.

### Backgrounds
Background effects should create atmosphere without competing with the content.

Potential visual vocabulary:
- subtle grain
- dot matrices
- technical grids
- system diagrams
- controlled gradients
- shader-based environments
- sparse data points

No background effect should exist purely because it looks cool.

---

# 8. Layout Philosophy

Avoid repetitive card grids.

Prefer:
- large compositions
- asymmetric layouts
- editorial sections
- intentional whitespace
- visual storytelling
- full-width moments
- carefully framed product interfaces
- transitions between conceptual sections

The page should feel composed rather than assembled.

---

# 9. Component Philosophy

Components should feel like members of the same design system.

Avoid:
- excessive rounded cards
- random border radii
- inconsistent shadows
- inconsistent spacing
- arbitrary gradients
- multiple unrelated button styles
- generic SaaS components

A component should either:
1. communicate information,
2. enable an interaction,
3. establish hierarchy,
4. reinforce the Home Cloud visual language.

If it does none of these, remove it.

---

# 10. Design Constraints

The redesign must NOT become:

- generic AI SaaS
- cyberpunk
- excessive glassmorphism
- gradient-heavy
- card-heavy
- visually noisy
- excessively rounded
- over-animated
- fake-terminal aesthetic
- generic developer portfolio
- generic startup landing page

Avoid copying reference sites directly.

---

# 11. Redesign Workflow

The landing page will be redesigned element by element.

Process:

1. Define the design problem.
2. Establish the desired visual outcome.
3. Create a focused implementation prompt.
4. Implement using the selected model.
5. Review the result.
6. Identify weaknesses.
7. Iterate.
8. Lock the element.
9. Record the decision here.
10. Move to the next element.

Do not redesign the entire website when fixing an individual element.

Changes should remain scoped unless a global design decision requires otherwise.

---

# 12. Model Strategy

### Muse 1.3 — XHigh
Default implementation model.

Use for:
- component implementation
- React/Tailwind work
- GSAP
- animations
- micro-interactions
- iterative refinement

### Gemini Flash — High
Use primarily for:
- alternative design concepts
- design critique
- identifying weaknesses
- generating alternative approaches

### Grok — High
Use primarily for:
- creative divergence
- unconventional concepts
- breaking out of design ruts
- alternative visual directions

Different models should be used when their different biases are useful.

---

# 13. Current Redesign Status

Status: Not started.

Current phase:

> Establishing the visual foundation.

Next elements to design:

1. Global visual foundation
2. Navbar
3. Hero
4. Hero/product interaction
5. Section transitions
6. Product showcase
7. Feature storytelling
8. Infrastructure/terminal experience
9. Setup/onboarding
10. Final CTA
11. Footer
12. Global motion system
13. Responsive/mobile refinement
14. Final visual polish

This order may change as the redesign develops.

---

# 14. Experiments

Nothing locked yet.

---

# 15. Rejected Ideas

Nothing rejected yet.

---

# 16. Locked Decisions

Nothing locked yet.

---

# 17. Open Questions

These will be added as the redesign progresses.
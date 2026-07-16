// GSAP timeline registration for HyperFrames
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });

// Initial setup for animated elements
gsap.set("#scene1 .anim-item", { opacity: 0, y: 40 });
gsap.set("#scene2 .anim-item", { opacity: 0, y: 40 });
gsap.set("#scene3 .anim-item", { opacity: 0, y: 40 });
gsap.set("#scene4 .anim-item", { opacity: 0, y: 40 });
gsap.set("#scene5 .anim-item", { opacity: 0, y: 40 });

// Scene 1: Title & Introduction (0.0s - 4.2s)
tl.to("#scene1 .anim-item", {
  opacity: 1,
  y: 0,
  duration: 1.4,
  stagger: 0.25,
  ease: "power2.out"
}, 0.3)
.to("#scene1 .anim-item", {
  opacity: 0,
  y: -30,
  duration: 0.9,
  stagger: 0.1,
  ease: "power2.in"
}, 3.3);

// Scene 2: Feature 01 Autonomous Thinking (4.0s - 8.2s)
tl.to("#scene2 .anim-item", {
  opacity: 1,
  y: 0,
  duration: 1.4,
  stagger: 0.25,
  ease: "power2.out"
}, 4.2)
.to("#scene2 .anim-item", {
  opacity: 0,
  y: -30,
  duration: 0.9,
  stagger: 0.1,
  ease: "power2.in"
}, 7.3);

// Scene 3: Feature 02 Minimal UI/UX (8.0s - 12.2s)
tl.to("#scene3 .anim-item", {
  opacity: 1,
  y: 0,
  duration: 1.4,
  stagger: 0.25,
  ease: "power2.out"
}, 8.2)
.to("#scene3 .anim-item", {
  opacity: 0,
  y: -30,
  duration: 0.9,
  stagger: 0.1,
  ease: "power2.in"
}, 11.3);

// Scene 4: Feature 03 Video & Media Generation (12.0s - 16.2s)
tl.to("#scene4 .anim-item", {
  opacity: 1,
  y: 0,
  duration: 1.4,
  stagger: 0.25,
  ease: "power2.out"
}, 12.2)
.to("#scene4 .anim-item", {
  opacity: 0,
  y: -30,
  duration: 0.9,
  stagger: 0.1,
  ease: "power2.in"
}, 15.3);

// Scene 5: Epilogue (16.0s - 18.0s)
tl.to("#scene5 .anim-item", {
  opacity: 1,
  y: 0,
  duration: 1.5,
  stagger: 0.3,
  ease: "power2.out"
}, 16.1);

// Register timeline to HyperFrames global registry
window.__timelines["main"] = tl;

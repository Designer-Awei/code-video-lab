# Code Video Lab

**A complete code-driven video production case study — from research and storytelling to procedural models, art direction, narration, and rendered frames.**

[English](README.md) · [简体中文](README.zh-CN.md)

The case study is a seven-minute explainer about the evolution of the automobile brake pedal. Its visual system combines Canvas, Three.js, custom shaders, mechanical cutaways, engraving-style shading, and deterministic animation.

Started by **Awei in Cursor**, the project documents the end-to-end foundation built with **Opus5.5**, the later chapter development with **Grok4.7**, and the finishing work with **GPT-6.1**. The first two chapters are especially useful examples of procedural modeling and cohesive art direction.

[Watch / download the 25-second silent showreel](docs/gallery/code-video-showreel.mp4) · [Reusable agent skill](skills/code-video/SKILL.md) · [Production retrospective](docs/MAKING_OF.md)

## Motion highlights

### An engraved automobile, revealed in code

The 1886 Motorwagen emerges through a moving clipping plane. Procedural wheels, linkages, and bodywork combine with ink outlines and cross-hatching to establish the historical visual language.

![Procedural Motorwagen reveal with engraving-style shading](docs/gallery/car-reveal.gif)

Explore: [Chapter 2](opus-video/brake-pedal-history/src/scenes/ch2.js) · [Historical models](opus-video/brake-pedal-history/src/three/models_history.js) · [Rendering pipeline](opus-video/brake-pedal-history/src/three/stage.js)

### Mechanical evolution, one film frame at a time

A hand lever, wooden brake block, stamped steel arm, layered composite, and sensor occupy separate frames of a continuous filmstrip. Sprocket holes and illustrations travel together, with subtle time-driven exposure flicker.

![Continuous filmstrip cycling through five distinct mechanical illustrations](docs/gallery/filmstrip.gif)

Explore: [Chapter 8](opus-video/brake-pedal-history/src/scenes/ch8.js) · [Original mechanical illustrations](opus-video/brake-pedal-history/src/scenes/ch8-art.js)

### A moving mechanical timeline

Years and explanations change on the left as full-size mechanisms slide through the right: lever, three pedals, hydraulics, disc brakes, ABS, by-wire, and EMB.

![Mechanical history carousel with synchronized typography and upward transitions](docs/gallery/history-carousel.gif)

### A typewriter ending with weight and character

Large warm-red serif lettering lands with per-character spring motion, is rapidly backspaced, and gives way to a second line. The cursor follows actual character widths; the original film ends with a slow fade to black.

![Typewriter ending with advancing cursor, backspace, and replacement text](docs/gallery/typewriter.gif)

The excerpts are silent, trimmed from the finished movie, and optimized for README playback. The MP4 reel preserves a higher-resolution presentation for social sharing. The full movie and cloned narration are not included in the public source release.

## The complete production chain

```text
Research and sources → Narration → Brief and shot design
        → Procedural assets + art direction → Deterministic scenes
        → Preview and review → Audio alignment → Frame rendering → Delivery
```

The project preserves both the finished implementation and the decisions behind it:

- **Mechanical structure before decoration.** Pivots, axles, brackets, curved arms, pads, rods, fasteners, and ribs make the assets explain their function.
- **Art direction across the whole shot.** Materials, lighting, camera placement, outlines, hatching, typography, and transitions work together.
- **A frame-addressable renderer.** `window.render(t)` determines the complete frame. Seeded randomness and closed-form springs support out-of-order rendering.
- **Narration as a timing contract.** Chapter boundaries and pauses are preserved when replacing a voice. Acoustic alignment and pitch-preserving tempo adjustment are kept separate from transcription.
- **Review before expensive rendering.** Representative frames, movement extremes, transition frames, and small-screen readability are checked before delivery.

## Model collaboration

**Opus5.5** established the project framework, storyboards, visual direction, and chapter skeletons. Chapters 1 and 2 were largely completed with Opus, including the detailed pedal assembly and the engraved historical automobile.

**Grok4.7** continued the later chapters after their skeletons were established, with repeated revisions to models, composition, colors, transitions, and readability.

**GPT-6.1** contributed the Chapter 8 redesign, distinct mechanical illustrations, filmstrip and typewriter effects, voice replacement, and repository organization.

**Awei** selected the subject and references, directed the review process, and made the creative decisions. These roles follow the creator's account of the collaboration; they are not a line-by-line authorship audit or a model benchmark.

## Start exploring

- [Agent skill](skills/code-video/SKILL.md): reusable guidance covering the production chain. The entire `code-video` directory can be copied into an agent's skill directory.
- [Making of](docs/MAKING_OF.md): references, collaboration, review iterations, and lessons.
- [Architecture](docs/ARCHITECTURE.md): an annotated reading order through the scenes, models, shaders, and timing helpers.
- [Run and reuse](docs/REUSE.md): previews, rendering, TTS, and voice replacement.
- Case inputs: [brief](opus-video/brake-pedal-history/brief.md), [narration](opus-video/brake-pedal-history/script.md), [storyboard](opus-video/brake-pedal-history/storyboard.md), [timeline](opus-video/brake-pedal-history/timeline.json).

Supporting production notes and the case narration remain in Chinese. Both README editions describe the same project and link to the same code.

## Quick start

Requires Python 3.10+, FFmpeg, and Chromium. Node.js is needed only to rebuild the included Three.js bundle.

```sh
python -m pip install -r requirements.txt
python -m playwright install chromium
python skills/code-video/scripts/check_env.py
cd opus-video/brake-pedal-history
python tools/stills.py demo 65 148 251 397
```

The browser entry point is `index.html`. Calling `window.render(65)` draws body-timeline second 65. The local finished movie has an additional two-second cover intro, so that frame appears around second 67 in the movie.

Optional local fonts have system fallbacks. Missing news images produce explicit placeholders; reproducing evidence-bearing shots requires installing the original images from the source index. See [reproduction details](docs/REUSE.md).

## Repository layout

```text
skills/code-video/                 Reusable skill, rendering tools, craft references
docs/                              Making-of, architecture, reuse and validation notes
  gallery/                         Selected stills, animated excerpts, silent showreel
  archive/                         Historical briefs and storyboards
opus-video/brake-pedal-history/     Complete case study
  index.html                       window.render(t) entry point
  src/scenes/                      Chapters and original mechanical illustrations
  src/three/                       Procedural models and visual pipelines
  src/lib.js                       Springs, text masks, transitions, seeded textures
  tools/                           Case timing, previews, TTS and audio tools
  source/                          Research and news-image source index
  audio/vo/segments.example.json    Narration configuration without a private voice
  previews/ qa/ audio/ out/         Local artifacts, excluded from Git
licenses/                          Third-party license notices
```

## References and release scope

Production began with [@xilo2991's tutorial](https://x.com/xilo2991/status/2104912748794589515), a cinematic reference from [@prasenx](https://x.com/prasenx/status/2103851939457093635), and later motion-design guidance from [mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15). The foundational production skill comes from [xilo-opus-video](https://github.com/Kianzzz/xilo-opus-video).

The main animation is generated in code. Real news screenshots are an explicit evidence exception, and the final cover was generated with imagegen at the creator's request. The final sound version uses narration only; code-synthesized music remains an optional tool in the repository.

Original code and documentation are MIT-licensed. Private voice samples, cloned narration, the full movie, font binaries, and original news images are excluded. The intentionally public motion excerpts contain no narration. [Third-party notices](THIRD_PARTY_NOTICES.md) · [Validation record](docs/VALIDATION.md).

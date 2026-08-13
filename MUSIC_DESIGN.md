# Rhythmic Ride — Music Design Brief

## Core promise

The score should make players dance in their seats while they drive. Music is
not wallpaper and it is not a wall of permanent intensity. A successful theme
has three foreground jobs working together:

- **The melody sticks.** The player can recognize or hum its rhythmic contour
  after a few passes, and it remains the easiest musical idea to hear.
- **The bass makes the body move.** It has a pocket of its own—something worth
  nodding to even with the melody muted—while remaining locked to important
  kick accents.
- **The percussion moves time forward.** Kick, snare, hats, and fills clarify
  the pulse and announce changes without burying the melody or flattening the
  bass groove.

Pads, arps, chugs, guitar accents, and industrial hits create harmony, motion,
and world identity around those three jobs. They support the song; they do not
all compete to become the song.

The target is **catchy, danceable, futuristic, and dynamic**. A track should
feel good under active play and still reward someone listening to several
loops on headphones.

The Music Player ships one strongest production mix per composition.
Superseded arrangements are removed from the runtime library so players do not
have to distinguish near-duplicate versions during a jam-sized campaign.

Race School is one composition with six lesson mixes, not six unrelated
songs. Course variants may shift tempo by at most 8 BPM and transpose the
motif by at most four semitones; arrangement changes should identify the skill
(clearer collision space, acceleration pulse, airy register, rival breakbeat,
or flight lift) while `Open Circuit` remains recognizable within one phrase.

## Reference standards: “Night Drive” and “Controlled Burn”

`src/audio/tracks/titleTheme.js` (`Night Drive`) is the production clarity
reference: a short hook states itself immediately, bass stays physical without
masking it, and percussion creates motion at restrained gain. A Story cue may
be longer, heavier, or more sectional, but its main idea must remain at least
as easy to follow. Do not copy Night Drive's F-minor writing or hook contour.

`src/audio/tracks/syndicateRunTheme.js` is the current reference for musical
hierarchy and dynamic pacing. Do not copy its E-minor progression, hook, riff,
or cyber-metal arrangement into another theme. Reuse these principles:

1. **One recognizable hook survives the arrangement.** It is teased, stated,
   varied, reduced during the interlude, and used to make the rebuild familiar.
2. **Bass, percussion, and melody each have an independent identity.** The bass
   is not merely every kick note; the melody is not a nonstop scale; the drums
   are not maximum-density noise.
3. **Intensity is earned by contrast.** The half-time intro, build, main groove,
   riser, climax, interlude, and rebuild create a waveform instead of a plateau.
4. **Subtraction makes the payoff larger.** The breakdown removes chug density,
   bright percussion, FM grit, and mix weight. Restoring them then matters.
5. **The loop has dramatic logic.** Its final rebuild leads to a deliberate
   half-time landing at bar one, so repetition feels like another training set
   rather than a file restarting.

`src/audio/tracks/redlineGauntletTheme.js` is the counterexample in one useful
sense: it proves that excellent genre texture and relentless energy can still
be tiring when a level's pacing does not justify a near-constant ceiling.
Preserve it for the future high-intensity level it was renamed to serve.

## The musical hierarchy

| Layer | Primary job | Standalone test | Common failure |
| --- | --- | --- | --- |
| Melody / hook | Memory, emotion, track identity | Hum or tap it after two loops | Scale run, constant notes, buried register |
| Bass | Pocket, weight, head movement | Groove still works with lead muted | Copies every kick or sustains roots without rhythm |
| Percussion | Pulse, propulsion, section punctuation | Beat drives forward at modest volume | Loudness substitutes for groove; no dynamic range |
| Harmony / pads | Chord context, atmosphere, width | Progression reads without crowding the hook | Muddy voicing or bright pad masking the melody |
| Motion texture | Arps, chugs, glints, industrial color | Adds momentum when enabled, leaves a hole when removed | Runs constantly and becomes meaningless |
| Accent voice | Guitar hit, fill, one-off effect | Makes a payoff or transition unmistakable | Becomes the theme's identity or appears in every bar |

Arrange and mix in this priority order: **hook first, bass pocket second,
percussion third, harmony fourth, texture last**. This is not an instruction to
make the lead objectively loudest at every instant. It means every production
choice must preserve the listener's ability to follow the hook.

## Composition workflow

### 1. Define the scene before the genre

Write one sentence describing what the player is doing and how their energy
should change. Include:

- scene role: training, momentum, technical finale, garage, survival, or future
  maximum-intensity course;
- target tempo and whether sections imply half-time or double-time;
- emotional adjectives and physical imagery;
- desired energy arc;
- one synthetic timbre that belongs specifically to that environment.

Genre is a vocabulary for fulfilling the role. It is not the role itself.

### 2. Choose a unique harmonic identity

Pick a key, mode, and progression not already carrying another theme. Shared
production techniques are healthy; shared songwriting is not. Record the
progression and Roman-numeral analysis in the theme's header.

Keep progression length in mind when arranging. Four-bar progressions work
cleanly with four-, eight-, and twelve-bar sections because major arrivals land
back on the intended chord. A deliberate mid-progression section boundary is
allowed, but it should create audible tension rather than happen by accident.

### 3. Write the bass pocket before decorating it

The bass should answer two questions: where is the downbeat, and what makes the
player nod between downbeats?

- Begin with roots, fifths, octaves, and chord-defining approach tones.
- Use rests. Silence creates syncopation and keeps distortion readable.
- Lock selected notes to the kick, then add anticipations or answers the kick
  does not play.
- Give the line a pickup or turnaround that leads into the next chord.
- Change density with the arrangement: sparse roots in an intro, a syncopated
  ostinato in the groove, reduced motion in the interlude.
- Keep fundamental pitches above the engine's `48 Hz` master high-pass or move
  low chord roots up an octave.

**Head-bob test:** mute melody, pad, and decorative voices. Bass plus drums
should already feel like music rather than a metronome with chord labels.

### 4. Build percussion as forward motion

The drum machine establishes a dependable body pulse, then subdivisions create
speed:

- kick establishes weight and important bass locks;
- snare establishes backbeat or half-time scale;
- closed hats establish subdivision;
- open hats create lift and phrase boundaries;
- rolls and fills belong near transitions, not throughout a section;
- industrial percussion is world color, not a second full drum kit.

Intensity should increase through a combination of note density, subdivision,
brightness, and selective gain—not gain alone. If the kick, snare, and hats all
begin at their loudest and busiest settings, the arrangement has nowhere to go.

**Drive test:** lower the drums until they no longer dominate. If the groove
loses all momentum, improve the pattern before restoring volume.

### 5. Write one hook with a rhythmic fingerprint

A hook is a short musical sentence, usually one or two bars, with enough rests
to expose its shape. It should have a recognizable rhythm even when tapped on
one pitch.

- Prefer a small set of meaningful notes over a 16-step scale traversal.
- Use repetition before variation. State A clearly, repeat it, then introduce
  A′ or B as an answer.
- Tease only its first gesture during an intro or build.
- Reduce it to long notes or a different synthetic voice in a breakdown.
- Bring back the complete version for a payoff.
- Reserve dense runs for turnarounds and fills.

**Sing-back test:** after two loops, stop playback. Someone should be able to
hum, whistle, or tap the hook's contour without seeing the note data.

### 6. Audit melody math and voice-leading

Correct pitch classes can still sound wrong when their registers jump without
purpose. For every chord transition:

1. Convert semitone offsets to actual pitch classes.
2. Confirm chord tones and intentional color tones such as sevenths or ninths.
3. Inspect the last lead note of one bar and first lead note of the next.
4. Flag accidental register drops or jumps larger than a fourth/fifth.
5. Move a chord's melody palette by an octave when that produces smoother
   voice-leading; the pad may retain its close lower voicing.

Large melodic leaps are welcome when they are the hook. The requirement is
that they be intentional and repeated as part of its identity.

### 7. Arrange an intensity waveform

Not every theme needs the exact “Controlled Burn” form, but every racing theme
needs at least three clearly audible intensity levels and one meaningful
subtractive section.

| Section term | Musical function | Typical layer behavior |
| --- | --- | --- |
| Half-time intro | Establish scale, weight, and space | Root pulses, 2 kicks/bar, quarter hats, hook absent or teased, dark pad |
| Crescendo / pre-drop build | Increase expectation | Add eighths then 16ths, raise pad cutoff, introduce riff layers, use a one-bar fill |
| Main groove / verse | Deliver the repeatable driving identity | Full bass pocket, stable backbeat, clear hook A/A′, controlled texture |
| Pre-chorus / riser | Withhold resolution before the high point | Rising contour, increasing subdivision/brightness, fewer resting points |
| Chorus / drop / climax | Pay off accumulated tension | Complete hook, densest appropriate groove, signature accents, widest/brightest harmony |
| Breakdown / interlude | Reset the ear after payoff | Remove at least one core motion layer, half-time drums, clean or sparse bass, reduced hook |
| Rebuild / turnaround | Restore expectation and prepare the loop | Add one layer per bar, increase cutoff/density, finish with a fill or pickup |

A useful intensity plan is `2 → 3 → 4 → 5 → 1 → 2/3`, not `5 → 5 → 5`.
The exact order can change with the scene. The contrast cannot disappear.

### 8. Design the loop as a transition

The last bar and first bar are adjacent music. Test them that way.

- End with a fill, pickup, dominant chord, riser, or intentional breath.
- Decide whether bar one is a fresh intro, a half-time landing, or the payoff
  of the prior turnaround on subsequent loops.
- Avoid a held note whose release is cut by wrapping.
- Listen through at least three loop boundaries; a clean first loop can still
  become irritating on the third.

## Mix hierarchy and dynamic levels

The engine's limiter is a safety net, not a mixing strategy. A mix repeatedly
hitting it loses the contrast the arrangement was written to create.

- Keep the melody intelligible over the busiest section before making drums
  louder.
- Bass should be physically present but leave the melody's midrange readable.
- Percussion should drive at lower gain; pattern and transient placement create
  urgency more effectively than constant maximum level.
- Hats are especially fatiguing. Reduce their gain before removing the motion
  they provide.
- Pads should establish space below the hook. Use `padCutoff` to darken quiet
  sections and brighten builds rather than leaving every pad wide open.
- Sidechain should make the groove breathe, not erase the bass and harmony.
  `sidechainDepth` is the gain reached during a duck, so **smaller values mean
  deeper pumping** (`0.4` is stronger than `0.65`).

Current per-bar gain fields are multipliers where `1` is the instrument's
engine default:

| Field | Controls | Practical use |
| --- | --- | --- |
| `bassGain` | Synth-bass note gain | Reduce low-end crowding or distinguish interlude/drive |
| `bassCutoff` | Synth-bass low-pass cutoff in Hz | Keep saw/FM edge out of the hook's low-mid register |
| `bassHighpass` | Optional synth-bass high-pass in Hz | Trim speaker-moving sub energy for a specific mix without thinning every cue |
| `leadGain` | Chip, saw, metal, guitar, or keys lead gain | Keep the hook forward without raising the whole music bus |
| `arpGain` | Gated motion-arp gain | Preserve speed texture below the melody |
| `chugGain` | Cyber-chug gain | Control low-mid density independently of bass |
| `guitarGain` | Supporting power-chord gain | Keep acoustic-like accents behind synthetic voices |
| `kickGain` | Kick gain | Keep pulse below melody or enlarge a climax |
| `snareGain` | Snare noise/body gain | Scale backbeat between half-time and payoff |
| `hatGain` | Closed/open hat gain | Preserve motion without high-frequency fatigue |
| `sidechainDepth` | Duckable-bus minimum gain | Set pump intensity when `sidechain` is enabled |
| `padCutoff` | Pad low-pass cutoff in Hz | Create dark-to-bright section motion |
| `padGain` | Sustained pad gain | Place long chords behind the hook and rhythm without changing other themes |

Unset gain fields preserve the engine's defaults, so expression can be added to
one theme without remixing every other track.

Open Circuit is a deliberate low-pad exception: its four-tone, detuned chord
stack uses `padGain` values from `0.11` to `0.18`. The held chord supplies quiet
harmony beneath the hook and percussion; do not restore the earlier `0.28`–
`0.42` range without a three-loop playtest against cone impacts and instructions.

Music and gameplay feedback use independent gain buses before the shared mix
limiter. The playtest-approved defaults are `musicVolume: 0.16` and
`sfxVolume: 1.0`, which place objective feedback decisively forward without
rewriting the musical balance.
Both values are live controls in the Projection Lab's collapsible Audio group;
the UI presents them as human-readable `0–100%` values and translates to the
engine's normalized `0–1` gains. Use them to audition a mix while driving before
changing individual patches.

## Repeated gameplay audio

Frequently repeated gameplay cues use variation pools, not one sample or patch
with identical settings. Every recurring family ships with at least three
variants and prevents immediate repetition. Variation changes pitch contour,
filtering, envelope, timbre, and/or stereo position—not merely gain.

Each cue is a composite with three perceptual jobs:

- **low body** supplies weight and physical consequence;
- **mid material** identifies plastic, chassis, engine, tire, or reward tone;
- **high detail** supplies crack, air, debris, speed, or celebratory sparkle.

Cone hits, boosts and speed lines, rival warnings/contact/takedowns, time
bonuses, glass and hull damage, ramp takeoff/landing/misses, pickups, and
completion cues all follow this contract. Their balances remain distinct: a
boost favors sustained air, damage favors body and material, and rewards favor
mid/high harmony without losing a short low anchor. The shared mix limiter is
still only peak protection; do not compensate for weak layers by making the
whole composite louder.

## Futuristic 16-bit palette

The score is futuristic first, with the economy and strong silhouettes of a
16-bit game composer. A limited channel budget is an aesthetic advantage: each
voice should have a reason to exist.

Core synthetic voices currently include:

- clean, driven, or FM-gritted saw bass;
- square-wave “chip” lead;
- detuned saw lead;
- inharmonic metallic lead;
- gated saw arp;
- warm synthetic keys;
- triangle/saw analog pad;
- FM/distorted cyber-chug;
- electronic kick, snare, hats, and synthesized industrial impacts.

Guitar-like power chords and acoustic-kit character remain accents. They may
make a chorus larger, but they must not place the score in a past-decade garage
or arena. The future comes from FM sidebands, synthetic transients, gated
motion, automation, and deliberately artificial stereo width.

## Tracker data contract

Every theme exports a track object:

```js
export const EXAMPLE_THEME = {
  bpm: 160,
  stepsPerBar: 16,
  swing: 0.1, // optional
  bars: [/* bar objects */],
};
```

At 16 steps per bar, each step is a 16th note and each bar is four beats. Loop
duration is:

```text
seconds = bars.length × 4 × 60 / bpm
```

Pattern semantics matter:

- `bass`, `chug`, and `guitar` contain direct semitone offsets from their
  respective root frequencies; `null` is a rest.
- `lead` contains indices into `leadTones` when provided, otherwise into
  `chordTones`.
- `arp` contains indices into `chordTones`.
- `chordTones` supplies pad pitches; keep these harmonically focused.
- `leadTones` may add color tones or octave-shifted voicings for melodic
  voice-leading without changing the pad.
- `kick`, `snare`, `hat`, `openHat`, `industrial`, and `industrialAccent`
  contain step numbers from `0` through `15`.
- Every melodic pattern must contain exactly `stepsPerBar` entries.
- Optional voices must be accessed defensively by the engine so older themes
  remain valid.

Root frequencies should make register intent obvious (`E2` for bass, `E3` for
pad/rhythm, `E4` for lead). Document enharmonic spellings and octave shifts
when raw semitone math would otherwise be misleading.

## Reviewing or revising an existing theme

Use this sequence before changing notes:

1. **Scene fit:** describe the gameplay pace and emotional arc in one sentence.
2. **Duration:** calculate the loop length and check the rules in
   `GAME_DESIGN.md`.
3. **Section map:** label every bar as intro, build, groove, riser, payoff,
   interlude, or turnaround. Repeated labels with no contrast reveal a plateau.
4. **Hook audit:** tap the melody rhythm, locate its repetitions/variations,
   and check whether it remains audible in the densest bar.
5. **Pitch audit:** verify pitch classes, color tones, register, and bar-to-bar
   voice-leading.
6. **Bass solo:** confirm a head-bobbing pocket, useful rests, and a turnaround.
7. **Drum solo:** lower gain and confirm the pattern still drives.
8. **Layer collision:** identify notes where bass, kick, lead, chug, arp, and
   pad all attack together; keep only collisions that create a deliberate hit.
9. **Intensity graph:** compare note counts, subdivisions, gains, pad cutoff,
   timbre, and removed layers across sections.
10. **Loop test:** listen across three consecutive wraps at gameplay volume.
11. **Identity check:** compare progression, bass rhythm, and hook contour with
    every other theme; redesign shared songwriting rather than rationalizing it.

### Two-point scorecard

Score each category `0` (missing/problem), `1` (functional), or `2` (strong).

| Category | A score of 2 means… |
| --- | --- |
| Hook | Recognizable rhythm, clear repetition and variation, easy to recall |
| Bass pocket | Grooves independently and interacts with rather than copies kick |
| Percussion drive | Moves forward at controlled gain and marks transitions |
| Layer separation | Melody, bass, percussion, and pads remain individually legible |
| Dynamic arc | At least three intensity levels and one subtractive contrast |
| Payoff | Build creates expectation and the arrival audibly exceeds the groove |
| Loop | Turnaround and bar one form an intentional transition over repeats |
| Scene fit | Tempo, density, and emotional curve support actual gameplay pace |
| Identity | Key, progression, hook, and bass material are unique in the score |
| Future palette | Synthetic sources carry the theme; acoustic-like voices accent it |

A theme is ready for final tuning when it has no zeroes. A total below `16/20`
usually means the problem is compositional or structural, not a missing effect.

## Automated validation

Tests cannot prove that music grooves, but they can protect deliberate design:

- loop duration and tempo bounds;
- every melodic array matches `stepsPerBar`;
- every drum step stays within the bar;
- chord and lead palettes have the intended size;
- selected melody tones belong to the chord/scale or are documented colors;
- accidental register jumps do not return;
- intro, groove, payoff, interlude, and rebuild have measurably different
  density, gain, or brightness;
- hook A repeats before hook B varies it;
- acoustic-like accent layers stay limited to intended sections;
- production build succeeds after engine or theme changes.

Do not freeze every note in a test. Protect contracts and intentional
relationships while leaving room for musical revision.

## Definition of done

A theme is finished when:

- its scene role, key, progression, tempo, length, and form are documented;
- the hook passes the sing-back test;
- bass plus drums pass the head-bob test;
- percussion drives without masking the melody;
- the arrangement has contrast, buildup, payoff, and loop logic appropriate to
  the scene;
- melody math and register changes have been audited;
- its songwriting is distinct from every other theme;
- synthetic timbres carry its identity;
- focused tests and the full production build pass;
- a human has listened through at least three loop boundaries at gameplay
  volume.

The ultimate playtest question is simple: **does the music make the player want
to move while making the driving feel better?**

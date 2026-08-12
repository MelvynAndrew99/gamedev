# Rhythmic Ride — Jam Economy Specification

## Goal

The economy should reward finishing well and driving with style, then turn that
money into visible preparation for the next race. It must not ask a player to
repeat a cleared event just to finish the three-course Story campaign.

This is a finite jam campaign, not a service-game economy. There are no entry
fees, random prices, daily rewards, sell-back losses, or upgrades to base speed.
The last rule keeps authored qualifier times and Rival balance trustworthy.

Official arcade-racer references support three useful patterns without requiring
their grind: Need for Speed separates Garage choices into Style and Performance,
uses race cash for upgrades, and treats effects such as nitrous color and
underglow as customization; Forza Motorsport ties track mastery and race results
to credits and parts progression. Rhythmic Ride compresses those ideas into
Service, Race Prep, and Unlockables that fit one short campaign.

Research references:

- [Need for Speed Unbound: Show Up and Show Off](https://www.ea.com/news/under-the-hood-show-up-and-show-off)
- [Need for Speed Heat official text manual](https://www.ea.com/able/resources/need-for-speed/need-for-speed-heat/ps4/text-manual)
- [Forza Motorsport Builders Cup](https://forza.net/news/forza-motorsport-builders-cup)

## Currency sources

Cash is banked only when the player completes the required result: beat the
qualifier target or win the Rival Race. A failed attempt retains lifetime stats
but banks no purse, takedown bounty, or style cash. This makes the intended loop
explicit: pull off tricks **and** close the race.

### Win purses

| Course | Qualifier win | Rival win |
| --- | ---: | ---: |
| Proving Ground | $350 | $600 |
| Neon Gulch | $450 | $750 |
| Syndicate Run | $550 | $900 |

Each track/phase has three paid win claims. The first pays 100% of its listed
purse, the second 50%, and the third 25%, rounded to the nearest whole dollar.
Later wins pay no purse. A loss never consumes a claim. The result screen must
show `FIRST PURSE`, `REPLAY 2/3`, `FINAL REPLAY PURSE`, or `PURSE COMPLETE`.

This caps all six event purses at **$6,302**:

- Qualifiers: $613 + $788 + $963 = $2,364.
- Rival Races: $1,050 + $1,313 + $1,575 = $3,938.

### Style cash

Every Story style reward carries a small fixed cash value:

| Reward | Cash |
| --- | ---: |
| Killer Driving — authored cone line | $15 |
| Speed Demon — three Speed Lines | $20 |
| Sky High — qualified boosted landing | $20 |
| Triple Threat — tier-three boost | $25 |
| Long Burn — qualified held boost | $15 |

The toast adds a compact `+$N` beside its existing detail. It plays one short
cash-register confirmation only when the reward still has cash value. Repeated
toasts (`×N`) pay `N × value`; one queued/coalesced presentation can never lose
money. The sound should be a three-layer Crazy Taxi-like register gesture, not a
sample imitation: low coin/body tick, mid register snap, bright two-note chime,
with three subtle pitch/decay variants. It must remain below collision and
critical-hull warnings in the mix.

To prevent a safe style loop from becoming the optimal way to play, each
track/phase has a finite Style Bank:

- Qualifier: **$150 lifetime maximum** for that course's qualifier.
- Rival Race: **$300 lifetime maximum** for that course's Rival phase.
- One successful result may bank at most the Style Bank still available.
- The race receipt shows `STYLE +$N` and `STYLE BANK $earned/$cap`.
- When the bank is exhausted, rewards retain their toast, statistics, and
  future multiplayer meaning, but omit the cash sound and `+$N`.

The campaign-wide Style maximum is **$1,350**. Event identity, phase, paid-claim
count, and Style Bank balance must persist; restarting or refreshing must not
restore them.

### Rival takedown bounty

Each authored rival pays **$50 once per course**, banked only on a Rival win.
Use the stable rival ID as the claim key, so wrecking the same rival on a replay
cannot pay again. Three Platinum clears therefore add **$450 maximum**. A Gold
win still banks any newly defeated rivals; a later Platinum attempt can collect
only the remaining identities.

### Total supply and expected first campaign

- Absolute Story supply: $6,302 purses + $1,350 style + $450 takedowns =
  **$8,102**.
- First wins with strong enough style to fill each bank: $3,600 purses +
  $1,350 style + $450 takedowns = **$5,400**.
- Expected first wins at roughly $60 qualifier style, $150 Rival style, and two
  takedowns per Rival win: $3,600 + $630 + $300 = **$4,530**.

The $4,530 expected path buys both Pit Crew levels and the Music Deck ($2,700),
leaving $1,830: enough for 36 ten-point repairs, 24 Overcharge Racks, or a mix
of cosmetics and race preparation. No replay income is required for campaign
progression or its primary accessibility upgrades.

## Garage catalog

### Service

| Item | Price | Effect |
| --- | ---: | --- |
| Hull patch | $50 | Restore 10 hull; prorate the final partial patch at $5/hull. |
| Full repair | Dynamic | Restore all missing hull at $5/hull. |
| Pit Crew I | $800 once | After any **completed** Story event, automatically restore 15 hull. |
| Pit Crew II | $1,400 upgrade | After any completed Story event, restore to full hull. |

Pit Crew II appears as the next state of the same bay after buying Level I and
unlocks after the first Rival win. Neither crew triggers on a wreck or abandoned
race, preserving the emergency tow and the consequence of failing. Show the
upgrade through two animated crew silhouettes, repair sparks, and a filling
hull diagram; explanatory text confirms the exact number.

### Race Prep

| Item | Price | Effect |
| --- | ---: | --- |
| Starter Canister | $75/race | Next Story attempt starts with +1 boost charge, capped by current capacity. |
| Overcharge Rack | $150/race | Next Story attempt has four boost slots instead of three and starts with its extra slot filled. |

The two supplies stack, producing a 2/4 start. They are consumed when an event
actually begins, not when selected or when navigating away. Only one of each
may be queued; its card reads `READY FOR NEXT RACE` and cannot be bought twice.
They are deliberately always available so a non-racing player is not asked to
pass a skill gate before purchasing help.

### Unlockables

| Item | Price | Unlock/effect |
| --- | ---: | --- |
| Music Deck | $500 once | Always purchasable; plays encountered game tracks from the Trophy Room or Garage. Unknown tracks remain silhouetted. |
The shipped jam catalog stops at the Music Deck. Paint Booth and Afterburner FX
were researched as good follow-ups, but are not sold until their actual picker
and trail controls exist; the garage never charges for a promise. The Music
Deck turns track discovery into progression without making the player buy
individual songs.

### Optional stretch upgrades

Only add these after the catalog above is complete and tested:

| Item | Price | Unlock/effect |
| --- | ---: | --- |
| Collector Fins | $450 once | Increase only boost-pickup lateral forgiveness by 20%; never changes hazards or objectives. |
| Reinforced Hull | $650 once | Raise maximum and current hull by 20. Repair price remains $5 per missing point. |
| Paint Booth | $250 once | Add a real car color picker and persist the selected palette. |
| Afterburner FX | $300 once | After the first Triple Threat, add a real exhaust/trail selector. |

Collector Fins are the more valuable accessibility addition; Reinforced Hull is
simple but requires auditing crack thresholds, emergency tow, repair quotes,
and every health percentage display. Do not ship conventional acceleration or
top-speed purchases during the jam because they invalidate qualifier and Rival
tuning.

## Garage presentation contract

The integrated Garage should feel like a current console game's compact loadout
screen while retaining the SNES palette:

- Keep wallet and hull visible while browsing. Divide items into clear
  `SERVICE`, `RACE PREP`, and `UNLOCKABLES` groups; do not present one undifferentiated list.
- Every focused item shows price, exact effect, state, and a car/bay preview.
  Valid states are `BUY`, `LOCKED — <exact condition>`, `OWNED`, `UPGRADE`, and
  `READY FOR NEXT RACE`.
- Affordability uses both text/icon state and color. Never hide a product only
  because the wallet is short.
- A purchase gets a brief register sound, wallet count-down, installed/queued
  animation, and persistent state change. Insufficient funds gets a restrained
  error pulse and no cash sound.
- The car preview visibly responds: hull panels/sparks for repairs, filled
  canisters for Race Prep, crew in the service bay for Pit Crew, deck/equalizer
  for Music, paint swatch on the car, and exhaust pulses for Afterburner FX.
- Leaving and returning reconstructs every item from economy state. No purchase
  may exist only in scene-local UI state.

## Acceptance criteria

1. A successful result itemizes purse, style, new rival bounties, repair/supply
   spending since the prior event, and final wallet. The itemized values sum
   exactly to the wallet delta.
2. Failed qualifier, non-winning Rival result, retry, pause/resume, refresh, and
   duplicate result submission cannot mint money or consume a paid win claim.
3. The fourth and later win of one phase pays no purse. No phase can exceed its
   $150/$300 Style Bank, and no rival ID can pay its bounty twice.
4. Each style event pays exactly once even if its collision persists for several
   frames, its toast is delayed, or repeated events are coalesced.
5. With zero starting cash, the six first-win purses alone total $3,600. This
   buys Pit Crew I, Pit Crew II, Music Deck, and twelve Hull Patches with $300
   left; the central assist/unlock path never requires replay farming.
6. A player with $0 and zero hull still receives the existing emergency tow and
   can start a race. No catalog state can deadlock Story progression.
7. Race Prep is consumed exactly once on race start, survives menu navigation,
   and cannot stack beyond 2/4 starting boost when both supplies are queued.
8. Pit Crew triggers only after a completed Story event. Level I restores no
   more than 15; Level II restores no more than the missing hull.
9. Purchases and payout caps survive a page reload. A fresh new-campaign action
   must explicitly confirm before clearing them; merely entering Story must not.
10. At 800×600, wallet, hull, selected effect, price/state, category, and input
    help remain readable without covering the car preview. Keyboard, controller,
    and pointer can reach and buy every visible item with selection parity.

## Playtest balance gates

Run at least five players or five representative telemetry profiles from novice
to expert and record cash after every event.

- A novice who wins each phase with few tricks should afford Pit Crew I by the
  second course and both crew levels before the final Rival Race.
- A skilled player should feel each toast's `+$15–$25` but earn at least 65% of
  first-clear income from results, not tricks. The current maximum split is
  $3,600 result / $1,800 performance = 67% / 33%.
- Typical repair spend should remain below 20% of first-clear income. If it is
  higher, reduce collision damage or repair cost before increasing purses.
- Starter Canister should cost less than one weak successful event's style take;
  Overcharge should cost no more than one qualifier Style Bank.
- If a required purchase ever appears, the guaranteed purse immediately before
  it must cover that purchase without assuming style rewards.

# Bhabi Thulla — Rules Contract (Classic preset, version `classic-1`)

> Proposed defaults. Visible and versioned per the product brief; household
> confirmation can adjust them before launch. Each match records its ruleset version.

## Setup

- 4–7 seats per table, one standard 52-card deck, no jokers, no partnerships.
- Rank order: A > K > Q > J > 10 > 9 > … > 2. **No suit is trump.**
- Deal one card at a time starting with the seat after the dealer, until all 52
  are distributed. Hand sizes differ by at most one card (extra cards go to the
  earliest seats in deal order).
- Dealer rotates clockwise each match.
- Play proceeds clockwise.

## The opening

- The player holding the **A-spades must open with that exact card**.
- **Classic:** the opening trick follows normal Thulla rules — an off-suit play
  ends it immediately.
- **Protected Opening (variant):** the opening trick always runs through every
  participant even if someone cannot follow spades. The whole trick is discarded
  and the A-spades player leads next (unless they escaped, then lead passes
  clockwise to the next active player).

## Trick play

1. The leader plays a card, choosing the suit for the trick.
2. Each other player **must follow suit** if they hold any card of the led suit.
3. A player unable to follow may play **any** owned card — this ends the trick
   **immediately (Thulla)**. Players later in turn order do not play.
4. On a Thulla, the **highest card of the led suit** determines the pickup
   recipient. The recipient collects **every card in the current trick**,
   including the off-suit card, and **leads next**. An off-suit card can never
   win a trick: an off-suit king never beats a led-suit two.
5. If everyone scheduled for the trick follows suit, all played cards are
   **discarded** (nobody picks up) and the highest card of the led suit
   **leads next**.
6. If the next leader has escaped, lead passes clockwise to the next active player.

*Example:* K-hearts, 5-hearts, A-hearts are played, then 3-clubs from a player
with no hearts. Thulla! The A-hearts player collects all four cards and leads.

## Escapes and endgame

- A player whose hand is empty is marked **safe (escaped)** — but only **after**
  the current trick resolves.
- If a player's last card is currently the highest and a Thulla occurs, they
  collect the pile and **remain active**.
- When only one player still holds cards after resolution, that player is
  **Bhabi** and the match ends.
- If all remaining hands empty together after resolution, the match ends as a
  **draw** with no Bhabi.
- Seat order stays clockwise as players escape; escaped players may watch but
  cannot play.

## Bots (house table rules for bots)

- Bots see only their own hand plus public information (played cards, hand
  counts, escapes). They never inspect opponents' hands and never influence
  the shuffle.
- **Easy** plays a random legal card. **Normal** sheds high cards when leading,
  plays low when following (to avoid becoming a pickup recipient), and sheds
  high when forced off-suit.

## What Classic does NOT include

No voluntary hand transfers, no special shoot-out or random-draw endgame,
no partnerships, no wagering.

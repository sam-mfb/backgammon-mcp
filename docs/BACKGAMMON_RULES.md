# Backgammon Rules Reference

> Source: [United States Backgammon Federation (USBGF)](https://usbgf.org/backgammon-basics-how-to-play/)

This document provides a comprehensive reference for backgammon rules as defined by the USBGF. It is intended for developers implementing game logic.

---

## Table of Contents

1. [Equipment](#equipment)
2. [Board Setup](#board-setup)
3. [Objective](#objective)
4. [Starting the Game](#starting-the-game)
5. [Movement Rules](#movement-rules)
6. [Dice Rules](#dice-rules)
7. [Hitting and the Bar](#hitting-and-the-bar)
8. [Bearing Off](#bearing-off)
9. [Winning](#winning)
10. [Doubling Cube](#doubling-cube-not-implemented)
11. [Optional Rules](#optional-rules-not-implemented)

---

## Equipment

- **Board**: 24 narrow triangles called "points", arranged in four quadrants of 6 points each
- **Bar**: The center ridge dividing the board
- **Checkers**: 15 per player (traditionally white/red or white/black)
- **Dice**: Two standard six-sided dice per player
- **Doubling Cube**: A six-sided die marked with 2, 4, 8, 16, 32, 64 (for stakes)

---

## Board Setup

### Point Numbering

Points are numbered 1-24 from each player's perspective:

- Each player's **1-point** is in their home board (bearing off destination)
- Each player's **24-point** is in their opponent's home board
- A player's 24-point is the opponent's 1-point

### Quadrants

| Quadrant            | White's View | Black's View |
| ------------------- | ------------ | ------------ |
| White's Home Board  | Points 1-6   | Points 19-24 |
| White's Outer Board | Points 7-12  | Points 13-18 |
| Black's Outer Board | Points 13-18 | Points 7-12  |
| Black's Home Board  | Points 19-24 | Points 1-6   |

### Initial Checker Positions

Each player starts with 15 checkers positioned as follows:

| Point (from player's view) | Checkers |
| -------------------------- | -------- |
| 24-point                   | 2        |
| 13-point                   | 5        |
| 8-point                    | 3        |
| 6-point                    | 5        |
| **Total**                  | **15**   |

**Visual representation (White's perspective):**

```
    13 14 15 16 17 18 | BAR | 19 20 21 22 23 24
   +------------------+-----+------------------+
   | X           O  O |     | O              X |
   | X           O  O |     | O              X |
   |             O  O |     | O                |
   |             O    |     | O                |
   |             O    |     | O                |
   |------------------+-----+------------------|
   | O             X  |     | X              O |
   | O             X  |     | X              O |
   |               X  |     | X                |
   | O             X  |     | X                |
   | O             X  |     | X              O |
   +------------------+-----+------------------+
    12 11 10  9  8  7 | BAR |  6  5  4  3  2  1

   O = White (5 on 6-pt, 3 on 8-pt, 5 on 13-pt, 2 on 24-pt)
   X = Black (5 on 6-pt, 3 on 8-pt, 5 on 13-pt, 2 on 24-pt)
```

---

## Objective

Move all 15 of your checkers into your home board, then bear them off. The first player to bear off all checkers wins.

---

## Starting the Game

### Determining First Player

1. Each player rolls one die
2. The player with the higher number goes first
3. If both roll the same number, re-roll until different
4. The first player uses BOTH dice from the opening roll (does not roll again)

### Example

- White rolls 4, Black rolls 2
- White goes first and plays a 4 and a 2

---

## Movement Rules

### Direction

- **White** moves from point 24 toward point 1 (high to low)
- **Black** moves from point 1 toward point 24 (low to high)
- Checkers always move forward (toward home board), never backward

### Basic Movement

Each die represents a separate move:

- Roll 5-3: Move one checker 5 points AND move one checker 3 points
- OR: Move one checker 5 points, then the same checker 3 more points (total 8)

### Combining Dice on One Checker

When moving one checker using both dice:

- The intermediate point must be open (not blocked)
- Example: To move 8 points with a 5-3 roll, either the point 5 away OR the point 3 away must be open

### Legal Landing Points

A checker may land on a point that is:

1. **Empty** (no checkers)
2. **Occupied by your own checkers** (any number)
3. **Occupied by exactly ONE opponent checker** (a "blot" - this hits it)

A checker may NOT land on a point occupied by **two or more opponent checkers** (blocked/made point).

### Making a Point

When you have two or more checkers on a point, you "own" or "make" that point. Opponent cannot land there.

---

## Dice Rules

### Rolling

- Roll both dice together
- Dice must land flat on the right-hand side of the board
- Re-roll if: dice land outside board, land on a checker, or don't land flat
- A turn is completed when the player picks up their dice

### Doubles

Rolling the same number on both dice (e.g., 4-4):

- Play that number **four times** instead of twice
- Can be distributed among multiple checkers
- Example: Roll 3-3, you have four moves of 3 points each

### Obligation to Play

**You must use as many dice as legally possible:**

1. **Both dice playable**: Must play both
2. **Only one die playable**: Must play that one
3. **Either die playable, but not both**: Must play the HIGHER number
4. **Neither die playable**: Turn is forfeited (no move)

**For doubles:**

- Must play as many of the four moves as legally possible
- If only 2 of 4 can be played, play 2

---

## Hitting and the Bar

### Blots

A single checker alone on a point is called a "blot" and is vulnerable to being hit.

### Hitting

When your checker lands on a point with exactly one opponent checker:

1. The opponent's checker is "hit"
2. The hit checker is placed on the bar (center of the board)
3. Your checker occupies that point

### Entering from the Bar

When you have checkers on the bar:

1. **First obligation**: Enter ALL bar checkers before moving any other checker
2. **Entry points**: Opponent's home board (points 1-6 from their view, 19-24 from yours for White)
3. **Entry mechanism**: Roll dice, enter on point matching die value if open
   - White enters on points 19-24 (roll 1 = point 24, roll 6 = point 19)
   - Black enters on points 1-6 (roll 1 = point 1, roll 6 = point 6)

### Bar Entry Examples

**White has a checker on the bar, rolls 4-2:**

- Can enter on point 21 (24 - 4 + 1 = 21) if open
- OR enter on point 23 (24 - 2 + 1 = 23) if open
- After entering, may use remaining die to move

**If entry points are blocked:**

- If both points are blocked: Turn is forfeited
- If one point is blocked: Enter on the other, use remaining die if possible
- Multiple checkers on bar: Enter as many as possible

### Hitting While Entering

You can hit an opponent's blot when entering from the bar.

---

## Bearing Off

### Prerequisites

You can only bear off when **ALL 15 of your checkers are in your home board**.

- White's home board: Points 1-6
- Black's home board: Points 19-24

If a checker is hit during bearing off, you must:

1. Re-enter from the bar
2. Move that checker back to your home board
3. Resume bearing off

### Bearing Off Mechanics

**Exact roll:**

- Roll matches point number → Remove that checker
- Example: Roll 4, bear off a checker from the 4-point

**No checker on rolled point:**

- Must move a checker from a HIGHER-numbered point if possible
- Example: Roll 4, no checker on 4-point, but checker on 5-point → Move 5→1

**No checker on higher points:**

- May (and must) bear off from the HIGHEST occupied point
- Example: Roll 6, highest checker is on 3-point → Bear off from 3-point

### Bearing Off with Both Dice

You may use one die to move within the home board and the other to bear off:

- Roll 5-2 with checkers on 6-point and 2-point
- Move 6→1 (using 5), then bear off from 1-point? No - must land exactly
- OR: Bear off 2-point (using 2), then move 6→1 (using 5)

### Bearing Off Priority

The obligation to play both dice (or as many as possible) still applies:

- If you can bear off with one die and must move with the other, do so
- You cannot voluntarily skip a playable die

---

## Winning

### Game End

The game ends when one player bears off all 15 checkers.

### Victory Types

| Type           | Condition                                                                                                 | Point Value |
| -------------- | --------------------------------------------------------------------------------------------------------- | ----------- |
| **Single**     | Opponent has borne off at least 1 checker                                                                 | 1× stakes   |
| **Gammon**     | Opponent has NOT borne off any checkers                                                                   | 2× stakes   |
| **Backgammon** | Opponent has NOT borne off any checkers AND has at least one checker on the bar or in winner's home board | 3× stakes   |

---

## Doubling Cube (Not Implemented)

> Note: The doubling cube is used for stakes/gambling and is not implemented in this version.

For reference:

- Games start at 1 point
- Either player may propose doubling before their roll
- Opponent may accept (stakes double, they own cube) or refuse (lose at current stakes)
- Only cube owner may propose next double
- No limit on redoubles

### Crawford Rule (Match Play)

When one player is one point away from winning a match:

- The doubling cube is out of play for that one game
- Prevents the trailing player from immediately doubling

---

## Optional Rules (Not Implemented)

These rules are sometimes used but are not part of standard play:

### Automatic Doubles

If both players roll the same number to start, stakes automatically double. Often limited to one automatic double per game.

### Beavers

When doubled, a player may immediately redouble ("beaver") while keeping cube ownership.

### Jacoby Rule

Gammons and backgammons only count as single games unless the cube has been turned. Encourages cube action.

---

## Quick Reference

### Checker Movement Summary

| Scenario                        | Rule              |
| ------------------------------- | ----------------- |
| Landing on empty point          | Legal             |
| Landing on own checkers         | Legal             |
| Landing on 1 opponent checker   | Legal (hit)       |
| Landing on 2+ opponent checkers | Illegal (blocked) |

### Must-Play Priority

1. Play both dice if possible
2. If only one playable, play it
3. If either but not both, play the higher
4. If neither, forfeit turn

### Key Numbers

- 15 checkers per player
- 24 points on board
- 6 points per quadrant
- 4 moves on doubles
- Home board = points 1-6 (or 19-24)

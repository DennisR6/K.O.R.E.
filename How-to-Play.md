# Slipstrike (KORE) — How to Play Guide

Welcome to **Slipstrike** (also known as **KORE**), a turn-based 2D arena physics-tactics game. Players drag and release circular figures across slippery ice and billiard surfaces, navigating hazards, executing collisions, and utilizing specialized items to eliminate the opposing team.

---

## 🎮 Basic Gameplay & Controls

The game is played in a local hotseat or server matchmaking layout. Each team takes turns controlling their circular figures.

### 1. Movement and Aiming (Drag-to-Shoot)
- **Active Team Check**: You can only control figures belonging to your currently active team.
- **How to Shoot**:
  1. Click and hold the mouse button over any of your live figures.
  2. Drag the cursor in the **opposite direction** of your intended shot (like a slingshot).
  3. An overlay arrow will appear indicating the vector and power of the launch.
  4. **Power Limit**: Drag distance maps to launch power from `0` to `10`. Dragging 100 world units matches the maximum power of `10`.
  5. Release the mouse button to fire the figure.

### 2. Physics & Collisions
- Once a shot is fired, the game enters a deterministic, no-input physics simulation phase.
- Figures slide based on map-specific physics (e.g., **Ice** has low friction; **Billiards** has higher friction; some maps have **Drift** steering blends).
- Figures bounce off obstacles, arena walls, and other figures.
- A turn resolves completely when all figures settle to a stop (at or below the speed stop threshold) or when the simulation reaches its hard safety limit of `1,200` frames.

---

## 📦 Turn Phases & Item Selection

A single turn proceeds through structured rules phases (Item Phase -> Aiming/Physics Phase).

### The Item Phase
At the start of your turn, if the game mode includes items, the **Item Phase** begins. A dark-slate panel will appear in the upper-right corner of the browser canvas.

> [!NOTE]
> During the Item Phase, all drag-to-shoot actions are locked. Attempting to drag and launch a figure will be rejected with visual gameplay feedback until you either use an item or skip the phase.

#### How to Select and Use Items:
1. **Identify the Active Figure**: The UI automatically selects your active team's first alive figure.
2. **Review Available Inventory**: The item panel lists each item currently held by that figure, showing:
   - The Item ID (e.g., `Anker`, `Magnet`, `Power-Dash`, `Switch`).
   - The remaining uses in parentheses.
3. **Use an Item**: Click on the item's button in the panel. 
   - This immediately uses the item targeting `{ type: "self" }` (applying its effects directly to the active figure).
   - Using an item consumes one charge and advances the turn to the Aiming/Physics phase.
4. **Skip the Phase**: If you do not want to use an item, click the blue **"Skip phase"** button at the bottom of the panel to go straight to Aiming/Physics.

---

## 🏆 Win Conditions & Out-Of-Bounds (OOB)

* **Last Team Standing**: You win when all opponent figures are eliminated while at least one of your team's figures remains alive.
* **Draw**: If a collision or hazard eliminates all surviving figures from both teams in the same turn, the game ends in a Draw.
* **Containment Elimination**: On some maps (such as *Symmetric Duel*, *Structure Control*, and *Hazard Control*), the outer walls double as a containment boundary. Any figure whose circular body leaves the world dimensions is instantly eliminated.
* **Deadly Hazards**: Avoid landing inside red hazards (such as the kill-zones on *Hazard Control* and *Magma Cradle*), which eliminate figures upon contact.

---

## 💡 Quick Tactical Tips

> [!TIP]
> **Use the Central Obstacles**: Direct shots at the opponent are often blocked by central columns or walls. Bank your shots off side containment boundaries to flank your opponent.

> [!WARNING]
> **Watch Your Power**: Strong shots are high-risk. Pushing a defender puck into a wall might eliminate them, but excessive power can easily cause your own puck to deflect out-of-bounds or into a lethal hazard!

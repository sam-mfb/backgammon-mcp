# Backgammon MCP

Play backgammon with your favorite LLM.

A backgammon game that can be played through Claude Desktop (via MCP) or as a standalone web app.

## Project Structure

```
packages/
├── game/          # Core game logic (Redux-based, framework-agnostic)
├── viewer/        # React UI components for the board
├── web-app/       # Standalone web app ("couch mode")
└── mcp-server/    # MCP server for Claude Desktop integration
```

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)

## Installation

```bash
git clone <repo-url>
cd backgammon-mcp
pnpm install
```

## Running Modes

### Couch Mode (Standalone Web App)

Play backgammon locally in your browser - perfect for two humans on the same device.

```bash
# Start the development server
pnpm --filter @backgammon/web-app dev
```

Open http://localhost:5173 in your browser.

### Claude Desktop (MCP App)

Play backgammon with Claude as your opponent, or watch Claude play against itself.

#### 1. Build the MCP App

The MCP server requires a built client UI bundle. This must be done before first use and after any changes to the viewer or client code.

```bash
# Build the client UI bundle (required)
pnpm --filter @backgammon/mcp-server build:client
```

This creates `packages/mcp-server/dist/client/index.html` - a single-file bundle containing the interactive board UI.

#### 2. Configure Claude Desktop

Edit your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the backgammon server:

```json
{
  "mcpServers": {
    "backgammon": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/backgammon-mcp/packages/mcp-server/src/server.ts"]
    }
  }
}
```

**Important**: Replace `/ABSOLUTE/PATH/TO/backgammon-mcp` with the actual full path to this repository.

#### 3. Restart Claude Desktop

After saving the config, restart Claude Desktop. You should see "backgammon" in the MCP servers list.

#### 4. Start Playing

Ask Claude to start a game:

> "Let's play backgammon! Start a new game where I play white and you play black."

Or watch an AI vs AI game:

> "Start a backgammon game where you control both players and play against yourself."

## Available Tools (MCP)

| Tool | Description |
|------|-------------|
| `backgammon_start_game` | Start a new game. Optionally specify who controls each color (`human` or `ai`). |
| `backgammon_roll_dice` | Roll dice for the current turn. |
| `backgammon_make_move` | Move a checker from one point to another. |
| `backgammon_end_turn` | End the current player's turn. |
| `backgammon_get_game_state` | Get the current board position and available moves. |
| `backgammon_reset_game` | Reset to initial state. |
| `backgammon_get_rules` | Get backgammon rules (overview, movement, dice, hitting, bearing_off, winning). |

## Development

### Run Tests

```bash
# All packages
pnpm test

# Specific package
pnpm --filter @backgammon/game test
```

### Type Check

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
```

## Architecture

- **game/**: Pure game logic with no UI dependencies. Uses Redux Toolkit for state management. Exports reducers, actions, selectors, and type definitions.

- **viewer/**: React components that render the backgammon board. Fully controlled - receives all state via props, emits events via callbacks. Uses CSS custom properties for theming.

- **web-app/**: Standalone Vite + React app that combines the game logic and viewer. Uses Redux for state management.

- **mcp-server/**: MCP server that exposes game tools and serves the viewer as an MCP App resource. The viewer is bundled as a single HTML file using vite-plugin-singlefile.

## License

MIT

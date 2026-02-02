# MCP Server Implementation Analysis

This document analyzes the `@backgammon/mcp-server` package against MCP app best practices as documented in the official MCP extension apps guide and the reference implementations in the [`modelcontextprotocol/ext-apps`](https://github.com/modelcontextprotocol/ext-apps) repository.

**Reference Examples Reviewed:**
- `basic-server-react` - React implementation patterns
- `basic-server-vanillajs` - Vanilla JS lifecycle management
- `system-monitor-server` - Advanced patterns (polling, visibility controls, safe areas)
- General SDK patterns and conventions

## Executive Summary

The implementation is **solid and follows most core MCP patterns correctly**. However, there are opportunities to improve idiomaticity, add missing features, and enhance robustness to better match official examples.

### Strengths
- ✅ Correct Tool + Resource pattern implementation
- ✅ Proper use of `registerAppTool` and `registerAppResource`
- ✅ React `useApp` hook for lifecycle management
- ✅ Host styling integration (manual approach)
- ✅ Correct build configuration with `vite-plugin-singlefile`
- ✅ TypeScript execution with `tsx`
- ✅ Error handling and user feedback

### Areas for Improvement
- ⚠️ Missing tool visibility controls
- ⚠️ Not using `useHostStyles` React hook (using manual approach instead)
- ⚠️ No safe area inset handling
- ⚠️ Mixed tool registration approaches
- ⚠️ Missing lifecycle optimizations

---

## Detailed Analysis

### 1. Tool Visibility Control ⚠️

**Current State:** All tools use default visibility `["model", "app"]`, making them accessible to both the AI model and the UI.

**Issue:** UI-triggered actions like `backgammon_roll_dice` and `backgammon_end_turn` should be restricted to UI-only access.

**Recommendation:**

```typescript
// Tools that should be UI-only (buttons in the interface)
registerAppTool(
  server,
  'backgammon_roll_dice',
  {
    description: "Roll the dice for the current player's turn.",
    _meta: {
      ui: {
        resourceUri: RESOURCE_URI,
        visibility: ["app"] // UI-only - hide from model
      }
    }
  },
  // ... handler
)

registerAppTool(
  server,
  'backgammon_end_turn',
  {
    description: "End the current player's turn.",
    _meta: {
      ui: {
        resourceUri: RESOURCE_URI,
        visibility: ["app"] // UI-only
      }
    }
  },
  // ... handler
)
```

**Rationale:** These tools are UI interaction primitives. The model should use higher-level tools like `backgammon_make_move`. Having the model call `roll_dice` directly can lead to confusion and unnecessary turn management complexity.

**File:** `src/server.ts:185-217, 290-321`

---

### 2. React Styling Hook Usage ⚠️

**Current State:** Manual application of host styles in `useEffect`:

```typescript
// McpAppShim.tsx:88-99
useEffect(() => {
  if (hostContext?.theme) {
    applyDocumentTheme(hostContext.theme)
  }
  if (hostContext?.styles?.variables) {
    applyHostStyleVariables(hostContext.styles.variables)
  }
  if (hostContext?.styles?.css?.fonts) {
    applyHostFonts(hostContext.styles.css.fonts)
  }
}, [hostContext])
```

**Issue:** The MCP React SDK provides a `useHostStyles` hook that automates this pattern.

**Recommendation:**

```typescript
import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react'

export function McpAppShim(): React.JSX.Element {
  const { app, toolResult, hostContext, error } = useApp<BackgammonStructuredContent>({
    appInfo: { name: 'Backgammon', version: '1.0.0' },
    capabilities: {}
  })

  // Automatically applies theme, variables, and fonts
  useHostStyles(hostContext)

  // ... rest of component
}
```

**Rationale:** Using the official hook:
- Reduces boilerplate
- Ensures correct implementation
- Automatically handles edge cases
- Follows idiomatic MCP patterns

**File:** `src/client/McpAppShim.tsx:88-99`

---

### 3. Safe Area Inset Handling ⚠️

**Current State:** No handling of `safeAreaInsets` from host context.

**Issue:** On devices with notches or system UI (mobile, tablets), the app UI may overlap with system elements.

**Recommendation:**

```typescript
// In McpAppShim.tsx
useEffect(() => {
  if (hostContext?.safeAreaInsets) {
    const { top, right, bottom, left } = hostContext.safeAreaInsets
    document.documentElement.style.setProperty('--safe-area-top', `${top}px`)
    document.documentElement.style.setProperty('--safe-area-right', `${right}px`)
    document.documentElement.style.setProperty('--safe-area-bottom', `${bottom}px`)
    document.documentElement.style.setProperty('--safe-area-left', `${left}px`)
  }
}, [hostContext?.safeAreaInsets])
```

Then in your CSS (in `@backgammon/viewer`):

```css
.board-container {
  padding-top: var(--safe-area-top, 0);
  padding-right: var(--safe-area-right, 0);
  padding-bottom: var(--safe-area-bottom, 0);
  padding-left: var(--safe-area-left, 0);
}
```

**Rationale:** Ensures UI is not obscured by system elements on modern devices.

**File:** `src/client/McpAppShim.tsx` (new effect needed)

---

### 4. Mixed Tool Registration Approaches ⚠️

**Current State:** Most tools use `registerAppTool()` but `backgammon_get_rules` uses plain `server.tool()`:

```typescript
// server.ts:390
server.tool(
  'backgammon_get_rules',
  'Get information about backgammon rules...',
  // ... schema and handler
)
```

**Analysis:** This is **intentional and acceptable** since the rules tool:
- Returns pure text content
- Doesn't interact with game state
- Doesn't need UI rendering
- Is purely informational

**Recommendation:** Document this decision explicitly:

```typescript
// =============================================================================
// Tool: Get Rules (non-App tool - pure information, no UI needed)
// =============================================================================

server.tool(
  'backgammon_get_rules',
  'Get information about backgammon rules. Specify a section: overview, movement, dice, hitting, bearing_off, winning, or all.',
  // ...
)
```

**Rationale:** Makes the intentional distinction clear to future maintainers.

**File:** `src/server.ts:387-498`

---

### 5. Streaming Partial Input (Optional Feature) ℹ️

**Current State:** Not implemented.

**Use Case:** For tools with large inputs (e.g., if you added batch move submission), partial input streaming allows progressive UI updates.

**Example Implementation:**

```typescript
// In McpAppShim.tsx
const { app, toolResult, hostContext, error, partialToolInput } =
  useApp<BackgammonStructuredContent>({
    appInfo: { name: 'Backgammon', version: '1.0.0' },
    capabilities: {},
    ontoolinputpartial: (partial) => {
      // Handle streaming input
      console.log('Partial input:', partial)
    }
  })
```

**Assessment:** **Not needed for current use case**. Your tools have small, atomic inputs. This would only be valuable if you added features like:
- Batch move submission
- Game analysis with large position history
- Import/export of long game records

**File:** N/A (optional enhancement)

---

### 6. Visibility-Based Resource Management (Performance) ℹ️

**Current State:** No `IntersectionObserver` to pause expensive operations when UI is not visible.

**Use Case:** Pause animations, polling, or expensive rendering when the app scrolls out of view.

**Example Implementation:**

```typescript
// In McpAppShim.tsx
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      const isVisible = entries[0].isIntersecting
      // Pause/resume animations or polling based on isVisible
    },
    { threshold: 0.1 }
  )

  const rootElement = document.getElementById('root')
  if (rootElement) {
    observer.observe(rootElement)
  }

  return () => observer.disconnect()
}, [])
```

**Assessment:** **Low priority for current implementation**. Your app:
- Has no continuous animations (board is static between moves)
- Has no polling/timers
- Renders efficiently with React

This would become relevant if you add:
- Animated dice rolls
- Timer/clock display
- Live opponent move notifications

**File:** N/A (optional optimization)

---

### 7. Handler Registration Order ✅

**Status:** Correctly handled by `useApp` hook.

**Analysis:** The React `useApp` hook automatically manages the handler lifecycle, ensuring all handlers are registered before `app.connect()` is called. No action needed.

**File:** `src/client/McpAppShim.tsx:59-63`

---

### 8. Error Handling ✅

**Status:** Good implementation with room for minor enhancement.

**Current Approach:**
- Server-side error responses with `errorResponse()` helper
- Client-side error toast with auto-dismiss

**Enhancement Suggestion:** Add error recovery actions:

```typescript
// In error toast
{errorMessage && (
  <div className="error-toast">
    <span>{errorMessage}</span>
    <button onClick={() => {
      setErrorMessage(null)
      // Optionally refresh state
      app?.callServerTool({ name: 'backgammon_get_game_state', arguments: {} })
    }}>
      Dismiss
    </button>
  </div>
)}
```

**File:** `src/client/McpAppShim.tsx:108-120, 277-278`

---

### 9. Type Safety Between Server and Client ⚠️

**Current State:** `BackgammonStructuredContent` is defined **separately** in both:
- `src/server.ts:49-54`
- `src/client/McpAppShim.tsx:30-35`

**Issue:** Type drift risk - if server response structure changes, client types won't update automatically.

**Recommendation:** Create shared type definition:

```typescript
// src/types.ts (new file)
import type { GameState, AvailableMoves } from '@backgammon/game'

export type PlayerControl = 'human' | 'ai'

export interface GameConfig {
  readonly whiteControl: PlayerControl
  readonly blackControl: PlayerControl
}

export interface BackgammonStructuredContent {
  [key: string]: unknown
  gameState: GameState
  validMoves?: readonly AvailableMoves[]
  config?: GameConfig
}
```

Then import in both files:

```typescript
// src/server.ts
import type { BackgammonStructuredContent, GameConfig } from './types'

// src/client/McpAppShim.tsx
import type { BackgammonStructuredContent, GameConfig } from '../types'
```

**Rationale:** Single source of truth prevents type drift and reduces maintenance burden.

**Files:** `src/server.ts:43-54`, `src/client/McpAppShim.tsx:23-40`

---

### 10. Resource URI Management 💡

**Current State:** Resource URI is hardcoded:

```typescript
// src/server.ts:37
const RESOURCE_URI = 'ui://backgammon/board'
```

**Suggestion:** Consider namespace versioning for future compatibility:

```typescript
const RESOURCE_URI = 'ui://backgammon/v1/board'
```

**Rationale:** If you later add multiple UI variants (e.g., 3D board, analysis view), versioned URIs provide clean migration path:
- `ui://backgammon/v1/board` - Current 2D board
- `ui://backgammon/v2/board` - Future enhanced board
- `ui://backgammon/v1/analysis` - New analysis view

**Assessment:** **Nice-to-have**, not critical for current single-UI scenario.

**File:** `src/server.ts:37`

---

### 11. Package.json Scripts ✅

**Status:** Correctly configured.

**Analysis:**
- ✅ Uses `tsx` for server execution
- ✅ Separate build scripts for client and server
- ✅ Proper build ordering

**Suggestion:** Add development mode script:

```json
{
  "scripts": {
    "build": "pnpm build:client && pnpm build:server",
    "build:client": "vite build --config vite.config.client.ts",
    "build:server": "tsc --noEmit",
    "start": "tsx src/server.ts",
    "dev": "tsx watch src/server.ts",
    "dev:client": "vite --config vite.config.client.ts"
  }
}
```

**Rationale:** `tsx watch` enables hot-reload during development.

**File:** `package.json:11-16`

---

### 12. Build Output Path Convention ℹ️

**Current State:** Built client HTML is at `dist/client/index.html`, resolved from `../dist/client/index.html` relative to `src/server.ts`.

**Analysis:** This works but is slightly unconventional. MCP examples typically use:
- `dist/index.html` (at package root)
- Or inline the HTML in the server code during build

**Recommendation:** **Keep current approach** since it:
- Clearly separates client and server artifacts
- Works correctly with your monorepo structure
- Is more explicit about what's being served

**Alternative (if you want to match examples more closely):**

```typescript
// vite.config.client.ts
export default defineConfig({
  root: 'src/client',
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'esnext',
    outDir: '../../dist',  // Changed from ../../dist/client
    emptyOutDir: true
  }
})

// server.ts
const htmlPath = join(__dirname, '../dist/index.html')  // Simplified path
```

**Assessment:** **Current approach is fine**, consider changing only if following examples strictly.

**Files:** `vite.config.client.ts:10`, `src/server.ts:117`

---

### 13. Fullscreen Mode Support (Optional Feature) ℹ️

**Current State:** Not implemented.

**Use Case:** Allow users to expand the board to fullscreen on supported hosts.

**Example Implementation:**

```typescript
// Check if fullscreen is available
const canGoFullscreen = hostContext?.availableDisplayModes?.includes('fullscreen')

// Add button to toggle
const handleFullscreenToggle = useCallback(() => {
  if (canGoFullscreen) {
    app?.requestDisplayMode({ mode: 'fullscreen' })
  }
}, [app, canGoFullscreen])

// In UI
{canGoFullscreen && (
  <button onClick={handleFullscreenToggle}>Fullscreen</button>
)}
```

**Assessment:** **Nice-to-have enhancement**. Board would benefit from more screen real estate for detailed game analysis.

**File:** N/A (optional enhancement)

---

## Priority Recommendations

### High Priority (Implement Soon)
1. **Add tool visibility controls** - Prevents model confusion, improves UX (examples: `system-monitor-server`)
2. **Add safe area inset handling** - Critical for mobile/tablet support (examples: all React examples)
3. **Share type definitions** - Prevents type drift between server/client
4. **Add output schemas to tools** - Better type safety and documentation (examples: `basic-server-vanillajs`)

### Medium Priority (Consider for Next Version)
5. **Use `useHostStyles` hook** - More idiomatic React pattern (if SDK provides it)
6. **Document tool registration approach** - Clarifies intentional design decisions
7. **Add development logging** - Improves debugging experience (pattern: all examples)
8. **Add development scripts** - Improves developer experience (tsx watch)

### Low Priority (Future Enhancements)
9. **Enhanced error recovery UI** - Better UX for error states
10. **Vite sourcemap configuration** - Better dev experience (pattern: examples)
11. **Visibility-based optimizations** - Only if adding animations/polling
12. **Fullscreen mode support** - Nice-to-have feature
13. **Streaming partial input** - Only if adding batch operations

### Optional (Style/Convention Alignment)
14. **Standardize resource registration signature** - Match examples more closely
15. **Use `onAppCreated` callback** - Only if need custom lifecycle handlers

---

## Additional Findings from Reference Examples

After reviewing the official MCP examples (`basic-server-react`, `system-monitor-server`, etc.), here are additional patterns and conventions your implementation could adopt:

### 1. Output Schema in Tool Definitions ⚠️

**Pattern in Examples:**

```typescript
// From basic-server-vanillajs/server.ts
registerAppTool(server,
  "get-time",
  {
    title: "Get Time",
    description: "Returns the current server time as an ISO 8601 string.",
    inputSchema: {},
    outputSchema: z.object({
      time: z.string(),
    }),
    _meta: { ui: { resourceUri } },
  },
  // handler
)
```

**Current State:** Your tool definitions don't include `outputSchema`.

**Recommendation:** Add output schemas for better type safety and documentation:

```typescript
registerAppTool(
  server,
  'backgammon_roll_dice',
  {
    description: "Roll the dice for the current player's turn.",
    inputSchema: {},
    outputSchema: z.object({
      gameState: GameStateSchema,
      validMoves: z.array(AvailableMovesSchema).optional(),
    }),
    _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ["app"] } }
  },
  // handler
)
```

**Benefit:** Provides runtime validation and better IDE support for consumers.

**File:** `src/server.ts` (all tool definitions)

---

### 2. React Lifecycle Handler Registration 📝

**Pattern in Examples:**

```typescript
// From basic-server-react/src/mcp-app.tsx:24-50
const { app, error } = useApp({
  appInfo: { name: "Get Time App", version: "1.0.0" },
  capabilities: {},
  onAppCreated: (app) => {
    app.onteardown = async () => {
      console.info("App is being torn down");
      return {};
    };
    app.ontoolinput = async (input) => {
      console.info("Received tool call input:", input);
    };
    app.ontoolresult = async (result) => {
      console.info("Received tool call result:", result);
      setToolResult(result);
    };
    // ... more handlers
  },
});
```

**Current State:** You pass handlers directly without using `onAppCreated`:

```typescript
const { app, toolResult, hostContext, error } = useApp<BackgammonStructuredContent>({
  appInfo: { name: 'Backgammon', version: '1.0.0' },
  capabilities: {}
})
```

**Analysis:** Both approaches work, but the examples use `onAppCreated` to:
1. Explicitly control handler registration timing
2. Keep handler logic close to `useApp` call
3. Have access to the app instance for setup

**Assessment:** **Your approach is simpler and works fine**. The `onAppCreated` pattern is useful when you need custom lifecycle handlers beyond what `useApp` provides directly.

**File:** `src/client/McpAppShim.tsx:59-63`

---

### 3. Vite Configuration Patterns 📝

**Pattern in Examples:**

```typescript
// From basic-server-react/vite.config.ts
const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is not set");
}

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    rollupOptions: {
      input: INPUT,  // Dynamic input via env var
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
```

**Current State:**

```typescript
// Your vite.config.client.ts
export default defineConfig({
  root: 'src/client',
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'esnext',
    outDir: '../../dist/client',
    emptyOutDir: true
  }
})
```

**Differences:**
- Examples use env var for input file
- Examples output to `dist/` root, not `dist/client/`
- Examples conditionally enable sourcemaps for dev

**Recommendation (Optional):**

```typescript
const isDevelopment = process.env.NODE_ENV === 'development'

export default defineConfig({
  root: 'src/client',
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'esnext',
    outDir: '../../dist/client',
    emptyOutDir: true,
    sourcemap: isDevelopment ? 'inline' : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
  }
})
```

**Assessment:** **Your current config is fine**, especially for monorepo structure.

**File:** `vite.config.client.ts`

---

### 4. Resource Registration Signature 📝

**Pattern in Examples:**

```typescript
// From system-monitor-server/server.ts:172-193
registerAppResource(
  server,
  resourceUri,        // 1st: URI/name
  resourceUri,        // 2nd: URI again (or title)
  {                   // 3rd: metadata object
    mimeType: RESOURCE_MIME_TYPE,
    description: "System Monitor UI"
  },
  async (): Promise<ReadResourceResult> => {
    // handler
  }
)
```

**Current State:**

```typescript
// Your server.ts:110-129
registerAppResource(
  server,
  'Interactive backgammon board',  // Title as string
  RESOURCE_URI,
  { description: 'Interactive backgammon game board' },
  async () => {
    // handler
  }
)
```

**Analysis:** Both signatures are valid. The examples tend to use URI for both name and title parameters for consistency.

**Recommendation (Optional):** Match example pattern:

```typescript
registerAppResource(
  server,
  RESOURCE_URI,
  RESOURCE_URI,
  {
    mimeType: RESOURCE_MIME_TYPE,
    description: 'Interactive backgammon game board'
  },
  async () => {
    // handler
  }
)
```

**Assessment:** **Not critical** - both approaches work correctly.

**File:** `src/server.ts:110-129`

---

### 5. Explicit Safe Area Handling (Confirmed) ✅

**Pattern in Examples:**

```typescript
// From system-monitor-server/src/mcp-app.ts:442-448
function handleHostContextChanged(ctx: McpUiHostContext) {
  if (ctx.safeAreaInsets) {
    mainEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
    mainEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
    mainEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
    mainEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
  }
}
```

And in React:

```typescript
// From basic-server-react/src/mcp-app.tsx:123-128
<main
  style={{
    paddingTop: hostContext?.safeAreaInsets?.top,
    paddingRight: hostContext?.safeAreaInsets?.right,
    paddingBottom: hostContext?.safeAreaInsets?.bottom,
    paddingLeft: hostContext?.safeAreaInsets?.left,
  }}
>
```

**Current State:** Not implemented.

**Recommendation:** Add to your `McpAppShim.tsx`:

```typescript
return (
  <div
    style={{
      paddingTop: hostContext?.safeAreaInsets?.top,
      paddingRight: hostContext?.safeAreaInsets?.right,
      paddingBottom: hostContext?.safeAreaInsets?.bottom,
      paddingLeft: hostContext?.safeAreaInsets?.left,
    }}
  >
    {errorMessage && <div className="error-toast">{errorMessage}</div>}
    <BoardView
      // ... props
    />
  </div>
)
```

**File:** `src/client/McpAppShim.tsx:276-293`

---

### 6. Handler Registration Order (Vanilla JS) 📝

**Pattern in Examples:**

```typescript
// From system-monitor-server/src/mcp-app.ts:422-458
app.onerror = console.error;
app.ontoolresult = (result) => { /* ... */ };
app.onhostcontextchanged = handleHostContextChanged;

// THEN connect
app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) {
    handleHostContextChanged(ctx);
  }
});
```

**Analysis:** The vanilla JS examples explicitly register all handlers **before** calling `app.connect()`, which ensures handlers are ready when events fire.

**Your React Implementation:** Uses `useApp` hook which handles this automatically - **no change needed**.

---

### 7. Console Logging for Debugging 💡

**Pattern in Examples:**

Both React and vanilla JS examples include extensive console logging:

```typescript
app.ontoolinput = async (input) => {
  console.info("Received tool call input:", input);
};

app.ontoolresult = async (result) => {
  console.info("Received tool call result:", result);
  setToolResult(result);
};
```

**Current State:** Minimal logging in your implementation.

**Recommendation:** Add development logging for easier debugging:

```typescript
const { app, toolResult, hostContext, error } = useApp<BackgammonStructuredContent>({
  appInfo: { name: 'Backgammon', version: '1.0.0' },
  capabilities: {},
  onAppCreated: (app) => {
    if (process.env.NODE_ENV === 'development') {
      app.ontoolinput = async (input) => {
        console.info('Received tool call input:', input);
      };
      app.onerror = (err) => {
        console.error('App error:', err);
      };
    }
  }
})
```

**Assessment:** **Nice-to-have** for development, not critical for production.

**File:** `src/client/McpAppShim.tsx`

---

## Conclusion

Your MCP server implementation demonstrates a **strong understanding of core MCP patterns**. After comparing against official examples (`basic-server-react`, `system-monitor-server`, `basic-server-vanillajs`), your code is architecturally sound and well-structured.

### Key Takeaways

**What you're doing well:**
- ✅ Correct Tool + Resource pattern implementation
- ✅ Proper React hooks usage with `useApp`
- ✅ Clean separation of concerns (server, client, store)
- ✅ Good error handling patterns
- ✅ Proper build configuration

**Where examples differ (and you should consider adopting):**
- ⚠️ **Tool visibility controls** - Examples use `["app"]` visibility for UI-only tools
- ⚠️ **Safe area handling** - Examples explicitly handle device insets for mobile
- ⚠️ **Output schemas** - Examples define output types for better validation
- 💡 **Development patterns** - Examples include more logging and debugging support

**Style differences (optional to adopt):**
- Resource registration signature variations
- `onAppCreated` callback pattern (useful for custom lifecycle)
- Vite configuration patterns (dynamic inputs, conditional sourcemaps)

### Bottom Line

**Your server works correctly as-is.** The recommendations focus on:
- **Idiomaticity** - Using patterns consistent with official examples
- **Robustness** - Handling edge cases seen in production examples (mobile support)
- **Developer Experience** - Debugging and development workflow improvements
- **Type Safety** - Runtime validation through output schemas

The **most impactful changes** would be:
1. Adding tool visibility controls (prevents model confusion)
2. Safe area handling (ensures mobile compatibility)
3. Output schemas (better validation and documentation)

These changes directly affect user experience and match patterns seen consistently across all official advanced examples.

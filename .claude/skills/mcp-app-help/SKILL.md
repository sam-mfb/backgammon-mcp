me: MCP App Help
description: This skill should be used when the user asks to questions about "the mcp app" or "mcp-app", or the "mcp app standard", or needs guidance on MCP Apps SDK patterns, UI-resource registration, MCP App lifecycle, or host integration. Provides comprehensive guidance for building MCP Apps with interactive UIs.

---

# MCP App Help

Build interactive UIs that run inside MCP-enabled hosts like Claude Desktop. An MCP App combines an MCP tool with an HTML resource to display rich, interactive content.

## Core Concept: Tool + Resource

Every MCP App requires two parts linked together:

1. **Tool** - Called by the LLM/host, returns data
2. **Resource** - Serves the bundled HTML UI that displays the data
3. **Link** - The tool's `_meta.ui.resourceUri` references the resource

```
Host calls tool → Server returns result → Host renders resource UI → UI receives result
```

## Getting Reference Code

Clone the SDK repository for working examples and API documentation:

```bash


git clone --branch "v$(npm view @modelcontextprotocol/ext-apps version)" --depth 1 https://github.com/modelcontextprotocol/ext-apps.git /tmp/mcp-ext-apps
```

### Framework Templates

Learn and adapt from `/tmp/mcp-ext-apps/examples/basic-server-react/`:

| Template              | Key Files                                           |
| --------------------- | --------------------------------------------------- |
| `basic-server-react/` | `server.ts`, `src/mcp-app.tsx` (uses `useApp` hook) |

We are using React so don't use the obther basic-server-{template} templates

Template includes:

- Complete `server.ts` with `registerAppTool` and `registerAppResource`
- Client-side app with all lifecycle handlers
- `vite.config.ts` with `vite-plugin-singlefile`
- `package.json` with all required dependencies
- `.gitignore` excluding `node_modules/` and `dist/`

### API Reference (Source Files)

Read JSDoc documentation directly from `/tmp/mcp-ext-apps/src/`:

| File                         | Contents                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/app.ts`                 | `App` class, handlers (`ontoolinput`, `ontoolresult`, `onhostcontextchanged`, `onteardown`), lifecycle |
| `src/server/index.ts`        | `registerAppTool`, `registerAppResource`, tool visibility options                                      |
| `src/spec.types.ts`          | All type definitions: `McpUiHostContext`, CSS variable keys, display modes                             |
| `src/styles.ts`              | `applyDocumentTheme`, `applyHostStyleVariables`, `applyHostFonts`                                      |
| `src/react/useApp.tsx`       | `useApp` hook for React apps                                                                           |
| `src/react/useHostStyles.ts` | `useHostStyles`, `useHostStyleVariables`, `useHostFonts` hooks                                         |

### Advanced Examples

Use these to investigate idomatic usage, best practices, and advanced usage of the sdk

| Example                           | Pattern Demonstrated                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `examples/shadertoy-server/`      | **Streaming partial input** + visibility-based pause/play (best practice for large inputs)  |
| `examples/wiki-explorer-server/`  | `callServerTool` for interactive data fetching                                              |
| `examples/system-monitor-server/` | Polling pattern with interval management                                                    |
| `examples/video-resource-server/` | Binary/blob resources                                                                       |
| `examples/sheet-music-server/`    | `ontoolinput` - processing tool args before execution completes                             |
| `examples/threejs-server/`        | `ontoolinputpartial` - streaming/progressive rendering                                      |
| `examples/map-server/`            | `updateModelContext` - keeping model informed of UI state                                   |
| `examples/transcript-server/`     | `updateModelContext` + `sendMessage` - background context updates + user-initiated messages |
| `examples/basic-host/`            | Reference host implementation using `AppBridge`                                             |

Note: The SDK examples use `bun` but generated projects should use `tsx` for broader compatibility.

### Handler Registration Order

Register ALL handlers BEFORE calling `app.connect()`:

```typescript
const app = new App({ name: 'My App', version: '1.0.0' })

// Register handlers first
app.ontoolinput = params => {
  ;/_ handle input _/
}
app.ontoolresult = result => {
  ;/_ handle result _/
}
app.onhostcontextchanged = ctx => {
  ;/_ handle context _/
}
app.onteardown = async () => {
  return {}
}

// Then connect
await app.connect()
```

### Tool Visibility

Control who can access tools via `_meta.ui.visibility`:

```typescript


// Default: visible to both model and app
\_meta: { ui: { resourceUri, visibility: ["model", "app"] } }

// UI-only (hidden from model) - for refresh buttons, form submissions
\_meta: { ui: { resourceUri, visibility: ["app"] } }

// Model-only (app cannot call)
\_meta: { ui: { resourceUri, visibility: ["model"] } }


```

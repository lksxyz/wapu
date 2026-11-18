<script lang="ts">
  import favicon from "#lib/assets/favicon.svg";
  import type { LayoutProps } from "./$types";
  import Sidebar from "#lib/components/app/Sidebar.svelte";
  import { setShell } from "#lib/shell.svelte";

  let { data, children }: LayoutProps = $props();

  // Desktop collapses the rail; mobile slides it over the graph.
  let collapsed = $state(false);
  let mobileOpen = $state(false);

  setShell({
    toggleSidebar: () => {
      if (window.matchMedia("(max-width: 900px)").matches) {
        mobileOpen = !mobileOpen;
      } else {
        collapsed = !collapsed;
      }
    },
    closeSidebar: () => {
      mobileOpen = false;
    },
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{#if data.user}
  <div class="app" class:collapsed class:mobile-open={mobileOpen}>
    <div class="sidebar-slot">
      <Sidebar
        projects={data.projects}
        user={data.user}
        onclose={() => (mobileOpen = false)}
      />
    </div>
    <main class="main">{@render children()}</main>
  </div>

  {#if mobileOpen}
    <button
      type="button"
      class="backdrop"
      aria-label="Close sidebar"
      onclick={() => (mobileOpen = false)}
    ></button>
  {/if}
{:else}
  {@render children()}
{/if}

<style>
  :global(:root) {
    --fg: #0d0d0d;
    --muted: #6e6e6e;
    --border: #e6e6e6;
    --border-strong: #d6d6d6;
    --surface: #ffffff;
    --surface-2: #f7f7f8;
    --surface-3: #f0f0f0;
    --sidebar: #f9f9f9;
    --danger: #d92d20;
    --success: #16794a;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    color-scheme: light;
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
  :global(html, body) {
    height: 100%;
  }
  :global(body) {
    margin: 0;
    font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
    background: var(--surface);
    color: var(--fg);
    -webkit-font-smoothing: antialiased;
    overscroll-behavior: none;
  }
  :global(a) {
    color: inherit;
    text-decoration: none;
  }
  :global(button) {
    cursor: pointer;
    font: inherit;
  }
  :global(input, textarea) {
    font: inherit;
  }
  :global(:focus-visible) {
    outline: 2px solid #8ab4f8;
    outline-offset: 1px;
  }
  :global(::selection) {
    background: #d7e6ff;
  }

  /* Melt renders floating surfaces through the popover API. */
  :global([popover]) {
    inset: auto;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    overflow: visible;
  }

  :global(::-webkit-scrollbar) {
    width: 10px;
    height: 10px;
  }
  :global(::-webkit-scrollbar-thumb) {
    border: 3px solid transparent;
    border-radius: 10px;
    background: #dcdcdc;
    background-clip: content-box;
  }
  :global(::-webkit-scrollbar-thumb:hover) {
    background: #c4c4c4;
    background-clip: content-box;
  }

  :global(.menu-item) {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--fg);
    font-size: 13px;
    text-align: left;
  }
  :global(.menu-item:hover) {
    background: var(--surface-2);
  }
  :global(.menu-item.danger) {
    color: var(--danger);
  }
  :global(.menu-item.danger:hover) {
    background: #fef2f2;
  }
  :global(.menu-sep) {
    height: 1px;
    margin: 4px 2px;
    background: var(--border);
  }

  .app {
    display: flex;
    height: 100dvh;
    overflow: hidden;
  }
  .sidebar-slot {
    display: flex;
    flex-shrink: 0;
    height: 100%;
  }
  .app.collapsed .sidebar-slot {
    display: none;
  }
  .main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }
  .backdrop {
    display: none;
  }

  @media (max-width: 900px) {
    .app .sidebar-slot {
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 60;
      transform: translateX(-100%);
      transition: transform 0.18s ease;
      box-shadow: 0 0 40px rgb(0 0 0 / 0.12);
    }
    .app.mobile-open .sidebar-slot {
      transform: none;
    }
    .app.collapsed .sidebar-slot {
      display: flex;
    }
    .backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 55;
      padding: 0;
      border: none;
      background: rgb(0 0 0 / 0.25);
      cursor: default;
    }
  }
</style>

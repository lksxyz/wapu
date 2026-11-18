<script lang="ts">
  import { Popover } from "melt/builders";
  import type { Snippet } from "svelte";

  let {
    trigger,
    children,
    label,
    placement = "bottom-end",
    class: cls = "",
  }: {
    trigger: Snippet;
    children: Snippet<[{ close: () => void }]>;
    label: string;
    placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
    class?: string;
  } = $props();

  const popover = new Popover({
    floatingConfig: () => ({
      computePosition: { placement },
      offset: 6,
    }),
  });
</script>

<button
  type="button"
  class="menu-trigger {cls}"
  aria-label={label}
  {...popover.trigger}
>
  {@render trigger()}
</button>

{#if popover.open}
  <div class="menu" role="menu" {...popover.content}>
    {@render children({ close: () => (popover.open = false) })}
  </div>
{/if}

<style>
  .menu-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    border-radius: 8px;
  }
  .menu {
    z-index: 200;
    min-width: 190px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.12);
  }
</style>

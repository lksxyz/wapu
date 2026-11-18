<script lang="ts">
  import { Tooltip } from "melt/builders";
  import type { Snippet } from "svelte";

  let {
    label,
    children,
    side = "bottom",
  }: {
    label: string;
    children: Snippet;
    side?: "top" | "bottom" | "left" | "right";
  } = $props();

  const tooltip = new Tooltip({
    openDelay: 350,
    floatingConfig: () => ({ computePosition: { placement: side } }),
  });
</script>

<span class="tip-trigger" {...tooltip.trigger}>{@render children()}</span>
{#if tooltip.open}
  <div class="tip" {...tooltip.content}>{label}</div>
{/if}

<style>
  .tip-trigger {
    display: inline-flex;
  }
  .tip {
    z-index: 200;
    max-width: 240px;
    padding: 5px 8px;
    border-radius: 6px;
    background: var(--fg);
    color: var(--surface);
    font-size: 12px;
    line-height: 1.4;
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.14);
    pointer-events: none;
  }
</style>

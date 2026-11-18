<script lang="ts">
  import Icon from "#lib/components/ui/Icon.svelte";
  import type { IconName } from "#lib/components/ui/Icon.svelte";

  const suggestions: { icon: IconName; title: string; prompt: string }[] = [
    {
      icon: "monitor",
      title: "Landing page",
      prompt:
        "Build a dark SaaS landing page with a hero, a three-feature grid, and a pricing CTA.",
    },
    {
      icon: "layout",
      title: "Portfolio",
      prompt:
        "Build a personal portfolio with an intro, a project grid with hover previews, and a contact section.",
    },
    {
      icon: "chart",
      title: "Dashboard",
      prompt:
        "Build an analytics dashboard with a sidebar, stat cards, and a clean chart placeholder.",
    },
    {
      icon: "tag",
      title: "Pricing page",
      prompt:
        "Build a pricing page with three tiers, a monthly/yearly toggle, and a comparison note.",
    },
  ];

  let { onpick }: { onpick: (prompt: string) => void } = $props();
</script>

<div class="grid">
  {#each suggestions as suggestion (suggestion.title)}
    <button
      type="button"
      class="card"
      onclick={() => onpick(suggestion.prompt)}
    >
      <span class="icon"><Icon name={suggestion.icon} size={16} /></span>
      <span class="text">
        <span class="title">{suggestion.title}</span>
        <span class="hint">{suggestion.prompt}</span>
      </span>
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
  }
  .card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--fg);
    text-align: left;
    transition: background 0.12s, border-color 0.12s;
  }
  .card:hover {
    background: var(--surface-2);
    border-color: var(--border-strong);
  }
  .icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 8px;
    background: var(--surface-3);
    color: var(--muted);
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .title {
    font-size: 13px;
    font-weight: 600;
  }
  .hint {
    display: -webkit-box;
    overflow: hidden;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  @media (max-width: 560px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>

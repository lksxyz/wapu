<script lang="ts">
  import Icon from "#lib/components/ui/Icon.svelte";
  import type { ChatTrace } from "#lib/chat-trace";

  let {
    trace,
    live = false,
  }: { trace: ChatTrace; live?: boolean } = $props();

  let manual = $state<boolean | null>(null);
  const expanded = $derived(manual ?? live);
  let now = $state(Date.now());

  $effect(() => {
    if (!live) return;
    const timer = setInterval(() => (now = Date.now()), 200);
    return () => clearInterval(timer);
  });

  const elapsed = $derived(
    trace.startedAt
      ? Math.max(0, (trace.endedAt ?? now) - trace.startedAt)
      : 0,
  );
  const active = $derived(trace.steps.find((step) => step.state === "active"));
  const failed = $derived(trace.steps.some((step) => step.state === "error"));
  const title = $derived(
    live
      ? (active?.label ?? "Working")
      : failed
        ? "Failed"
        : trace.startedAt
          ? `Worked for ${formatDuration(elapsed)}`
          : "Completed",
  );

  function formatDuration(ms: number): string {
    if (ms < 1000) return "<1s";
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  }
</script>

<section class="process" class:live>
  <button
    type="button"
    class="head"
    aria-expanded={expanded}
    onclick={() => (manual = !expanded)}
  >
    <span class="mark">
      {#if live}
        <span class="pulse"></span>
      {:else}
        <Icon name="check" size={13} />
      {/if}
    </span>

    <span class="title" class:working={live}>
      {title}{#if live}<span class="ellipsis">…</span>{/if}
    </span>

    {#if (trace.chars ?? 0) > 0}
      <span class="meta">{(trace.chars ?? 0).toLocaleString()} chars</span>
    {/if}
    <span class="chevron" class:open={expanded}>
      <Icon name="chevron-right" size={14} />
    </span>
  </button>

  {#if expanded}
    <ol class="steps">
      {#each trace.steps as step (step.stage)}
        <li class={step.state}>
          <span class="step-icon">
            {#if step.state === "active"}
              <span class="spinner"></span>
            {:else if step.state === "error"}
              <Icon name="close" size={12} />
            {:else}
              <Icon name="check" size={12} />
            {/if}
          </span>
          <span class="step-label">{step.label}</span>
          {#if step.endedAt && step.startedAt && step.endedAt - step.startedAt >= 1000}
            <span class="time">{formatDuration(step.endedAt - step.startedAt)}</span>
          {/if}
        </li>
      {/each}
    </ol>

    {#if trace.reasoning}
      <div class="reasoning">
        <span class="reasoning-label">Reasoning</span>
        <p>{trace.reasoning}</p>
      </div>
    {/if}
  {/if}
</section>

<style>
  .process {
    margin: 0 0 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: var(--muted);
    text-align: left;
    font-size: 12.5px;
  }
  .head:hover {
    color: var(--fg);
  }

  .mark {
    display: grid;
    place-items: center;
    width: 17px;
    height: 17px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--surface-3);
    color: var(--muted);
  }
  .pulse {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--muted);
    animation: pulse 1.1s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.35;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .title {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 500;
    color: var(--muted);
  }
  .title.working {
    color: var(--fg);
  }
  .ellipsis {
    display: inline-block;
    margin-left: 1px;
    animation: blink 1.2s steps(2, start) infinite;
  }
  @keyframes blink {
    to {
      visibility: hidden;
    }
  }

  .meta {
    flex-shrink: 0;
    margin-left: auto;
    color: var(--muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .chevron {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    color: var(--muted);
    transition: transform 0.15s;
  }
  .chevron.open {
    transform: rotate(90deg);
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin: 0;
    padding: 2px 10px 11px 14px;
    list-style: none;
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 12.5px;
    line-height: 1.4;
  }
  .steps li.active {
    color: var(--fg);
  }
  .steps li.error {
    color: var(--danger);
  }

  .step-icon {
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: inherit;
  }
  .spinner {
    width: 12px;
    height: 12px;
    border: 1.5px solid var(--border-strong);
    border-top-color: var(--muted);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .step-label {
    flex: 1;
    min-width: 0;
  }
  .time {
    flex-shrink: 0;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .reasoning {
    margin: 0 10px 11px;
    padding: 9px 11px;
    border-left: 2px solid var(--border-strong);
    color: var(--muted);
  }
  .reasoning-label {
    display: block;
    margin-bottom: 4px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .reasoning p {
    margin: 0;
    max-height: 220px;
    overflow-y: auto;
    white-space: pre-wrap;
    font-size: 12.5px;
    line-height: 1.55;
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse,
    .ellipsis,
    .spinner {
      animation: none;
    }
  }
</style>

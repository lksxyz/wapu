<script lang="ts">
  import { formatProse } from "#lib/format";
  import type { ChatTrace, TraceStep } from "#lib/chat-trace";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Process from "#lib/components/chat/Process.svelte";

  let {
    role,
    content,
    streaming = false,
    trace = undefined,
    steps = undefined,
    saved = false,
    failed = false,
  }: {
    role: "user" | "assistant";
    content: string;
    streaming?: boolean;
    trace?: ChatTrace;
    steps?: TraceStep[];
    saved?: boolean;
    failed?: boolean;
  } = $props();

  const effectiveTrace = $derived(
    trace ?? (steps && steps.length > 0 ? { steps, failed } : undefined),
  );

  let copied = $state(false);
  let copyToken = 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      copied = true;
      const token = ++copyToken;
      setTimeout(() => {
        if (copyToken === token) copied = false;
      }, 1600);
    } catch {
      // Clipboard permission denied — nothing useful to show.
    }
  }
</script>

{#if role === "user"}
  <div class="turn user">
    <div class="bubble">{content}</div>
  </div>
{:else}
  <div class="turn assistant">
    <span class="mark" aria-hidden="true">w</span>
    <div class="content">
      {#if effectiveTrace}
        <Process trace={effectiveTrace} live={streaming} />
      {/if}

      {#if content}
        <div class="prose">{@html formatProse(content, saved)}{#if streaming}<span class="caret"></span>{/if}</div>
      {:else if !effectiveTrace}
        <div class="thinking" aria-live="polite">
          <span class="shimmer"></span>
          <span class="shimmer short"></span>
        </div>
      {/if}

      {#if !streaming && content}
        <div class="actions">
          <button
            type="button"
            class="action"
            aria-label={copied ? "Copied" : "Copy response"}
            onclick={copy}
          >
            <Icon name={copied ? "check" : "copy"} size={14} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .turn {
    display: flex;
    gap: 12px;
    width: 100%;
  }
  .turn.user {
    justify-content: flex-end;
  }

  .bubble {
    max-width: min(85%, 38rem);
    padding: 10px 16px;
    border-radius: 18px;
    background: var(--surface-3);
    color: var(--fg);
    font-size: 15px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .mark {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    margin-top: 1px;
    flex-shrink: 0;
    border-radius: 8px;
    background: var(--fg);
    color: var(--surface);
    font-size: 13px;
    font-weight: 700;
  }

  .content {
    min-width: 0;
    flex: 1;
    padding-top: 1px;
  }

  .prose {
    font-size: 15px;
    line-height: 1.72;
    color: var(--fg);
    overflow-wrap: anywhere;
  }
  .prose :global(p) {
    margin: 0 0 12px;
  }
  .prose :global(p:last-child) {
    margin-bottom: 0;
  }
  .prose :global(ul) {
    margin: 0 0 12px;
    padding-left: 20px;
  }
  .prose :global(ol) {
    margin: 0 0 12px;
    padding-left: 20px;
  }
  .prose :global(li) {
    margin: 3px 0;
  }
  .prose :global(strong) {
    font-weight: 600;
  }
  .prose :global(code) {
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--surface-3);
    font-family: var(--mono);
    font-size: 0.88em;
  }
  .prose :global(.code) {
    margin: 0 0 12px;
    padding: 12px 14px;
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-2);
  }
  .prose :global(.code code) {
    padding: 0;
    background: none;
    font-size: 12.5px;
    line-height: 1.6;
  }
  .prose :global(.artifact) {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 4px 0 12px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-2);
  }
  .prose :global(.artifact-mark) {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #eefbf2;
    color: #16794a;
    font-size: 13px;
    font-weight: 700;
  }
  .prose :global(.artifact-copy) {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .prose :global(.artifact-title) {
    font-size: 13px;
    font-weight: 600;
  }
  .prose :global(.artifact-note) {
    color: var(--muted);
    font-size: 12px;
  }

  .caret {
    display: inline-block;
    width: 7px;
    height: 15px;
    margin-left: 2px;
    vertical-align: -2px;
    background: var(--fg);
    animation: blink 1s steps(2, start) infinite;
  }
  @keyframes blink {
    to {
      visibility: hidden;
    }
  }

  .thinking {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 4px;
  }
  .shimmer {
    width: 62%;
    height: 11px;
    border-radius: 6px;
    background: linear-gradient(
      90deg,
      var(--surface-3) 25%,
      var(--surface-2) 50%,
      var(--surface-3) 75%
    );
    background-size: 200% 100%;
    animation: sweep 1.3s linear infinite;
  }
  .shimmer.short {
    width: 38%;
  }
  @keyframes sweep {
    to {
      background-position: -200% 0;
    }
  }

  .actions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
    opacity: 0;
    transition: opacity 0.12s;
  }
  .turn:hover .actions,
  .actions:focus-within {
    opacity: 1;
  }
  .action {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 7px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
  }
  .action:hover {
    background: var(--surface-3);
    color: var(--fg);
  }

  @media (hover: none) {
    .actions {
      opacity: 1;
    }
  }
</style>

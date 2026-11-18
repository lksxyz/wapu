<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { api } from "#lib/api";
  import { titleFromPrompt } from "#lib/format";
  import { getShell } from "#lib/shell.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Composer from "#lib/components/chat/Composer.svelte";
  import PromptSuggestions from "#lib/components/chat/PromptSuggestions.svelte";

  const shell = getShell();

  let value = $state("");
  let creating = $state(false);
  let error = $state("");

  // A: submit → create conversation → hand the first prompt to the project
  // route, which sends it once the transcript mounts.
  // E: create fails → restore the draft, show the error beside the composer.
  async function start(text: string) {
    if (creating) return;
    creating = true;
    error = "";

    try {
      const project = await api.projects.create(titleFromPrompt(text));
      sessionStorage.setItem(`wapu:pending:${project.id}`, text);
      await invalidateAll();
      await goto(`/project/${project.id}`);
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not start a new chat";
      value = text;
      creating = false;
    }
  }
</script>

<div class="page">
  <header class="topbar">
    <button
      type="button"
      class="icon-btn"
      aria-label="Toggle sidebar"
      onclick={shell.toggleSidebar}
    >
      <Icon name="panel" size={19} />
    </button>
    <span class="model">wapu</span>
  </header>

  <div class="scroll">
    <div class="inner">
      <div class="hero">
        <span class="mark" aria-hidden="true">w</span>
        <h1>What do you want to build?</h1>
        <p>Describe a page. wapu writes the HTML, CSS, and JS — preview it live.</p>
      </div>

      <Composer
        bind:value
        variant="hero"
        onsend={start}
        disabled={creating}
        placeholder={creating ? "Opening a new chat…" : "Describe the page you want to build…"}
      />

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <div class="suggestions">
        <PromptSuggestions onpick={(prompt) => (value = prompt)} />
      </div>

      <p class="note">Press Enter to send · Shift+Enter for a new line</p>
    </div>
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 52px;
    flex-shrink: 0;
    padding: 0 10px;
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
  }
  .icon-btn:hover {
    background: var(--surface-3);
    color: var(--fg);
  }
  .model {
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
  }

  .scroll {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow-y: auto;
    padding: 16px 16px 40px;
  }
  .inner {
    width: 100%;
    max-width: 780px;
    margin: 0 auto;
  }

  .hero {
    margin-bottom: 28px;
    text-align: center;
  }
  .mark {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    margin: 0 auto 16px;
    border-radius: 12px;
    background: var(--fg);
    color: var(--surface);
    font-size: 21px;
    font-weight: 700;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .hero p {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .suggestions {
    margin-top: 14px;
  }
  .error {
    margin: 10px 4px 0;
    color: var(--danger);
    font-size: 13px;
  }
  .note {
    margin: 16px 0 0;
    color: var(--muted);
    font-size: 11.5px;
    text-align: center;
  }

  @media (max-width: 640px) {
    h1 {
      font-size: 23px;
    }
    .hero p {
      font-size: 13px;
    }
    .scroll {
      justify-content: flex-start;
    }
  }
</style>

<script lang="ts">
  import Icon from "#lib/components/ui/Icon.svelte";

  let {
    value = $bindable(""),
    onsend,
    onstop,
    placeholder = "Message wapu…",
    disabled = false,
    streaming = false,
    variant = "chat",
    autofocus = true,
  }: {
    value?: string;
    onsend: (text: string) => void;
    onstop?: () => void;
    placeholder?: string;
    disabled?: boolean;
    streaming?: boolean;
    variant?: "hero" | "chat";
    autofocus?: boolean;
  } = $props();

  let textarea: HTMLTextAreaElement | undefined = $state();
  let composing = $state(false);

  const canSend = $derived(value.trim().length > 0 && !disabled && !streaming);

  $effect(() => {
    if (!textarea) return;
    value;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  });

  $effect(() => {
    if (autofocus) textarea?.focus();
  });

  function submit() {
    if (!canSend) return;
    const text = value.trim();
    value = "";
    onsend(text);
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey && !composing) {
      event.preventDefault();
      submit();
    }
  }
</script>

<form
  class="composer {variant}"
  onsubmit={(event) => {
    event.preventDefault();
    submit();
  }}
>
  <textarea
    bind:this={textarea}
    bind:value
    rows={1}
    {placeholder}
    disabled={disabled}
    aria-label={placeholder}
    onkeydown={keydown}
    oncompositionstart={() => (composing = true)}
    oncompositionend={() => (composing = false)}
  ></textarea>

  {#if streaming}
    <button
      type="button"
      class="send stop"
      aria-label="Stop generating"
      onclick={onstop}
    >
      <Icon name="stop" size={13} />
    </button>
  {:else}
    <button type="submit" class="send" disabled={!canSend} aria-label="Send message">
      <Icon name="arrow-up" size={18} stroke={2} />
    </button>
  {/if}
</form>

<style>
  .composer {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 8px 8px 16px;
    border: 1px solid var(--border-strong);
    border-radius: 26px;
    background: var(--surface);
    box-shadow: 0 2px 10px rgb(0 0 0 / 0.04);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .composer:focus-within {
    border-color: #bdbdbd;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.06);
  }
  .composer.hero {
    padding: 10px 10px 10px 18px;
  }

  textarea {
    flex: 1;
    min-width: 0;
    max-height: 200px;
    padding: 9px 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--fg);
    font-size: 15px;
    line-height: 1.5;
    resize: none;
    overflow-y: auto;
  }
  textarea::placeholder {
    color: var(--muted);
  }
  textarea:disabled {
    opacity: 0.6;
  }

  .send {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border: none;
    border-radius: 50%;
    background: var(--fg);
    color: var(--surface);
    transition: opacity 0.15s, background 0.15s;
  }
  .send:disabled {
    opacity: 0.2;
    cursor: default;
  }
  .send:not(:disabled):hover {
    opacity: 0.85;
  }
  .send.stop {
    background: var(--fg);
  }
  .send.stop:hover {
    opacity: 1;
    background: #303030;
  }

  @media (max-width: 640px) {
    textarea {
      font-size: 16px;
    }
  }
</style>

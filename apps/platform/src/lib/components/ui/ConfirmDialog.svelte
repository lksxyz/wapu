<script lang="ts">
  import { Dialog } from "melt/builders";

  let {
    title,
    description,
    confirmLabel = "Delete",
    onconfirm,
    oncancel,
  }: {
    title: string;
    description: string;
    confirmLabel?: string;
    onconfirm: () => Promise<boolean> | boolean;
    oncancel: () => void;
  } = $props();

  const dialog = new Dialog({
    onOpenChange: (open) => {
      if (!open) oncancel();
    },
  });

  let busy = $state(false);
  let error = $state("");

  // Mounted only when the person asked for it — open on mount, close on release.
  $effect(() => {
    dialog.open = true;
  });

  async function confirm() {
    busy = true;
    error = "";
    try {
      if (await onconfirm()) dialog.open = false;
    } catch (e) {
      error = e instanceof Error ? e.message : "Something went wrong";
    } finally {
      busy = false;
    }
  }
</script>

<dialog class="dialog" {...dialog.content} aria-labelledby="confirm-title">
  <h2 id="confirm-title">{title}</h2>
  <p>{description}</p>
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
  <div class="actions">
    <button
      type="button"
      class="btn-ghost"
      disabled={busy}
      onclick={() => (dialog.open = false)}
    >
      Cancel
    </button>
    <button type="button" class="btn-danger" disabled={busy} onclick={confirm}>
      {busy ? "Working…" : confirmLabel}
    </button>
  </div>
</dialog>

<style>
  .dialog {
    width: min(420px, calc(100vw - 32px));
    padding: 22px;
    border: none;
    border-radius: 16px;
    background: var(--surface);
    color: var(--fg);
    box-shadow: 0 24px 64px rgb(0 0 0 / 0.2);
  }
  .dialog::backdrop {
    background: rgb(0 0 0 / 0.32);
  }
  h2 {
    margin: 0 0 8px;
    font-size: 17px;
    font-weight: 600;
  }
  p {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.55;
  }
  .error {
    margin-top: 10px;
    color: var(--danger);
    font-size: 13px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 22px;
  }
  .btn-ghost,
  .btn-danger {
    padding: 8px 14px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
  }
  .btn-ghost {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
  }
  .btn-ghost:hover:not(:disabled) {
    background: var(--surface-2);
  }
  .btn-danger {
    border: 1px solid transparent;
    background: var(--danger);
    color: #fff;
  }
  .btn-danger:hover:not(:disabled) {
    filter: brightness(0.92);
  }
  .btn-ghost:disabled,
  .btn-danger:disabled {
    opacity: 0.5;
  }
</style>

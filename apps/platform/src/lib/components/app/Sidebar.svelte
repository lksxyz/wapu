<script lang="ts">
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { authClient } from "#lib/auth-client";
  import { api } from "#lib/api";
  import type { Project } from "#lib/api";
  import { groupProjects } from "#lib/time";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Menu from "#lib/components/ui/Menu.svelte";
  import Tooltip from "#lib/components/ui/Tooltip.svelte";
  import ConfirmDialog from "#lib/components/ui/ConfirmDialog.svelte";

  let {
    projects,
    user,
    onclose,
  }: {
    projects: Project[];
    user: { name: string; email: string; image?: string | null };
    onclose: () => void;
  } = $props();

  let query = $state("");
  let pendingDelete = $state<Project | null>(null);
  let deleteError = $state("");

  const filtered = $derived(
    query.trim()
      ? projects.filter((project) =>
          project.name.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : projects,
  );
  const groups = $derived(groupProjects(filtered));

  async function confirmDelete() {
    const project = pendingDelete;
    if (!project) return false;
    deleteError = "";
    try {
      await api.projects.delete(project.id);
      const removedActive = page.params.id === project.id;
      pendingDelete = null;
      if (removedActive) await goto("/");
      await invalidateAll();
      return true;
    } catch (e) {
      deleteError = e instanceof Error ? e.message : "Failed to delete project";
      return false;
    }
  }

  async function signOut() {
    await authClient.signOut();
    await goto("/login");
  }
</script>

<aside class="sidebar" aria-label="Chat history">
  <div class="head">
    <a class="brand" href="/" onclick={onclose}>
      <span class="brand-mark">w</span>
      <span class="brand-name">wapu</span>
    </a>
    <Tooltip label="New chat" side="bottom">
      <a class="icon-btn" href="/" aria-label="New chat" onclick={onclose}>
        <Icon name="plus" size={19} />
      </a>
    </Tooltip>
  </div>

  {#if projects.length > 0}
    <div class="search">
      <Icon name="search" size={15} />
      <input
        bind:value={query}
        placeholder="Search projects"
        aria-label="Search projects"
      />
    </div>
  {/if}

  <nav class="history">
    {#each groups as group (group.label)}
      <p class="group-label">{group.label}</p>
      {#each group.items as project (project.id)}
        <div class="item" class:active={page.params.id === project.id}>
          <a class="item-link" href="/project/{project.id}" onclick={onclose}>
            {project.name}
          </a>
          <Menu label="Project options" placement="bottom-end" class="item-menu">
            {#snippet trigger()}
              <Icon name="dots" size={16} />
            {/snippet}
            {#snippet children({ close })}
              <button
                type="button"
                class="menu-item danger"
                role="menuitem"
                onclick={() => {
                  close();
                  pendingDelete = project;
                }}
              >
                <Icon name="trash" size={15} />
                Delete
              </button>
            {/snippet}
          </Menu>
        </div>
      {/each}
    {/each}

    {#if projects.length === 0}
      <p class="note">No projects yet. Start a new chat.</p>
    {:else if filtered.length === 0}
      <p class="note">No projects match “{query.trim()}”.</p>
    {/if}
  </nav>

  {#if deleteError}
    <p class="error" role="alert">{deleteError}</p>
  {/if}

  <div class="foot">
    <Menu label="Account menu" placement="top-end" class="user-menu">
      {#snippet trigger()}
        {#if user.image}
          <img class="avatar" src={user.image} alt="" referrerpolicy="no-referrer" />
        {:else}
          <span class="avatar fallback">{user.name.slice(0, 1).toUpperCase()}</span>
        {/if}
        <span class="user-meta">
          <span class="user-name">{user.name}</span>
          <span class="user-mail">{user.email}</span>
        </span>
        <Icon name="chevron-down" size={15} />
      {/snippet}
      {#snippet children({ close })}
        <div class="menu-head">
          <span class="user-name">{user.name}</span>
          <span class="user-mail">{user.email}</span>
        </div>
        <div class="menu-sep"></div>
        <button
          type="button"
          class="menu-item"
          role="menuitem"
          onclick={() => {
            close();
            signOut();
          }}
        >
          <Icon name="logout" size={15} />
          Sign out
        </button>
      {/snippet}
    </Menu>
  </div>
</aside>

{#if pendingDelete}
  <ConfirmDialog
    title="Delete project?"
    description={`“${pendingDelete.name}” and its chat history will be removed. This cannot be undone.`}
    onconfirm={confirmDelete}
    oncancel={() => (pendingDelete = null)}
  />
{/if}

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    width: 264px;
    flex-shrink: 0;
    height: 100%;
    padding: 8px;
    background: var(--sidebar);
    border-right: 1px solid var(--border);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px 10px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 8px;
    min-width: 0;
  }
  .brand:hover {
    background: var(--surface-3);
  }
  .brand-mark {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    background: var(--fg);
    color: var(--surface);
    font-size: 13px;
    font-weight: 700;
  }
  .brand-name {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    margin-left: auto;
    border-radius: 8px;
    color: var(--muted);
  }
  .icon-btn:hover {
    background: var(--surface-3);
    color: var(--fg);
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 4px 10px;
    padding: 0 9px;
    height: 34px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: var(--surface-3);
    color: var(--muted);
  }
  .search:focus-within {
    border-color: var(--border-strong);
    background: var(--surface);
  }
  .search input {
    width: 100%;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--fg);
    font-size: 13px;
  }
  .search input::placeholder {
    color: var(--muted);
  }

  .history {
    flex: 1;
    overflow-y: auto;
    padding: 0 2px;
  }
  .group-label {
    margin: 12px 8px 4px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .item {
    display: flex;
    align-items: center;
    border-radius: 8px;
  }
  .item:hover {
    background: var(--surface-3);
  }
  .item.active {
    background: var(--surface-3);
  }
  .item-link {
    flex: 1;
    min-width: 0;
    padding: 8px 9px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 13.5px;
    color: var(--fg);
  }
  .item :global(.item-menu) {
    width: 26px;
    height: 26px;
    margin-right: 4px;
    color: var(--muted);
    opacity: 0;
    flex-shrink: 0;
  }
  .item:hover :global(.item-menu),
  .item :global(.item-menu:focus-visible),
  .item :global(.item-menu[data-open]) {
    opacity: 1;
  }
  .item :global(.item-menu:hover) {
    background: var(--surface);
    color: var(--fg);
  }

  .note {
    margin: 16px 8px;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.5;
  }
  .error {
    margin: 8px 8px 0;
    color: var(--danger);
    font-size: 12px;
    line-height: 1.45;
  }

  .foot {
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  .foot :global(.user-menu) {
    width: 100%;
    justify-content: flex-start;
    gap: 9px;
    padding: 7px 8px;
    color: var(--fg);
  }
  .foot :global(.user-menu:hover) {
    background: var(--surface-3);
  }

  .avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .avatar.fallback {
    display: grid;
    place-items: center;
    background: var(--surface-3);
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }
  .user-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    line-height: 1.25;
  }
  .user-name {
    max-width: 150px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 13px;
    font-weight: 500;
  }
  .user-mail {
    max-width: 150px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--muted);
    font-size: 11.5px;
  }

  .menu-head {
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    line-height: 1.35;
  }

  @media (hover: none) {
    .item :global(.item-menu) {
      opacity: 1;
    }
  }
</style>

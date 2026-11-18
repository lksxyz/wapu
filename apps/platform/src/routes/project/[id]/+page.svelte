<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import type { PageData } from "./$types";
  import { api } from "#lib/api";
  import type { Message as ChatMessage } from "#lib/api";
  import type { ChatTrace } from "#lib/chat-trace";
  import { getShell } from "#lib/shell.svelte";
  import Icon from "#lib/components/ui/Icon.svelte";
  import Tooltip from "#lib/components/ui/Tooltip.svelte";
  import Composer from "#lib/components/chat/Composer.svelte";
  import MessageView from "#lib/components/chat/Message.svelte";
  import PromptSuggestions from "#lib/components/chat/PromptSuggestions.svelte";

  let { data }: { data: PageData } = $props();

  const shell = getShell();
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

  interface FxLine {
    type: string;
    messageId?: string;
    sessionId?: string;
    input?: unknown;
    delta?: string;
    id?: string;
    name?: string;
    inputTruncated?: boolean;
    inputPreview?: string;
    stopReason?: string;
    isError?: boolean;
    error?: { message?: string };
    cursor?: number;
  }

  type Turn = ChatMessage & { trace?: ChatTrace };

  let project = $state(untrack(() => data.project));
  let messages = $state<Turn[]>(untrack(() => data.project.messages) ?? []);
  let input = $state("");

  let isStreaming = $state(false);
  let streamingContent = $state("");
  let streamError = $state("");
  let stoppedByUser = $state(false);
  let liveTrace = $state<ChatTrace | null>(null);

  let previewSrc = $state(untrack(() => data.project.previewUrl));
  let iframeLoading = $state(true);
  let showPreview = $state(
    untrack(() => (data.project.messages?.length ?? 0) > 0),
  );

  // Split panes: width is stored in px so the divider never drifts on resize.
  const CANVAS_WIDTH_KEY = "wapu:canvas-width";
  const MIN_CANVAS = 320;
  const MIN_CHAT = 380;
  let workspace: HTMLDivElement | undefined = $state();
  let canvasEl: HTMLElement | undefined = $state();
  let canvasWidth = $state(0);
  let dragging = $state(false);
  let dragStartX = 0;
  let dragStartWidth = 0;

  const splitPercent = $derived(
    canvasWidth && workspace
      ? Math.round((canvasWidth / workspace.clientWidth) * 100)
      : 46,
  );

  let deploying = $state(false);
  let actionError = $state("");

  let controller: AbortController | null = null;
  let scrollBox: HTMLDivElement | undefined = $state();
  let stick = true;

  const publicLink = $derived(project.deployUrl);

  // Same route, different project: reset the transcript instead of showing the
  // previous conversation under the new title.
  $effect(() => {
    const incoming = data.project;
    if (untrack(() => project.id) === incoming.id) return;

    controller?.abort();
    messages = incoming.messages ?? [];
    project = incoming;
    input = "";
    streamingContent = "";
    streamError = "";
    liveTrace = null;
    isStreaming = false;
    previewSrc = incoming.previewUrl;
    iframeLoading = true;
    showPreview = (incoming.messages?.length ?? 0) > 0;
  });

  function toolPath(value: unknown): string | undefined {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      !("path" in value)
    ) {
      return undefined;
    }
    return typeof value.path === "string" ? value.path : undefined;
  }

  function toolLabel(name: string, input: unknown): string {
    const path = toolPath(input);
    if (name === "write_file") return path ? `Writing ${path}` : "Writing file";
    if (name === "read_file") return path ? `Reading ${path}` : "Reading file";
    if (name === "list_files") return "Listing files";
    return name.replace(/_/g, " ");
  }

  async function consumeNdjson(
    stream: ReadableStream<Uint8Array>,
    onLine: (line: FxLine) => void,
    stopWhen?: () => boolean,
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const raw = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
          if (!raw) continue;

          let line: FxLine;
          try {
            line = JSON.parse(raw) as FxLine;
          } catch {
            continue;
          }
          onLine(line);
          if (stopWhen?.()) {
            await reader.cancel();
            return;
          }
        }
      }

      const tail = buffer.trim();
      if (tail) {
        try {
          onLine(JSON.parse(tail) as FxLine);
        } catch {
          // A truncated final line is replayed from the cursor next time.
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
  }

  // A: send → fx turn → NDJSON events → tool trace → preview refresh
  // E: stream drop → reconnect from cursor; model failure → banner.
  async function send(text: string, answers?: string[]) {
    const prompt = text.trim();
    if (!prompt || isStreaming) return;

    streamError = "";
    actionError = "";
    stoppedByUser = false;
    isStreaming = true;
    streamingContent = "";
    stick = true;

    const startedAt = Date.now();
    const projectId = project.id;
    liveTrace = {
      steps: [
        {
          stage: "request",
          label: "Sending message",
          state: "active",
          startedAt,
        },
      ],
      startedAt,
      chars: 0,
    };

    messages = [
      ...messages,
      {
        id: crypto.randomUUID(),
        projectId,
        role: "user",
        content: prompt,
        createdAt: new Date().toISOString(),
      },
    ];
    await tick();
    scrollBox?.scrollTo({ top: scrollBox.scrollHeight });

    const abort = new AbortController();
    controller = abort;

    let full = "";
    let sawTurnEnd = false;
    let wroteFiles = false;
    let cleanEnd = false;
    let failed = false;
    let lastCursor = 0;

    const onLine = (line: FxLine) => {
      if (project.id !== projectId) return;
      if (typeof line.cursor === "number") lastCursor = line.cursor;
      const now = Date.now();
      if (!liveTrace) {
        liveTrace = { steps: [], startedAt: now, chars: 0 };
      }

      if (line.type === "turn_start") {
        const request = liveTrace.steps.find(
          (step) => step.stage === "request" && step.state === "active",
        );
        if (request) {
          request.state = "done";
          request.endedAt = now;
        }
        return;
      }

      if (line.type === "reasoning_delta") {
        liveTrace.reasoning = (liveTrace.reasoning ?? "") + (line.delta ?? "");
        if (!liveTrace.steps.some((step) => step.stage === "reasoning")) {
          liveTrace.steps.push({
            stage: "reasoning",
            label: "Reasoning",
            state: "active",
            startedAt: now,
          });
        }
        return;
      }

      if (line.type === "text_delta") {
        full += line.delta ?? "";
        streamingContent = full;
        liveTrace.chars = full.length;
        const reasoning = liveTrace.steps.find((step) => step.stage === "reasoning");
        if (reasoning?.state === "active") {
          reasoning.state = "done";
          reasoning.endedAt = now;
        }
        if (!liveTrace.steps.some((step) => step.stage === "response")) {
          liveTrace.steps.push({
            stage: "response",
            label: "Writing response",
            state: "active",
            startedAt: now,
          });
        }
        return;
      }

      if (line.type === "tool_start") {
        liveTrace.steps.push({
          stage: `tool:${line.id ?? crypto.randomUUID()}`,
          label: toolLabel(line.name ?? "tool", line.input),
          state: "active",
          detail: toolPath(line.input)?.slice(0, 160),
          startedAt: now,
        });
        return;
      }

      if (line.type === "tool_end") {
        const step = liveTrace.steps.find(
          (candidate) => candidate.stage === `tool:${line.id}`,
        );
        if (step) {
          step.state = line.isError ? "error" : "done";
          step.endedAt = now;
        }
        if (line.name === "write_file" && !line.isError) wroteFiles = true;
        return;
      }

      if (line.type === "turn_end") {
        sawTurnEnd = true;
        cleanEnd = line.stopReason === "end_turn";
        if (line.stopReason === "error" || line.stopReason === "unknown") {
          failed = true;
          streamError = line.error?.message ?? "The turn ended with an error.";
        } else if (line.stopReason === "cancelled" && !stoppedByUser) {
          streamError =
            "The turn hit its time limit before it finished. Retry or ask for a smaller change.";
        }
      }
    };

    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, answers }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(
          res.status === 401
            ? "Your session expired. Sign in again."
            : `The server returned ${res.status}.`,
        );
      }

      await consumeNdjson(res.body, onLine);

      if (!sawTurnEnd && !abort.signal.aborted && !failed) {
        const resumed = await fetch(
          `${API_URL}/api/projects/${projectId}/stream?cursor=${lastCursor}`,
          { credentials: "include", signal: abort.signal },
        );
        if (!resumed.ok || !resumed.body) {
          throw new Error(`Reconnect failed (${resumed.status}).`);
        }
        await consumeNdjson(resumed.body, onLine, () => sawTurnEnd);
      }

      if (!sawTurnEnd && !abort.signal.aborted) {
        throw new Error("The connection ended before the turn finished.");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // Stopped by the person — keep what was already written.
      } else {
        failed = true;
        streamError = e instanceof Error ? e.message : "Something went wrong.";
      }
    }

    if (project.id !== projectId) {
      controller = null;
      return;
    }

    if (liveTrace) {
      const endedAt = Date.now();
      for (const step of liveTrace.steps) {
        if (step.state !== "active") continue;
        step.state = failed ? "error" : "done";
        step.endedAt = endedAt;
      }
      liveTrace.endedAt = endedAt;
    }

    if (full || (liveTrace?.steps.length ?? 0) > 0) {
      messages = [
        ...messages,
        {
          id: crypto.randomUUID(),
          projectId,
          role: "assistant",
          content: full,
          saved: wroteFiles || (cleanEnd && /<!DOCTYPE html/i.test(full)),
          createdAt: new Date().toISOString(),
          trace: liveTrace ?? undefined,
        },
      ];
    }

    if (wroteFiles || (/<!DOCTYPE html/i.test(full) && /<\/html>/i.test(full))) {
      showPreview = true;
      await refreshPreview();
    }

    // The turn may have moved the phase, adopted a design, or asked a
    // question. Pull all three back so the card comes from the server, not
    // from the stream.
    const fresh = await api.projects.get(projectId).catch(() => null);
    if (fresh && project.id === projectId) {
      project = {
        ...project,
        phase: fresh.phase,
        design: fresh.design,
        pendingQuestion: fresh.pendingQuestion,
      };
      // A different card (or none) is a new ask: the answered one stays hidden.
      if (fresh.pendingQuestion?.id !== askedQuestionId) {
        askedQuestionId = fresh.pendingQuestion?.id ?? null;
        answeredQuestion = null;
        questionIndex = 0;
        questionAnswers = [];
        otherAnswer = "";
      }
    }

    streamingContent = "";
    liveTrace = null;
    isStreaming = false;
    controller = null;
  }

  async function stop() {
    stoppedByUser = true;
    controller?.abort();
    await api.projects.stop(project.id).catch(() => {});
  }

  // The card is asked one question at a time, like a short form: the answers
  // are collected locally and sent as one message. The server clears its copy
  // at the start of the next turn, so a reload cannot show a stale card.
  let answeredQuestion = $state<string | null>(null);
  let askedQuestionId = $state<string | null>(null);
  let questionIndex = $state(0);
  let questionAnswers = $state<string[]>([]);
  let otherAnswer = $state("");

  const asked = $derived(project.pendingQuestion?.questions ?? []);
  const currentQuestion = $derived(asked[questionIndex] ?? null);

  function chooseAnswer(option: string) {
    if (!currentQuestion) return;
    const next = [...questionAnswers];
    next[questionIndex] = option;
    questionAnswers = next;
    otherAnswer = "";
    advance();
  }

  function submitOther() {
    const value = otherAnswer.trim();
    if (!value || !currentQuestion) return;
    const next = [...questionAnswers];
    next[questionIndex] = value;
    questionAnswers = next;
    otherAnswer = "";
    advance();
  }

  function advance() {
    if (questionIndex < asked.length - 1) {
      questionIndex += 1;
      return;
    }
    finishAnswers();
  }

  function skipQuestion() {
    if (!currentQuestion) return;
    if (questionIndex < asked.length - 1) {
      questionIndex += 1;
      return;
    }
    finishAnswers();
  }

  function finishAnswers() {
    const pending = project.pendingQuestion;
    if (!pending || isStreaming) return;
    answeredQuestion = pending.id;
    const lines = pending.questions.map((question, index) => {
      const answer = questionAnswers[index];
      return `${index + 1}. ${question.question}\nAnswer: ${answer ?? "(skipped)"}`;
    });
    const answers = pending.questions
      .map((_, index) => questionAnswers[index])
      .filter((answer): answer is string => Boolean(answer));
    questionIndex = 0;
    void send(lines.join("\n"), answers);
  }

  function onScroll() {
    if (!scrollBox) return;
    stick =
      scrollBox.scrollHeight - scrollBox.scrollTop - scrollBox.clientHeight < 80;
  }

  $effect(() => {
    messages.length;
    streamingContent;
    liveTrace?.chars;
    liveTrace?.steps.length;
    liveTrace?.steps[liveTrace.steps.length - 1]?.state;
    if (!stick) return;
    tick().then(() => scrollBox?.scrollTo({ top: scrollBox.scrollHeight }));
  });

  function startResize(event: PointerEvent) {
    if (!workspace || !canvasEl) return;
    dragging = true;
    dragStartX = event.clientX;
    dragStartWidth = canvasEl.getBoundingClientRect().width;
    canvasWidth = dragStartWidth;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function resize(event: PointerEvent) {
    if (!dragging || !workspace) return;
    const max = Math.max(MIN_CANVAS, workspace.clientWidth - MIN_CHAT);
    canvasWidth = Math.min(
      Math.max(dragStartWidth - (event.clientX - dragStartX), MIN_CANVAS),
      max,
    );
  }

  function endResize() {
    if (!dragging) return;
    dragging = false;
    localStorage.setItem(CANVAS_WIDTH_KEY, String(Math.round(canvasWidth)));
  }

  function keyResize(event: KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();

    const base =
      canvasWidth ||
      canvasEl?.getBoundingClientRect().width ||
      (workspace ? workspace.clientWidth * 0.46 : 480);
    const step = (event.shiftKey ? 64 : 16) * (event.key === "ArrowLeft" ? 1 : -1);
    const max = workspace
      ? Math.max(MIN_CANVAS, workspace.clientWidth - MIN_CHAT)
      : base;

    canvasWidth = Math.min(Math.max(base + step, MIN_CANVAS), max);
    localStorage.setItem(CANVAS_WIDTH_KEY, String(Math.round(canvasWidth)));
  }

  function resetWidth() {
    canvasWidth = 0;
    localStorage.removeItem(CANVAS_WIDTH_KEY);
  }

  // New-chat flow hands the first prompt over through sessionStorage so the
  // URL never carries the message.
  onMount(() => {
    const key = `wapu:pending:${project.id}`;
    const pending = sessionStorage.getItem(key);
    if (!pending) return;
    sessionStorage.removeItem(key);
    void send(pending);
  });

  onMount(() => {
    const stored = Number(localStorage.getItem(CANVAS_WIDTH_KEY));
    if (!Number.isFinite(stored) || stored <= 0) return;
    const max = workspace
      ? Math.max(MIN_CANVAS, workspace.clientWidth - MIN_CHAT)
      : stored;
    canvasWidth = Math.min(Math.max(stored, MIN_CANVAS), max);
  });

  onDestroy(() => controller?.abort());

  async function toggleDeploy() {
    deploying = true;
    actionError = "";
    const projectId = project.id;
    try {
      const result = await api.projects.deploy(projectId);
      if (project.id !== projectId) return;
      project = {
        ...project,
        isDeployed: result.isDeployed,
        deployVersion: result.deployVersion,
        deployUrl: result.url,
      };
    } catch (e) {
      if (project.id === projectId) {
        actionError = e instanceof Error ? e.message : "Deploy failed.";
      }
    } finally {
      if (project.id === projectId) deploying = false;
    }
  }

  function exportProject() {
    const link = document.createElement("a");
    link.href = `${API_URL}/api/projects/${project.id}/export`;
    link.click();
  }

  async function refreshPreview() {
    const projectId = project.id;
    try {
      const { url } = await api.projects.previewUrl(projectId);
      if (project.id !== projectId) return;
      previewSrc = url;
      iframeLoading = true;
    } catch {
      // Keep the current preview URL; the iframe may still have its cookie.
      if (project.id === projectId) iframeLoading = false;
    }
  }

  async function reloadPreview() {
    iframeLoading = true;
    await refreshPreview();
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

    <span class="title" title={project.name}>{project.name}</span>

    {#if actionError}
      <span class="action-error" role="alert">{actionError}</span>
    {/if}

    <div class="actions">
      {#if project.isDeployed && publicLink}
        <a class="live" href={publicLink} target="_blank" rel="noopener">
          <Icon name="globe" size={13} />
          <span>{project.slug}</span>
        </a>
      {/if}

      <Tooltip label={showPreview ? "Hide preview" : "Show preview"} side="bottom">
        <button
          type="button"
          class="btn ghost"
          class:on={showPreview}
          aria-pressed={showPreview}
          onclick={() => (showPreview = !showPreview)}
        >
          <Icon name={showPreview ? "eye-off" : "eye"} size={16} />
          <span class="btn-label">Preview</span>
        </button>
      </Tooltip>

      <Tooltip label="Export HTML" side="bottom">
        <button
          type="button"
          class="icon-btn bordered"
          aria-label="Export HTML"
          onclick={exportProject}
        >
          <Icon name="download" size={17} />
        </button>
      </Tooltip>

      <button
        type="button"
        class="btn primary"
        disabled={deploying || isStreaming}
        onclick={toggleDeploy}
      >
        {deploying
          ? "Deploying…"
          : project.isDeployed
            ? "Undeploy"
            : "Deploy"}
      </button>
    </div>
  </header>

  <div class="workspace" bind:this={workspace} class:resizing={dragging}>
    <section class="chat" aria-label="Conversation">
      <div class="messages" bind:this={scrollBox} onscroll={onScroll}>
        <div class="thread">
          {#if messages.length === 0 && !isStreaming}
            <div class="empty">
              <span class="mark-lg" aria-hidden="true">w</span>
              <h2>What should we build?</h2>
              <p>Describe a page and wapu will write it, then show it here.</p>
              <div class="empty-suggestions">
                <PromptSuggestions onpick={(prompt) => (input = prompt)} />
              </div>
            </div>
          {/if}

          {#each messages as message (message.id)}
            <MessageView
              role={message.role}
              content={message.content}
              trace={message.trace}
              steps={message.steps}
              saved={message.saved ?? false}
            />
          {/each}

          {#if project.pendingQuestion && currentQuestion && !isStreaming && !answeredQuestion}
            <div class="question-card" role="group" aria-label={currentQuestion.question}>
              <div class="question-head">
                <p>{currentQuestion.question}</p>
                <span class="question-count">{questionIndex + 1} of {asked.length}</span>
              </div>
              <div class="question-options">
                {#each currentQuestion.options as option, index (option)}
                  <button
                    type="button"
                    class:chosen={questionAnswers[questionIndex] === option}
                    onclick={() => chooseAnswer(option)}
                  >
                    <span class="question-index" aria-hidden="true">{index + 1}</span>
                    <span>{option}</span>
                  </button>
                {/each}
              </div>
              <form
                class="question-other"
                onsubmit={(event) => { event.preventDefault(); submitOther(); }}
              >
                <input
                  bind:value={otherAnswer}
                  placeholder="Something else"
                  aria-label="Your own answer"
                />
                <button type="submit" disabled={!otherAnswer.trim()}>Send</button>
              </form>
              <div class="question-actions">
                <button
                  type="button"
                  onclick={() => (questionIndex = Math.max(0, questionIndex - 1))}
                  disabled={questionIndex === 0}
                >Back</button>
                <button type="button" onclick={skipQuestion}>Skip</button>
              </div>
            </div>
          {/if}

          {#if isStreaming}
            <MessageView
              role="assistant"
              content={streamingContent}
              streaming
              trace={liveTrace ?? undefined}
            />
          {/if}

          {#if streamError}
            <div class="error-banner" role="alert">
              <span>{streamError}</span>
              <button
                type="button"
                aria-label="Dismiss error"
                onclick={() => (streamError = "")}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          {/if}
        </div>
      </div>

      <div class="composer-area">
        <div class="composer-wrap">
          <Composer
            bind:value={input}
            onsend={send}
            onstop={stop}
            streaming={isStreaming}
            placeholder="Message wapu…"
          />
          <p class="disclaimer">
            wapu can make mistakes. Check the preview before deploying.
          </p>
        </div>
      </div>
    </section>

    {#if showPreview}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="divider"
        class:dragging
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize preview"
        aria-valuemin={20}
        aria-valuemax={80}
        aria-valuenow={splitPercent}
        title="Drag to resize · Double-click to reset"
        tabindex={0}
        onpointerdown={startResize}
        onpointermove={resize}
        onpointerup={endResize}
        onpointercancel={endResize}
        onkeydown={keyResize}
        ondblclick={resetWidth}
      >
        <span></span>
      </div>

      <aside
        class="canvas"
        aria-label="Preview"
        bind:this={canvasEl}
        style:width={canvasWidth ? `${canvasWidth}px` : null}
      >
        <div class="canvas-head">
          <span class="dot" aria-hidden="true"></span>
          <span class="canvas-title">Preview</span>
          <div class="canvas-actions">
            <Tooltip label="Reload preview" side="bottom">
              <button
                type="button"
                class="icon-btn small"
                aria-label="Reload preview"
                onclick={reloadPreview}
              >
                <Icon name="refresh" size={15} />
              </button>
            </Tooltip>
            <Tooltip label="Open in new tab" side="bottom">
              <a
                class="icon-btn small"
                href={previewSrc}
                target="_blank"
                rel="noopener"
                aria-label="Open preview in new tab"
              >
                <Icon name="external" size={15} />
              </a>
            </Tooltip>
            <Tooltip label="Close preview" side="bottom">
              <button
                type="button"
                class="icon-btn small"
                aria-label="Close preview"
                onclick={() => (showPreview = false)}
              >
                <Icon name="close" size={15} />
              </button>
            </Tooltip>
          </div>
        </div>

        <div class="canvas-body">
          {#if iframeLoading}
            <div class="canvas-loading">
              <span class="spinner"></span>
              <span>Rendering preview…</span>
            </div>
          {/if}
          <iframe
            src={previewSrc}
            title="Project preview"
            sandbox="allow-scripts"
            onload={() => (iframeLoading = false)}
          ></iframe>
        </div>
      </aside>
    {/if}
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 52px;
    flex-shrink: 0;
    padding: 0 10px;
    border-bottom: 1px solid var(--border);
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
  }
  .icon-btn:hover {
    background: var(--surface-3);
    color: var(--fg);
  }
  .icon-btn.bordered {
    border: 1px solid var(--border);
    width: 32px;
    height: 32px;
  }
  .icon-btn.bordered:hover {
    background: var(--surface-2);
    color: var(--fg);
  }

  .title {
    min-width: 0;
    max-width: 34%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
    font-weight: 600;
  }

  .action-error {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--danger);
    font-size: 12px;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
  .live {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 180px;
    overflow: hidden;
    padding: 4px 9px;
    border: 1px solid #b7e4c7;
    border-radius: 999px;
    background: #eefbf2;
    color: #16794a;
    font-size: 12px;
    white-space: nowrap;
  }
  .live span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 500;
  }
  .btn.ghost {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
  }
  .btn.ghost:hover,
  .btn.ghost.on {
    background: var(--surface-2);
    color: var(--fg);
  }
  .btn.primary {
    border: 1px solid transparent;
    background: var(--fg);
    color: var(--surface);
  }
  .btn.primary:hover:not(:disabled) {
    opacity: 0.88;
  }
  .btn.primary:disabled {
    opacity: 0.55;
  }

  .workspace {
    display: flex;
    flex: 1;
    min-height: 0;
    position: relative;
  }
  .workspace.resizing {
    cursor: col-resize;
    user-select: none;
  }
  .workspace.resizing * {
    cursor: col-resize;
  }
  .workspace.resizing iframe {
    pointer-events: none;
  }

  .divider {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 9px;
    flex-shrink: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: col-resize;
    touch-action: none;
    z-index: 4;
  }
  .divider::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    transform: translateX(-50%);
    background: var(--border);
    transition: background 0.12s, width 0.12s;
  }
  .divider span {
    width: 3px;
    height: 36px;
    border-radius: 3px;
    background: transparent;
    z-index: 1;
  }
  .divider:hover::before,
  .divider.dragging::before {
    width: 2px;
    background: var(--border-strong);
  }
  .divider:hover span,
  .divider.dragging span {
    background: var(--border-strong);
  }
  .divider:focus-visible {
    outline: none;
  }
  .divider:focus-visible span {
    background: #8ab4f8;
  }

  .chat {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px;
  }
  .thread {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    max-width: 48rem;
    margin: 0 auto;
    padding: 28px 0 12px;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6vh 0 2vh;
    text-align: center;
  }
  .mark-lg {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin-bottom: 14px;
    border-radius: 12px;
    background: var(--fg);
    color: var(--surface);
    font-size: 20px;
    font-weight: 700;
  }
  .empty h2 {
    margin: 0 0 6px;
    font-size: 22px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .empty p {
    margin: 0;
    color: var(--muted);
    font-size: 13.5px;
  }
  .empty-suggestions {
    width: 100%;
    max-width: 560px;
    margin-top: 20px;
  }

  .question-card {
    align-self: stretch;
    margin: 4px 0 14px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
  }
  .question-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  .question-head > p {
    margin: 0;
    font-size: 13.5px;
    font-weight: 600;
  }
  .question-count {
    flex-shrink: 0;
    color: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .question-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .question-options button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    text-align: left;
    font-size: 13px;
    cursor: pointer;
  }
  .question-options button:hover {
    background: var(--surface-2, rgba(0, 0, 0, 0.04));
  }
  .question-options button.chosen {
    border-color: var(--fg);
  }
  .question-index {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 6px;
    background: var(--surface-2, rgba(0, 0, 0, 0.06));
    color: var(--muted);
    font-size: 12px;
  }
  .question-other {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  .question-other input {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border: 0;
    background: transparent;
    font-size: 13px;
    outline: none;
  }
  .question-other button,
  .question-actions button {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-2, var(--surface));
    font-size: 12.5px;
    cursor: pointer;
  }
  .question-other button:disabled,
  .question-actions button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .question-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
  }

  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 12px;
    border: 1px solid #f3c2bd;
    border-radius: 10px;
    background: #fef3f2;
    color: #9b2318;
    font-size: 13px;
    line-height: 1.45;
  }
  .error-banner button {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
  }
  .error-banner button:hover {
    background: #fbe3e1;
  }

  .composer-area {
    flex-shrink: 0;
    padding: 8px 16px 14px;
    background: var(--surface);
  }
  .composer-wrap {
    width: 100%;
    max-width: 48rem;
    margin: 0 auto;
  }
  .disclaimer {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 11.5px;
    text-align: center;
  }

  .canvas {
    display: flex;
    flex-direction: column;
    width: 46%;
    min-width: 320px;
    max-width: calc(100% - 380px);
    background: var(--surface-2);
  }
  .canvas-head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    flex-shrink: 0;
    padding: 0 8px 0 14px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--success);
  }
  .canvas-title {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--muted);
  }
  .canvas-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: auto;
  }
  .icon-btn.small {
    width: 28px;
    height: 28px;
  }

  .canvas-body {
    position: relative;
    flex: 1;
    min-height: 0;
    background: var(--surface);
  }
  .canvas-body iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: none;
    background: var(--surface);
  }
  .canvas-loading {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 13px;
  }
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--border-strong);
    border-top-color: var(--muted);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1100px) {
    .canvas {
      width: 44%;
      min-width: 300px;
    }
    .btn-label {
      display: none;
    }
    .btn.ghost {
      padding: 0 8px;
    }
  }

  @media (max-width: 900px) {
    .divider {
      display: none;
    }
    .canvas {
      position: fixed;
      inset: 0;
      z-index: 70;
      width: 100%;
      min-width: 0;
      max-width: none;
      background: var(--surface);
    }
    .canvas-head {
      height: 48px;
    }
  }

  @media (max-width: 640px) {
    .thread {
      gap: 20px;
      padding-top: 20px;
    }
    .title {
      max-width: 36%;
    }
    .live {
      display: none;
    }
  }
</style>

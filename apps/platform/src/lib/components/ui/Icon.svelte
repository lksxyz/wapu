<script lang="ts">
  export type IconName =
    | "plus"
    | "panel"
    | "search"
    | "dots"
    | "trash"
    | "copy"
    | "check"
    | "arrow-up"
    | "stop"
    | "external"
    | "refresh"
    | "close"
    | "download"
    | "globe"
    | "eye"
    | "eye-off"
    | "logout"
    | "chevron-down"
    | "chevron-right"
    | "monitor"
    | "layout"
    | "chart"
    | "tag";

  let {
    name,
    size = 18,
    stroke = 1.8,
  }: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === "plus"}
    <path d="M12 5v14M5 12h14" />
  {:else if name === "panel"}
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  {:else if name === "search"}
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  {:else if name === "dots"}
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  {:else if name === "trash"}
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  {:else if name === "copy"}
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  {:else if name === "check"}
    <path d="m5 13 4 4L19 7" />
  {:else if name === "arrow-up"}
    <path d="M12 19V5M5 12l7-7 7 7" />
  {:else if name === "stop"}
    <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
  {:else if name === "external"}
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
  {:else if name === "refresh"}
    <path d="M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6" />
  {:else if name === "close"}
    <path d="M6 6l12 12M18 6 6 18" />
  {:else if name === "download"}
    <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" />
  {:else if name === "globe"}
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
  {:else if name === "eye"}
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.5" />
  {:else if name === "eye-off"}
    <path d="M3 3l18 18M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.6M6.5 6.9A17 17 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 4.2-.9" />
  {:else if name === "logout"}
    <path d="M15 12H4m0 0 4-4m-4 4 4 4M9 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9" />
  {:else if name === "chevron-down"}
    <path d="m6 9 6 6 6-6" />
  {:else if name === "chevron-right"}
    <path d="m9 6 6 6-6 6" />
  {:else if name === "monitor"}
    <rect x="2" y="4" width="20" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  {:else if name === "layout"}
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 9v12" />
  {:else if name === "chart"}
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  {:else if name === "tag"}
    <path d="M20 13 13 20a2 2 0 0 1-2.8 0L3 12.8V4h8.8l8.2 8.2a1 1 0 0 1 0 .8z" />
    <circle cx="7.5" cy="7.5" r="1" />
  {/if}
</svg>

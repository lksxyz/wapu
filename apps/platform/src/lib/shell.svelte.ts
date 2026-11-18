import { getContext, setContext } from "svelte";

export interface Shell {
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const KEY = Symbol("wapu:shell");

export function setShell(shell: Shell): Shell {
  return setContext(KEY, shell);
}

export function getShell(): Shell {
  return getContext<Shell>(KEY);
}

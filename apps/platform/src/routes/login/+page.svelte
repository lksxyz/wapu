<script lang="ts">
  import { authClient } from "#lib/auth-client";

  // V: loading while the Google redirect is in flight
  let loading = $state(false);

  async function signInWithGoogle() {
    loading = true;
    await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/`,
    });
    loading = false;
  }
</script>

<div class="page">
  <main class="card">
    <span class="mark" aria-hidden="true">w</span>
    <h1>Welcome to wapu</h1>
    <p class="tagline">Describe a web page. Get working HTML, CSS, and JS.</p>

    <button class="google-btn" onclick={signInWithGoogle} disabled={loading}>
      {#if loading}
        <span class="spinner"></span>
        Redirecting…
      {:else}
        <svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      {/if}
    </button>

    <p class="fine">You will be redirected to Google to sign in.</p>
  </main>
</div>

<style>
  .page {
    display: grid;
    place-items: center;
    min-height: 100dvh;
    padding: 24px;
    background: var(--surface);
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 360px;
    text-align: center;
  }
  .mark {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    margin-bottom: 18px;
    border-radius: 13px;
    background: var(--fg);
    color: var(--surface);
    font-size: 22px;
    font-weight: 700;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 24px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .tagline {
    margin: 0 0 28px;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.5;
  }
  .google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    height: 44px;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: var(--surface);
    color: var(--fg);
    font-size: 14px;
    font-weight: 500;
    transition: background 0.12s;
  }
  .google-btn:hover:not(:disabled) {
    background: var(--surface-2);
  }
  .google-btn:disabled {
    opacity: 0.65;
  }
  .google-icon {
    width: 17px;
    height: 17px;
    flex-shrink: 0;
  }
  .fine {
    margin: 16px 0 0;
    color: var(--muted);
    font-size: 11.5px;
  }
  .spinner {
    display: inline-block;
    width: 15px;
    height: 15px;
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
</style>

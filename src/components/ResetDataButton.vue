<script setup lang="ts">
async function resetAll() {
  if (!confirm("Reset all local data (progress, decks, preferences)?")) return;

  try {
    // 1) chiudi la connessione IDB se è aperta
    try {
      const { db } = await import("../db/index.ts");
      const handle = await db;
      handle.close();
    } catch {
      /* ok se non era aperto */
    }

    // 2) elimina il DB principale
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("shodoku");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });

    // 3) fallback aggressivo: elimina tutti gli IDB se l’API esiste
    try {
      if ("databases" in indexedDB && typeof indexedDB.databases === "function") {
        // @ts-ignore non tipizzata su tutti i browser
        const dbs = await indexedDB.databases();
        await Promise.all(
          dbs
            .map((d: any) => d?.name)
            .filter(Boolean)
            .map((name: string) => new Promise<void>((resolve) => {
              const r = indexedDB.deleteDatabase(name);
              r.onsuccess = r.onerror = r.onblocked = () => resolve();
            })),
        );
      }
    } catch {/* ignore */}

    // 4) pulisci preferenze locali
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("shodoku.app.")) localStorage.removeItem(k);
    }
    sessionStorage.clear?.();

    // 5) svuota cache PWA e deregistra SW
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {/* ignore */}

    alert("Local data has been fully reset. Reloading…");
    location.reload();
  } catch {
    alert("Could not fully reset. Reloading anyway…");
    location.reload();
  }
}
</script>

<template>
  <button class="reset-button" @click="resetAll">Reset local data</button>
</template>

<style scoped>
.reset-button {
  background: #d33; color: #fff; border: none; border-radius: 6px;
  padding: 0.6em 1em; font-weight: 700; cursor: pointer;
}
.reset-button:hover { background: #b22; }
</style>
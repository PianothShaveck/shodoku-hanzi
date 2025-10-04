<script setup lang="ts">
import AppearanceSettings from "../components/AppearanceSettings.vue";
import PreferencesForm from "../components/PreferencesForm.vue";
import RemoteSyncSettings from "../components/RemoteSyncSettings.vue";
import ResetDataButton from "../components/ResetDataButton.vue";
</script>

<template>
  <article class="settings-view">
    <section>
      <h2>Preferences</h2>
      <PreferencesForm />
    </section>

    <section>
      <h2>Appearance</h2>
      <AppearanceSettings />
    </section>

    <section>
      <h2>Remote Sync</h2>
      <RemoteSyncSettings />
    </section>

    <section>
      <h2>Maintenance</h2>
      <p>Reset progress, deck, and local preferences.</p>
      <ResetDataButton />
    </section>
  </article>
</template>
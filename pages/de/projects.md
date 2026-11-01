---
title: Teslaks Projekte
display: Erdacht und verwirklicht
description: Liste von Projekten
art: dots
---

<script setup lang="ts">
import { projects } from '~/data/projects'
</script>

<ListProjects :projects="projects" />

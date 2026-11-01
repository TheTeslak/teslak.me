---
title: Проекты Теслака
display: Замыслил и воплотил
description: Список проектов
art: dots
---

<script setup lang="ts">
import { projects } from '~/data/projects'
</script>

<ListProjects :projects="projects" />

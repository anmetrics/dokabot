<script lang="ts" setup>
const breadcrumbStore = useBreadcrumbStore()
const { breadcrumbs } = storeToRefs(breadcrumbStore)

const router = useRouter()
router.beforeEach(() => {
  breadcrumbStore.setBreadcrumbs([])
})
</script>
<template>
  <Transition>
    <v-breadcrumbs
      v-show="breadcrumbs.length"
      class="doka-breadcrumb"
      :items="breadcrumbs"
    >
      <template #divider>
        <v-icon size="20" icon="mdi-chevron-right" color="text-placeholder" />
      </template>
      <template #item="{ item }">
        <v-breadcrumbs-item
          class="item"
          active-class="item"
          :href="item.href"
          :disabled="item.disabled"
          :title="item.title"
        />
      </template>
    </v-breadcrumbs>
  </Transition>
</template>
<style lang="scss" scoped>
.doka-breadcrumb {
  height: 40px;
  border-bottom: 0.5px solid rgb(var(--v-theme-border));
  padding-left: 25px;
  font-size: 12px;
}
.v-enter-active,
.v-leave-active {
  transition: 0.3s ease;
}
.v-enter-from,
.v-leave-to {
  height: 0;
  padding: 0;
}
</style>

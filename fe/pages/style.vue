<script lang="ts" setup>
definePageMeta({
  layout: 'blank'
})
const colors = [
  'primary',
  'text',
  'textplaceholder',
  'textonprimary',
  'border',
  'background'
]

const headers = [
  { title: '顧客番号', key: 'id', width: '150' },
  { title: '顧客名', key: 'name' },
  { title: '顧客担当者名', key: 'customerContact', align: 'start' },
  { title: '住所', key: 'address', align: 'start' },
  { title: '電話番号', key: 'tel', align: 'start' },
  { title: '', key: 'actions', sortable: false, align: 'end', width: '200' }
]
const staffs = [
  {
    id: 1,
    name: 'hoang',
    nameKana: 'nguyen viet hoang',
    customerContact: '田中太郎',
    address: '東京都渋谷区代々木1-2-1',
    tel: '090-1234-5678'
  },
  {
    id: 2,
    name: 'nam',
    nameKana: 'nguyen van nam',
    customerContact: '田中太郎',
    address: '東京都渋谷区代々木1-2-1',
    tel: '090-1234-5678'
  },
  {
    id: 3,
    name: 'hoang',
    nameKana: 'nguyen viet hoang',
    customerContact: '田中太郎',
    address: '東京都渋谷区代々木1-2-1',
    tel: '090-1234-5678'
  },
  {
    id: 4,
    name: 'nam',
    nameKana: 'nguyen van nam',
    customerContact: '田中太郎',
    address: '東京都渋谷区代々木1-2-1',
    tel: '090-1234-5678'
  },
  {
    id: 5,
    name: 'hoang',
    nameKana: 'nguyen viet hoang',
    customerContact: '田中太郎',
    address: '東京都渋谷区代々木1-2-1',
    tel: '090-1234-5678'
  },
  {
    id: 6,
    name: 'nam',
    nameKana: 'nguyen van nam',
    customerContact: '田中太郎',
    address: '東京都渋谷区代々木1-2-1',
    tel: '090-1234-5678'
  },
  {
    id: 7,
    name: 'hoang',
    nameKana: 'nguyen viet hoang',
    customerContact: '田中太郎',
    address: '東京都渋谷区代々木1-2-1',
    tel: '090-1234-5678'
  },
  {
    id: 8,
    name: 'nam',
    nameKana: 'nguyen van nam',
    customerContact: '田中太郎',
    address: '東京都渋谷区代々木1-2-1',
    tel: '090-1234-5678'
  },
  {
    id: 9,
    name: 'hoang',
    nameKana: 'nguyen viet hoang',
    customerContact: '田中太郎',
    address: '東京都渋谷区代々木1-2-1',
    tel: '090-1234-5678'
  },
  {
    id: 10,
    name: 'nam',
    nameKana: 'nguyen van nam',
    customerContact: '田中太郎',
    address: '東京都渋谷区代々木1-2-1',
    tel: '090-1234-5678'
  }
]
const itemsPerPage = 5
</script>
<template>
  <v-app>
    <v-main class="vuetify-page">
      <ul class="section -colors">
        <li v-for="color in colors" :key="color" class="color">
          <div class="color" :class="[`-${color}`]" />
          <p class="colorname">
            {{ color }}
          </p>
        </li>
      </ul>
      <section class="section -typography">
        <h1>Title</h1>
        <h2>Title</h2>
        <h3>Title</h3>
        <h4>Title</h4>
        <h5>Title</h5>
        <h6>Title</h6>
        <p>Normal text</p>
      </section>
      <section class="section -buttons">
        <h1 class="title">
          Button
        </h1>
        <div class="detail">
          <div class="type -x-small">
            <v-btn size="x-small" class="button" density="compact">
              X-small compact
            </v-btn>
            <v-btn size="x-small" class="button" density="comfortable">
              X-small comfortable
            </v-btn>
            <v-btn size="x-small" class="button" density="default">
              X-small default
            </v-btn>
            <v-btn size="x-small" class="button" disabled>
              X-small default but disabled
            </v-btn>
          </div>
          <div class="type -small">
            <v-btn size="small" class="button" density="compact">
              Small compact
            </v-btn>
            <v-btn size="small" class="button" density="comfortable">
              Small comfortable
            </v-btn>
            <v-btn size="small" class="button" density="default">
              Small default
            </v-btn>
            <v-btn size="small" class="button" disabled>
              Small default but disabled
            </v-btn>
          </div>
          <div class="type -default">
            <v-btn class="button" size="default" density="compact">
              Default Compact
            </v-btn>
            <v-btn class="button" size="default" density="comfortable">
              Default Comfortable
            </v-btn>
            <v-btn class="button">
              Default Default
            </v-btn>
            <v-btn class="button" disabled>
              Default default but disabled
            </v-btn>
          </div>
          <div class="type -large">
            <v-btn class="button" size="large" density="compact">
              Large Compact
            </v-btn>
            <v-btn class="button" size="large" density="comfortable">
              Large Comfortable
            </v-btn>
            <v-btn class="button" size="large" density="default">
              Large default
            </v-btn>
            <v-btn class="button" size="large" disabled>
              Large default but disabled
            </v-btn>
          </div>
          <div class="type -big">
            <v-btn size="x-large" class="button" density="compact">
              X-large compact
            </v-btn>
            <v-btn size="x-large" class="button" density="comfortable">
              X-large Comfortable
            </v-btn>
            <v-btn size="x-large" class="button" density="default">
              X-large Default
            </v-btn>
            <v-btn size="x-large" class="button" disabled>
              X-large but disabled
            </v-btn>
          </div>
          <div class="type -big">
            <v-btn size="x-small" class="button">
              X-small
            </v-btn>
            <v-btn size="small" class="button">
              Small
            </v-btn>
            <v-btn class="button">
              Default
            </v-btn>
            <v-btn class="button" size="large">
              Large
            </v-btn>
            <v-btn size="x-large" class="button">
              X-large
            </v-btn>
          </div>
          <div class="type -texticon">
            <v-btn variant="plain" append-icon="mdi-chevron-right">
              default
            </v-btn>
            <v-btn variant="plain" append-icon="mdi-chevron-right" disabled>
              Disabled
            </v-btn>
          </div>
        </div>
      </section>
      <section class="section -input">
        <div class="type -textfield">
          <v-text-field
            placeholder="Density default is az with placeholder. Label is centered"
            class="input"
          />
          <v-text-field
            placeholder="Default input with japanese プレースポルダー"
            class="input"
          />
          <v-text-field
            placeholder="Density Compact with placeholder. Label is centered."
            class="input"
            density="compact"
          />
          <v-text-field
            placeholder="Density Comfortable with placeholder. Label is centered. This one look small because of font-size, not because of us"
            class="input"
            density="comfortable"
          />
          <v-text-field
            placeholder="Density Default with placeholder. Label is centered. This one look small because of font-size, not because of us"
            class="input"
            density="default"
          />

          <v-text-field
            label="Density default is az with label. Label is centered"
            class="input"
          />
          <v-text-field
            label="Default input with japanese プレースポルダー"
            class="input"
          />
          <v-text-field
            label="Density Compact with label. Label is centered"
            class="input"
            density="compact"
          />
          <v-text-field
            label="Density Comfortable with label. Label is centered. This one look small because of font-size, not because of us"
            class="input"
            density="comfortable"
          />
          <v-text-field
            label="Density Default with label. Label is centered. This one look small because of font-size, not because of us"
            class="input"
            density="default"
          />
          <v-text-field
            placeholder="プレースポルダー"
            class="input"
            label="プレースポルダー"
            error
          />
          <v-text-field
            placeholder="Wanna a form with label. Here is append and prepend. Az desensity"
            class="input"
          >
            <template #prepend>
              <label class="label">Prepend</label>
            </template>
            <template #append>
              <span class="unit">Append</span>
            </template>
          </v-text-field>
          <v-text-field
            placeholder="Wanna a form with label. Here is append and prepend. Compact desensity"
            class="input"
            density="compact"
          >
            <template #prepend>
              <label class="label">Prepend</label>
            </template>
            <template #append>
              <span class="unit">Append</span>
            </template>
          </v-text-field>
          <v-text-field
            placeholder="Wanna a form with label. Here is append and prepend. Comfortable desensity"
            class="input"
            density="comfortable"
          >
            <template #prepend>
              <label class="label">Prepend</label>
            </template>
            <template #append>
              <span class="unit">Append</span>
            </template>
          </v-text-field>
          <v-text-field
            placeholder="Wanna a form with label. Here is append and prepend. Default desensity"
            class="input"
            density="default"
          >
            <template #prepend>
              <label class="label">Prepend</label>
            </template>
            <template #append>
              <span class="unit">Append</span>
            </template>
          </v-text-field>
        </div>
        <div class="type -textarea">
          <v-textarea placeholder="Normal textarea" class="input" no-resize>
            <template #prepend>
              <label class="label">Prepend</label>
            </template>
            <template #append>
              <span class="unit">Append</span>
            </template>
          </v-textarea>
          <v-textarea
            placeholder="プレースポルダー"
            class="input"
            no-resize
            density="compact"
          >
            <template #prepend>
              <label class="label">Prepend</label>
            </template>
            <template #append>
              <span class="unit">Append</span>
            </template>
          </v-textarea>
          <v-textarea
            placeholder="プレースポルダー"
            class="input"
            no-resize
            density="comfortable"
          >
            <template #prepend>
              <label class="label">Prepend</label>
            </template>
            <template #append>
              <span class="unit">Append</span>
            </template>
          </v-textarea>
          <v-textarea
            placeholder="プレースポルダー"
            class="input"
            no-resize
            density="default"
          >
            <template #prepend>
              <label class="label">Prepend</label>
            </template>
            <template #append>
              <span class="unit">Append</span>
            </template>
          </v-textarea>
          <v-textarea
            class="input"
            no-resize
            variant="outlined"
            label="outlined"
          >
            <template #prepend>
              <label class="label">Prepend</label>
            </template>
            <template #append>
              <span class="unit">Append</span>
            </template>
          </v-textarea>
        </div>
        <div class="type -checkbox">
          <v-checkbox label="Checkbox" />
          <v-checkbox label="Checkbox" />
        </div>
        <div class="type -select">
          <v-select
            label="Select"
            class="input"
            :items="[
              'California',
              'Colorado',
              'Florida',
              'Georgia',
              'Texas',
              'Wyoming',
            ]"
          />
          <v-select
            label="Density Compact"
            class="input"
            :items="[
              'California',
              'Colorado',
              'Florida',
              'Georgia',
              'Texas',
              'Wyoming',
            ]"
            density="compact"
          />
          <v-select
            label="Density Comfortable"
            class="input"
            :items="[
              'California',
              'Colorado',
              'Florida',
              'Georgia',
              'Texas',
              'Wyoming',
            ]"
            density="comfortable"
          />
          <v-select
            label="Density Default"
            class="input"
            :items="[
              'California',
              'Colorado',
              'Florida',
              'Georgia',
              'Texas',
              'Wyoming',
            ]"
            density="default"
          />
        </div>
        <div class="type -autocomplete">
          <v-autocomplete
            label="Autocomplete"
            class="input"
            :items="[
              'California',
              'Colorado',
              'Florida',
              'Georgia',
              'Texas',
              'Wyoming',
            ]"
          />
          <v-autocomplete
            label="Density Compact"
            class="input"
            :items="[
              'California',
              'Colorado',
              'Florida',
              'Georgia',
              'Texas',
              'Wyoming',
            ]"
            density="compact"
          />
          <v-autocomplete
            label="Density Comfortable"
            class="input"
            :items="[
              'California',
              'Colorado',
              'Florida',
              'Georgia',
              'Texas',
              'Wyoming',
            ]"
            density="comfortable"
          />
          <v-autocomplete
            label="Density Default"
            class="input"
            :items="[
              'California',
              'Colorado',
              'Florida',
              'Georgia',
              'Texas',
              'Wyoming',
            ]"
            density="default"
          />
        </div>
        <div class="type -radio">
          <v-radio label="Single radio" value="1" />

          <v-radio-group inline>
            <v-radio label="Radio 1" value="1" />
            <v-radio label="Radio 2" value="2" />
            <v-radio label="Radio 3" value="3" />
          </v-radio-group>
        </div>
      </section>
      <section class="section -table">
        <v-data-table
          class="data-table"
          :headers="headers"
          :items="staffs"
          :items-per-page="itemsPerPage"
        >
          <template #top>
            <div class="top">
              <div class="column">
                並び替え：
                <v-select
                  label="Select"
                  class="sort"
                  :items="[
                    'California',
                    'Colorado',
                    'Florida',
                    'Georgia',
                    'Texas',
                    'Wyoming',
                  ]"
                />
              </div>
              <div class="column">
                <doka-pagination :items-per-page="5" :page="1" :total="15" />
              </div>
            </div>
          </template>
          <template #[`item.name`]="{ item }">
            <div class="col -name">
              <p class="namekana">
                {{ item.raw.nameKana }}
              </p>
              <p class="name">
                {{ item.raw.name }}
              </p>
            </div>
          </template>
          <template #[`item.address`]="{ item }">
            <div class="col -address">
              <p class="address">
                {{ item.raw.address }}
              </p>
            </div>
          </template>
          <template #[`item.isEnabled`]="{ item }">
            <v-chip
              size="small"
              :color="item.raw.isEnabled ? 'primary' : 'text-placeholder'"
            >
              {{ !!item.raw.isEnabled ? "有効" : "無効" }}
            </v-chip>
          </template>
          <template #[`item.actions`]="{ item }">
            <v-btn
              variant="plain"
              color="primary"
              density="compact"
              append-icon="mdi-chevron-right"
              :ripple="false"
              :to="`/staffs/${item.raw.id}`"
            >
              詳細を見る
            </v-btn>
          </template>
          <template #bottom />
        </v-data-table>
      </section>
    </v-main>
  </v-app>
</template>
<style lang="scss" scoped>
.vuetify-page {
  padding: 50px;
  background-color: rgb(var(--v-theme-background));
  > .section {
    margin-bottom: 10px;
    > .detail {
      display: flex;
      flex-direction: column;
      row-gap: 30px;
      padding: 15px;
    }
    > .detail > .type {
      display: inline-flex;
      column-gap: 30px;
      border: 1px dashed #9747ff;
      padding: 15px;
    }
  }
  > .section.-colors {
    display: flex;
    flex-direction: row;
    list-style: none;
  }
  > .section.-colors > .color {
    width: 33%;
  }
  > .section.-colors > .color > .color {
    width: 60px;
    height: 60px;
    &.-primary {
      background-color: rgb(var(--v-theme-primary));
    }
    &.-text {
      background-color: rgb(var(--v-theme-text));
    }
    &.-textplaceholder {
      background-color: rgb(var(--v-theme-text-placeholder));
    }
    &.-textonprimary {
      background-color: rgb(var(--v-theme-on-primary));
    }
    &.-border {
      background-color: rgb(var(--v-theme-border));
    }
    &.-background {
      background-color: rgb(var(--v-theme-background));
    }
  }
  > .section.-buttons > .type {
    margin-bottom: 10px;
  }
  > .section.-buttons > .type > .button {
    margin: 10px;
  }
  > .section.-input > .type > .input {
    margin-bottom: 20px;
  }
  > .section.-input > .type {
    &.-select,
    &.-autocomplete {
      width: 200px;
    }
  }
}

.data-table {
  &:deep(.col.-name) {
    > .namekana {
      font-size: 10px;
      color: rgb(var(--v-theme-text-placeholder));
    }
  }
  &:deep(.top) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background-color: rgb(var(--v-theme-on-primary));
    > .column {
      display: flex;
      align-items: center;
    }
    > .column > .sort {
      width: 140px;
    }
  }
}
</style>

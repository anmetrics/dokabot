<script lang="ts" setup>
import { ref } from 'vue'
import {
  VIcon,
  VBtn,
  VCard,
  VCardTitle,
  VCardText,
  VTable
} from 'vuetify/components'

// Mock data for the organization tree (current user and referred users)
const currentUser = {
  id: 'user1',
  name: 'John Doe',
  avatar: 'https://via.placeholder.com/40?text=JD',
  referredUsers: [
    {
      id: 'user2',
      name: 'Jane Smith',
      avatar: 'https://via.placeholder.com/40?text=JS',
      referredUsers: [
        {
          id: 'user4',
          name: 'Alice Brown',
          avatar: 'https://via.placeholder.com/40?text=AB',
          referredUsers: []
        },
        {
          id: 'user5',
          name: 'Bob Wilson',
          avatar: 'https://via.placeholder.com/40?text=BW',
          referredUsers: []
        }
      ]
    },
    {
      id: 'user3',
      name: 'Mike Johnson',
      avatar: 'https://via.placeholder.com/40?text=MJ',
      referredUsers: [
        {
          id: 'user6',
          name: 'Emma Davis',
          avatar: 'https://via.placeholder.com/40?text=ED',
          referredUsers: []
        }
      ]
    }
  ]
}

// Mock data for DOKA coin purchase history
const purchaseHistory = ref([
  {
    id: 1,
    date: '2025-06-01',
    amount: 1000,
    price: 1.25,
    total: 1250,
    status: 'Completed'
  },
  {
    id: 2,
    date: '2025-05-15',
    amount: 500,
    price: 1.2,
    total: 600,
    status: 'Completed'
  },
  {
    id: 3,
    date: '2025-04-10',
    amount: 2000,
    price: 1.3,
    total: 2600,
    status: 'Pending'
  }
])

// Reactive state for active tab
const activeTab = ref('tree')

// Tab switch handler
function switchTab(tab: string) {
  activeTab.value = tab
}

// Recursive function to render the tree
function renderTreeNode(user: any, level: number = 0) {
  return {
    ...user,
    level,
    referredUsers: user.referredUsers.map((child: any) =>
      renderTreeNode(child, level + 1)
    )
  }
}

const treeData = computed(() => renderTreeNode(currentUser))
</script>

<template>
  <div class="container">
    <v-card class="main-card" rounded="lg">
      <v-card-title class="header">
        <v-icon icon="mdi-sitemap" class="header-icon" aria-hidden="true" />
        Organization Tree
      </v-card-title>
      <v-card-text>
        <div class="tabs">
          <v-btn
            :class="['tab', { active: activeTab === 'tree' }]"
            @click="switchTab('tree')"
            aria-label="Switch to Organization Tree tab"
            :aria-selected="activeTab === 'tree'"
            role="tab"
          >
            <v-icon icon="mdi-account-group" class="tab-icon" />
            Organization Tree
          </v-btn>
          <v-btn
            :class="['tab', { active: activeTab === 'history' }]"
            @click="switchTab('history')"
            aria-label="Switch to Purchase History tab"
            :aria-selected="activeTab === 'history'"
            role="tab"
          >
            <v-icon icon="mdi-history" class="tab-icon" />
            Purchase History
          </v-btn>
        </div>

        <div v-if="activeTab === 'tree'" class="tree-container">
          <div
            class="tree-node"
            :style="{ 'margin-left': `${treeData.level * 20}px` }"
          >
            <div class="user-info">
              <img :src="treeData.avatar" :alt="treeData.name" class="avatar" />
              <span class="user-name">{{ treeData.name }}</span>
            </div>
            <div v-if="treeData.referredUsers.length" class="children">
              <div
                v-for="child in treeData.referredUsers"
                :key="child.id"
                class="child-node"
              >
                <div class="connector"></div>
                <div
                  class="user-info"
                  :style="{ 'margin-left': `${child.level * 20}px` }"
                >
                  <img :src="child.avatar" :alt="child.name" class="avatar" />
                  <span class="user-name">{{ child.name }}</span>
                </div>
                <div v-if="child.referredUsers.length" class="children">
                  <div
                    v-for="grandchild in child.referredUsers"
                    :key="grandchild.id"
                    class="child-node"
                  >
                    <div class="connector"></div>
                    <div
                      class="user-info"
                      :style="{ 'margin-left': `${grandchild.level * 20}px` }"
                    >
                      <img
                        :src="grandchild.avatar"
                        :alt="grandchild.name"
                        class="avatar"
                      />
                      <span class="user-name">{{ grandchild.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'history'" class="history-container">
          <v-table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount (DOKA)</th>
                <th>Price ($)</th>
                <th>Total ($)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="purchase in purchaseHistory" :key="purchase.id">
                <td>{{ purchase.date }}</td>
                <td>{{ purchase.amount.toLocaleString() }}</td>
                <td>{{ purchase.price.toFixed(2) }}</td>
                <td>{{ purchase.total.toLocaleString() }}</td>
                <td
                  :class="
                    purchase.status === 'Completed'
                      ? 'status-completed'
                      : 'status-pending'
                  "
                >
                  {{ purchase.status }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<style lang="scss" scoped>
$primary-color: #1976d2;
$text-color: #1a1a1a;
$border-radius: 12px;
$background-color: #f1f5f9;

.container {
  max-width: 1200px;
  margin: 24px auto;
  padding: 16px;
}

.main-card {
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: $border-radius;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.5rem;
  font-weight: 600;
  color: $text-color;
  padding: 16px;
}

.header-icon {
  font-size: 1.5rem;
  color: $primary-color;
}

.tabs {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.tab {
  padding: 10px 20px;
  border: none;
  border-radius: $border-radius;
  background: #e5e7eb;
  color: $text-color;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
  &:hover {
    background: darken(#e5e7eb, 10%);
  }
  &.active {
    background: $primary-color;
    color: white;
  }
}

.tab-icon {
  font-size: 1.2rem;
}

.tree-container {
  padding: 24px;
  overflow-x: auto;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  margin: 8px 0;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.user-name {
  font-size: 1rem;
  font-weight: 500;
  color: $text-color;
}

.child-node {
  position: relative;
}

.connector {
  position: absolute;
  top: -20px;
  left: 20px;
  width: 2px;
  height: 20px;
  background: #6b7280;
}

.children {
  margin-left: 40px;
}

.history-container {
  padding: 24px;
}

.v-table {
  background: #ffffff;
  border-radius: $border-radius;
  overflow: hidden;
}

th,
td {
  padding: 12px;
  text-align: left;
  font-size: 0.9rem;
  color: $text-color;
}

th {
  background: #f8fafc;
  font-weight: 600;
}

.status-completed {
  color: #2ecc71;
}

.status-pending {
  color: #f59e0b;
}

@media (max-width: 600px) {
  .container {
    padding: 8px;
    margin: 8px auto;
  }
  .tabs {
    flex-direction: column;
    align-items: stretch;
  }
  .tab {
    width: 100%;
    justify-content: center;
  }
  .tree-container {
    padding: 16px;
  }
  .history-container {
    padding: 16px;
  }
  .v-table {
    font-size: 0.85rem;
  }
}
</style>

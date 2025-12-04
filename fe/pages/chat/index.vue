<template>
  <div class="chat-container">
    <h1>Chat Room</h1>

    <div class="messages">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="{ 'my-message': msg.userId === userId }"
      >
        <strong>{{ msg.userId === userId ? "Me" : "Friend" }}:</strong>
        {{ msg.text }}
      </div>
    </div>

    <form @submit.prevent="sendMessage">
      <input v-model="newMessage" placeholder="Type a message..." />
      <button type="submit">Send</button>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

const messages = ref([]);
const newMessage = ref("");
const ws = ref(null);

// Giả định userId của bạn (thường lấy từ session)
const userId = 1;

// WebSocket URL (thay đổi cho phù hợp)
const WS_URL = "ws://localhost:8000/websocket";

const connectWebSocket = () => {
  ws.value = new WebSocket(WS_URL);

  ws.value.onopen = () => {
    console.log("WebSocket connected");
  };

  ws.value.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      // Giả sử data có dạng { id, userId, text }
      messages.value.push(data);
    } catch (e) {
      console.error("Invalid message", e);
    }
  };

  ws.value.onclose = () => {
    console.log("WebSocket disconnected, retry in 2s...");
    setTimeout(connectWebSocket, 2000);
  };

  ws.value.onerror = (err) => {
    console.error("WebSocket error", err);
  };
};

const sendMessage = () => {
  if (!newMessage.value.trim()) return;

  const msg = {
    id: Date.now(),
    userId,
    text: newMessage.value,
  };

  // Gửi message qua WebSocket
  ws.value.send(JSON.stringify(msg));

  // Hiển thị ngay trên client
  messages.value.push(msg);
  newMessage.value = "";
};

onMounted(() => {
  connectWebSocket();
});

onBeforeUnmount(() => {
  if (ws.value) ws.value.close();
});
</script>

<style scoped>
.chat-container {
  max-width: 600px;
  margin: auto;
  padding: 1rem;
}
.messages {
  border: 1px solid #ccc;
  height: 400px;
  overflow-y: auto;
  padding: 1rem;
  margin-bottom: 1rem;
}
.my-message {
  text-align: right;
  color: blue;
}
</style>

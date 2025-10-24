// plugins/chart-financial.client.ts
import { defineNuxtPlugin } from "#app";
import {
  Chart,
  TimeScale,
  LinearScale,
  Tooltip,
  Title,
  Legend,
} from "chart.js";
import "chartjs-adapter-luxon"; // adapter time
import {
  CandlestickController,
  CandlestickElement,
} from "chartjs-chart-financial";

// register core components + financial
Chart.register(
  TimeScale,
  LinearScale,
  Tooltip,
  Title,
  Legend,
  CandlestickController,
  CandlestickElement
);

export default defineNuxtPlugin((nuxtApp) => {
  // nothing to return; Chart is globally registered
});

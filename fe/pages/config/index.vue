<template>
  <v-container fluid class="pa-8 bg-background">
    <v-card
      elevation="6"
      rounded="xl"
      class="mx-auto overflow-hidden"
      max-width="1280"
    >
      <!-- Header -->
      <v-card-title
        class="text-h5 font-weight-bold primary white--text py-4 px-6"
      >
        <v-icon left size="32" color="white">mdi-robot</v-icon>
        Crypto Trading Bot Configuration
      </v-card-title>

      <v-row no-gutters>
        <!-- Vertical Tabs -->
        <v-col cols="12" md="3" class="primary pa-4">
          <v-row no-gutters>
            <v-col
              v-for="(tab, index) in tabs"
              :key="index"
              cols="12"
              class="mb-2"
            >
              <v-btn
                block
                :class="{ 'custom-btn': true, 'custom-btn--active': mainTab === index }"
                :style="mainTab === index
                  ? 'background: linear-gradient(45deg, #1976d2, #42a5f5)'
                  : 'background: linear-gradient(45deg, #4caf50, #81c784)'"
                rounded="lg"
                class="text-white"
                @click="mainTab = index"
              >
                {{ tab.name }}
                <v-icon right size="x-large">{{ tab.icon }}</v-icon>
              </v-btn>
            </v-col>
          </v-row>
        </v-col>


        <!-- Tab Content -->
        <v-col cols="12" md="9" class="pa-6">
          <v-tabs-items v-model="mainTab" class="transparent">
            <!-- EXCHANGE & API -->
            <v-tab-item>
              <v-form
                ref="formExchange"
                v-model="validExchange"
                @submit.prevent
              >
                <v-subheader class="text-h6 primary--text">
                  Exchange Settings
                </v-subheader>
                <v-row dense>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="config.apiKey"
                      label="API Key"
                      outlined
                      dense
                      :rules="[rules.required]"
                      prepend-inner-icon="mdi-key"
                      :error-messages="formErrors.apiKey"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="config.apiSecret"
                      label="API Secret"
                      type="password"
                      outlined
                      dense
                      :rules="[rules.required]"
                      prepend-inner-icon="mdi-lock"
                      :error-messages="formErrors.apiSecret"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-select
                      v-model="config.exchange"
                      :items="exchanges"
                      label="Exchange"
                      outlined
                      dense
                      :rules="[rules.required]"
                      prepend-inner-icon="mdi-swap-horizontal"
                      :error-messages="formErrors.exchange"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-switch
                      v-model="config.testnet"
                      label="Use Testnet/Sandbox"
                      color="success"
                      inset
                      dense
                    />
                  </v-col>
                  <v-col v-if="config.exchange === 'Binance'" cols="12">
                    <v-text-field
                      v-model="config.binanceSpecific.subAccount"
                      label="Binance Sub-Account (Optional)"
                      outlined
                      dense
                    />
                  </v-col>
                </v-row>
              </v-form>
            </v-tab-item>

            <!-- TRADING STRATEGY -->
            <v-tab-item>
              <v-row no-gutters>
                <v-col cols="12" md="3">
                  <v-tabs
                    v-model="strategySubTab"
                    vertical
                    background-color="transparent"
                    class="vertical-sub-tabs"
                  >
                    <v-tab class="py-2">Basic Settings</v-tab>
                    <v-tab class="py-2">Strategy Parameters</v-tab>
                    <v-tab class="py-2">Order Management</v-tab>
                  </v-tabs>
                </v-col>
                <v-col cols="12" md="9">
                  <v-tabs-items v-model="strategySubTab" class="transparent">
                    <!-- Basic Settings -->
                    <v-tab-item>
                      <v-form
                        ref="formTradingBasic"
                        v-model="validTradingBasic"
                        @submit.prevent
                      >
                        <v-subheader class="text-h6 primary--text">
                          Trading Basics
                        </v-subheader>
                        <v-row dense>
                          <v-col cols="12">
                            <v-text-field
                              v-model="config.symbol"
                              label="Trading Pair (e.g., BTCUSDT)"
                              outlined
                              dense
                              :rules="[rules.required, rules.validSymbol]"
                              prepend-inner-icon="mdi-currency-btc"
                              :error-messages="formErrors.symbol"
                            />
                          </v-col>
                          <v-col cols="12" sm="6">
                            <v-select
                              v-model="config.strategy"
                              :items="strategies"
                              label="Strategy"
                              outlined
                              dense
                              :rules="[rules.required]"
                              prepend-inner-icon="mdi-strategy"
                              :error-messages="formErrors.strategy"
                            />
                          </v-col>
                          <v-col cols="12" sm="6">
                            <v-select
                              v-model="config.timeframe"
                              :items="timeframes"
                              label="Timeframe"
                              outlined
                              dense
                              :rules="[rules.required]"
                              prepend-inner-icon="mdi-clock-outline"
                              :error-messages="formErrors.timeframe"
                            />
                          </v-col>
                        </v-row>
                      </v-form>
                    </v-tab-item>
                    <!-- Strategy Parameters -->
                    <v-tab-item>
                      <v-form
                        ref="formStrategyParams"
                        v-model="validStrategyParams"
                        @submit.prevent
                      >
                        <v-subheader class="text-h6 primary--text">
                          Strategy Parameters
                        </v-subheader>
                        <v-row dense v-if="config.strategy === 'Scalping'">
                          <v-col cols="12" sm="6">
                            <v-text-field
                              v-model.number="
                                config.strategyParams.scalpInterval
                              "
                              label="Scalp Interval (minutes)"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.scalpInterval"
                            />
                          </v-col>
                          <v-col cols="12" sm="6">
                            <v-text-field
                              v-model.number="
                                config.strategyParams.scalpProfitTarget
                              "
                              label="Profit Target (%)"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.scalpProfitTarget"
                            />
                          </v-col>
                        </v-row>
                        <v-row
                          dense
                          v-if="config.strategy === 'Trend Following'"
                        >
                          <v-col cols="12" sm="6">
                            <v-text-field
                              v-model.number="config.strategyParams.trendPeriod"
                              label="Trend Period (candles)"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.trendPeriod"
                            />
                          </v-col>
                          <v-col cols="12" sm="6">
                            <v-text-field
                              v-model.number="
                                config.strategyParams.trendThreshold
                              "
                              label="Trend Threshold (%)"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.trendThreshold"
                            />
                          </v-col>
                        </v-row>
                        <v-row dense v-if="config.strategy === 'Grid'">
                          <v-col cols="12" sm="4">
                            <v-text-field
                              v-model.number="config.strategyParams.gridLevels"
                              label="Grid Levels"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.gridLevels"
                            />
                          </v-col>
                          <v-col cols="12" sm="4">
                            <v-text-field
                              v-model.number="config.strategyParams.gridSpacing"
                              label="Grid Spacing (%)"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.gridSpacing"
                            />
                          </v-col>
                          <v-col cols="12" sm="4">
                            <v-text-field
                              v-model.number="
                                config.strategyParams.gridOrderSize
                              "
                              label="Order Size per Grid"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.gridOrderSize"
                            />
                          </v-col>
                        </v-row>
                        <v-row dense v-if="config.strategy === 'DCA'">
                          <v-col cols="12" sm="6">
                            <v-text-field
                              v-model.number="config.strategyParams.dcaLevels"
                              label="DCA Levels"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.dcaLevels"
                            />
                          </v-col>
                          <v-col cols="12" sm="6">
                            <v-text-field
                              v-model.number="
                                config.strategyParams.dcaMultiplier
                              "
                              label="DCA Multiplier"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.dcaMultiplier"
                            />
                          </v-col>
                        </v-row>
                        <v-row dense v-if="config.strategy === 'Martingale'">
                          <v-col cols="12" sm="6">
                            <v-text-field
                              v-model.number="
                                config.strategyParams.martingaleFactor
                              "
                              label="Martingale Factor"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.martingaleFactor"
                            />
                          </v-col>
                          <v-col cols="12" sm="6">
                            <v-text-field
                              v-model.number="
                                config.strategyParams.maxMartingaleSteps
                              "
                              label="Max Martingale Steps"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.maxMartingaleSteps"
                            />
                          </v-col>
                        </v-row>
                        <v-row dense v-if="config.strategy === 'Arbitrage'">
                          <v-col cols="12" sm="6">
                            <v-text-field
                              v-model.number="
                                config.strategyParams.arbThreshold
                              "
                              label="Arbitrage Threshold (%)"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.arbThreshold"
                            />
                          </v-col>
                          <v-col cols="12" sm="6">
                            <v-text-field
                              v-model="config.strategyParams.arbExchanges"
                              label="Arbitrage Exchanges (comma-separated)"
                              outlined
                              dense
                              :rules="[rules.required]"
                              :error-messages="formErrors.arbExchanges"
                            />
                          </v-col>
                        </v-row>
                      </v-form>
                    </v-tab-item>
                    <!-- Order Management -->
                    <v-tab-item>
                      <v-form
                        ref="formOrderMgmt"
                        v-model="validOrderMgmt"
                        @submit.prevent
                      >
                        <v-subheader class="text-h6 primary--text">
                          Order Settings
                        </v-subheader>
                        <v-row dense>
                          <v-col cols="12" sm="6">
                            <v-select
                              v-model="config.orderType"
                              :items="orderTypes"
                              label="Default Order Type"
                              outlined
                              dense
                              :rules="[rules.required]"
                              prepend-inner-icon="mdi-order-bool-ascending"
                              :error-messages="formErrors.orderType"
                            />
                          </v-col>
                          <v-col cols="12" sm="6">
                            <v-text-field
                              v-model.number="config.leverage"
                              label="Leverage (e.g., 10x)"
                              type="number"
                              outlined
                              dense
                              :rules="[rules.positiveNumber]"
                              :error-messages="formErrors.leverage"
                            />
                          </v-col>
                          <v-col cols="12">
                            <v-switch
                              v-model="config.autoRebalance"
                              label="Enable Auto-Rebalance"
                              color="success"
                              inset
                              dense
                            />
                          </v-col>
                        </v-row>
                      </v-form>
                    </v-tab-item>
                  </v-tabs-items>
                </v-col>
              </v-row>
            </v-tab-item>

            <!-- INDICATORS & SIGNALS -->
            <v-tab-item>
              <v-row no-gutters>
                <v-col cols="12" md="3">
                  <v-tabs
                    v-model="indicatorsSubTab"
                    vertical
                    background-color="transparent"
                    class="vertical-sub-tabs"
                  >
                    <v-tab class="py-2">Indicator Selection</v-tab>
                    <v-tab class="py-2">Indicator Parameters</v-tab>
                    <v-tab class="py-2">Signal Sources</v-tab>
                  </v-tabs>
                </v-col>
                <v-col cols="12" md="9">
                  <v-tabs-items v-model="indicatorsSubTab" class="transparent">
                    <!-- Indicator Selection -->
                    <v-tab-item>
                      <v-form
                        ref="formIndicatorsSelect"
                        v-model="validIndicatorsSelect"
                        @submit.prevent
                      >
                        <v-subheader class="text-h6 primary--text">
                          Select Indicators
                        </v-subheader>
                        <v-row dense>
                          <v-col
                            v-for="ind in indicatorsList"
                            :key="ind"
                            cols="12"
                            sm="4"
                          >
                            <v-checkbox
                              v-model="config.indicators"
                              :label="ind"
                              :value="ind"
                              color="primary"
                              dense
                            />
                          </v-col>
                        </v-row>
                      </v-form>
                    </v-tab-item>
                    <!-- Indicator Parameters -->
                    <v-tab-item>
                      <v-form
                        ref="formIndicatorsParams"
                        v-model="validIndicatorsParams"
                        @submit.prevent
                      >
                        <v-subheader class="text-h6 primary--text">
                          Indicator Parameters
                        </v-subheader>
                        <v-expansion-panels flat>
                          <v-expansion-panel
                            v-for="ind in config.indicators"
                            :key="ind"
                          >
                            <v-expansion-panel-header
                              class="font-weight-medium primary--text"
                            >
                              {{ ind }}
                            </v-expansion-panel-header>
                            <v-expansion-panel-content>
                              <v-row dense v-if="ind === 'RSI'">
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.rsi.period
                                    "
                                    label="Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.rsiPeriod"
                                  />
                                </v-col>
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.rsi.overbought
                                    "
                                    label="Overbought Threshold"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.rsiOverbought"
                                  />
                                </v-col>
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.rsi.oversold
                                    "
                                    label="Oversold Threshold"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.rsiOversold"
                                  />
                                </v-col>
                              </v-row>
                              <v-row dense v-if="ind === 'MACD'">
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.macd.fast
                                    "
                                    label="Fast Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.macdFast"
                                  />
                                </v-col>
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.macd.slow
                                    "
                                    label="Slow Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.macdSlow"
                                  />
                                </v-col>
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.macd.signal
                                    "
                                    label="Signal Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.macdSignal"
                                  />
                                </v-col>
                              </v-row>
                              <v-row dense v-if="ind === 'EMA'">
                                <v-col cols="12">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.ema.period
                                    "
                                    label="Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.emaPeriod"
                                  />
                                </v-col>
                              </v-row>
                              <v-row dense v-if="ind === 'SMA'">
                                <v-col cols="12">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.sma.period
                                    "
                                    label="Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.smaPeriod"
                                  />
                                </v-col>
                              </v-row>
                              <v-row dense v-if="ind === 'Bollinger Bands'">
                                <v-col cols="12" sm="6">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.bbands.period
                                    "
                                    label="Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.bbandsPeriod"
                                  />
                                </v-col>
                                <v-col cols="12" sm="6">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.bbands.dev
                                    "
                                    label="Deviation"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.bbandsDev"
                                  />
                                </v-col>
                              </v-row>
                              <v-row dense v-if="ind === 'Stochastic'">
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.stoch.k
                                    "
                                    label="%K Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.stochK"
                                  />
                                </v-col>
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.stoch.d
                                    "
                                    label="%D Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.stochD"
                                  />
                                </v-col>
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.stoch.smooth
                                    "
                                    label="Smooth"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.stochSmooth"
                                  />
                                </v-col>
                              </v-row>
                              <v-row dense v-if="ind === 'Ichimoku Cloud'">
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.ichimoku.tenkan
                                    "
                                    label="Tenkan-sen"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.ichimokuTenkan"
                                  />
                                </v-col>
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.ichimoku.kijun
                                    "
                                    label="Kijun-sen"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.ichimokuKijun"
                                  />
                                </v-col>
                                <v-col cols="12" sm="4">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.ichimoku.senkou
                                    "
                                    label="Senkou Span B"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.ichimokuSenkou"
                                  />
                                </v-col>
                              </v-row>
                              <v-row dense v-if="ind === 'Parabolic SAR'">
                                <v-col cols="12" sm="6">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.psar.step
                                    "
                                    label="Step"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.psarStep"
                                  />
                                </v-col>
                                <v-col cols="12" sm="6">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.psar.max
                                    "
                                    label="Max"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.psarMax"
                                  />
                                </v-col>
                              </v-row>
                              <v-row dense v-if="ind === 'ADX'">
                                <v-col cols="12">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.adx.period
                                    "
                                    label="Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.adxPeriod"
                                  />
                                </v-col>
                              </v-row>
                              <v-row dense v-if="ind === 'CCI'">
                                <v-col cols="12">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.cci.period
                                    "
                                    label="Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.cciPeriod"
                                  />
                                </v-col>
                              </v-row>
                              <v-row dense v-if="ind === 'VWAP'">
                                <v-col cols="12">
                                  <v-text-field
                                    v-model.number="
                                      config.indicatorParams.vwap.period
                                    "
                                    label="Period"
                                    type="number"
                                    outlined
                                    dense
                                    :rules="[rules.positiveNumber]"
                                    :error-messages="formErrors.vwapPeriod"
                                  />
                                </v-col>
                              </v-row>
                              <v-row
                                dense
                                v-if="ind === 'Fibonacci Retracement'"
                              >
                                <v-col cols="12">
                                  <v-textarea
                                    v-model="config.indicatorParams.fib.levels"
                                    label="Fib Levels (comma-separated)"
                                    outlined
                                    dense
                                    :rules="[rules.validFibLevels]"
                                    :error-messages="formErrors.fibLevels"
                                  />
                                </v-col>
                              </v-row>
                            </v-expansion-panel-content>
                          </v-expansion-panel>
                        </v-expansion-panels>
                      </v-form>
                    </v-tab-item>
                    <!-- Signal Sources -->
                    <v-tab-item>
                      <v-form
                        ref="formSignals"
                        v-model="validSignals"
                        @submit.prevent
                      >
                        <v-subheader class="text-h6 primary--text">
                          Signal Sources
                        </v-subheader>
                        <v-row dense>
                          <v-col cols="12">
                            <v-text-field
                              v-model="config.signalSource"
                              label="Primary Signal Source (e.g., Telegram, TradingView)"
                              outlined
                              dense
                              prepend-inner-icon="mdi-signal"
                              :error-messages="formErrors.signalSource"
                            />
                          </v-col>
                          <v-col cols="12">
                            <v-text-field
                              v-model="config.webhookUrl"
                              label="Webhook URL for Signals"
                              outlined
                              dense
                              :rules="[rules.validUrl]"
                              :error-messages="formErrors.webhookUrl"
                            />
                          </v-col>
                          <v-col cols="12">
                            <v-switch
                              v-model="config.autoTradeOnSignal"
                              label="Auto-Trade on Signals"
                              color="success"
                              inset
                              dense
                            />
                          </v-col>
                        </v-row>
                      </v-form>
                    </v-tab-item>
                  </v-tabs-items>
                </v-col>
              </v-row>
            </v-tab-item>

            <!-- RISK MANAGEMENT -->
            <v-tab-item>
              <v-form ref="formRisk" v-model="validRisk" @submit.prevent>
                <v-subheader class="text-h6 primary--text">
                  Risk Management
                </v-subheader>
                <v-row dense>
                  <v-col cols="12" sm="4">
                    <v-text-field
                      v-model.number="config.maxDailyLoss"
                      label="Max Daily Loss (%)"
                      type="number"
                      outlined
                      dense
                      :rules="[rules.positiveNumber, rules.percentage]"
                      prepend-inner-icon="mdi-chart-donut"
                      :error-messages="formErrors.maxDailyLoss"
                    />
                  </v-col>
                  <v-col cols="12" sm="4">
                    <v-text-field
                      v-model.number="config.maxOpenTrades"
                      label="Max Open Trades"
                      type="number"
                      outlined
                      dense
                      :rules="[rules.positiveNumber]"
                      prepend-inner-icon="mdi-counter"
                      :error-messages="formErrors.maxOpenTrades"
                    />
                  </v-col>
                  <v-col cols="12" sm="4">
                    <v-text-field
                      v-model.number="config.positionSize"
                      label="Position Size (% of Capital)"
                      type="number"
                      outlined
                      dense
                      :rules="[rules.positiveNumber, rules.percentage]"
                      prepend-inner-icon="mdi-percent"
                      :error-messages="formErrors.positionSize"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model.number="config.stopLoss"
                      label="Stop Loss (%)"
                      type="number"
                      outlined
                      dense
                      :rules="[rules.positiveNumber, rules.percentage]"
                      :error-messages="formErrors.stopLoss"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model.number="config.takeProfit"
                      label="Take Profit (%)"
                      type="number"
                      outlined
                      dense
                      :rules="[rules.positiveNumber, rules.percentage]"
                      :error-messages="formErrors.takeProfit"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-switch
                      v-model="config.trailingStop"
                      label="Enable Trailing Stop"
                      color="success"
                      inset
                      dense
                    />
                  </v-col>
                  <v-col v-if="config.trailingStop" cols="12" sm="6">
                    <v-text-field
                      v-model.number="config.trailingStopPercentage"
                      label="Trailing Stop (%)"
                      type="number"
                      outlined
                      dense
                      :rules="[rules.positiveNumber, rules.percentage]"
                      :error-messages="formErrors.trailingStopPercentage"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-switch
                      v-model="config.hedging"
                      label="Enable Hedging"
                      color="success"
                      inset
                      dense
                    />
                  </v-col>
                </v-row>
              </v-form>
            </v-tab-item>

            <!-- NOTIFICATIONS & ALERTS -->
            <v-tab-item>
              <v-form ref="formNotify" v-model="validNotify" @submit.prevent>
                <v-subheader class="text-h6 primary--text">
                  Notifications
                </v-subheader>
                <v-row dense>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="config.email"
                      label="Email for Notifications"
                      type="email"
                      outlined
                      dense
                      :rules="[rules.email]"
                      prepend-inner-icon="mdi-email"
                      :error-messages="formErrors.email"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="config.telegram"
                      label="Telegram Bot Token"
                      outlined
                      dense
                      :rules="[rules.requiredIfNotification]"
                      prepend-inner-icon="mdi-telegram"
                      :error-messages="formErrors.telegram"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="config.discord"
                      label="Discord Webhook URL"
                      outlined
                      dense
                      :rules="[rules.validUrlIfFilled]"
                      prepend-inner-icon="mdi-discord"
                      :error-messages="formErrors.discord"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="config.smsNumber"
                      label="SMS Phone Number"
                      outlined
                      dense
                      :rules="[rules.phoneIfFilled]"
                      prepend-inner-icon="mdi-cellphone-message"
                      :error-messages="formErrors.smsNumber"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-select
                      v-model="config.notificationEvents"
                      :items="notificationEvents"
                      label="Notification Events"
                      multiple
                      outlined
                      dense
                      :rules="[rules.requiredIfNotification]"
                      prepend-inner-icon="mdi-bell-ring"
                      :error-messages="formErrors.notificationEvents"
                      chips
                    />
                  </v-col>
                </v-row>
              </v-form>
            </v-tab-item>

            <!-- BACKTESTING & SIMULATION -->
            <v-tab-item>
              <v-form
                ref="formBacktest"
                v-model="validBacktest"
                @submit.prevent
              >
                <v-subheader class="text-h6 primary--text">
                  Backtesting
                </v-subheader>
                <v-row dense>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="config.backtestStartDate"
                      label="Start Date"
                      type="date"
                      outlined
                      dense
                      :rules="[rules.requiredIfBacktest, rules.validDate]"
                      prepend-inner-icon="mdi-calendar-start"
                      :error-messages="formErrors.backtestStartDate"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="config.backtestEndDate"
                      label="End Date"
                      type="date"
                      outlined
                      dense
                      :rules="[
                        rules.requiredIfBacktest,
                        rules.validDate,
                        rules.dateAfterStart
                      ]"
                      prepend-inner-icon="mdi-calendar-end"
                      :error-messages="formErrors.backtestEndDate"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model.number="config.initialCapital"
                      label="Initial Capital (USDT)"
                      type="number"
                      outlined
                      dense
                      :rules="[rules.positiveNumber]"
                      prepend-inner-icon="mdi-currency-usd"
                      :error-messages="formErrors.initialCapital"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-switch
                      v-model="config.enableBacktesting"
                      label="Enable Backtesting"
                      color="success"
                      inset
                      dense
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-btn
                      color="info"
                      rounded
                      :disabled="!validBacktest || isBacktesting"
                      :loading="isBacktesting"
                      @click="runBacktest"
                    >
                      <v-icon left>mdi-play</v-icon>
                      Run Backtest
                    </v-btn>
                  </v-col>
                </v-row>
              </v-form>
            </v-tab-item>

            <!-- ADVANCED SETTINGS -->
            <v-tab-item>
              <v-form
                ref="formAdvanced"
                v-model="validAdvanced"
                @submit.prevent
              >
                <v-subheader class="text-h6 primary--text">
                  Advanced Settings
                </v-subheader>
                <v-row dense>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model.number="config.apiRateLimit"
                      label="API Rate Limit (req/min)"
                      type="number"
                      outlined
                      dense
                      :rules="[rules.positiveNumber]"
                      :error-messages="formErrors.apiRateLimit"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-select
                      v-model="config.loggingLevel"
                      :items="loggingLevels"
                      label="Logging Level"
                      outlined
                      dense
                      :rules="[rules.required]"
                      prepend-inner-icon="mdi-file-document"
                      :error-messages="formErrors.loggingLevel"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-switch
                      v-model="config.autoUpdate"
                      label="Enable Auto-Updates"
                      color="success"
                      inset
                      dense
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-textarea
                      v-model="config.customScripts"
                      label="Custom Scripts/Overrides"
                      outlined
                      rows="4"
                      :error-messages="formErrors.customScripts"
                    />
                  </v-col>
                </v-row>
              </v-form>
            </v-tab-item>

            <!-- SECURITY & LOGGING -->
            <v-tab-item>
              <v-form
                ref="formSecurity"
                v-model="validSecurity"
                @submit.prevent
              >
                <v-subheader class="text-h6 primary--text">
                  Security & Logging
                </v-subheader>
                <v-row dense>
                  <v-col cols="12">
                    <v-text-field
                      v-model="config.twoFactorSecret"
                      label="2FA Secret"
                      type="password"
                      outlined
                      dense
                      :rules="[rules.requiredIf2FA]"
                      prepend-inner-icon="mdi-shield-key"
                      :error-messages="formErrors.twoFactorSecret"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-switch
                      v-model="config.ipWhitelist"
                      label="Enable IP Whitelisting"
                      color="success"
                      inset
                      dense
                    />
                  </v-col>
                  <v-col v-if="config.ipWhitelist" cols="12">
                    <v-textarea
                      v-model="config.allowedIps"
                      label="Allowed IPs (comma-separated)"
                      outlined
                      rows="3"
                      :rules="[rules.validIps]"
                      :error-messages="formErrors.allowedIps"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      v-model="config.logPath"
                      label="Log File Path"
                      outlined
                      dense
                      :rules="[rules.required]"
                      prepend-inner-icon="mdi-folder"
                      :error-messages="formErrors.logPath"
                    />
                  </v-col>
                </v-row>
              </v-form>
            </v-tab-item>
          </v-tabs-items>
        </v-col>
      </v-row>

      <!-- Card Actions -->
      <v-card-actions class="pa-6">
        <v-spacer />
        <v-btn color="grey darken-1" text rounded @click="resetConfig">
          <v-icon left>mdi-restore</v-icon>
          Reset
        </v-btn>
        <v-btn
          color="primary"
          rounded
          :disabled="!allValid || isSaving"
          :loading="isSaving"
          @click="saveConfig"
        >
          <v-icon left>mdi-content-save</v-icon>
          Save Configuration
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="3000"
      rounded="pill"
    >
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn color="white" text @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { VForm } from 'vuetify/components'

// Tab configuration
const tabs = [
  { name: 'Exchange & API', icon: 'mdi-api' },
  { name: 'Trading Strategy', icon: 'mdi-chart-line' },
  { name: 'Indicators & Signals', icon: 'mdi-bell-outline' },
  { name: 'Risk Management', icon: 'mdi-shield-alert' },
  { name: 'Notifications', icon: 'mdi-message-alert' },
  { name: 'Backtesting', icon: 'mdi-test-tube' },
  { name: 'Advanced Settings', icon: 'mdi-cog' },
  { name: 'Security & Logging', icon: 'mdi-lock' }
]

// Reactive state for tabs
const mainTab = ref(0)
const strategySubTab = ref(0)
const indicatorsSubTab = ref(0)

// Form validation states
const validExchange = ref(false)
const validTradingBasic = ref(false)
const validStrategyParams = ref(false)
const validOrderMgmt = ref(false)
const validIndicatorsSelect = ref(false)
const validIndicatorsParams = ref(false)
const validSignals = ref(false)
const validRisk = ref(false)
const validNotify = ref(false)
const validBacktest = ref(false)
const validAdvanced = ref(false)
const validSecurity = ref(false)

// Form references
const formExchange = ref<InstanceType<typeof VForm> | null>(null)
const formTradingBasic = ref<InstanceType<typeof VForm> | null>(null)
const formStrategyParams = ref<InstanceType<typeof VForm> | null>(null)
const formOrderMgmt = ref<InstanceType<typeof VForm> | null>(null)
const formIndicatorsSelect = ref<InstanceType<typeof VForm> | null>(null)
const formIndicatorsParams = ref<InstanceType<typeof VForm> | null>(null)
const formSignals = ref<InstanceType<typeof VForm> | null>(null)
const formRisk = ref<InstanceType<typeof VForm> | null>(null)
const formNotify = ref<InstanceType<typeof VForm> | null>(null)
const formBacktest = ref<InstanceType<typeof VForm> | null>(null)
const formAdvanced = ref<InstanceType<typeof VForm> | null>(null)
const formSecurity = ref<InstanceType<typeof VForm> | null>(null)

// Options for select fields
const exchanges = ['Binance', 'Bybit', 'Kucoin', 'Coinbase', 'Kraken']
const strategies = [
  'Scalping',
  'Trend Following',
  'Grid',
  'DCA',
  'Martingale',
  'Arbitrage'
]
const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']
const orderTypes = ['Market', 'Limit', 'Stop-Limit', 'OCO', 'Trailing Stop']
const indicatorsList = [
  'RSI',
  'MACD',
  'EMA',
  'SMA',
  'Bollinger Bands',
  'Stochastic',
  'Ichimoku Cloud',
  'Parabolic SAR',
  'ADX',
  'CCI',
  'VWAP',
  'Fibonacci Retracement'
]
const notificationEvents = [
  'Trade Open',
  'Trade Close',
  'Profit Alert',
  'Loss Alert',
  'System Error'
]
const loggingLevels = ['Debug', 'Info', 'Warning', 'Error']

// Configuration state
const config = ref({
  apiKey: '',
  apiSecret: '',
  exchange: 'Binance',
  testnet: true,
  binanceSpecific: { subAccount: '' },
  symbol: '',
  strategy: '',
  timeframe: '1h',
  orderType: 'Market',
  leverage: 1,
  autoRebalance: false,
  strategyParams: {
    scalpInterval: 5,
    scalpProfitTarget: 0.5,
    trendPeriod: 50,
    trendThreshold: 2,
    gridLevels: 10,
    gridSpacing: 1,
    gridOrderSize: 0.01,
    dcaLevels: 5,
    dcaMultiplier: 2,
    martingaleFactor: 2,
    maxMartingaleSteps: 5,
    arbThreshold: 0.5,
    arbExchanges: ''
  },
  indicators: [] as string[],
  indicatorParams: {
    rsi: { period: 14, overbought: 70, oversold: 30 },
    macd: { fast: 12, slow: 26, signal: 9 },
    ema: { period: 20 },
    sma: { period: 20 },
    bbands: { period: 20, dev: 2 },
    stoch: { k: 14, d: 3, smooth: 3 },
    ichimoku: { tenkan: 9, kijun: 26, senkou: 52 },
    psar: { step: 0.02, max: 0.2 },
    adx: { period: 14 },
    cci: { period: 20 },
    vwap: { period: 14 },
    fib: { levels: '0.236,0.382,0.5,0.618,0.786' }
  },
  signalSource: '',
  webhookUrl: '',
  autoTradeOnSignal: false,
  maxDailyLoss: 5,
  maxOpenTrades: 3,
  positionSize: 10,
  stopLoss: 2,
  takeProfit: 5,
  trailingStop: false,
  trailingStopPercentage: 1,
  hedging: false,
  email: '',
  telegram: '',
  discord: '',
  smsNumber: '',
  notificationEvents: [] as string[],
  backtestStartDate: '',
  backtestEndDate: '',
  initialCapital: 10000,
  enableBacktesting: false,
  apiRateLimit: 60,
  loggingLevel: 'Info',
  autoUpdate: true,
  customScripts: '',
  twoFactorSecret: '',
  ipWhitelist: false,
  allowedIps: '',
  logPath: '/logs/bot.log'
})

// Form validation rules
const rules = {
  required: (v: string) => !!v || 'This field is required',
  requiredIfNotification: (v: string | string[]) =>
    config.value.notificationEvents.length === 0 ||
    !!v ||
    'Required when notifications are enabled',
  requiredIfBacktest: (v: string) =>
    !config.value.enableBacktesting ||
    !!v ||
    'Required when backtesting is enabled',
  requiredIf2FA: (v: string) => !!v || '2FA Secret is required',
  positiveNumber: (v: number | string) =>
    (v !== '' && Number(v) > 0) || 'Must be a positive number',
  percentage: (v: number | string) =>
    (v !== '' && Number(v) >= 0 && Number(v) <= 100) ||
    'Must be between 0 and 100',
  validSymbol: (v: string) =>
    /^[A-Z0-9]+$/i.test(v) || 'Invalid trading pair format',
  validUrl: (v: string) =>
    !v || /^https?:\/\/[^\s$.?#].[^\s]*$/.test(v) || 'Invalid URL format',
  validUrlIfFilled: (v: string) =>
    !v || /^https?:\/\/[^\s$.?#].[^\s]*$/.test(v) || 'Invalid URL format',
  phoneIfFilled: (v: string) =>
    !v || /^\+?[1-9]\d{1,14}$/.test(v) || 'Invalid phone number format',
  validIps: (v: string) =>
    !v ||
    /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(,\s*|$))+$/.test(v) ||
    'Invalid IP format',
  validDate: (v: string) =>
    !v || /^\d{4}-\d{2}-\d{2}$/.test(v) || 'Invalid date format',
  dateAfterStart: (v: string) => {
    if (!config.value.backtestStartDate || !v) return true
    return (
      new Date(v) > new Date(config.value.backtestStartDate) ||
      'End date must be after start date'
    )
  },
  validFibLevels: (v: string) => {
    if (!v) return true
    const levels = v.split(',').map(Number)
    return (
      levels.every(n => !isNaN(n) && n >= 0 && n <= 1) ||
      'Fib levels must be between 0 and 1'
    )
  }
}

// Form error messages
const formErrors = ref({
  apiKey: [] as string[],
  apiSecret: [] as string[],
  exchange: [] as string[],
  symbol: [] as string[],
  strategy: [] as string[],
  timeframe: [] as string[],
  orderType: [] as string[],
  leverage: [] as string[],
  scalpInterval: [] as string[],
  scalpProfitTarget: [] as string[],
  trendPeriod: [] as string[],
  trendThreshold: [] as string[],
  gridLevels: [] as string[],
  gridSpacing: [] as string[],
  gridOrderSize: [] as string[],
  dcaLevels: [] as string[],
  dcaMultiplier: [] as string[],
  martingaleFactor: [] as string[],
  maxMartingaleSteps: [] as string[],
  arbThreshold: [] as string[],
  arbExchanges: [] as string[],
  rsiPeriod: [] as string[],
  rsiOverbought: [] as string[],
  rsiOversold: [] as string[],
  macdFast: [] as string[],
  macdSlow: [] as string[],
  macdSignal: [] as string[],
  emaPeriod: [] as string[],
  smaPeriod: [] as string[],
  bbandsPeriod: [] as string[],
  bbandsDev: [] as string[],
  stochK: [] as string[],
  stochD: [] as string[],
  stochSmooth: [] as string[],
  ichimokuTenkan: [] as string[],
  ichimokuKijun: [] as string[],
  ichimokuSenkou: [] as string[],
  psarStep: [] as string[],
  psarMax: [] as string[],
  adxPeriod: [] as string[],
  cciPeriod: [] as string[],
  vwapPeriod: [] as string[],
  fibLevels: [] as string[],
  signalSource: [] as string[],
  webhookUrl: [] as string[],
  maxDailyLoss: [] as string[],
  maxOpenTrades: [] as string[],
  positionSize: [] as string[],
  stopLoss: [] as string[],
  takeProfit: [] as string[],
  trailingStopPercentage: [] as string[],
  email: [] as string[],
  telegram: [] as string[],
  discord: [] as string[],
  smsNumber: [] as string[],
  notificationEvents: [] as string[],
  backtestStartDate: [] as string[],
  backtestEndDate: [] as string[],
  initialCapital: [] as string[],
  apiRateLimit: [] as string[],
  loggingLevel: [] as string[],
  customScripts: [] as string[],
  twoFactorSecret: [] as string[],
  allowedIps: [] as string[],
  logPath: [] as string[]
})

// Snackbar for notifications
const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// Loading states
const isSaving = ref(false)
const isBacktesting = ref(false)

// Computed property to check if all forms are valid
const allValid = computed(() => {
  return (
    validExchange.value &&
    validTradingBasic.value &&
    validStrategyParams.value &&
    validOrderMgmt.value &&
    validIndicatorsSelect.value &&
    validIndicatorsParams.value &&
    validSignals.value &&
    validRisk.value &&
    validNotify.value &&
    validBacktest.value &&
    validAdvanced.value &&
    validSecurity.value
  )
})

// Watch for tab changes to validate forms
watch(mainTab, async () => {
  await validateAllForms()
})

watch(strategySubTab, () => {
  if (formTradingBasic.value) formTradingBasic.value.validate()
  if (formStrategyParams.value) formStrategyParams.value.validate()
  if (formOrderMgmt.value) formOrderMgmt.value.validate()
})

watch(indicatorsSubTab, () => {
  if (formIndicatorsSelect.value) formIndicatorsSelect.value.validate()
  if (formIndicatorsParams.value) formIndicatorsParams.value.validate()
  if (formSignals.value) formSignals.value.validate()
})

// Validate all forms
const validateAllForms = async () => {
  const forms = [
    formExchange,
    formTradingBasic,
    formStrategyParams,
    formOrderMgmt,
    formIndicatorsSelect,
    formIndicatorsParams,
    formSignals,
    formRisk,
    formNotify,
    formBacktest,
    formAdvanced,
    formSecurity
  ]
  for (const form of forms) {
    if (form.value) {
      await form.value.validate()
    }
  }
}

// Methods
const saveConfig = async () => {
  await validateAllForms()
  if (!allValid.value) {
    snackbar.value = {
      show: true,
      message: 'Please correct errors in all tabs before saving.',
      color: 'error'
    }
    return
  }
  isSaving.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    snackbar.value = {
      show: true,
      message: 'Configuration saved successfully!',
      color: 'success'
    }
  } catch (error) {
    snackbar.value = {
      show: true,
      message: 'Failed to save configuration. Please try again.',
      color: 'error'
    }
  } finally {
    isSaving.value = false
  }
}

const resetConfig = async () => {
  config.value = {
    apiKey: '',
    apiSecret: '',
    exchange: 'Binance',
    testnet: true,
    binanceSpecific: { subAccount: '' },
    symbol: '',
    strategy: '',
    timeframe: '1h',
    orderType: 'Market',
    leverage: 1,
    autoRebalance: false,
    strategyParams: {
      scalpInterval: 5,
      scalpProfitTarget: 0.5,
      trendPeriod: 50,
      trendThreshold: 2,
      gridLevels: 10,
      gridSpacing: 1,
      gridOrderSize: 0.01,
      dcaLevels: 5,
      dcaMultiplier: 2,
      martingaleFactor: 2,
      maxMartingaleSteps: 5,
      arbThreshold: 0.5,
      arbExchanges: ''
    },
    indicators: [],
    indicatorParams: {
      rsi: { period: 14, overbought: 70, oversold: 30 },
      macd: { fast: 12, slow: 26, signal: 9 },
      ema: { period: 20 },
      sma: { period: 20 },
      bbands: { period: 20, dev: 2 },
      stoch: { k: 14, d: 3, smooth: 3 },
      ichimoku: { tenkan: 9, kijun: 26, senkou: 52 },
      psar: { step: 0.02, max: 0.2 },
      adx: { period: 14 },
      cci: { period: 20 },
      vwap: { period: 14 },
      fib: { levels: '0.236,0.382,0.5,0.618,0.786' }
    },
    signalSource: '',
    webhookUrl: '',
    autoTradeOnSignal: false,
    maxDailyLoss: 5,
    maxOpenTrades: 3,
    positionSize: 10,
    stopLoss: 2,
    takeProfit: 5,
    trailingStop: false,
    trailingStopPercentage: 1,
    hedging: false,
    email: '',
    telegram: '',
    discord: '',
    smsNumber: '',
    notificationEvents: [],
    backtestStartDate: '',
    backtestEndDate: '',
    initialCapital: 10000,
    enableBacktesting: false,
    apiRateLimit: 60,
    loggingLevel: 'Info',
    autoUpdate: true,
    customScripts: '',
    twoFactorSecret: '',
    ipWhitelist: false,
    allowedIps: '',
    logPath: '/logs/bot.log'
  }
  await validateAllForms()
  snackbar.value = {
    show: true,
    message: 'Configuration reset to defaults.',
    color: 'info'
  }
}

const runBacktest = async () => {
  await validateAllForms()
  if (!validBacktest.value) {
    snackbar.value = {
      show: true,
      message: 'Please correct backtest settings before running.',
      color: 'error'
    }
    return
  }
  isBacktesting.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    snackbar.value = {
      show: true,
      message:
        'Backtest completed successfully! Results would be displayed here.',
      color: 'success'
    }
  } catch (error) {
    snackbar.value = {
      show: true,
      message: 'Backtest failed. Please try again.',
      color: 'error'
    }
  } finally {
    isBacktesting.value = false
  }
}
</script>

<style scoped>
/* Global Container */
.v-container {
  background-color: #f8fafc;
  min-height: 100vh;
}

/* Card Styling */
.v-card {
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

/* Card Title */
.v-card-title {
  background: linear-gradient(90deg, #1976d2, #1565c0);
  letter-spacing: 0.5px;
}

/* Vertical Tabs */
.vertical-tabs {
  display: flex;
  flex-direction: column;
  background-color: #1976d2;
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  min-height: 100%;
}

.v-slide-group__content {
  flex-direction: column !important;
  align-items: stretch; /* cho mỗi tab full width */
}

.vertical-tabs .v-tab {
  flex-direction: column;
  justify-content: flex-start;
  text-transform: none;
  letter-spacing: 0.5px;
  font-weight: 500;
  padding: 12px 16px;
  color: rgba(255, 255, 255, 0.8);
  transition: all 0.3s ease;
}

.vertical-tabs .v-tab:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.vertical-tabs .v-tab--active {
  background-color: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-weight: 600;
}

/* Sub Tabs */
.vertical-sub-tabs .v-tab {
  justify-content: flex-start;
  text-transform: none;
  font-weight: 500;
  padding: 8px 16px;
  color: #374151;
  transition: all 0.3s ease;
}

.vertical-sub-tabs .v-tab:hover {
  background-color: #f1f5f9;
}

.vertical-sub-tabs .v-tab--active {
  background-color: #e3f2fd;
  color: #1976d2;
  font-weight: 600;
}

/* Tab Content */
.v-tabs-items {
  background-color: transparent;
}

/* Form Elements */
.v-subheader {
  padding-left: 0;
  margin-bottom: 16px;
}

.v-text-field,
.v-select,
.v-textarea {
  margin-bottom: 12px;
}

.v-switch {
  margin: 12px 0;
}

/* Expansion Panels */
.v-expansion-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 12px;
  background-color: #ffffff;
}

.v-expansion-panel-header {
  font-weight: 500;
  color: #1976d2;
}

/* Buttons */
.v-btn {
  text-transform: none;
  font-weight: 500;
  letter-spacing: 0.5px;
  border-radius: 8px;
  padding: 8px 16px;
}

.v-btn--disabled {
  opacity: 0.6;
}

/* Snackbar */
.v-snackbar {
  z-index: 1000;
}

/* Responsive Design */
@media (max-width: 960px) {
  .vertical-tabs {
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .vertical-tabs .v-tab {
    min-width: 120px;
    padding: 8px 12px;
  }

  .vertical-sub-tabs {
    flex-direction: row;
    overflow-x: auto;
  }

  .vertical-sub-tabs .v-tab {
    min-width: 100px;
    padding: 6px 12px;
  }
}

@media (max-width: 600px) {
  .v-card-title {
    font-size: 1.25rem;
  }

  .v-subheader {
    font-size: 1rem;
  }
}
</style>

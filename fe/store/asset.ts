export const useAssetStore = defineStore('asset', () => {
  const { $apis } = useNuxtApp()

  const adminWallet = ref<{
    metamask: string
  }>()

  const lastClaim = ref<{
    amount: number
    claimedAt: string
    createdAt: string
    id: number
    updatedAt: string
    userId: number
  }>()

  const asset = ref<{
    id: number
    totalUsdt: number
    totalDoka: number
  }>()

  async function getAdminWallet() {
    const result = await $apis.doka.get('assets/admin-wallet').json()

    adminWallet.value = {
      metamask: result?.metamask
    }
  }

  async function getLastClaim() {
    const result = await $apis.doka.get('assets/last-claim').json()
    lastClaim.value = result
    return result
  }

  async function saveManualTransaction(txId: string, network: string) {
    const result = await $apis.doka
      .post('assets/manual-deposit', {
        json: {
          txId,
          network
        }
      })
      .json()
    return result
  }

  async function swapDoka(value: number) {
    const result = await $apis.doka
      .post('assets/swap-doka', {
        json: {
          fromToken: 'usdt',
          value: Number(value)
        }
      })
      .json()
    console.log(result)
  }

  async function claimToken() {
    const result = await $apis.doka.post('assets/claim').json()
    lastClaim.value = { ...result, isClaiming: true }
    return result
  }

  async function getListTier() {
    const result = await $apis.doka.post('assets/claim').json()
    lastClaim.value = { ...result, isClaiming: true }
    return result
  }

  async function getAsset() {
    const result = await $apis.doka.get('user/asset').json()
    asset.value = { ...result }
    return result
  }
  return {
    lastClaim,
    asset,
    adminWallet,
    getLastClaim,
    getAdminWallet,
    saveManualTransaction,
    claimToken,
    getListTier,
    getAsset,
    swapDoka
  }
})

import { InvoiceItem } from '~/store/booking-detail'

export function calculateTotalAmountInfo (
  invoiceItems: Array<InvoiceItem & { subtotalType: number }>,
  initValue = 0,
  taxRate = 10
) {
  const {
    totalAmountWithoutTax,
    unroundedTotalTaxAmount,
    unroundedTotalAmount
  } = invoiceItems.reduce(
    (amount, invoice) => {
      const { subtotalWithoutTaxAmount, subtotalType } = invoice

      const subTaxAmount =
        subtotalType !== subtotalTypes.nonTaxable.value
          ? (Number(subtotalWithoutTaxAmount) * taxRate) / 100
          : 0
      const subTotalAmount = Number(subtotalWithoutTaxAmount) + subTaxAmount

      return {
        totalAmountWithoutTax:
          amount.totalAmountWithoutTax + Number(subtotalWithoutTaxAmount),
        unroundedTotalTaxAmount: amount.unroundedTotalTaxAmount + subTaxAmount,
        unroundedTotalAmount: amount.unroundedTotalAmount + subTotalAmount
      }
    },
    {
      totalAmountWithoutTax: Math.floor(initValue),
      unroundedTotalTaxAmount: (Math.floor(initValue) * taxRate) / 100,
      unroundedTotalAmount:
        Math.floor(initValue) + (Math.floor(initValue) * taxRate) / 100
    }
  )

  return {
    totalAmountWithoutTax,
    totalTaxAmount: Math.floor(unroundedTotalTaxAmount),
    totalAmount: Math.floor(unroundedTotalAmount)
  }
}

export function calculateServiceFee (
  invoiceItems: Array<InvoiceItem & { subtotalType: number }>,
  taxRate = serviceFeeTaxRate
) {
  return Math.floor(
    (invoiceItems.reduce((totalAmount, invoice) => {
      const { subtotalType, subtotalWithoutTaxAmount } = invoice

      if (subtotalType === subtotalTypes.serviceFee.value) {
        totalAmount = totalAmount + Number(subtotalWithoutTaxAmount)
      }

      return totalAmount
    }, 0) *
      taxRate) /
      100
  )
}

export function formatAmount (amount?: string | number, defaultValue = 0) {
  if (!amount || !isPositiveNumber(String(amount))) {
    return defaultValue
  }
  return Number(amount)
}

function formatPrice (price: number): string {
  return new Intl.NumberFormat('ja-JP').format(price)
}

function isNotEmpty (value: string) {
  return !!value
}

function isKana (value: string) {
  // eslint-disable-next-line no-irregular-whitespace
  return /^[ァ-ンｧ-ﾝﾞﾟー 　]+$/.test(value)
}

function isNumeric (string: string): boolean {
  if (typeof string !== 'string') {
    return false
  }
  return !isNaN(+string) && !isNaN(parseFloat(string))
}

export const isPositiveNumber = (string: string): boolean => {
  return /^\d+$/.test(string)
}

function isInteger (string: string): boolean {
  return /^[0-9]+$/.test(string)
}

function isPostalCode (string: string): boolean {
  return /^[0-9]{3}-?[0-9]{4}$/.test(string)
}

function isDashNumber (value: string) {
  return !value || /^[\d-]+$/.test(value)
}

function isEmail (string: string) {
  return /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(string)
}

function isHalfWidth (string: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\u0000-\u00FF｡-ﾟ]*$/.test(string)
}

export {
  formatPrice,
  isNotEmpty,
  isKana,
  isNumeric,
  isInteger,
  isPostalCode,
  isDashNumber,
  isEmail,
  isHalfWidth
}

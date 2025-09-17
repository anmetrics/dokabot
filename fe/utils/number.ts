function isMax (max: number) {
  return (value: string) => {
    return !value || value.length <= max
  }
}
function isMaxIncludeDash (max: number) {
  return (value: string) => {
    if (!value) {
      return true
    }
    value = value.replaceAll('-', '')
    return !!value && value.length <= max
  }
}

export { isMax, isMaxIncludeDash }

function generateConstants (data: any) {
  return {
    ...data,
    valueLabelList: Object.keys(data).map(key => data[key]),
    labelList: Object.keys(data).map(key => data[key].label),
    labelOf: (value: any) => {
      const key = Object.keys(data).find(key => data[key]?.value === value)
      return key ? data[key].label : undefined
    },
    valueOf: (label: string) => {
      const key = Object.keys(data).find(key => data[key]?.label === label)
      return key ? data[key].value : undefined
    }
  }
}

export { generateConstants }

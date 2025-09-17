export function generateModel (modelSettings: any) {
  return Object.keys(modelSettings).reduce((model: any, key: string) => {
    const setting = modelSettings[key]
    if (setting.path) {
      return {
        ...model,
        [key]: useField(setting.path, undefined, {
          initialValue: setting.initialValue ?? null,
          validateOnValueUpdate: setting.validateOnValueUpdate ?? false
        })
      }
    }
    return {
      ...model,
      [key]: useField(key, undefined, {
        initialValue: setting.initialValue ?? null,
        validateOnValueUpdate: setting.validateOnValueUpdate ?? false
      })
    }
  }, {})
}

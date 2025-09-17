type Obj = { [key: string | number]: any };

function sanitizeObject (rawObject: Obj): object {
  const clonedObject: Obj = {}

  Object.keys(rawObject).forEach((key) => {
    if (Array.isArray(rawObject[key]) && !rawObject[key].length) {
      return
    }
    if (rawObject[key] || typeof rawObject[key] === 'number' || typeof rawObject[key] === 'boolean') {
      clonedObject[key] = rawObject[key]
    }
  })
  return clonedObject
}

export { sanitizeObject }

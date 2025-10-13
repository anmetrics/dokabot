export default function keyMirror<T extends object>(
  obj: T,
): { [K in keyof T]: K } {
  if (!(obj instanceof Object && !Array.isArray(obj))) {
    throw new Error('keyMirror(...): Argument must be an object.');
  }

  const ret: any = {};
  for (const key in obj) {
    // eslint-disable-next-line no-prototype-builtins
    if (!obj.hasOwnProperty(key)) {
      continue;
    }

    ret[key] = key;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return ret;
}

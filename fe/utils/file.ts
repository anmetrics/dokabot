function downloadFile (file: BlobPart, fileName: string): void {
  const url = URL.createObjectURL(new Blob([file]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', decodeURI(fileName))
  document.body.appendChild(link)
  link.click()
}

export { downloadFile }

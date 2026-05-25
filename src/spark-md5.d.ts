declare module 'spark-md5' {
  interface SparkMd5ArrayBuffer {
    hash(buffer: ArrayBufferLike, raw?: boolean): string
  }

  interface SparkMd5Static {
    ArrayBuffer: SparkMd5ArrayBuffer
  }

  const SparkMD5: SparkMd5Static

  export default SparkMD5
}

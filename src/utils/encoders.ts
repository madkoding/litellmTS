import { getEncoding } from 'js-tiktoken';

let _encoder: ReturnType<typeof getEncoding> | null = null;

export function getEncoder(): ReturnType<typeof getEncoding> {
  _encoder ??= getEncoding('cl100k_base');
  return _encoder;
}

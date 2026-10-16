import * as tf from '@tensorflow/tfjs';
import { Buffer } from 'buffer';

class PlatformReactNative {
  fetch(path: any, init: any) {
    return fetch(path, init);
  }
  now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }
  encode(text: string, encoding: string = 'utf-8') {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text);
    }
    return new Uint8Array(Buffer.from(text, 'utf-8'));
  }
  decode(bytes: Uint8Array, encoding: string = 'utf-8') {
    if (!bytes || bytes.length === 0) return '';
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder(encoding).decode(bytes);
    }
    return Buffer.from(bytes).toString('utf-8');
  }
  isTypedArray(a: any) {
    return ArrayBuffer.isView(a) && !(a instanceof DataView);
  }
  setTimeoutCustom(functionRef: Function, delay: number) {
    setTimeout(functionRef, delay);
  }
}

export function initTFPlatform() {
  try {
    if (!tf.env().platform || tf.env().platformName !== 'react-native') {
      tf.setPlatform('react-native', new PlatformReactNative() as any);
    }
  } catch (err) {
    console.warn('⚠️ Platform initialization notice:', err);
  }
}

// Auto-initialize immediately
initTFPlatform();


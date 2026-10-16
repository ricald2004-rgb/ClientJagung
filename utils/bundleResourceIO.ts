import { io } from '@tensorflow/tfjs';
import { Buffer } from 'buffer';
import './tfPlatform';
import { shard1Base64, shard2Base64, shard3Base64 } from '../assets/model/shardsBase64';

/**
 * Expo-native offline bundleResourceIO implementation.
 * Uses embedded base64 weight shards to guarantee 100% offline,
 * instant, and reliable loading on all Android APK standalone builds
 * without requiring native file-system resolution or external downloads.
 */
export function bundleResourceIO(modelJson: any, _modelWeights?: any[]) {
  if (typeof modelJson !== 'object') {
    throw new Error('modelJson must be an object (from require(...))');
  }

  return {
    load: async () => {
      const modelArtifacts = Object.assign({}, modelJson);
      if (modelJson.weightsManifest && modelJson.weightsManifest.length > 0) {
        modelArtifacts.weightSpecs = modelJson.weightsManifest[0].weights;
      }
      delete (modelArtifacts as any).weightsManifest;
      delete (modelArtifacts as any).weightManifest;

      const b1 = Buffer.from(shard1Base64, 'base64');
      const b2 = Buffer.from(shard2Base64, 'base64');
      const b3 = Buffer.from(shard3Base64, 'base64');

      const weightsDataArray = [
        b1.buffer.slice(b1.byteOffset, b1.byteOffset + b1.byteLength),
        b2.buffer.slice(b2.byteOffset, b2.byteOffset + b2.byteLength),
        b3.buffer.slice(b3.byteOffset, b3.byteOffset + b3.byteLength),
      ];

      modelArtifacts.weightData = io.concatenateArrayBuffers(weightsDataArray);
      return modelArtifacts;
    },
  };
}

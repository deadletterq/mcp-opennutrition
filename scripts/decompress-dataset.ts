import * as fs from 'fs';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as yauzl from 'yauzl';

const DATASET_ZIP = path.join(process.cwd(), 'data', 'opennutrition-dataset-2025.1.zip');
const OUTPUT_DIR = path.join(process.cwd(), 'data_local_temp');

async function decompressDataset() {
  console.log('Decompressing dataset...');
  
  return new Promise<void>((resolve, reject) => {
    yauzl.open(DATASET_ZIP, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!zipfile) {
        reject(new Error('Failed to open zip file'));
        return;
      }

      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          zipfile.readEntry();
        } else {
          // File entry
          const outputPath = path.join(OUTPUT_DIR, entry.fileName);
          const outputDir = path.dirname(outputPath);
          
          // Ensure output directory exists
          fs.mkdirSync(outputDir, { recursive: true });
          
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(err);
              return;
            }
            
            if (!readStream) {
              reject(new Error('Failed to open read stream'));
              return;
            }
            
            const writeStream = createWriteStream(outputPath);
            
            pipeline(readStream, writeStream)
              .then(() => {
                console.log(`Extracted: ${entry.fileName}`);
                zipfile.readEntry();
              })
              .catch(reject);
          });
        }
      });
      
      zipfile.on('end', () => {
        console.log('Dataset decompressed successfully!');
        resolve();
      });
      
      zipfile.on('error', reject);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  decompressDataset().catch(console.error);
}

export { decompressDataset };
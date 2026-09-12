import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
for (const mode of ['space','comic']) {
 await sharp(fileURLToPath(new URL(`./nova-artwork/${mode}.svg`,import.meta.url)))
  .webp({quality:92,alphaQuality:100,effort:6})
  .toFile(fileURLToPath(new URL(`../public/bots/nova/${mode}-body.webp`,import.meta.url)));
}
console.log('Rendered cached Nova backgrounds. Eyes and motion remain live in CosmicOrb.');

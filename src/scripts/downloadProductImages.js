import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import colors from 'colors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const productsDir = path.join(rootDir, 'public/images/products');

// Sample image URLs (using placeholder images)
const imageUrls = {
    'protein-powder.jpg': 'https://images.unsplash.com/photo-1593097135639-1b2e0e4a1d3c?w=500&h=500&fit=crop',
    'yoga-mat.jpg': 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=500&h=500&fit=crop',
    'fitness-tracker.jpg': 'https://images.unsplash.com/photo-1576243345690-4e4b79b63288?w=500&h=500&fit=crop',
    'gym-shorts.jpg': 'https://images.unsplash.com/photo-1562183241-b937e95585b6?w=500&h=500&fit=crop',
    'resistance-bands.jpg': 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?w=500&h=500&fit=crop',
    'bcaa.jpg': 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&h=500&fit=crop',
    'water-bottle.jpg': 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&h=500&fit=crop',
    'compression-tights.jpg': 'https://images.unsplash.com/photo-1552902865-b72c31c8cfd6?w=500&h=500&fit=crop'
};

// Function to download an image
const downloadImage = (url, filename) => {
    return new Promise((resolve, reject) => {
        const filePath = path.join(productsDir, filename);
        const file = fs.createWriteStream(filePath);

        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => {}); // Delete the file if there's an error
            reject(err);
        });
    });
};

// Main function to download all images
const downloadAllImages = async () => {
    try {
        // Create products directory if it doesn't exist
        if (!fs.existsSync(productsDir)) {
            fs.mkdirSync(productsDir, { recursive: true });
        }

        console.log(colors.yellow('Downloading product images...'));

        // Download all images
        for (const [filename, url] of Object.entries(imageUrls)) {
            await downloadImage(url, filename);
            console.log(colors.green(`Downloaded ${filename}`));
        }

        console.log(colors.green('All images downloaded successfully!'));
    } catch (error) {
        console.error(colors.red(`Error downloading images: ${error.message}`));
    }
};

// Run the script
downloadAllImages(); 
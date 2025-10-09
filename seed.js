import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

// --- Configuration ---
const API_URL = 'http://localhost:3000/api/upload';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_FOLDER_PATH = path.join(__dirname, 'seed');
// This should be a valid UUID from your 'notebooks' table.
// You can create a notebook manually in the app first and copy its ID here.
const TARGET_NOTEBOOK_ID = 'your-target-notebook-id-here'; 

async function seedDatabase() {
  console.log('--- Starting Database Seeding ---');

  if (TARGET_NOTEBOOK_ID === 'your-target-notebook-id-here') {
    console.error('\x1b[31m%s\x1b[0m', 'ERROR: Please replace "your-target-notebook-id-here" with a real notebook ID from your database.');
    console.log('\x1b[33m%s\x1b[0m', 'To get a notebook ID:');
    console.log('1. Go to http://localhost:3000 and create a new notebook');
    console.log('2. Check your Supabase notebooks table for the ID');
    console.log('3. Replace the TARGET_NOTEBOOK_ID in this script');
    return;
  }

  try {
    const files = fs.readdirSync(SEED_FOLDER_PATH).filter(file => file.toLowerCase().endsWith('.pdf'));

    if (files.length === 0) {
      console.warn('\x1b[33m%s\x1b[0m', 'No PDF files found in the "seed" directory.');
      console.log('Please add PDF files to the "seed" folder and run again.');
      return;
    }

    console.log(`Found ${files.length} PDF(s) to seed: ${files.join(', ')}`);

    for (const file of files) {
      console.log(`\nProcessing "${file}"...`);
      const filePath = path.join(SEED_FOLDER_PATH, file);
      const fileStream = fs.createReadStream(filePath);

      const formData = new FormData();
      formData.append('file', fileStream);
      formData.append('notebookId', TARGET_NOTEBOOK_ID);

      console.log('  📤 Uploading...');
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`Failed to upload ${file}: ${result.error || response.statusText}`);
      }

      console.log(`  ✅ Successfully processed and embedded "${file}"`);
      console.log(`  📄 Document ID: ${result.documentId}`);
      
      // Small delay between uploads to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n🎉 --- Seeding Complete! ---');
    console.log('All PDFs have been uploaded and processed with embeddings.');

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '\n❌ --- Seeding Failed ---');
    console.error('Error details:', error.message);
    
    if (error.code === 'ENOENT') {
      console.log('\x1b[33m%s\x1b[0m', 'Make sure your Next.js app is running with: npm run dev');
    }
  }
}

// Check if the seed folder exists
if (!fs.existsSync(SEED_FOLDER_PATH)) {
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: "seed" folder not found!');
  console.log('Creating the seed folder for you...');
  fs.mkdirSync(SEED_FOLDER_PATH);
  console.log('✅ Created "seed" folder. Please add your PDF files there and run again.');
  process.exit(0);
}

seedDatabase();
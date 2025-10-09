// Sample data for seeding new user accounts with demo notebooks and documents

export interface SampleDocument {
  filename: string;
  content_text: string; // Base64 encoded PDF content or placeholder
  status: string;
}

export interface SampleNotebook {
  title: string;
  description: string;
  documents: SampleDocument[];
}

// Sample notebooks with realistic academic content
export const sampleNotebooks: SampleNotebook[] = [
  {
    title: "KEPH 101 - Fundamentals",
    description: "Essential foundational material for KEPH 101 course. This comprehensive guide covers all the fundamental concepts you need to master.",
    documents: [
      {
        filename: "KEPH101_Complete_Guide.pdf",
        content_text: "", // Will be replaced with actual base64 content
        status: "ready"
      }
    ]
  },
  {
    title: "Study Materials Collection", 
    description: "Additional study resources and supplementary materials to complement your main coursework and enhance understanding.",
    documents: [
      {
        filename: "KEPH101_Study_Notes.pdf",
        content_text: "", // Copy of the same PDF with different name for variety
        status: "ready"
      },
      {
        filename: "Practice_Problems.pdf", 
        content_text: "", // Can be same content or you can add more PDFs later
        status: "ready"
      }
    ]
  },
  {
    title: "Reference Library",
    description: "Essential reference materials and additional readings to deepen your understanding of the subject matter.",
    documents: [
      {
        filename: "KEPH101_Reference.pdf",
        content_text: "", // Same content reused
        status: "ready"
      },
      {
        filename: "Quick_Reference_Guide.pdf",
        content_text: "",
        status: "ready"
      },
      {
        filename: "Supplementary_Reading.pdf",
        content_text: "",
        status: "ready"
      }
    ]
  }
];

// Function to create sample notebook with documents for a user
export async function createSampleNotebook(
  supabase: any,
  userId: string,
  sampleNotebook: SampleNotebook
) {
  try {
    // 1. Create the notebook
    const { data: notebook, error: notebookError } = await supabase
      .from('notebooks')
      .insert({
        user_id: userId,
        title: sampleNotebook.title,
        description: sampleNotebook.description,
        source_count: sampleNotebook.documents.length,
        is_featured: false
      })
      .select()
      .single();

    if (notebookError) throw notebookError;

    // 2. Create the documents for this notebook
    const documentsToInsert = sampleNotebook.documents.map(doc => ({
      notebook_id: notebook.id,
      user_id: userId,
      filename: doc.filename,
      content_text: doc.content_text,
      status: doc.status,
      file_size: Math.floor(Math.random() * 500000) + 100000, // Random file size between 100KB-600KB
    }));

    const { error: documentsError } = await supabase
      .from('documents')
      .insert(documentsToInsert);

    if (documentsError) throw documentsError;

    console.log(`✅ Created sample notebook: ${sampleNotebook.title}`);
    return notebook;
  } catch (error) {
    console.error(`❌ Error creating sample notebook ${sampleNotebook.title}:`, error);
    throw error;
  }
}

// Function to seed all sample notebooks for a new user
export async function seedSampleNotebooks(supabase: any, userId: string) {
  try {
    console.log(`🌱 Seeding sample notebooks for user: ${userId}`);
    
    const createdNotebooks = [];
    
    for (const sampleNotebook of sampleNotebooks) {
      const notebook = await createSampleNotebook(supabase, userId, sampleNotebook);
      createdNotebooks.push(notebook);
      
      // Add small delay between creations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Successfully created ${createdNotebooks.length} sample notebooks`);
    return createdNotebooks;
  } catch (error) {
    console.error('❌ Error seeding sample notebooks:', error);
    throw error;
  }
}

// Check if user needs sample data (has no notebooks)
export async function shouldSeedSampleData(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('notebooks')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    
    if (error) throw error;
    
    // Return true if user has no notebooks (needs sample data)
    return !data || data.length === 0;
  } catch (error) {
    console.error('Error checking if user needs sample data:', error);
    return false;
  }
}
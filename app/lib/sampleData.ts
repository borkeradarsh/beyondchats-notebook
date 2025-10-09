// Sample data for seeding new user accounts with demo notebooks and documents
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SampleDocument {
  filename: string;
  content_text: string; // Actual text content for processing
  status: string;
}

export interface SampleNotebook {
  title: string;
  description: string;
  documents: SampleDocument[];
}

// Helper function to chunk text into smaller pieces (matches upload route logic)
const chunkText = (text: string, chunkSize = 500, overlap = 50): string[] => {
  const chunks: string[] = [];
  if (!text) return chunks;
  
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    const chunk = text.slice(i, i + chunkSize);
    if (chunk.trim().length > 50) {
      chunks.push(chunk.trim());
    }
  }
  
  return chunks;
};

// Generate embeddings using Google AI (matches upload route)
async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('Google AI API key not found');
  }
  
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// Sample notebooks with realistic academic content
export const sampleNotebooks: SampleNotebook[] = [
  {
    title: "KEPH 107 - Fundamentals",
    description: "Essential foundational material for KEPH 107 course. This comprehensive guide covers all the fundamental concepts you need to master.",
    documents: [
      {
        filename: "KEPH107_Complete_Guide.pdf",
        content_text: `KEPH 107 - Fundamentals of Health Economics and Policy

Chapter 1: Introduction to Health Economics
Health economics is a branch of economics concerned with issues related to efficiency, effectiveness, value and behavior in the production and consumption of health and healthcare. It is an applied field of study that allows for the systematic and rigorous examination of the problems faced in promoting health for all.

Key Concepts in Health Economics:
1. Scarcity and Resource Allocation
Healthcare resources are limited while healthcare needs and wants are unlimited. This fundamental economic problem requires societies to make choices about how to allocate scarce resources efficiently.

2. Opportunity Cost
The value of the next best alternative forgone when making a choice. In healthcare, this might be the alternative treatments or programs that cannot be funded when resources are allocated to a particular intervention.

3. Economic Evaluation
Methods used to assess the value for money of healthcare interventions, including cost-effectiveness analysis, cost-utility analysis, and cost-benefit analysis.

Chapter 2: Healthcare Markets and Market Failures
Healthcare markets differ significantly from traditional markets due to several characteristics:

Information Asymmetry:
Patients typically have less information about their health conditions and treatment options than healthcare providers. This asymmetry can lead to supplier-induced demand and moral hazard.

Externalities:
Healthcare consumption can have positive externalities (vaccination protecting others) or negative externalities (antibiotic resistance). These external effects are not typically reflected in market prices.

Public Goods Aspects:
Some health interventions, such as disease surveillance systems or health promotion campaigns, have characteristics of public goods that markets may underprovide.

Chapter 3: Health Insurance and Risk
Health insurance serves several important functions:

Risk Pooling:
Insurance allows individuals to pool their health risks, spreading the financial burden of healthcare costs across a large group.

Moral Hazard:
The tendency for individuals with insurance to consume more healthcare services because they do not bear the full cost of their consumption.

Adverse Selection:
The tendency for individuals with higher health risks to be more likely to purchase insurance, potentially leading to market failure.

Chapter 4: Healthcare Financing Systems
Different countries have adopted various approaches to financing healthcare:

Tax-Based Systems:
Healthcare funded primarily through general taxation, as seen in the UK's National Health Service.

Social Insurance Systems:
Healthcare funded through mandatory contributions to social insurance funds, common in European countries like Germany and France.

Private Insurance Systems:
Healthcare funded primarily through private insurance, with varying degrees of government regulation and subsidy.

Chapter 5: Cost-Effectiveness Analysis
Cost-effectiveness analysis (CEA) is a method of economic evaluation that compares the relative costs and outcomes of different interventions:

Quality-Adjusted Life Years (QALYs):
A measure that combines quantity and quality of life, often used as the outcome measure in cost-effectiveness analysis.

Incremental Cost-Effectiveness Ratio (ICER):
The additional cost per additional unit of outcome when comparing two interventions.

Threshold Values:
Decision-making bodies often use threshold values (such as $50,000 per QALY) to determine whether interventions represent good value for money.

Chapter 6: Health Technology Assessment
Health Technology Assessment (HTA) is a systematic evaluation of the properties and effects of health technologies:

Clinical Effectiveness:
Assessment of whether a technology works under ideal conditions and in routine practice.

Economic Evaluation:
Assessment of whether a technology represents good value for money compared to existing alternatives.

Ethical and Social Considerations:
Assessment of the broader implications of adopting new technologies, including equity and ethical concerns.

Chapter 7: Global Health Economics
Health economics principles apply globally, but developing countries face unique challenges:

Disease Burden:
The pattern of disease in developing countries often differs from developed countries, with a higher burden of infectious diseases and maternal/child health issues.

Resource Constraints:
Developing countries typically have fewer resources available for healthcare, making efficient allocation even more critical.

International Health Initiatives:
Global health initiatives and foreign aid play important roles in health system strengthening and disease control in developing countries.

Conclusion:
Health economics provides essential tools for understanding and improving health system performance. By applying economic principles to healthcare, we can make more informed decisions about resource allocation, policy design, and intervention prioritization. The ultimate goal is to maximize health outcomes given available resources, ensuring that health systems serve their populations effectively and efficiently.

This foundation in health economics principles will serve as the basis for more advanced topics in health policy analysis, healthcare management, and health system evaluation covered in subsequent courses.`,
        status: "ready"
      }
    ]
  }
];

// Enhanced function to create sample notebook with document chunks
export async function createSampleNotebook(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
  sampleNotebook: SampleNotebook
) {
  try {
    console.log(`📚 Creating sample notebook: ${sampleNotebook.title}`);

    // Step 1: Create notebook
    const { data: notebook, error: notebookError } = await supabase
      .from('notebooks')
      .insert({
        title: sampleNotebook.title,
        description: sampleNotebook.description,
        user_id: userId,
      })
      .select()
      .single();

    if (notebookError) throw notebookError;

    // Step 2: Create documents with chunks and embeddings
    for (const doc of sampleNotebook.documents) {
      console.log(`📄 Processing document: ${doc.filename}`);

      // Create document record
      const { data: document, error: documentError } = await supabase
        .from('documents')
        .insert({
          notebook_id: notebook.id,
          user_id: userId,
          filename: doc.filename,
          content_text: doc.content_text,
          status: doc.status,
          file_size: doc.content_text.length, // Use text length as file size
        })
        .select()
        .single();

      if (documentError) throw documentError;

      // Step 3: Create document chunks with embeddings
      console.log(`🔍 Creating chunks for: ${doc.filename}`);
      const chunks = chunkText(doc.content_text);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          // Generate embedding for this chunk
          console.log(`🧠 Generating embedding for chunk ${i + 1}/${chunks.length}`);
          const embedding = await generateEmbedding(chunk);

          // Insert chunk with embedding
          const { error: chunkError } = await supabase
            .from('document_chunks')
            .insert({
              document_id: document.id,
              chunk_index: i,
              content: chunk,
              embedding: embedding,
            });

          if (chunkError) {
            console.error(`❌ Error inserting chunk ${i + 1}:`, chunkError);
            throw chunkError;
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (embeddingError) {
          console.error(`❌ Error processing chunk ${i + 1}:`, embeddingError);
          throw embeddingError;
        }
      }

      console.log(`✅ Created ${chunks.length} chunks for ${doc.filename}`);
    }

    console.log(`✅ Successfully created sample notebook: ${sampleNotebook.title}`);
    return notebook;
  } catch (error) {
    console.error(`❌ Error creating sample notebook ${sampleNotebook.title}:`, error);
    throw error;
  }
}

// Function to seed all sample notebooks for a new user
export async function seedSampleNotebooks(supabase: any, userId: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    console.log(`🌱 Seeding sample notebooks for user: ${userId}`);
    
    const createdNotebooks = [];
    
    for (const sampleNotebook of sampleNotebooks) {
      const notebook = await createSampleNotebook(supabase, userId, sampleNotebook);
      createdNotebooks.push(notebook);
      
      // Add delay between notebooks to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`✅ Successfully created ${createdNotebooks.length} sample notebooks with document chunks`);
    return createdNotebooks;
  } catch (error) {
    console.error('❌ Error seeding sample notebooks:', error);
    throw error;
  }
}

// Check if user needs sample data (has no notebooks)
export async function shouldSeedSampleData(supabase: any, userId: string): Promise<boolean> { // eslint-disable-line @typescript-eslint/no-explicit-any
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
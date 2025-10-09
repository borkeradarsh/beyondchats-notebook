import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
        };
      };
      notebooks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          thumbnail_url: string | null;
          source_count: number;
          created_at: string;
          updated_at: string;
          is_featured: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          thumbnail_url?: string | null;
          source_count?: number;
          created_at?: string;
          updated_at?: string;
          is_featured?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          thumbnail_url?: string | null;
          source_count?: number;
          created_at?: string;
          updated_at?: string;
          is_featured?: boolean;
        };
      };
      documents: {
        Row: {
          id: string;
          notebook_id: string;
          user_id: string;
          filename: string;
          file_path: string;
          file_size: number;
          content_text: string;
          page_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          notebook_id: string;
          user_id: string;
          filename: string;
          file_path: string;
          file_size: number;
          content_text: string;
          page_count: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          notebook_id?: string;
          user_id?: string;
          filename?: string;
          file_path?: string;
          file_size?: number;
          content_text?: string;
          page_count?: number;
          created_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          notebook_id: string;
          user_id: string;
          role: 'user' | 'assistant';
          content: string;
          citations: unknown | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          notebook_id: string;
          user_id: string;
          role: 'user' | 'assistant';
          content: string;
          citations?: unknown | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          notebook_id?: string;
          user_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          citations?: unknown | null;
          created_at?: string;
        };
      };
    };
  };
};
-- BeyondChats Database Setup for Supabase
-- Run these commands in your Supabase SQL Editor

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notebooks table
CREATE TABLE IF NOT EXISTS public.notebooks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    source_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_featured BOOLEAN DEFAULT FALSE
);

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    content_text TEXT NOT NULL,
    page_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    citations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles table
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for notebooks table
CREATE POLICY "Users can view own notebooks" ON public.notebooks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notebooks" ON public.notebooks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notebooks" ON public.notebooks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notebooks" ON public.notebooks
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for documents table
CREATE POLICY "Users can view own documents" ON public.documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON public.documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON public.documents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON public.documents
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages table
CREATE POLICY "Users can view own chat messages" ON public.chat_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages" ON public.chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat messages" ON public.chat_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages" ON public.chat_messages
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON public.notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_created_at ON public.notebooks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_notebook_id ON public.documents(notebook_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_notebook_id ON public.chat_messages(notebook_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notebooks_updated_at BEFORE UPDATE ON public.notebooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update source count when documents are added/removed
CREATE OR REPLACE FUNCTION update_notebook_source_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.notebooks 
        SET source_count = source_count + 1 
        WHERE id = NEW.notebook_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.notebooks 
        SET source_count = source_count - 1 
        WHERE id = OLD.notebook_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update source count
CREATE TRIGGER trigger_update_source_count_insert
    AFTER INSERT ON public.documents
    FOR EACH ROW EXECUTE FUNCTION update_notebook_source_count();

CREATE TRIGGER trigger_update_source_count_delete
    AFTER DELETE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION update_notebook_source_count();

-- Enable realtime for chat messages (optional, for real-time chat updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Sample data for testing (Class XI Physics notebooks from keph1dd folder)
-- You can run this after setting up your first user account
/*
INSERT INTO public.notebooks (user_id, title, description, is_featured, source_count) VALUES
    ('your-user-id-here', 'Class XI Physics - Chapter 1', 'Physical World and Measurement', true, 1),
    ('your-user-id-here', 'Class XI Physics - Chapter 2', 'Kinematics', true, 1),
    ('your-user-id-here', 'Class XI Physics - Chapter 3', 'Laws of Motion', true, 1),
    ('your-user-id-here', 'Class XI Physics - Chapter 4', 'Work, Energy and Power', false, 1),
    ('your-user-id-here', 'Class XI Physics - Chapter 5', 'Motion of System of Particles', false, 1);
*/

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fojzducauupfdsbqeqad.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvanpkdWNhdXVwZmRzYnFlcWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyODE0ODYsImV4cCI6MjA1NDg1NzQ4Nn0.vj5UVei7HuT3tmKTGXM6X99xwKU_i0Ryl6_cvE0s0Rw';

export const supabase = createClient(supabaseUrl, supabaseKey);

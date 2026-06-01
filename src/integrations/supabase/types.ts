export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      bot_settings: {
        Row: {
          id: string
          user_id: string
          bot_type: 'whatsapp' | 'instagram'
          is_active: boolean
          offline_message: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bot_type: 'whatsapp' | 'instagram'
          is_active?: boolean
          offline_message?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bot_type?: 'whatsapp' | 'instagram'
          is_active?: boolean
          offline_message?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_schedules: {
        Row: {
          id: string
          user_id: string
          bot_type: 'whatsapp' | 'instagram'
          day_of_week: number
          is_active: boolean
          start_time: string
          end_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bot_type: 'whatsapp' | 'instagram'
          day_of_week: number
          is_active?: boolean
          start_time?: string
          end_time?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bot_type?: 'whatsapp' | 'instagram'
          day_of_week?: number
          is_active?: boolean
          start_time?: string
          end_time?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      instagram_settings: {
        Row: {
          id: string
          user_id: string
          is_active: boolean
          offline_message: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          is_active?: boolean
          offline_message?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          is_active?: boolean
          offline_message?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      instagram_schedules: {
        Row: {
          id: string
          user_id: string
          day_of_week: number
          is_active: boolean
          start_time: string
          end_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          day_of_week: number
          is_active?: boolean
          start_time?: string
          end_time?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          day_of_week?: number
          is_active?: boolean
          start_time?: string
          end_time?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          id: string
          user_id: string
          company_name: string
          company_phone: string
          company_address: string
          company_website: string
          company_description: string
          ai_base_prompt: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_name?: string
          company_phone?: string
          company_address?: string
          company_website?: string
          company_description?: string
          ai_base_prompt?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          company_phone?: string
          company_address?: string
          company_website?: string
          company_description?: string
          ai_base_prompt?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      special_events: {
        Row: {
          id: string
          title: string
          description: string
          prompt_text: string
          start_date: string
          end_date: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          prompt_text: string
          start_date: string
          end_date: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          prompt_text?: string
          start_date?: string
          end_date?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      bot_type: 'whatsapp' | 'instagram'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

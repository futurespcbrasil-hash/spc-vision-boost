export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      clientes_indicados: {
        Row: {
          cidade: string | null
          cnpj: string | null
          comissao_gerada: number
          created_at: string
          data_indicacao: string
          email: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          parceiro_id: string
          produto_vendido: string | null
          razao_social: string
          responsavel: string | null
          telefone: string | null
          updated_at: string
          user_id: string
          valor_venda: number
          whatsapp: string | null
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          comissao_gerada?: number
          created_at?: string
          data_indicacao?: string
          email?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          parceiro_id: string
          produto_vendido?: string | null
          razao_social: string
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
          valor_venda?: number
          whatsapp?: string | null
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          comissao_gerada?: number
          created_at?: string
          data_indicacao?: string
          email?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          parceiro_id?: string
          produto_vendido?: string | null
          razao_social?: string
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
          valor_venda?: number
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_indicados_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_spc"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_email: string | null
          created_at: string
          description: string | null
          end_datetime: string
          google_event_id: string | null
          id: string
          meet_link: string | null
          start_datetime: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_email?: string | null
          created_at?: string
          description?: string | null
          end_datetime: string
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          start_datetime: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_email?: string | null
          created_at?: string
          description?: string | null
          end_datetime?: string
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          start_datetime?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      imported_tables: {
        Row: {
          created_at: string
          id: string
          name: string
          products: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          products?: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          products?: Json
        }
        Relationships: []
      }
      kanban_stages: {
        Row: {
          color: string
          created_at: string
          funnel: string
          id: string
          key: string
          label: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          funnel?: string
          id?: string
          key: string
          label: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          funnel?: string
          id?: string
          key?: string
          label?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          company: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          funnel: string
          id: string
          interactions: Json | null
          name: string
          observations: string | null
          origin: string | null
          phone: string | null
          product: string | null
          status: string
          type: string
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          company?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          funnel?: string
          id?: string
          interactions?: Json | null
          name: string
          observations?: string | null
          origin?: string | null
          phone?: string | null
          product?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          company?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          funnel?: string
          id?: string
          interactions?: Json | null
          name?: string
          observations?: string | null
          origin?: string | null
          phone?: string | null
          product?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      metas_faturamento: {
        Row: {
          created_at: string
          faturamento: number | null
          id: string
          ordem: number
          ponto_zero: number
          referencia: string
          salario: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          faturamento?: number | null
          id?: string
          ordem: number
          ponto_zero?: number
          referencia: string
          salario?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          faturamento?: number | null
          id?: string
          ordem?: number
          ponto_zero?: number
          referencia?: string
          salario?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notas: {
        Row: {
          concluido: boolean
          conteudo: string | null
          cor: string
          created_at: string
          data_lembrete: string | null
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          conteudo?: string | null
          cor?: string
          created_at?: string
          data_lembrete?: string | null
          id?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          conteudo?: string | null
          cor?: string
          created_at?: string
          data_lembrete?: string | null
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      parceiros_spc: {
        Row: {
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          percentual_comissao: number
          razao_social: string
          responsavel: string | null
          status: string
          tipo_parceiro: Database["public"]["Enums"]["tipo_parceiro_spc"]
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          percentual_comissao?: number
          razao_social: string
          responsavel?: string | null
          status?: string
          tipo_parceiro?: Database["public"]["Enums"]["tipo_parceiro_spc"]
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          percentual_comissao?: number
          razao_social?: string
          responsavel?: string | null
          status?: string
          tipo_parceiro?: Database["public"]["Enums"]["tipo_parceiro_spc"]
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_events: {
        Row: {
          created_at: string
          date: string
          done: boolean
          id: string
          lead_id: string | null
          lead_name: string
          note: string | null
          time: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          done?: boolean
          id?: string
          lead_id?: string | null
          lead_name: string
          note?: string | null
          time: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          done?: boolean
          id?: string
          lead_id?: string | null
          lead_name?: string
          note?: string | null
          time?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendas_indicadas: {
        Row: {
          cliente_indicado_id: string
          created_at: string
          data_venda: string
          id: string
          observacoes: string | null
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          cliente_indicado_id: string
          created_at?: string
          data_venda?: string
          id?: string
          observacoes?: string | null
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          cliente_indicado_id?: string
          created_at?: string
          data_venda?: string
          id?: string
          observacoes?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_indicadas_cliente_indicado_id_fkey"
            columns: ["cliente_indicado_id"]
            isOneToOne: false
            referencedRelation: "clientes_indicados"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "vendedor" | "gestor"
      tipo_parceiro_spc:
        | "contabilidade"
        | "software"
        | "certificadora"
        | "consultoria"
        | "outro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["vendedor", "gestor"],
      tipo_parceiro_spc: [
        "contabilidade",
        "software",
        "certificadora",
        "consultoria",
        "outro",
      ],
    },
  },
} as const

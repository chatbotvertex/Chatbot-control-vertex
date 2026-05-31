import { config } from "dotenv";
config(); // Carregar variáveis de ambiente

console.log("🔧 Variáveis de ambiente carregadas:");
console.log("VITE_SUPABASE_URL:", process.env.VITE_SUPABASE_URL);
console.log("VITE_SUPABASE_PUBLISHABLE_KEY:", process.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "Presente" : "Ausente");

async function testDatabaseConnection() {
  // Importar dinamicamente após carregar variáveis
  const { supabase } = await import("@/integrations/supabase/client");

  console.log("🔍 Testando conexão com Supabase...");

  try {
    // Test 1: Verificar conexão básica
    console.log("📡 Testando conexão básica...");
    const { data: connectionTest, error: connectionError } = await supabase
      .from("bot_settings")
      .select("count", { count: "exact", head: true });

    if (connectionError) {
      console.error("❌ Erro de conexão:", connectionError);
      return;
    }
    console.log("✅ Conexão básica OK");

    // Test 2: Verificar se tabelas existem
    console.log("📋 Verificando tabelas...");

    const tables = ["bot_settings", "bot_schedules", "instagram_settings", "instagram_schedules"] as const;

    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        if (error) {
          console.error(`❌ Tabela ${table} não existe ou tem erro:`, error);
        } else {
          console.log(`✅ Tabela ${table} existe`);
        }
      } catch (err) {
        console.error(`❌ Erro ao verificar tabela ${table}:`, err);
      }
    }

    // Test 3: Verificar dados existentes
    console.log("📊 Verificando dados existentes...");

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*");

        if (error) {
          console.error(`❌ Erro ao consultar ${table}:`, error);
        } else {
          console.log(`✅ ${table}: ${data?.length || 0} registros`);
        }
      } catch (err) {
        console.error(`❌ Erro ao consultar ${table}:`, err);
      }
    }

    // Test 4: Simular operação de salvar
    console.log("💾 Testando operação de salvar...");

    try {
      // Teste WhatsApp settings
      const { error: whatsappError } = await supabase
        .from("bot_settings")
        .update({ is_active: true, offline_message: "Teste" })
        .eq("bot_type", "whatsapp");

      if (whatsappError) {
        console.error("❌ Erro ao salvar WhatsApp settings:", whatsappError);
      } else {
        console.log("✅ WhatsApp settings salvo com sucesso");
      }

      // Teste Instagram settings - verificar se existe primeiro
      const { data: existingInstagram } = await supabase
        .from("instagram_settings")
        .select("id")
        .maybeSingle();

      let instagramError;
      if (existingInstagram?.id) {
        const { error } = await supabase
          .from("instagram_settings")
          .update({ is_active: true, offline_message: "Teste Instagram" })
          .eq("id", existingInstagram.id);
        instagramError = error;
      } else {
        // Tentar INSERT sem RLS primeiro (usando service role key se disponível)
        console.log("🔄 Tentando INSERT no instagram_settings...");
        const { error } = await supabase
          .from("instagram_settings")
          .insert({ is_active: true, offline_message: "Teste Instagram" });
        instagramError = error;

        if (instagramError && instagramError.code === '42501') {
          console.log("⚠️ RLS bloqueando INSERT. Tentando UPDATE em registro existente...");
          // Se RLS está bloqueando, talvez haja um registro que não conseguimos ver
          const { error: updateError } = await supabase
            .from("instagram_settings")
            .update({ is_active: true, offline_message: "Teste Instagram" })
            .limit(1); // Tentar atualizar qualquer registro
          instagramError = updateError;
        }
      }

      if (instagramError) {
        console.error("❌ Erro ao salvar Instagram settings:", instagramError);
        console.log("💡 Dica: As migrações podem não ter sido aplicadas. Execute 'supabase db reset' ou verifique as políticas RLS.");
      } else {
        console.log("✅ Instagram settings salvo com sucesso");
      }

    } catch (err) {
      console.error("❌ Erro geral na operação de salvar:", err);
    }

  } catch (err) {
    console.error("❌ Erro geral:", err);
  }
}

// Executar o teste
testDatabaseConnection().catch(console.error);
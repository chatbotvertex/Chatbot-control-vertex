import { config } from "dotenv";
config(); // Carregar variáveis de ambiente

console.log("🔧 Aplicando correções críticas ao banco de dados...");

async function applyMigrations() {
  // Importar dinamicamente após carregar variáveis
  const { supabase } = await import("@/integrations/supabase/client");

  try {
    console.log("📋 Aplicando correções nas tabelas Instagram...");

    // Verificar se já existem dados
    const { data: existingSettings } = await supabase
      .from("instagram_settings")
      .select("*");

    const { data: existingSchedules } = await supabase
      .from("instagram_schedules")
      .select("*");

    console.log(`📊 Dados existentes - Settings: ${existingSettings?.length || 0}, Schedules: ${existingSchedules?.length || 0}`);

    if ((existingSettings?.length || 0) === 0) {
      console.log("🔄 Inserindo dados iniciais no instagram_settings...");

      // Tentar inserir dados iniciais
      const { error: insertError } = await supabase
        .from("instagram_settings")
        .insert({
          offline_message: "Estou ausente no momento. Retornarei em breve."
        });

      if (insertError) {
        console.error("❌ Erro ao inserir settings:", insertError);
      } else {
        console.log("✅ Settings inseridos com sucesso");
      }
    }

    if ((existingSchedules?.length || 0) === 0) {
      console.log("🔄 Inserindo dados iniciais no instagram_schedules...");

      const scheduleData = [];
      for (let day = 0; day <= 6; day++) {
        scheduleData.push({
          day_of_week: day,
          is_active: false,
          start_time: "09:00:00",
          end_time: "18:00:00"
        });
      }

      const { error: scheduleError } = await supabase
        .from("instagram_schedules")
        .insert(scheduleData);

      if (scheduleError) {
        console.error("❌ Erro ao inserir schedules:", scheduleError);
      } else {
        console.log("✅ Schedules inseridos com sucesso");
      }
    }

    // Verificar resultado final
    const { data: finalSettings } = await supabase
      .from("instagram_settings")
      .select("*");

    const { data: finalSchedules } = await supabase
      .from("instagram_schedules")
      .select("*");

    console.log(`📊 Dados finais - Settings: ${finalSettings?.length || 0}, Schedules: ${finalSchedules?.length || 0}`);

    if ((finalSettings?.length || 0) > 0 && (finalSchedules?.length || 0) > 0) {
      console.log("✅ Correções aplicadas com sucesso!");
      console.log("🎉 Agora você pode testar a aplicação - o erro de salvar deve estar corrigido.");
    } else {
      console.log("⚠️ Correções podem não ter sido aplicadas completamente.");
      console.log("💡 Tente executar o script SQL manualmente no Supabase Dashboard:");
      console.log("   Arquivo: fix_migrations.sql");
    }

  } catch (error) {
    console.error("❌ Erro geral:", error);
  }
}

// Executar as correções
applyMigrations().catch(console.error);
import { MessageCircle } from "lucide-react";
import BotConfig from "@/components/BotConfig";

const BotSettings = () => (
  <BotConfig
    platform="whatsapp"
    title="Bot do WhatsApp"
    description="Configure horários e mensagens do bot do WhatsApp"
    icon={MessageCircle}
  />
);

export default BotSettings;

import { Instagram } from "lucide-react";
import BotConfig from "@/components/BotConfig";

const InstagramBot = () => (
  <BotConfig
    platform="instagram"
    title="Bot do Instagram"
    description="Configure horários e mensagens do bot do Instagram"
    icon={Instagram}
  />
);

export default InstagramBot;

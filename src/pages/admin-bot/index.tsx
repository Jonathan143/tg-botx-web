import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandConfigPanel } from "./components/command-config-panel";
import { ManagementBotPanel } from "./components/management-bot-panel";

export default function AdminBotPage() {
  return (
    <>
      <PageHeader
        title="Telegram 管理 Bot"
        description="管理 Bot 运行状态、签到积分范围、指令菜单、一次性绑定码和已授权的私聊用户。"
      />
      <Tabs defaultValue="bindings" className="w-full">
        <TabsList>
          <TabsTrigger value="bindings">绑定与状态</TabsTrigger>
          <TabsTrigger value="commands">指令配置</TabsTrigger>
        </TabsList>
        <TabsContent value="bindings" className="pt-4">
          <ManagementBotPanel />
        </TabsContent>
        <TabsContent value="commands" className="pt-4">
          <CommandConfigPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}

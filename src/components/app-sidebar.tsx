import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Search,
  Flame,
  Filter,
  CalendarDays,
  MessageSquare,
  History,
  Brain,
  Zap,
  UserPlus,
  Target,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useBackendStatus } from "@/hooks/use-backend-status";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Membros Extraídos", url: "/membros", icon: Users },
  { title: "Buscar Grupos", url: "/buscar-grupos", icon: Search },
  { title: "Banco de Leads", url: "/leads", icon: Target },
  { title: "Adicionar Membros", url: "/adicionar-membros", icon: UserPlus },
  { title: "Aquecimento", url: "/aquecimento", icon: Flame },
  { title: "Filtro de Números", url: "/filtro-numeros", icon: Filter },
  { title: "Campanhas", url: "/campanhas", icon: CalendarDays },
  { title: "Auto-Resposta", url: "/auto-resposta", icon: MessageSquare },
  { title: "Histórico", url: "/historico", icon: History },
  { title: "Memória", url: "/memoria", icon: Brain },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const backend = useBackendStatus();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar className="border-r border-sidebar-border" collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg animate-pulse-glow">
            <Zap className="h-5 w-5 text-white" fill="white" />
          </div>
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <div className="text-lg font-bold gradient-text">AgentZap</div>
            <div className="text-[11px] text-muted-foreground">WhatsApp Manager</div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu>
          {items.map((item) => {
            const active = pathname === item.url;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className={
                    active
                      ? "relative bg-gradient-to-r from-[oklch(0.65_0.24_295/25%)] to-[oklch(0.68_0.27_340/15%)] text-foreground shadow-[inset_0_0_0_1px_oklch(0.65_0.24_295/30%)]"
                      : "hover:bg-sidebar-accent"
                  }
                >
                  <Link to={item.url}>
                    <item.icon className={active ? "h-4 w-4 text-primary" : "h-4 w-4"} />
                    <span className="font-medium">{item.title}</span>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_oklch(0.65_0.24_295)]" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Gestão de Instâncias WhatsApp
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

import { lazy, Suspense } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRoutingRules, useDeleteRoutingRule, useUpdateRoutingRule } from "@/hooks/useRoutingRules";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";

const ChatAnalyticsDashboard = lazy(() =>
  import("@/components/admin/chat/ChatAnalyticsDashboard").then((m) => ({ default: m.ChatAnalyticsDashboard }))
);
const RoutingRulesDialog = lazy(() =>
  import("@/components/admin/chat/RoutingRulesDialog").then((m) => ({ default: m.RoutingRulesDialog }))
);

const AnalyticsLoader = () => (
  <div className="p-6 text-muted-foreground">Loading analytics...</div>
);

const AdminChatAnalytics = () => {
  const { data: routingRules } = useRoutingRules();
  const deleteRule = useDeleteRoutingRule();
  const updateRule = useUpdateRoutingRule();

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
        <AdminHeader />

        <div className="flex-1 overflow-auto">
          <Tabs defaultValue="analytics" className="w-full">
            <div className="border-b border-white/10 px-4 sm:px-6 pt-3 sm:pt-4 pb-2">
              <TabsList variant="admin" className="text-xs sm:text-sm">
                <TabsTrigger variant="admin" value="analytics" className="text-xs sm:text-sm">Analytics</TabsTrigger>
                <TabsTrigger variant="admin" value="routing" className="text-xs sm:text-sm">Routing Rules</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="analytics" className="m-0 animate-fade-in">
              <Suspense fallback={<AnalyticsLoader />}>
                <ChatAnalyticsDashboard />
              </Suspense>
            </TabsContent>

            <TabsContent value="routing" className="m-0 p-4 sm:p-6 animate-fade-in">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h2 className="text-lg sm:text-xl font-semibold">Auto-Assignment Rules</h2>
                  <Suspense fallback={null}>
                    <RoutingRulesDialog />
                  </Suspense>
                </div>

                <div className="grid gap-3 sm:gap-4">
                  {routingRules && routingRules.length > 0 ? (
                    routingRules.map((rule) => (
                      <Card key={rule.id}>
                        <CardHeader>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                              <CardTitle className="text-base sm:text-lg">{rule.name}</CardTitle>
                              <Badge variant={rule.is_active ? "default" : "secondary"} className="text-xs">
                                {rule.is_active ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">Priority: {rule.priority}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={rule.is_active}
                                onCheckedChange={(checked) =>
                                  updateRule.mutate({ id: rule.id, is_active: checked })
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteRule.mutate(rule.id)}
                                className="h-8 w-8 sm:h-10 sm:w-10"
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                            {rule.category_id && <p>Category: Specified</p>}
                            {rule.assign_to_role && <p>Assign to: {rule.assign_to_role}</p>}
                            {rule.assign_to_user_id && <p>Assign to: Specific user</p>}
                            {!rule.category_id && !rule.assign_to_role && !rule.assign_to_user_id && (
                              <p>Default rule: Auto-assign to least loaded available member</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card>
                      <CardContent className="py-6 sm:py-8 text-center text-muted-foreground text-sm">
                        No routing rules configured. Create one to enable auto-assignment.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminChatAnalytics;
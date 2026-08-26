"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SlackLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
    <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
    <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522v-2.521zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
    <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.52h-6.313z" fill="#ECB22E"/>
  </svg>
);

const GoogleDriveLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M15.8 4L8.2 4L4.4 10.6L12 10.6L15.8 4Z" fill="#FFC107"/>
    <path d="M11.1 12L7.3 18.6L14.9 18.6L18.7 12L11.1 12Z" fill="#1976D2"/>
    <path d="M19.6 10.6L12 10.6L8.2 17.2L15.8 17.2L19.6 10.6Z" fill="#4CAF50"/>
    <path d="M8.2 4L12 10.6L4.4 10.6L8.2 4Z" fill="#FFC107"/>
    <path d="M4.4 10.6L12 10.6L8.2 17.2L4.4 10.6Z" fill="#1976D2"/>
  </svg>
);

const NotionLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4.822 3.659L19.822 2.159V21.159L4.822 22.659V3.659ZM6.822 6.659V19.659L13.822 18.659V5.659L6.822 6.659Z" />
  </svg>
);

const FigmaLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 28.5C19 33.7467 14.7467 38 9.5 38C4.25329 38 0 33.7467 0 28.5C0 23.2533 4.25329 19 9.5 19C14.7467 19 19 23.2533 19 28.5Z" fill="#0ACF83"/>
    <path d="M0 47.5C0 52.7467 4.25329 57 9.5 57C14.7467 57 19 52.7467 19 47.5V38H9.5C4.25329 38 0 42.2533 0 47.5Z" fill="#1ABCFE"/>
    <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
    <path d="M19 0H28.5C33.7467 0 38 4.25329 38 9.5C38 14.7467 33.7467 19 28.5 19H19V0Z" fill="#FF7262"/>
    <path d="M38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5Z" fill="#A259FF"/>
  </svg>
);

const GithubLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" version="1.1" aria-hidden="true">
    <path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
  </svg>
);

const JiraLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" color="#0052CC">
    <path d="M12.012 11.968l-5.632-5.636 5.632-5.632 5.633 5.632-5.633 5.636zM11.996 23.3l-5.62-5.617 5.62-5.62 5.621 5.62-5.621 5.617zM2.843 14.509L-2.776 8.89 2.843 3.27l5.618 5.62-5.618 5.619zM21.173 14.509l-5.62-5.619 5.62-5.62 5.621 5.62-5.621 5.619z"/>
  </svg>
);

const initialIntegrations = [
  {
    id: "slack",
    name: "Slack",
    logo: SlackLogo,
    active: true,
    lastSync: "2 minutes ago",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    logo: GoogleDriveLogo,
    active: true,
    lastSync: "5 minutes ago",
  },
  {
    id: "notion",
    name: "Notion",
    logo: NotionLogo,
    active: false,
    lastSync: "Failed 1 hour ago",
  },
  {
    id: "github",
    name: "GitHub",
    logo: GithubLogo,
    active: true,
    lastSync: "Just now",
  },
  {
    id: "figma",
    name: "Figma",
    logo: FigmaLogo,
    active: false,
    lastSync: "Never",
  },
  {
    id: "jira",
    name: "Jira",
    logo: JiraLogo,
    active: true,
    lastSync: "10 minutes ago",
  },
];

export default function IntegrationsSection() {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleActive = (id: string, active: boolean) => {
    setIntegrations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, active } : item))
    );
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-full">
      <header className="px-2 pt-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-black">
          Integrations
        </h1>
        <p className="mt-1 text-[15px] text-graphite">
          View and manage your connected services.
        </p>
      </header>

      <section className="px-2 pb-8">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[300px] font-medium h-12 pl-4 text-ink-black">Service</TableHead>
                <TableHead className="font-medium h-12 text-ink-black">Status</TableHead>
                <TableHead className="font-medium h-12 text-right pr-6 text-ink-black">Last Sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((integration) => (
                <React.Fragment key={integration.id}>
                  <TableRow 
                    className="cursor-pointer hover:bg-muted/50 transition-colors border-b"
                    onClick={() => toggleExpand(integration.id)}
                  >
                    <TableCell className="py-4 pl-4">
                      <div className="flex items-center gap-3">
                        <button className="text-graphite hover:text-ink-black">
                          {expanded[integration.id] ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                        <integration.logo className="size-5" />
                        <span className="font-medium text-ink-black">{integration.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={integration.active}
                          onCheckedChange={(checked) => toggleActive(integration.id, checked)}
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-slate-200 border-2 border-transparent shadow-sm"
                        />
                        <span className="text-sm text-graphite">
                          {integration.active ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-graphite py-4 text-right pr-6">
                      {integration.lastSync}
                    </TableCell>
                  </TableRow>
                  {expanded[integration.id] && (
                    <TableRow className="bg-muted/20 border-b">
                      <TableCell colSpan={3} className="px-6 py-8">
                        <div className="max-w-xl space-y-5 ml-8">
                          <div>
                            <h4 className="text-sm font-medium mb-1 text-ink-black">Configuration Settings</h4>
                            <p className="text-sm text-graphite">
                              Update authentication details or specific settings for {integration.name}.
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <label className="text-sm font-medium leading-none text-ink-black">API Key</label>
                            <Input placeholder="Enter your API Key..." className="bg-background" />
                          </div>
                          <div className="grid gap-2">
                            <label className="text-sm font-medium leading-none text-ink-black">Workspace URL</label>
                            <Input placeholder="https://..." className="bg-background" />
                          </div>
                          <div className="pt-2">
                            <Button size="sm" className="bg-ink-black text-white hover:bg-ink-black/90 shadow-sm font-medium px-4">
                              Save Configuration
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

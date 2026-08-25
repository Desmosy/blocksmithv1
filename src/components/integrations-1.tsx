import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FigmaConnectCard } from "@/components/figma/FigmaConnectCard";
import { ScanWorkspaceCard } from "@/components/home/ScanWorkspaceCard";
import { InstallCommand } from "@/components/ui/code-block";
import InteractiveHoverButton from "@/components/shadcn-space/button/button-19";

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

const CliLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export default function IntegrationsSection() {
    return (
        <section>
            <div className="py-8">
                <div className="mx-auto max-w-5xl px-4 sm:px-6">
                    <div className="text-left mb-10">
                        <h2 className="text-3xl font-semibold text-[var(--dash-foreground)] tracking-tight">App Connections</h2>
                        <p className="text-[var(--dash-muted-fg)] mt-2">Manage integrations for importing design systems into BlockSmith.</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <IntegrationCard
                            title="Figma"
                            description="Fuse exact Figma structure, rendered frames, and designer annotations."
                            formComponent={<FigmaConnectCard />}>
                            <FigmaLogo className="size-5" />
                        </IntegrationCard>

                        <IntegrationCard
                            title="GitHub"
                            description="Connect your GitHub account to scan repositories for code components."
                            formComponent={<ScanWorkspaceCard />}>
                            <GithubLogo className="text-gray-900 dark:text-gray-100 size-6" />
                        </IntegrationCard>

                        <IntegrationCard
                            title="CLI"
                            description="Scan a repo locally on your machine and push it securely."
                            formComponent={
                              <InstallCommand isGlobal registryUrl="@block-smith/cli && blocksmith scan ./your-repo" />
                            }>
                            <CliLogo className="text-gray-600 dark:text-gray-300 size-5" />
                        </IntegrationCard>
                    </div>
                </div>
            </div>
        </section>
    )
}

const IntegrationCard = ({ title, description, children, formComponent }: { title: string; description: string; children: React.ReactNode; formComponent?: React.ReactNode }) => {
    return (
        <Dialog>
            <Card className="p-6 bg-[var(--dash-surface)] border-[var(--dash-border)] hover:border-[var(--dash-foreground)]/20 transition-colors flex flex-col h-full shadow-sm">
                <div className="relative flex flex-col h-full">
                    <div className="size-10 rounded-xl bg-[var(--dash-muted)] border border-[var(--dash-border)] flex items-center justify-center shrink-0">
                        {children}
                    </div>

                    <div className="space-y-2 py-6 flex-1">
                        <h3 className="text-base font-medium text-[var(--dash-foreground)]">{title}</h3>
                        <p className="text-[var(--dash-muted-fg)] line-clamp-2 text-sm leading-relaxed">{description}</p>
                    </div>

                    <div className="flex gap-3 border-t border-[var(--dash-border)] pt-6 mt-auto">
                        <DialogTrigger asChild>
                            <InteractiveHoverButton text="Connect" className="text-sm border-0 shadow-none hover:bg-[var(--dash-muted)] text-[var(--dash-foreground)] bg-transparent w-full sm:w-auto" />
                        </DialogTrigger>
                    </div>
                </div>
            </Card>
            <DialogContent className="light bg-white text-slate-900 border-slate-200 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-slate-900 font-semibold">Connect {title}</DialogTitle>
                    <DialogDescription className="text-slate-500">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <div className="pt-2">
                    {formComponent ? formComponent : (
                        <p className="text-sm text-slate-600">
                            Authentication and settings for {title} will be configured here.
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

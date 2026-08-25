"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ImportFigmaDialogProps {
  children: React.ReactNode;
}

const ImportFigmaDialog = ({ children }: ImportFigmaDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className='p-6 sm:max-w-lg bg-background border-border'>
        <DialogHeader className='text-left'>
          <DialogTitle className='text-xl text-ink-black'>Import from Figma</DialogTitle>
          <DialogDescription className='text-base text-graphite mt-2'>
            Paste the URL of your Figma file, page, or frame. We will extract the design system, components, and variables into this workspace.
          </DialogDescription>
        </DialogHeader>
        <form className='flex flex-col gap-4 mt-2'>
          <div className='grid gap-3'>
            <Label htmlFor='figma-url' className='text-ink-black'>Figma URL</Label>
            <Input 
              type='url' 
              id='figma-url' 
              name='figma-url' 
              placeholder='https://www.figma.com/file/...' 
              required 
              className='bg-background text-foreground' 
            />
          </div>
          <Button type='submit' className='self-end bg-ink-black text-white hover:bg-ink-black/90 px-6'>
            Import Design System
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ImportFigmaDialog;

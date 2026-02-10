import type { Metadata } from 'next'
import WorkLayoutClient from './WorkLayoutClient'

export const metadata: Metadata = {
  title: 'Unity Work | AI-Powered Work System',
  description: 'An AI work layer that prepares, organizes, and executes work — with human approval.',
}

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return <WorkLayoutClient>{children}</WorkLayoutClient>
}

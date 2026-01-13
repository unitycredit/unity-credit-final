import { redirect } from 'next/navigation'

export default function Home() {
  // Live site: show auth first (landing page removed)
  redirect('/login')
}


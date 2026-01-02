import AdminLoginForm from '@/components/AdminLoginForm'

export const dynamic = 'force-dynamic'

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001f3f] via-[#003d7a] to-[#001f3f] p-8 flex items-center justify-center">
      <AdminLoginForm />
    </div>
  )
}


